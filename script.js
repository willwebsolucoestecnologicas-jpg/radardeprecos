// script.js - v70.0 (Holo-Glass, Imagens e Modo Voz)

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjbwSid8YPyGIg44ToWcQvGIv_5ibBLLVpHAS6K3HIRmo_x4GcucDBamlGGyd9XNMH/exec'; 

const firebaseConfig = {
  apiKey: "AIzaSyCwNVNTZiUJ9qeqniRK9GHDofB9HaQTJ_c",
  authDomain: "kalango-app.firebaseapp.com",
  projectId: "kalango-app",
  storageBucket: "kalango-app.firebasestorage.app",
  messagingSenderId: "1060554025879",
  appId: "1:1060554025879:web:c41affa1cd8e8b346172d2",
  measurementId: "G-SMR42PSTBS"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();

let html5QrCode;
let scannerIsRunning = false;
let catalogoDados = [];
let carrinho = JSON.parse(localStorage.getItem('kalango_cart')) || [];
let modoScanAtual = 'registrar';
let currentUser = null; 
let historicoChat = JSON.parse(localStorage.getItem('kalango_chat_history')) || []; 

const FallbackImage = 'logokalango.png';

// =========================================================================
// MODO VOZ HOLOGRÁFICO E MICROSOFT AZURE
// =========================================================================

let kalangoAudioAtual = null;
let modoVozAtivo = false;

function abrirModoVoz() {
    modoVozAtivo = true;
    const overlay = document.getElementById('voice-mode-overlay');
    overlay.classList.remove('hidden'); overlay.classList.add('flex');
    iniciarGravacaoVoz();
}

function fecharModoVoz() {
    modoVozAtivo = false;
    const overlay = document.getElementById('voice-mode-overlay');
    overlay.classList.add('hidden'); overlay.classList.remove('flex');
    if (kalangoAudioAtual) { kalangoAudioAtual.pause(); kalangoAudioAtual.currentTime = 0; }
}

async function falarComVozDoKalango(texto, isModoVoz = false) {
    const P1 = "w8U2w2dwLljaTDN0Dt9AIHiGt8"; const P2 = "olZ4YTYqUJR10T79iTRHZjHCWLJQQJ99CEACYeBjFXJ3w3AAAYACOGrJEO";
    const CHAVE_AZURE = P1 + P2; const REGIAO_AZURE = "eastus";

    if (kalangoAudioAtual) { kalangoAudioAtual.pause(); kalangoAudioAtual.currentTime = 0; }
    
    let textoLimpo = texto.replace(/<[^>]*>?/gm, '').replace(/[*_]/g, '').replace(/\.\.\./g, ', ').replace(/!/g, '. ').replace(/hummm/gi, '');
    
    const ssml = `<speak version='1.0' xml:lang='pt-BR'><voice xml:lang='pt-BR' xml:gender='Male' name='pt-BR-AntonioNeural'><prosody rate="1.05" pitch="0%">${textoLimpo}</prosody></voice></speak>`;
    const url = `https://${REGIAO_AZURE}.tts.speech.microsoft.com/cognitiveservices/v1`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Ocp-Apim-Subscription-Key': CHAVE_AZURE, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3' },
            body: ssml
        });
        const blob = await response.blob();
        kalangoAudioAtual = new Audio(URL.createObjectURL(blob));
        
        if (isModoVoz) {
            const espectro = document.getElementById('spectrogram'); const statusText = document.getElementById('voice-status');
            kalangoAudioAtual.onplay = () => { espectro.classList.remove('opacity-0'); statusText.textContent = "TRANSMITINDO..."; };
            kalangoAudioAtual.onended = () => { espectro.classList.add('opacity-0'); statusText.textContent = "AGUARDANDO COMANDO"; };
        }
        kalangoAudioAtual.play();
    } catch (e) {
        const fallback = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textoLimpo)}&tl=pt-BR&client=tw-ob`;
        kalangoAudioAtual = new Audio(fallback); kalangoAudioAtual.play();
    }
}

function iniciarGravacaoVoz() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return mostrarNotificacao("Voz não suportada.", "erro");
    const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    rec.lang = 'pt-BR'; rec.interimResults = false;
    const statusText = document.getElementById('voice-status');
    const btnCentral = document.getElementById('btn-central-mic');
    
    rec.onstart = () => { 
        if (kalangoAudioAtual) kalangoAudioAtual.pause();
        if(modoVozAtivo) { statusText.textContent = "ESCUTANDO..."; btnCentral.classList.add('opacity-50'); } 
        else { document.getElementById('chat-input').placeholder = "Escutando..."; }
    };
    
    rec.onresult = (e) => {
        const textoOuvido = e.results[0][0].transcript;
        if(modoVozAtivo) { processarMensagemVoz(textoOuvido); } 
        else { document.getElementById('chat-input').value = textoOuvido; setTimeout(enviarMensagemGemini, 500); }
    };
    
    rec.onerror = () => { if(modoVozAtivo) { statusText.textContent = "FALHA NO ÁUDIO"; } };
    rec.onend = () => { btnCentral.classList.remove('opacity-50'); if(!modoVozAtivo) document.getElementById('chat-input').placeholder = "Comando de texto..."; };
    rec.start();
}

async function processarMensagemVoz(txt) {
    const statusText = document.getElementById('voice-status');
    const userName = currentUser ? currentUser.displayName.split(' ')[0] : "Usuário";
    statusText.textContent = "PROCESSANDO...";

    historicoChat.push(userName + " (Áudio): " + txt); localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

    try {
        const r = await fetch(`${APPS_SCRIPT_URL}?acao=chatGemini&pergunta=${encodeURIComponent(txt)}&nome=${encodeURIComponent(userName)}&historico=${encodeURIComponent(historicoChat.slice(-6).join("\n"))}`);
        const data = await r.json();
        let resposta = data.resposta || "Erro de servidor.";
        
        historicoChat.push("Kalango: " + resposta.replace(/\|\|ADD:(.*?)\|\|/g, "")); localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));
        const cmd = resposta.match(/\|\|ADD:(.*?)\|\|/);
        if (cmd && cmd[1]) {
            const p = cmd[1].split('::'); const catItem = catalogoDados.find(i => i.produto === p[0].trim());
            adicionarAoCarrinho(p[0].trim(), parseFloat(p[1].trim())||0, p[2]?p[2].trim():"Chat", catItem ? catItem.imagem : FallbackImage);
            resposta = resposta.replace(cmd[0], "");
        }
        await falarComVozDoKalango(resposta, true);
    } catch (e) { statusText.textContent = "ERRO DE CONEXÃO"; }
}

function rolarChatParaFim() { document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight; }

async function enviarMensagemGemini() {
    const input = document.getElementById('chat-input'); const area = document.getElementById('chat-messages'); const txt = input.value.trim();
    if (!txt) return;

    const userName = currentUser ? currentUser.displayName.split(' ')[0] : "Usuário";
    area.innerHTML += `<div class="chat-user text-base mb-2 animate-fade-in">${txt}</div>`;
    input.value = ''; rolarChatParaFim();

    const id = 'load-' + Date.now();
    area.innerHTML += `<div id="${id}" class="chat-ai text-sm mb-2 opacity-50"><i class="fas fa-circle-notch fa-spin text-[#00f0ff] mr-2"></i> Processando...</div>`;
    rolarChatParaFim();

    historicoChat.push(userName + ": " + txt); localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

    try {
        const fetchUrl = `${APPS_SCRIPT_URL}?acao=chatGemini&pergunta=${encodeURIComponent(txt)}&nome=${encodeURIComponent(userName)}&historico=${encodeURIComponent(historicoChat.slice(-6).join("\n"))}`;
        const res = await fetch(fetchUrl, { redirect: 'follow' }); const data = await res.json();
        document.getElementById(id).remove();
        let respostaFinal = data.resposta || "Sem resposta.";

        historicoChat.push("Kalango: " + respostaFinal.replace(/\|\|ADD:(.*?)\|\|/g, "")); localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

        const comandoAdd = respostaFinal.match(/\|\|ADD:(.*?)\|\|/);
        if (comandoAdd && comandoAdd[1]) {
            const partes = comandoAdd[1].split('::'); const catItem = catalogoDados.find(i => i.produto === partes[0].trim());
            adicionarAoCarrinho(partes[0].trim(), parseFloat(partes[1].trim()) || 0, partes[2] ? partes[2].trim() : "Chat", catItem ? catItem.imagem : FallbackImage);
            respostaFinal = respostaFinal.replace(comandoAdd[0], "");
        }

        falarComVozDoKalango(respostaFinal, false);
        area.innerHTML += `<div class="chat-ai text-base mb-2 animate-fade-in">${respostaFinal.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b class="text-[#00f0ff]">$1</b>')}</div>`;
    } catch (e) {
        document.getElementById(id).remove();
        area.innerHTML += `<div class="chat-ai text-sm mb-2 text-red-400 animate-fade-in"><i class="fas fa-exclamation-triangle mr-1"></i> Erro de conexão.</div>`;
    }
    rolarChatParaFim();
}

// =========================================================================
// RENDERIZAÇÃO HOLO-GLASS DO APLICATIVO
// =========================================================================

function fazerLoginGoogle() { const provider = new firebase.auth.GoogleAuthProvider(); auth.signInWithPopup(provider).catch(() => auth.signInWithRedirect(provider)); }

auth.onAuthStateChanged((user) => { 
    if (user) { 
        currentUser = user; document.getElementById('login-screen').classList.add('hidden'); 
        document.getElementById('app-content').classList.remove('hidden'); document.getElementById('app-content').classList.add('flex');
        document.getElementById('user-profile').classList.remove('hidden'); document.getElementById('user-profile').classList.add('flex'); 
        document.getElementById('user-name-display').textContent = user.displayName.split(' ')[0]; 
        document.getElementById('user-avatar').src = user.photoURL; 
        document.getElementById('username').value = user.displayName; 
        atualizarContadorCarrinho(); carregarCatalogo(); trocarAba('chat');
    } else { 
        currentUser = null; document.getElementById('login-screen').classList.remove('hidden'); 
        document.getElementById('app-content').classList.add('hidden'); document.getElementById('app-content').classList.remove('flex');
    } 
});

function adicionarAoCarrinho(produto, preco, mercado, imagem = '') {
    const id = produto + mercado; const existente = carrinho.find(i => i.id === id);
    if (existente) existente.qtd++; else carrinho.push({ id, produto, preco, mercado, qtd: 1, imagem: imagem || FallbackImage });
    salvarCarrinho(); mostrarNotificacao(`ITEM ADICIONADO`); atualizarContadorCarrinho();
}

function toggleCarrinho() { 
    const m = document.getElementById('cart-modal'); const c = document.getElementById('cart-content'); 
    if (m.classList.contains('hidden')) { renderizarCarrinho(); m.classList.remove('hidden'); setTimeout(() => c.classList.remove('translate-y-full'), 10); 
    } else { c.classList.add('translate-y-full'); setTimeout(() => m.classList.add('hidden'), 300); } 
}
function atualizarContadorCarrinho() { const c = carrinho.reduce((a, b) => a + b.qtd, 0); const b = document.getElementById('cart-count'); if(b) { b.textContent = c; b.classList.toggle('hidden', c === 0); } }
function alterarQtd(id, d) { const i = carrinho.find(x => x.id === id); if (i) { i.qtd += d; if (i.qtd <= 0) carrinho = carrinho.filter(x => x.id !== id); } salvarCarrinho(); renderizarCarrinho(); }

function limparCarrinho() { if(confirm("Apagar todos os dados do carrinho?")) { carrinho = []; salvarCarrinho(); renderizarCarrinho(); toggleCarrinho(); historicoChat = []; localStorage.removeItem('kalango_chat_history'); } }
function salvarCarrinho() { localStorage.setItem('kalango_cart', JSON.stringify(carrinho)); atualizarContadorCarrinho(); }

function renderizarCarrinho() { 
    const c = document.getElementById('cart-items'); const t = document.getElementById('cart-total-price'); 
    if (carrinho.length === 0) { c.innerHTML = '<p class="text-center opacity-30 pt-10 uppercase tracking-widest text-sm">Cesta Vazia</p>'; t.textContent = "R$ 0,00"; return; } 
    c.innerHTML = ''; let total = 0; 
    carrinho.forEach(i => { 
        total += i.preco * i.qtd; 
        c.innerHTML += `
        <div class="glass-panel p-3 mb-3 flex justify-between items-center animate-fade-in border-[#00f0ff]/20">
            <div class="flex items-center gap-4 w-2/3">
                <div class="produto-img-wrapper !w-14 !h-14 !min-w-[56px]"><img src="${i.imagem}" onerror="this.src='${FallbackImage}'"></div>
                <div class="truncate">
                    <b class="text-white text-base truncate block w-full">${i.produto}</b>
                    <small class="text-[#00ffa3] uppercase tracking-widest text-[10px] block mt-1">${i.mercado}</small>
                </div>
            </div>
            <div class="text-right">
                <span class="text-[#00f0ff] font-bold block text-lg mb-2">R$ ${(i.preco * i.qtd).toFixed(2)}</span>
                <div class="flex items-center justify-end gap-3">
                    <button onclick="alterarQtd('${i.id}',-1)" class="text-red-400 font-bold hover:text-red-300"><i class="fas fa-minus-circle"></i></button> 
                    <span class="text-white font-bold text-base w-4 text-center">${i.qtd}</span> 
                    <button onclick="alterarQtd('${i.id}',1)" class="text-[#00ffa3] font-bold hover:text-white"><i class="fas fa-plus-circle"></i></button>
                </div>
            </div>
        </div>`; 
    }); 
    t.textContent = `R$ ${total.toFixed(2)}`; 
}
function abrirModalLimpeza() { if(confirm("Purgar banco de dados do carrinho?")) { limparCarrinho(); } }

async function trocarAba(aba) { 
    const abas = ['registrar', 'consultar', 'catalogo', 'chat']; if (scannerIsRunning) fecharCamera(); 
    abas.forEach(a => { document.getElementById(a + '-container').classList.add('hidden'); document.getElementById('nav-' + a).classList.remove('active-tab'); }); 
    document.getElementById(aba + '-container').classList.remove('hidden'); document.getElementById('nav-' + aba).classList.add('active-tab'); 
    if(aba === 'catalogo') carregarCatalogo(); if (aba === 'chat') setTimeout(rolarChatParaFim, 100); 
}

async function carregarCatalogo() { try { const r = await fetch(`${APPS_SCRIPT_URL}?acao=listarCatalogo`, { redirect: 'follow' }); const d = await r.json(); catalogoDados = d.catalogo || []; atualizarListaCatalogo(catalogoDados); } catch(e) {} }

function atualizarListaCatalogo(d) { 
    const l = document.getElementById('lista-catalogo'); l.innerHTML = ''; 
    d.forEach(i => { 
        l.innerHTML += `
        <div class="glass-panel p-4 mb-4 flex justify-between items-center animate-fade-in gap-4 border-[#00ffa3]/20 hover:border-[#00f0ff]/50 transition-colors">
            <div class="produto-img-wrapper"><img src="${i.imagem || FallbackImage}" onerror="this.src='${FallbackImage}'"></div>
            <div class="flex-1 flex justify-between items-center overflow-hidden">
                <div class="w-1/2 pr-2">
                    <b class="text-white text-sm block truncate mb-1">${i.produto}</b>
                    <span class="text-[10px] uppercase tracking-widest text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded">${i.mercado}</span>
                </div>
                <div class="text-right shrink-0">
                    <span class="text-white font-bold block text-2xl leading-none tracking-wider mb-2">R$ ${i.preco.toFixed(2)}</span>
                    <button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}', '${i.imagem}')" class="btn-cyber px-4 py-1.5 rounded-lg text-[10px] w-full">+ ADD</button>
                </div>
            </div>
        </div>`; 
    }); 
}

async function pesquisarPrecos() { 
    const t = document.getElementById('ean-busca').value; if (!t) return mostrarNotificacao("FALTA TERMO", "erro");
    mostrarNotificacao("VARRENDO DADOS...");
    const r = await fetch(`${APPS_SCRIPT_URL}?acao=consultarPrecos&ean=${encodeURIComponent(t)}`, { redirect: 'follow' }); const d = await r.json(); const c = document.getElementById('resultados-consulta'); 
    c.innerHTML = ''; if (!d.resultados || d.resultados.length === 0) { c.innerHTML = '<p class="text-center opacity-50 pt-10 uppercase text-sm tracking-widest">Nenhum registro.</p>'; return; }
    d.resultados.forEach(i => { 
        c.innerHTML += `
        <div class="glass-panel p-4 mb-4 flex justify-between items-center animate-fade-in gap-4 border-[#00f0ff]/30">
            <div class="produto-img-wrapper"><img src="${i.imagem || FallbackImage}" onerror="this.src='${FallbackImage}'"></div>
            <div class="flex-1 flex justify-between items-center overflow-hidden">
                <div class="w-1/2 pr-2">
                    <b class="text-white font-bold text-base block truncate">${i.produto}</b>
                    <span class="text-[10px] text-[#00ffa3] uppercase tracking-widest block mt-1">${i.mercado}</span>
                </div>
                <div class="text-right shrink-0">
                    <span class="text-white font-bold text-3xl leading-none mb-2 block">R$ ${i.preco.toFixed(2)}</span>
                    <button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}', '${i.imagem}')" class="btn-cyber px-4 py-1.5 rounded-lg text-[12px] w-full">+ ADD</button>
                </div>
            </div>
        </div>`; 
    }); 
}

function mostrarNotificacao(m, tipo = 'sucesso') { 
    const t = document.getElementById('toast-notification'); document.getElementById('toast-message').textContent = m; 
    const icon = document.getElementById('toast-icon');
    if(tipo === 'erro') { t.style.borderColor = '#ef4444'; t.style.boxShadow = '0 0 20px rgba(239,68,68,0.4)'; icon.innerHTML = '<i class="fas fa-exclamation-triangle text-red-500 text-lg"></i>'; } 
    else { t.style.borderColor = '#00f0ff'; t.style.boxShadow = '0 0 20px rgba(0,240,255,0.4)'; icon.innerHTML = '<i class="fas fa-check-circle text-[#00f0ff] text-lg"></i>'; }
    t.classList.remove('-translate-y-32', 'opacity-0'); setTimeout(() => t.classList.add('-translate-y-32', 'opacity-0'), 3000); 
}

// Funções de Câmera e Scanner mantidas
async function iniciarCamera(m) { modoScanAtual = m; document.getElementById('scanner-modal').classList.remove('hidden'); document.getElementById('scanner-modal').classList.add('flex'); try { html5QrCode = new Html5Qrcode("reader"); scannerIsRunning = true; await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess); } catch(e){mostrarNotificacao("ERRO NA LENTE", "erro"); fecharCamera(); } }
function fecharCamera() { if(scannerIsRunning && html5QrCode) { html5QrCode.stop(); scannerIsRunning = false; } document.getElementById('scanner-modal').classList.add('hidden'); document.getElementById('scanner-modal').classList.remove('flex');}
async function onScanSuccess(t) { fecharCamera(); if (modoScanAtual === 'pesquisar') { trocarAba('consultar'); document.getElementById('ean-busca').value = t; pesquisarPrecos(); } else { trocarAba('registrar'); document.getElementById('registrar-home').classList.add('hidden'); document.getElementById('price-form-section').classList.remove('hidden'); document.getElementById('ean-field').value = t; document.getElementById('product-name').value = "Buscando..."; try { const res = await fetch(`${APPS_SCRIPT_URL}?ean=${t}`, { redirect: 'follow' }); const data = await res.json(); document.getElementById('product-name').value = data.nome || ""; if (data.imagem && data.imagem.startsWith('http')) { document.getElementById('image-url-field').value = data.imagem; document.getElementById('preview-imagem').src = data.imagem; document.getElementById('preview-imagem').classList.remove('hidden'); document.getElementById('btn-camera-foto').classList.add('hidden'); } } catch(e) { document.getElementById('product-name').value = ""; } } }
async function salvarPreco(e) { e.preventDefault();mostrarNotificacao("SINCRONIZANDO..."); const p = { ean: document.getElementById('ean-field').value, produto: document.getElementById('product-name').value, preco: document.getElementById('price').value, mercado: document.getElementById('market').value, usuario: document.getElementById('username').value, imagem: document.getElementById('image-url-field').value }; await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(p), mode: 'no-cors' }); mostrarNotificacao("DADOS SALVOS"); setTimeout(() => location.reload(), 1500); }
function comprimirImagem(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (e) => { const img = new Image(); img.src = e.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const scale = 800 / img.width; canvas.width = 800; canvas.height = img.height * scale; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.6)); }; }; }); }

document.addEventListener('DOMContentLoaded', () => { 
    atualizarContadorCarrinho(); 
    document.getElementById('btn-enviar-chat').addEventListener('click', enviarMensagemGemini);
    document.getElementById('chat-input').addEventListener('keypress', function (e) { if (e.key === 'Enter') enviarMensagemGemini(); });
    const btnFoto = document.getElementById('btn-camera-foto'); const inputFoto = document.getElementById('input-foto-produto'); const imgPreview = document.getElementById('preview-imagem'); const urlField = document.getElementById('image-url-field');
    btnFoto.addEventListener('click', () => inputFoto.click()); inputFoto.addEventListener('change', async (e) => { if(e.target.files && e.target.files[0]) { btnFoto.innerHTML = '<i class="fas fa-circle-notch fa-spin text-[#00f0ff]"></i>'; const file = e.target.files[0]; try { const base64 = await comprimirImagem(file); imgPreview.src = base64; imgPreview.classList.remove('hidden'); btnFoto.classList.add('hidden'); urlField.value = base64; } catch(err) { mostrarNotificacao("FALHA NA IMAGEM", "erro"); btnFoto.innerHTML = '<i class="fas fa-camera text-[#00f0ff] text-xl"></i>'; } } });
    document.getElementById('filtro-mercado-catalogo').addEventListener('change', (e) => { const v = e.target.value; if(v === 'todos') atualizarListaCatalogo(catalogoDados); else atualizarListaCatalogo(catalogoDados.filter(i => i.mercado === v)); });
    document.getElementById('btn-pesquisar').addEventListener('click', pesquisarPrecos);
    document.getElementById('price-form').addEventListener('submit', salvarPreco);
    (async () => { try { const res = await fetch(`${APPS_SCRIPT_URL}?acao=buscarMercados`, { redirect: 'follow' }); const d = await res.json(); const s = document.getElementById('market'); if(d.mercados) { s.innerHTML = ''; d.mercados.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; o.className = "bg-[#030307]"; s.appendChild(o); }); } } catch(e) {} })(); 
});
