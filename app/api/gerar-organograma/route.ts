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
        
        // ⚡ A CORREÇÃO DA MÁGICA TÁ AQUI: Limpa os asteriscos (***) da Receita antes de gerar o ID!
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
          source: `CNPJ-${docLimpo}`, target: idSocio,
          label: `Sócio (Qualif: ${socio.qualificacao_socio || 'NI'})`,
          animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });

    } else if (tipoBusca === "CPF") {
      
      nodes.push({
        id: `CPF-${docLimpo}`,
        position: { x: centerX, y: centerY },
        data: { label: `Sócio: ${docLimpo}` },
        style: {
          backgroundColor: '#db2777', color: 'white', borderRadius: '50%', width: 100, height: 100,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px'
        }
      });

      const sqlEmpresas = `
        SELECT s.cnpj_basico, e.razao_social
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

      const angleStep = (2 * Math.PI) / (empresasRes.length || 1);

      empresasRes.forEach((emp: any, index: number) => {
        const angle = index * angleStep;
        const idEmpresa = `CNPJ-${emp.cnpj_basico}000100`;

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
          id: `edge-${docLimpo}-${emp.cnpj_basico}`,
          source: `CPF-${docLimpo}`, target: idEmpresa,
          label: `Participação`, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });
    }

    return NextResponse.json({ nodes, edges });
  } catch (error: any) {
    console.error("Erro na montagem do grafo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}