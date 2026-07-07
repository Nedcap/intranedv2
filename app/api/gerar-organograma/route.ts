import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic';

const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
let credentials: any = {};

if (credentialsEnv) {
  try {
    credentials = JSON.parse(credentialsEnv);
  } catch (err) {
    console.error("Erro ao fazer parse do GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
  }
}

const bigquery = new BigQuery({
  projectId: 'credito-489113',
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key, 
  }
});

export async function POST(req: Request) {
  try {
    const { documentoBusca, tipoBusca } = await req.json();
    if (!documentoBusca || !tipoBusca) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const docLimpo = String(documentoBusca).replace(/\D/g, "");
    const nodes: any[] = [];
    const edges: any[] = [];
    const centerX = 400, centerY = 300, raio = 250;

    if (tipoBusca === "CNPJ") {
      const cnpjBasico = docLimpo.substring(0, 8);

      // ⚡ Busca os dados da Empresa (Tenta pegar a Matriz unificada pelo básico)
      const sqlEmpresa = `
        SELECT cnpj, cnpj_basico, razao_social, nome_fantasia, uf, bairro
        FROM \`credito-489113.dados_receita.empresas_master\` 
        WHERE cnpj_basico = @cnpjBasico
      `;
      const [empresaRes] = await bigquery.query({ query: sqlEmpresa, params: { cnpjBasico } });
      
      if (empresaRes.length === 0) {
        return NextResponse.json({ error: "Empresa não localizada na base master." }, { status: 404 });
      }

      // Separa quem é a matriz (ou usa o primeiro registro como cabeça do nó)
      const dadosPrincipais = empresaRes[0];
      
      // Esquematiza a lista de filiais ocultas para mandar pro front armazenar
      const listaFiliais = empresaRes.map((emp: any) => ({
        cnpj: emp.cnpj,
        uf: emp.uf,
        bairro: emp.bairro,
        nome_fantasia: emp.nome_fantasia || dadosPrincipais.razao_social
      }));

      nodes.push({
        id: `CNPJ-${cnpjBasico}`, // ID unificado pelo básico!
        position: { x: centerX, y: centerY },
        data: { 
          label: dadosPrincipais.razao_social,
          isMatriz: true,
          totalFiliais: listaFiliais.length,
          filiais: listaFiliais // Enviado para renderizar em tabela no front
        },
        style: {
          backgroundColor: '#2563eb', color: 'white', borderRadius: '50%', width: 110, height: 110,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '10px',
          border: '4px solid #1d4ed8'
        }
      });

      // Busca os Sócios vinculados
      const sqlSocios = `
        SELECT nome_socio_razao_social, cnpj_cpf_socio, qualificacao_socio
        FROM \`credito-489113.dados_receita.socios_master\`
        WHERE cnpj_basico = @cnpjBasico
      `;
      const [sociosRes] = await bigquery.query({ query: sqlSocios, params: { cnpjBasico } });
      
      const angleStep = (2 * Math.PI) / (sociosRes.length || 1);

      sociosRes.forEach((socio: any, index: number) => {
        const angle = index * angleStep;
        const docSocioLimpo = socio.cnpj_cpf_socio ? String(socio.cnpj_cpf_socio).replace(/\D/g, "") : "";
        const idSocio = docSocioLimpo ? `CPF-${docSocioLimpo}` : `NOME-${socio.nome_socio_razao_social}`;

        nodes.push({
          id: idSocio,
          position: { x: centerX + Math.cos(angle) * raio, y: centerY + Math.sin(angle) * raio },
          data: { label: socio.nome_socio_razao_social },
          style: {
            backgroundColor: '#db2777', color: 'white', borderRadius: '50%', width: 90, height: 90,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px'
          }
        });

        edges.push({
          id: `edge-${cnpjBasico}-${docSocioLimpo || index}`,
          source: `CNPJ-${cnpjBasico}`, 
          target: idSocio,
          label: `Sócio (Qualif: ${socio.qualificacao_socio || 'NI'})`,
          animated: true, 
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });

    } else if (tipoBusca === "CPF") {
      
      // ⚡ REVOLUÇÃO: Agrupamento Inteligente usando ARRAY_AGG para trazer TODAS as filiais compactadas em 1 única linha!
      const sqlEmpresas = `
        SELECT 
          s.cnpj_basico, 
          MAX(e.razao_social) AS razao_social, 
          MAX(s.nome_socio_razao_social) AS nome_socio_razao_social,
          ARRAY_AGG(STRUCT(e.cnpj, e.uf, e.bairro)) AS todas_as_filiais
        FROM \`credito-489113.dados_receita.socios_master\` s
        LEFT JOIN \`credito-489113.dados_receita.empresas_master\` e 
          ON s.cnpj_basico = e.cnpj_basico
        WHERE s.cnpj_cpf_socio LIKE CONCAT('%', @docLimpo, '%')
        GROUP BY s.cnpj_basico
        LIMIT 100
      `;
      const [empresasRes] = await bigquery.query({ query: sqlEmpresas, params: { docLimpo } });

      if (empresasRes.length === 0) {
        return NextResponse.json({ nodes: [], edges: [] });
      }

      const nomeRealSocio = empresasRes[0].nome_socio_razao_social || `SÓCIO: ***${docLimpo}**`;

      nodes.push({
        id: `CPF-${docLimpo}`,
        position: { x: centerX, y: centerY },
        data: { label: `${nomeRealSocio}\n(***${docLimpo}**)` },
        style: {
          backgroundColor: '#db2777', color: 'white', borderRadius: '50%', width: 100, height: 100,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px',
          whiteSpace: 'pre-wrap'
        }
      });

      const angleStep = (2 * Math.PI) / empresasRes.length;

      empresasRes.forEach((emp: any, index: number) => {
        const angle = index * angleStep;
        const idEmpresa = `CNPJ-${emp.cnpj_basico}`;

        // Filtra nulos caso o LEFT JOIN traga lixo do BigQuery
        const filiaisValidas = (emp.todas_as_filiais || []).filter((f: any) => f.cnpj !== null);

        nodes.push({
          id: idEmpresa,
          position: { x: centerX + Math.cos(angle) * raio, y: centerY + Math.sin(angle) * raio },
          data: { 
            label: `${emp.razao_social}\n(${filiaisValidas.length} Unid.)`,
            totalFiliais: filiaisValidas.length,
            filiais: filiaisValidas
          },
          style: {
            backgroundColor: '#2563eb', color: 'white', borderRadius: '50%', width: 95, height: 95,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px',
            whiteSpace: 'pre-wrap',
            border: filiaisValidas.length > 1 ? '3px double #93c5fd' : 'none'
          }
        });

        edges.push({
          id: `edge-${docLimpo}-${emp.cnpj_basico}`,
          source: `CPF-${docLimpo}`, 
          target: idEmpresa,
          label: `Participação`, 
          animated: true, 
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });
    }

    return NextResponse.json({ nodes, edges });
  } catch (error: any) {
    console.error("Erro na montagem do grafo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}