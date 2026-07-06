const fs = require('fs');

async function gerarTabelaTom() {
  console.log("⏳ Baixando dados oficiais via Fetch...");
  
  try {
    const resMunicipios = await fetch('https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/json/municipios.json');
    const municipios = await resMunicipios.json();
    
    const resEstados = await fetch('https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/json/estados.json');
    const estados = await resEstados.json();

    const mapEstados = {};
    estados.forEach(e => { mapEstados[e.codigo_uf] = e.uf; });

    const tabelaTom = {};
    
    municipios.forEach(m => {
      const uf = mapEstados[m.codigo_uf];
      
      // A CORREÇÃO TÁ AQUI: a propriedade certa é 'siafi_id'
      if (!uf || !m.nome || !m.siafi_id) return; 

      const nomeLimpo = m.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
      const chave = `${nomeLimpo}-${uf}`;
      
      tabelaTom[chave] = m.siafi_id.toString().padStart(4, '0'); 
    });

    fs.writeFileSync('tabela_tom.json', JSON.stringify(tabelaTom, null, 2));
    console.log(`✅ Agora sim! Arquivo criado com ${Object.keys(tabelaTom).length} cidades.`);
    
  } catch (error) {
    console.error("❌ Erro fatal:", error.message);
  }
}

gerarTabelaTom();