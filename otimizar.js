// C:\Users\Alyson\intranet-webv2\otimizar.js
const duckdb = require('duckdb');
const path = require('path');
const fs = require('fs');

// 1. Criamos um arquivo de banco temporário para não estourar a RAM do seu PC clonando 4GB na memória
const db = new duckdb.Database('otimizar_temp.db');

// =========================================================================
// ⚠️ CONFIGURAÇÃO DOS CAMINHOS (AJUSTE SE NECESSÁRIO)
// =========================================================================
// O script espera que o seu arquivo original de 4GB esteja na raiz do projeto.
// Se ele estiver em outra pasta (ex: Downloads), mude o caminho abaixo:
const ARQUIVO_ORIGINAL = path.join(__dirname, 'estabelecimentos_completo.parquet');
const ARQUIVO_OTIMIZADO = path.join(__dirname, 'estabelecimentos_turbo.parquet');

// Função auxiliar para rodar comandos no DuckDB usando Promises
const executarComando = (sql) => {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
};

async function iniciarOtimizacao() {
  try {
    // Verifica se o arquivo original realmente existe no caminho especificado
    if (!fs.existsSync(ARQUIVO_ORIGINAL)) {
      console.error(`\n❌ ERRO: Não encontrei o arquivo original em:\n👉 ${ARQUIVO_ORIGINAL}\n`);
      console.log("Por favor, mova o arquivo de 4GB para a raiz do projeto ou ajuste o caminho no script.\n");
      process.exit(1);
    }

    console.log("\n=================================================================");
    console.log("⏳ INICIANDO A OTIMIZAÇÃO DO PARQUET (MODO SNIPER)");
    console.log("=================================================================");
    console.log(`📂 Lendo arquivo original: ${ARQUIVO_ORIGINAL}`);
    console.log("⚙️  Organizando dados por UF, Município e CNAE...");
    console.log("☕ Pode ir buscar um café, isso vai levar de 2 a 5 minutos...\n");

    // Executa a mágica: Ordena fisicamente o arquivo e agrupa em blocos de 100 mil linhas
    // Isso cria os índices necessários para a Cloudflare e a Vercel lerem em milissegundos
    const sqlQuery = `
      COPY (
        SELECT * FROM read_parquet('${ARQUIVO_ORIGINAL.replace(/\\/g, '/')}')
        ORDER BY uf, municipio_rf, cnae_principal
      ) TO '${ARQUIVO_OTIMIZADO.replace(/\\/g, '/')}' (FORMAT PARQUET, ROW_GROUP_SIZE 100000);
    `;

    const inicio = Date.now();
    await executarComando(sqlQuery);
    const fim = Date.now();
    
    const tempoGasto = ((fim - inicio) / 1000 / 60).toFixed(2);

    console.log("=================================================================");
    console.log(`✅ SUCESSO ABSOLUTO! Processo concluído em ${tempoGasto} minutos.`);
    console.log(`💾 Arquivo otimizado gerado: ${ARQUIVO_OTIMIZADO}`);
    console.log("=================================================================\n");

    console.log("👉 PRÓXIMOS PASSOS:");
    console.log("1. Abra o Cyberduck.");
    console.log("2. Delete o arquivo antigo do seu Bucket da Cloudflare.");
    console.log("3. Arraste esse NOVO arquivo 'estabelecimentos_turbo.parquet' para lá.");
    console.log("4. No seu 'route.ts', atualize a URL_PARQUET com o nome do novo arquivo.");
    console.log("5. Seja feliz com buscas em milissegundos sem estourar a memória da Vercel!\n");

  } catch (error) {
    console.error("\n❌ Ocorreu um erro durante o processamento:", error);
  } finally {
    // Fecha o banco de dados e limpa o arquivo temporário
    db.close(() => {
      try {
        if (fs.existsSync('otimizar_temp.db')) fs.unlinkSync('otimizar_temp.db');
        if (fs.existsSync('otimizar_temp.db.wal')) fs.unlinkSync('otimizar_temp.db.wal');
      } catch (e) {}
    });
  }
}

iniciarOtimizacao();