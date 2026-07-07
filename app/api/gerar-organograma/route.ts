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

// 2. Inicializa o cliente do BigQuery blindado para produção
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

    // Remove qualquer caractere que não seja número para não quebrar as buscas por LIKE
    const docLimpo = String(documentoBusca).replace(/\D/g, "");

    const nodes: any[] = [];
    const edges: any[] = [];
    const centerX = 400, centerY = 300, raio = 250;

    if (tipoBusca === "CNPJ") {
      const cnpjBasico = docLimpo.substring(0, 8);

      // ⚡ Busca os dados da Empresa Matriz
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

      // Cria o Nó Central (A Empresa)
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

      // ⚡ Busca todos os Sócios vinculados a este CNPJ básico
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

      // Cria os Nós Satélites (Os Sócios)
      sociosRes.forEach((socio: any, index: number) => {
        const angle = index * angleStep;
        
        // Remove os asteriscos (***) para gerar um ID imutável e limpo
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
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });

    } else if (tipoBusca === "CPF") {
      
      // ⚡ O SEGREDO TÁ AQUI: Usa LIKE com % nas duas pontas para ignorar os asteriscos da LGPD e cruzar os dados
      const sqlEmpresas = `
        SELECT e.cnpj, s.cnpj_basico, e.razao_social, s.nome_socio_razao_social
        FROM \`credito-489113.dados_receita.socios_master\` s
        LEFT JOIN \`credito-489113.dados_receita.empresas_master\` e 
          ON s.cnpj_basico = e.cnpj_basico
        WHERE s.cnpj_cpf_socio LIKE CONCAT('%', @docLimpo, '%')
        LIMIT 50
      `;
      const [empresasRes] = await bigquery.query({
        query: sqlEmpresas,
        params: { docLimpo }
      });

      // Pega o nome do primeiro registro para batizar a bolinha central com o NOME, não com o número
      const nomeRealSocio = empresasRes.length > 0 && empresasRes[0].nome_socio_razao_social
        ? empresasRes[0].nome_socio_razao_social
        : `SÓCIO: ***${docLimpo}**`;

      // Cria o Nó Central (O Sócio) com quebra de linha para o CPF mascarado ficar embaixo
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

      // Cria as Empresas Satélites onde esse CPF é sócio/diretor
      empresasRes.forEach((emp: any, index: number) => {
        const angle = index * angleStep;
        
        // Evita inventar final fixo. Se o join trouxer o CNPJ master, usa ele completo, senão faz fallback seguro
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