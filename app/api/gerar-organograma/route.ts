import { NextResponse } from "next/server";
import duckdb from "duckdb";

export const dynamic = 'force-dynamic';

let cachedDb: duckdb.Database | null = null;
async function getDuckDB() {
  if (cachedDb) return cachedDb;
  return new Promise<duckdb.Database>((resolve, reject) => {
    const db = new duckdb.Database(':memory:');
    const run = (query: string) => new Promise<void>((res, rej) => {
      db.run(query, (err) => err ? rej(err) : res());
    });
    const setupDB = async () => {
      try {
        await run(`SET home_directory='/tmp';`);
        await run(`SET extension_directory='/tmp';`);
        await run(`INSTALL httpfs;`);
        await run(`LOAD httpfs;`);
        await run(`SET s3_endpoint='${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com';`);
        await run(`SET s3_access_key_id='${process.env.R2_ACCESS_KEY_ID}';`);
        await run(`SET s3_secret_access_key='${process.env.R2_SECRET_ACCESS_KEY}';`);
        await run(`SET s3_region='auto';`);
        await run(`SET s3_url_style='path';`);
        cachedDb = db;
        resolve(db);
      } catch (error) { reject(error); }
    };
    setupDB();
  });
}

const queryDB = async (query: string): Promise<any[]> => {
  const db = await getDuckDB();
  return new Promise((resolve, reject) => {
    db.all(query, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
};

export async function POST(req: Request) {
  try {
    const { documentoBusca, tipoBusca } = await req.json();
    if (!documentoBusca || !tipoBusca) return NextResponse.json({ error: "Documentos obrigatórios." }, { status: 400 });

    const docLimpo = String(documentoBusca).replace(/\D/g, "");
    const bucketName = process.env.R2_BUCKET_NAME;

    const nodes: any[] = [];
    const edges: any[] = [];
    const centerX = 400, centerY = 300, raio = 250;

    if (tipoBusca === "CNPJ") {
      const cnpjBasico = docLimpo.substring(0, 8);

      // ⚡ Remoção do '**' - Busca direta na raiz estruturada da tabela
      const sqlEmpresa = `
        SELECT cnpj_basico, razao_social 
        FROM read_parquet('s3://${bucketName}/dados_convertidos_parquet/Empresas/*.parquet') 
        WHERE cnpj_basico = '${cnpjBasico}' 
        LIMIT 1
      `;
      const empresaRes = await queryDB(sqlEmpresa);
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
        SELECT identificador_socio, nome_socio_razao_social, cnpj_cpf_socio, qualificacao_socio
        FROM read_parquet('s3://${bucketName}/dados_convertidos_parquet/Socios/*.parquet')
        WHERE cnpj_basico = '${cnpjBasico}'
      `;
      const sociosRes = await queryDB(sqlSocios);
      const angleStep = (2 * Math.PI) / (sociosRes.length || 1);

      sociosRes.forEach((socio: any, index: number) => {
        const angle = index * angleStep;
        const idSocio = socio.cnpj_cpf_socio ? `CPF-${socio.cnpj_cpf_socio}` : `NOME-${socio.nome_socio_razao_social}`;

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
          id: `edge-${docLimpo}-${socio.cnpj_cpf_socio || index}`,
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
        SELECT s.cnpj_basico, e.razao_social, s.qualificacao_socio
        FROM read_parquet('s3://${bucketName}/dados_convertidos_parquet/Socios/*.parquet') s
        LEFT JOIN read_parquet('s3://${bucketName}/dados_convertidos_parquet/Empresas/*.parquet') e 
          ON s.cnpj_basico = e.cnpj_basico
        WHERE s.cnpj_cpf_socio LIKE '%${docLimpo}'
        LIMIT 30
      `;
      const empresasRes = await queryDB(sqlEmpresas);
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}