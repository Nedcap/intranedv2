import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic';

// 1. Puxa a string da variável de ambiente da Vercel
const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
let credentials: any = {};

if (credentialsEnv) {
  try {
    credentials = JSON.parse(credentialsEnv);
  } catch (err) {
    console.error("Erro ao fazer parse do GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
  }
}

// 2. Inicializa o cliente do BigQuery
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

      const sqlEmpresa = `
        SELECT razao_social 
        FROM \`credito-489113.dados_receita.empresas_master\` 
        WHERE cnpj_basico = @cnpjBasico 
        LIMIT 1
      `;
      const [empresaRes] = await bigquery.query({
        query: sqlEmpresa,
        params: { cnpjBasico }
      });
      
      const razaoSocial = empresaRes.length > 0 ? empresaRes[0].razao_social : `CNPJ Base: ${cnpjBasico}`;

      nodes.push({
        id: `CNPJ-${docLimpo}`,
        position: { x: centerX, y: centerY },
        data: { label: razaoSocial },
        style: {
          backgroundColor: '#2563eb', color: 'white', borderRadius: '50%', width: 100, height: 100,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '10px'
        }
      });

      const sqlSocios = `
        SELECT nome_socio_razao_social, cnpj_cpf_socio, qualificacao_socio
        FROM \`credito-489113.dados_receita.socios_master\`
        WHERE cnpj_basico = @cnpjBasico
      `;
      const [sociosRes] = await bigquery.query({
        query: sqlSocios,
        params: { cnpjBasico }
      });
      
      const angleStep = (2 * Math.PI) / (sociosRes.length || 1);

      sociosRes.forEach((socio: any, index: number) => {
        const angle = index * angleStep;
        
        // Limpa asteriscos para ID imutável
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
          id: `edge-${docLimpo}-${docSocioLimpo || index}`,
          source: `CNPJ-${docLimpo}`, 
          target: idSocio,
          label: `Sócio (Qualif: ${socio.qualificacao_socio || 'NI'})`,
          animated: true, 
          // ⚡ Linhas fluidas e elegantes (tipo bezier padrão, sem travar quinas)
          type: 'default', 
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });

    } else if (tipoBusca === "CPF") {
      
      // Busca o CNPJ completo real unificado da tabela master
      const sqlEmpresas = `
        SELECT e.cnpj, s.cnpj_basico, e.razao_social, s.nome_socio_razao_social
        FROM \`credito-489113.dados_receita.socios_master\` s
        LEFT JOIN \`credito-489113.dados_receita.empresas_master\` e 
          ON s.cnpj_basico = e.cnpj_basico
        WHERE s.cnpj_cpf_socio LIKE CONCAT('%', @docLimpo)
        LIMIT 30
      `;
      const [empresasRes] = await bigquery.query({
        query: sqlEmpresas,
        params: { docLimpo }
      });

      const nomeRealSocio = empresasRes.length > 0 && empresasRes[0].nome_socio_razao_social
        ? empresasRes[0].nome_socio_razao_social
        : `SÓCIO: ***${docLimpo}**`;

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

      const angleStep = (2 * Math.PI) / (empresasRes.length || 1);

      empresasRes.forEach((emp: any, index: number) => {
        const angle = index * angleStep;
        
        // Usa o CNPJ real e completo retornado pelo JOIN do BigQuery
        const cnpjCompleto = emp.cnpj ? emp.cnpj.replace(/\D/g, "") : `${emp.cnpj_basico}000100`;
        const idEmpresa = `CNPJ-${cnpjCompleto}`;

        nodes.push({
          id: idEmpresa,
          position: { x: centerX + Math.cos(angle) * raio, y: centerY + Math.sin(angle) * raio },
          data: { label: emp.razao_social || `CNPJ Base: ${emp.cnpj_basico}` },
          style: {
            backgroundColor: '#2563eb', color: 'white', borderRadius: '50%', width: 90, height: 90,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px'
          }
        });

        edges.push({
          id: `edge-${docLimpo}-${cnpjCompleto}`,
          source: `CPF-${docLimpo}`, 
          target: idEmpresa,
          label: `Participação`, 
          animated: true, 
          // ⚡ Linhas fluidas e elegantes (tipo bezier padrão, sem travar quinas)
          type: 'default', 
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