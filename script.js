/**
 * KALANGO - BACKEND (v50 - Inteligência Fluida e Sotaque Natural)
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const TOKEN_COSMOS = "L2UhW5P5-N8bkOl5akZUlg"; 
const ID_PASTA_DRIVE = "1D94xtvaY4GUf5_jPz_JwPAIAT3FC8lMp"; 
const TOKEN_GEMINI = "AIzaSyAZZZc8YmHAg8UeKzmW5uwaDAZUE5IL3w4"; 

function doGet(e) {
  const acao = e.parameter.acao;
  const ean = e.parameter.ean;
  const pergunta = e.parameter.pergunta;
  const nome = e.parameter.nome || "Amigo(a)";
  const historico = e.parameter.historico || "";

  if (!acao && !ean) return rJ({status: "Kalango Online v50"});

  if (acao === "chatGemini") {
    if (!pergunta) return rJ({resposta: "..."});
    return rJ(processarChatGemini(pergunta, nome, historico));
  }

  if (acao === "listarCatalogo") {
    try {
      const s = SS.getSheetByName("Precos");
      if (!s) return rJ({catalogo: []});
      const dados = s.getDataRange().getValues();
      const validos = dados.slice(1).filter(l => l[2] && l[3]); 
      const catalogo = validos.reverse().slice(0, 60).map(l => ({ 
        produto: l[2], preco: Number(l[3]), mercado: l[4], usuario: l[5], imagem: l[6] 
      }));
      return rJ({catalogo: catalogo});
    } catch (err) { return rJ({catalogo: []}); }
  }

  if (acao === "buscarMercados") {
    const s = SS.getSheetByName("Precos");
    const m = s ? [...new Set(s.getDataRange().getValues().slice(1).map(l=>l[4]).filter(Boolean))] : [];
    return rJ({mercados: m});
  }

  if (acao === "consultarPrecos" && ean) {
    const s = SS.getSheetByName("Precos");
    const termo = String(ean).toLowerCase().trim();
    if(!s) return rJ({resultados:[]});
    const dados = s.getDataRange().getValues().slice(1);
    const res = dados.filter(l => String(l[1]).toLowerCase().includes(termo) || String(l[2]).toLowerCase().includes(termo))
      .map(l => ({
        data: l[0], ean: l[1], produto: l[2], preco: Number(l[3]), 
        mercado: l[4], usuario: l[5], imagem: l[6]
      }));
    return rJ({resultados: res});
  }

  if (ean) {
    const m = buscarNaMemoria(ean);
    if (m) return rJ(m);
    return rJ(buscarProdutoNaExternalAPI(ean));
  }
  return rJ({erro: "Ação desconhecida"});
}

function processarChatGemini(pergunta, nome, historico) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + TOKEN_GEMINI;
  
  const promptSistema = `Você é o Kalango, o mascote gente boa do app de preços de Luís Gomes, RN.
  Sua missão é ajudar o ${nome} com uma conversa limpa, rápida e natural.
  
  DIRETRIZES DE FALA (CRÍTICO):
  1. ESTILO: Fale como um morador de Luís Gomes. Use um tom acolhedor e levemente nordestino, mas sem forçar gírias o tempo todo. 
  2. FLUIDEZ: NUNCA use reticências (...) ou repetições de letras (como "hummm", "eitaaaa"). Isso trava o motor de voz.
  3. PONTUAÇÃO: Use frases curtas e pontos finais. Evite muitas exclamações e interrogações juntas.
  4. SOTAQUE: Use expressões como "visse", "macho" ou "eita" apenas quando fizer sentido no contexto, de forma sutil.
  5. ADICIONAR AO CARRINHO: Se pedirem para colocar algo na lista, use o comando ||ADD:Produto::Preco::Mercado|| no final da frase.

  CONTEXTO:
  Usuário: ${nome}
  Histórico: ${historico}
  Pergunta: ${pergunta}`;

  const payload = {
    contents: [{ parts: [{ text: promptSistema }] }]
  };

  const options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    if (json.candidates && json.candidates[0].content.parts[0].text) {
      let resposta = json.candidates[0].content.parts[0].text;
      resposta = resposta.replace(/\.\.\./g, '. ').replace(/!/g, '.');
      return { resposta: resposta };
    }
    return { resposta: "Deu um probleminha aqui. Tenta falar de novo?" };
  } catch (e) {
    return { resposta: "O servidor deu uma cochilada. Tenta já já!" };
  }
} 

function doPost(e) {try{const c=JSON.parse(e.postData.contents);const s=SS.getSheetByName("Precos")||SS.insertSheet("Precos");if(s.getLastRow()===0)s.appendRow(["Data","EAN","Produto","Preco","Mercado","Usuario","Imagem"]);let img=c.imagem||"";if(img.startsWith("data:image"))img=salvarImagemNoDrive(img,c.ean);s.appendRow([new Date(),"'"+c.ean,c.produto,Number(c.preco),c.mercado,c.usuario,img]);return rJ({status:"sucesso"});}catch(erro){return rJ({status:"erro"});}}
function buscarNaMemoria(e){const d=SS.getSheetByName("Precos").getDataRange().getValues(); for(let i=d.length-1;i>=1;i--)if(String(d[i][1]).trim()===String(e).trim())return{nome:d[i][2],imagem:d[i][6]};return null}
function buscarProdutoNaExternalAPI(e){try{const r=UrlFetchApp.fetch(`https://api.cosmos.bluesoft.com.br/gtins/${e}.json`,{headers:{"X-Cosmos-Token":TOKEN_COSMOS},muteHttpExceptions:true});const d=JSON.parse(r.getContentText());return{nome:d.description||"",imagem:d.thumbnail||""}}catch(x){return{nome:"",imagem:""}}}
function salvarImagemNoDrive(b,n){try{const f=DriveApp.getFolderById(ID_PASTA_DRIVE)||DriveApp.getRootFolder();const a=f.createFile(Utilities.newBlob(Utilities.base64Decode(b.split(",")[1]),"image/jpeg","p_"+n+".jpg"));a.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);return"https://lh3.googleusercontent.com/d/"+a.getId()}catch(e){return""}}
function rJ(d){return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON)}
