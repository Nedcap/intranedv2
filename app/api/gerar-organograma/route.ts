import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic';

const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
let credentials: any = {};

if (credentialsEnv) {
  try {
    credentials = JSON.parse(credentialsEnv);
  } catch (err) {
    console.error("Erro no GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
  }
}

const bigquery = new BigQuery({
  projectId: 'credito-489113', 
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key, 
  }
});

// Validação flexível de nome para proteger contra homônimos, permitindo digitações manuais
function validarCorrespondenciaNome(nomeBusca: string, nomeReceita: string): boolean {
  if (!nomeBusca || !nomeReceita) return false;
  
  const n1 = nomeBusca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z\s]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  const n2 = nomeReceita.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z\s]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  
  if (n1 === n2) return true;
  
  if (n2.includes(n1) || n1.includes(n2)) return true;
  
  const tokens1 = n1.split(" ");
  const tokens2 = n2.split(" ");
  
  if (tokens1.length <= 1 || tokens2.length <= 1) return false;
  if (tokens1[0] === tokens2[0] && tokens1[tokens1.length - 1] === tokens2[tokens2.length - 1]) return true;
  
  return false;
}

export async function POST(req: Request) {
  try {
    const { documentoBusca, tipoBusca, nomeSocio } = await req.json();
    if (!documentoBusca || !tipoBusca) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    let docLimpo = String(documentoBusca).replace(/\D/g, "");
    
    // Extrai o miolo de 6 dígitos se o CPF for enviado completo
    if ((tipoBusca === "CPF" || tipoBusca === "PF") && docLimpo.length === 11) {
      docLimpo = docLimpo.substring(3, 9);
    }

    const nodes: any[] = [];
    const edges: any[] = [];
    const centerX = 400, centerY = 300, raio = 250;

    // Se for busca de Empresa (CNPJ ou Sócia PJ)
    if (tipoBusca === "CNPJ" || tipoBusca === "PJ") {
      const cnpjBasico = docLimpo.substring(0, 8);

      const sqlEmpresa = `
        SELECT cnpj, cnpj_basico, razao_social, nome_fantasia, uf, bairro
        FROM \`credito-489113.dados_receita.empresas_master\` 
        WHERE cnpj_basico = @cnpjBasico
      `;
      const [empresaRes] = await bigquery.query({ query: sqlEmpresa, params: { cnpjBasico } });
      
      if (empresaRes.length === 0) {
        return NextResponse.json({ error: "Empresa não localizada." }, { status: 404 });
      }

      const dadosPrincipais = empresaRes[0];
      const listaFiliais = empresaRes.map((emp: any) => ({
        cnpj: emp.cnpj, uf: emp.uf, bairro: emp.bairro,
        nome_fantasia: emp.nome_fantasia || dadosPrincipais.razao_social
      }));

      nodes.push({
        id: `CNPJ-${cnpjBasico}`,
        position: { x: centerX, y: centerY },
        data: { 
          label: dadosPrincipais.razao_social, isMatriz: true,
          totalFiliais: listaFiliais.length, filiais: listaFiliais 
        },
        style: {
          backgroundColor: '#1e40af', color: 'white', borderRadius: '50%', width: 120, height: 120,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '12px',
          border: '4px solid #3b82f6', boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
        }
      });

      const sqlSocios = `
        SELECT nome_socio_razao_social, doc_socio_limpo, tipo_socio, qualificacao_socio
        FROM \`credito-489113.dados_receita.socios_master\`
        WHERE cnpj_basico = @cnpjBasico
      `;
      const [sociosRes] = await bigquery.query({ query: sqlSocios, params: { cnpjBasico } });
      
      const angleStep = (2 * Math.PI) / (sociosRes.length || 1);

      sociosRes.forEach((socio: any, index: number) => {
        const angle = index * angleStep;
        const idSocio = socio.doc_socio_limpo ? `${socio.tipo_socio}-${socio.doc_socio_limpo}` : `NOME-${socio.nome_socio_razao_social}`;

        nodes.push({
          id: idSocio,
          position: { x: centerX + Math.cos(angle) * raio, y: centerY + Math.sin(angle) * raio },
          data: { 
            label: socio.nome_socio_razao_social,
            nomeOriginal: socio.nome_socio_razao_social 
          },
          style: {
            backgroundColor: socio.tipo_socio === 'PJ' ? '#065f46' : '#9d174d', 
            color: 'white', borderRadius: '50%', width: 95, height: 95,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '8px',
            boxShadow: socio.tipo_socio === 'PJ' ? '0 4px 10px rgba(16,185,129,0.2)' : '0 4px 10px rgba(219,39,119,0.2)',
            border: socio.tipo_socio === 'PJ' ? '2px solid #10b981' : '2px solid #f472b6'
          }
        });

        edges.push({
          id: `edge-${cnpjBasico}-${socio.doc_socio_limpo || index}`,
          source: `CNPJ-${cnpjBasico}`, 
          target: idSocio,
          label: `Sócio (${socio.qualificacao_socio || 'NI'})`,
          animated: true, 
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });

    } else if (tipoBusca === "CPF" || tipoBusca === "PF") { 
      const sqlEmpresas = `
        SELECT 
          s.cnpj_basico, 
          MAX(e.razao_social) AS razao_social, 
          MAX(s.nome_socio_razao_social) AS nome_socio_razao_social,
          ARRAY_AGG(STRUCT(e.cnpj, e.uf, e.bairro)) AS todas_as_filiais
        FROM \`credito-489113.dados_receita.socios_master\` s
        LEFT JOIN \`credito-489113.dados_receita.empresas_master\` e 
          ON s.cnpj_basico = e.cnpj_basico
        WHERE s.doc_socio_limpo = @docLimpo 
          AND s.tipo_socio = 'PF'
        GROUP BY s.cnpj_basico
        LIMIT 150
      `;
      const [empresasRes] = await bigquery.query({ query: sqlEmpresas, params: { docLimpo } });

      if (empresasRes.length === 0) return NextResponse.json({ nodes: [], edges: [] });

      let empresasValidadas = empresasRes;
      if (nomeSocio) {
        empresasValidadas = empresasRes.filter((emp: any) => validarCorrespondenciaNome(nomeSocio, emp.nome_socio_razao_social));
      }

      if (empresasValidadas.length === 0) {
        return NextResponse.json({ error: "Vínculos para este homônimo filtrados com segurança." }, { status: 404 });
      }

      const nomeRealSocio = nomeSocio || empresasValidadas[0].nome_socio_razao_social;

      nodes.push({
        id: `PF-${docLimpo}`,
        position: { x: centerX, y: centerY },
        data: { label: `${nomeRealSocio}\n(***${docLimpo}**)` },
        style: {
          backgroundColor: '#9d174d', color: 'white', borderRadius: '50%', width: 105, height: 105,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '8px', whiteSpace: 'pre-wrap',
          border: '3px solid #f472b6', boxShadow: '0 4px 14px rgba(219,39,119,0.3)'
        }
      });

      const angleStep = (2 * Math.PI) / empresasValidadas.length;

      empresasValidadas.forEach((emp: any, index: number) => {
        const angle = index * angleStep;
        const idEmpresa = `CNPJ-${emp.cnpj_basico}`;
        const filiaisValidas = (emp.todas_as_filiais || []).filter((f: any) => f.cnpj !== null);

        nodes.push({
          id: idEmpresa,
          position: { x: centerX + Math.cos(angle) * raio, y: centerY + Math.sin(angle) * raio },
          data: { 
            label: `${emp.razao_social || 'Desconhecida'}\n(${filiaisValidas.length} Unid.)`,
            totalFiliais: filiaisValidas.length, filiais: filiaisValidas
          },
          style: {
            backgroundColor: '#1e40af', color: 'white', borderRadius: '50%', width: 100, height: 100,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '8px',
            whiteSpace: 'pre-wrap', border: filiaisValidas.length > 1 ? '3px double #93c5fd' : '1px solid #3b82f6',
            boxShadow: '0 4px 10px rgba(37,99,235,0.15)'
          }
        });

        edges.push({
          id: `edge-${docLimpo}-${emp.cnpj_basico}`,
          source: `PF-${docLimpo}`, target: idEmpresa,
          label: `Participação`, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });
    }

    return NextResponse.json({ nodes, edges });
  } catch (error: any) {
    console.error("Erro no grafo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}