import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic';

const obterClienteBigQuery = () => {
  const jsonCredenciais = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!jsonCredenciais) throw new Error("A variável GOOGLE_APPLICATION_CREDENTIALS_JSON não está configurada.");
  try {
    const credenciais = JSON.parse(jsonCredenciais);
    return new BigQuery({
      projectId: credenciais.project_id,
      credentials: {
        client_email: credenciais.client_email,
        private_key: credenciais.private_key,
      },
    });
  } catch (err: any) {
    throw new Error("Falha ao processar o JSON das credenciais: " + err.message);
  }
};

export async function POST(req: Request) {
  try {
    const { documentoBusca, tipoBusca } = await req.json();

    if (!documentoBusca || !tipoBusca) {
      return NextResponse.json({ error: "Documento e Tipo de Busca são obrigatórios." }, { status: 400 });
    }

    const docLimpo = String(documentoBusca).replace(/\D/g, "");
    const bigquery = obterClienteBigQuery();

    // ⚠️ ATENÇÃO: Confirme se o nome das tabelas de Sócios e Empresas no seu BQ estão exatamente assim.
    // Usei os nomes padrão da Receita, ajuste se necessário para o seu dataset.
    const TABELA_SOCIOS = "`credito-489113.banco_receita_us.socios`";
    const TABELA_EMPRESAS = "`credito-489113.banco_receita_us.empresas`";

    const nodes: any[] = [];
    const edges: any[] = [];
    
    // Posição central da busca inicial (o meio da tela)
    const centerX = 400;
    const centerY = 300;
    const raio = 250; // Distância que as bolinhas filhas vão nascer do centro

    if (tipoBusca === "CNPJ") {
      // 1. Busca a Empresa Principal
      // Pega os primeiros 8 dígitos do CNPJ para buscar na tabela de sócios e empresas
      const cnpjBasico = docLimpo.substring(0, 8);

      const sqlEmpresa = `
        SELECT cnpj_basico, razao_social 
        FROM ${TABELA_EMPRESAS} 
        WHERE cnpj_basico = '${cnpjBasico}' 
        LIMIT 1
      `;
      const [empresaRes] = await bigquery.query({ query: sqlEmpresa });
      const razaoSocial = empresaRes.length > 0 ? empresaRes[0].razao_social : "Empresa Desconhecida";

      // Adiciona o Nó Central (A Empresa)
      nodes.push({
        id: `CNPJ-${docLimpo}`,
        position: { x: centerX, y: centerY },
        data: { label: razaoSocial },
        style: {
          backgroundColor: '#2563eb', // Azul para Empresa
          color: 'white', borderRadius: '50%', width: 100, height: 100,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px'
        }
      });

      // 2. Busca os Sócios dessa Empresa
      const sqlSocios = `
        SELECT nome_socio_razao_social, cnpj_cpf_socio, qualificacao_socio
        FROM ${TABELA_SOCIOS}
        WHERE cnpj_basico = '${cnpjBasico}'
      `;
      const [sociosRes] = await bigquery.query({ query: sqlSocios });

      // Distribui os sócios em um círculo ao redor da empresa
      const angleStep = (2 * Math.PI) / (sociosRes.length || 1);

      sociosRes.forEach((socio: any, index: number) => {
        const angle = index * angleStep;
        const idSocio = `CPF-${socio.cnpj_cpf_socio}`;

        // Cria o Nó do Sócio
        nodes.push({
          id: idSocio,
          position: { 
            x: centerX + Math.cos(angle) * raio, 
            y: centerY + Math.sin(angle) * raio 
          },
          data: { label: socio.nome_socio_razao_social },
          style: {
            backgroundColor: '#db2777', // Rosa para Pessoa/Sócio
            color: 'white', borderRadius: '50%', width: 90, height: 90,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px'
          }
        });

        // Cria a Linha (Aresta) ligando a Empresa ao Sócio
        edges.push({
          id: `edge-${docLimpo}-${socio.cnpj_cpf_socio}`,
          source: `CNPJ-${docLimpo}`,
          target: idSocio,
          label: `Sócio (Cód: ${socio.qualificacao_socio})`, // Mostra o nível de ligação na linha
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });

    } else if (tipoBusca === "CPF") {
      // 1. Busca todas as empresas que esse CPF (ou CNPJ Sócio) participa
      // Adiciona o Nó Central (A Pessoa)
      nodes.push({
        id: `CPF-${docLimpo}`,
        position: { x: centerX, y: centerY },
        data: { label: `Pessoa/Sócio: ${docLimpo}` },
        style: {
          backgroundColor: '#db2777', // Rosa
          color: 'white', borderRadius: '50%', width: 100, height: 100,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px'
        }
      });

      const sqlEmpresas = `
        SELECT s.cnpj_basico, e.razao_social, s.qualificacao_socio
        FROM ${TABELA_SOCIOS} s
        LEFT JOIN ${TABELA_EMPRESAS} e ON s.cnpj_basico = e.cnpj_basico
        WHERE s.cnpj_cpf_socio = '${docLimpo}'
        LIMIT 50 -- Limite de segurança para laranjas gigantes
      `;
      const [empresasRes] = await bigquery.query({ query: sqlEmpresas });

      const angleStep = (2 * Math.PI) / (empresasRes.length || 1);

      empresasRes.forEach((emp: any, index: number) => {
        const angle = index * angleStep;
        const idEmpresa = `CNPJ-${emp.cnpj_basico}`;

        // Cria o Nó da Empresa Ligada
        nodes.push({
          id: idEmpresa,
          position: { 
            x: centerX + Math.cos(angle) * raio, 
            y: centerY + Math.sin(angle) * raio 
          },
          data: { label: emp.razao_social || `CNPJ: ${emp.cnpj_basico}` },
          style: {
            backgroundColor: '#2563eb', // Azul
            color: 'white', borderRadius: '50%', width: 90, height: 90,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px'
          }
        });

        // Cria a Linha
        edges.push({
          id: `edge-${docLimpo}-${emp.cnpj_basico}`,
          source: `CPF-${docLimpo}`,
          target: idEmpresa,
          label: `Participação (Cód: ${emp.qualificacao_socio})`,
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });
    }

    return NextResponse.json({ nodes, edges });

  } catch (error: any) {
    console.error("Erro ao gerar grafo de grupo econômico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}