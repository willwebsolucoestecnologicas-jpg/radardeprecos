// script.js - v60.0 (Cyber-Neubrutal, Modo Voz Imersivo e Handle de Imagem Completo)

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

// Imagem Fallback (Placeholder Kalango)
const FallbackImage = 'logokalango.png';

// =========================================================================
// MOTOR DE VOZ NEURAL (MICROSOFT AZURE) E MODO LIVE
// =========================================================================

let kalangoAudioAtual = null;
let modoVozAtivo = false;

function abrirModoVoz() {
    modoVozAtivo = true;
    const overlay = document.getElementById('voice-mode-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    iniciarGravacaoVoz();
}

function fecharModoVoz() {
    modoVozAtivo = false;
    const overlay = document.getElementById('voice-mode-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    if (kalangoAudioAtual) {
        kalangoAudioAtual.pause();
        kalangoAudioAtual.currentTime = 0;
    }
}

async function falarComVozDoKalango(texto, isModoVoz = false) {
    // Chave Oculta
    const P1 = "w8U2w2dwLljaTDN0Dt9AIHiGt8";
    const P2 = "olZ4YTYqUJR10T79iTRHZjHCWLJQQJ99CEACYeBjFXJ3w3AAAYACOGrJEO";
    const CHAVE_AZURE = P1 + P2; 
    const REGIAO_AZURE = "eastus";

    if (kalangoAudioAtual) {
        kalangoAudioAtual.pause();
        kalangoAudioAtual.currentTime = 0;
    }
    
    // Limpeza de texto para não gaguejar
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
        
        // Animação Espectrograma Modo Voz
        if (isModoVoz) {
            const espectro = document.getElementById('spectrogram');
            const statusText = document.getElementById('voice-status');
            
            kalangoAudioAtual.onplay = () => { espectro.classList.add('espectro-ativo'); espectro.classList.remove('opacity-0'); statusText.textContent = "Kalango Falando..." };
            kalangoAudioAtual.onended = () => { espectro.classList.add('opacity-0'); statusText.textContent = "Toque para Falar"; };
        }
        kalangoAudioAtual.play();

    } catch (e) {
        console.error(e);
        const fallback = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textoLimpo)}&tl=pt-BR&client=tw-ob`;
        kalangoAudioAtual = new Audio(fallback);
        kalangoAudioAtual.play();
    }
}

function iniciarGravacaoVoz() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return mostrarNotificacao("Navegador não suporta voz.", "erro");
    
    const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    rec.lang = 'pt-BR'; rec.interimResults = false;
    
    const statusText = document.getElementById('voice-status');
    const btnCentral = document.getElementById('btn-central-mic');
    
    rec.onstart = () => { 
        if (kalangoAudioAtual) kalangoAudioAtual.pause();
        if(modoVozAtivo) { statusText.textContent = "Ouvindo..."; btnCentral.classList.add('mic-pulsing'); } 
        else { document.getElementById('chat-input').placeholder = "Ouvindo..."; }
    };
    
    rec.onresult = (e) => {
        const textoOuvido = e.results[0][0].transcript;
        if(modoVozAtivo) { processarMensagemVoz(textoOuvido); } 
        else { document.getElementById('chat-input').value = textoOuvido; setTimeout(enviarMensagemGemini, 500); }
    };
    
    rec.onerror = () => { if(modoVozAtivo) { statusText.textContent = "Não entendi, tente de novo."; } };
    rec.onend = () => { btnCentral.classList.remove('mic-pulsing'); if(!modoVozAtivo) document.getElementById('chat-input').placeholder = "Digite ou mande áudio..."; };
    rec.start();
}

async function processarMensagemVoz(txt) {
    const statusText = document.getElementById('voice-status');
    const userName = currentUser ? currentUser.displayName.split(' ')[0] : "Amigo";
    statusText.textContent = "Pensando...";

    const historyString = historicoChat.slice(-6).join("\n");
    historicoChat.push(userName + " (Áudio): " + txt);
    localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

    try {
        const r = await fetch(`${APPS_SCRIPT_URL}?acao=chatGemini&pergunta=${encodeURIComponent(txt)}&nome=${encodeURIComponent(userName)}&historico=${encodeURIComponent(historyString)}`);
        const data = await r.json();
        
        let resposta = data.resposta || "Vixe, deu um erro.";
        historicoChat.push("Kalango (Áudio): " + resposta.replace(/\|\|ADD:(.*?)\|\|/g, ""));
        localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

        const cmd = resposta.match(/\|\|ADD:(.*?)\|\|/);
        if (cmd && cmd[1]) {
            const p = cmd[1].split('::');
            const catItem = catalogoDados.find(i => i.produto === p[0].trim());
            const imgToCart = catItem ? catItem.imagem : FallbackImage;
            adicionarAoCarrinho(p[0].trim(), parseFloat(p[1].trim())||0, p[2]?p[2].trim():"Chat", imgToCart);
            resposta = resposta.replace(cmd[0], "");
        }

        await falarComVozDoKalango(resposta, true);

    } catch (e) { statusText.textContent = "Erro de conexão."; }
}

function rolarChatParaFim() {
    const area = document.getElementById('chat-messages');
    area.scrollTop = area.scrollHeight; 
}

async function enviarMensagemGemini() {
    const input = document.getElementById('chat-input');
    const area = document.getElementById('chat-messages');
    const txt = input.value.trim();
    if (!txt) return;

    const userName = currentUser ? currentUser.displayName.split(' ')[0] : "Amigo(a)";
    area.innerHTML += `<div class="chat-user text-sm mb-2 animate-fade-in">${txt}</div>`;
    input.value = ''; rolarChatParaFim();

    const id = 'load-' + Date.now();
    area.innerHTML += `<div id="${id}" class="chat-ai text-sm mb-2 opacity-50"><i class="fas fa-circle-notch fa-spin"></i> Pensando...</div>`;
    rolarChatParaFim();

    historicoChat.push(userName + ": " + txt);
    localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

    try {
        const fetchUrl = `${APPS_SCRIPT_URL}?acao=chatGemini&pergunta=${encodeURIComponent(txt)}&nome=${encodeURIComponent(userName)}&historico=${encodeURIComponent(historicoChat.slice(-6).join("\n"))}`;
        const res = await fetch(fetchUrl, { redirect: 'follow' });
        const data = await res.json();
        
        document.getElementById(id).remove();
        let respostaFinal = data.resposta || "Sem resposta.";

        historicoChat.push("Kalango: " + respostaFinal.replace(/\|\|ADD:(.*?)\|\|/g, ""));
        localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

        const comandoAdd = respostaFinal.match(/\|\|ADD:(.*?)\|\|/);
        if (comandoAdd && comandoAdd[1]) {
            const partes = comandoAdd[1].split('::');
            const catItem = catalogoDados.find(i => i.produto === partes[0].trim());
            const imgToCart = catItem ? catItem.imagem : FallbackImage;
            adicionarAoCarrinho(partes[0].trim(), parseFloat(partes[1].trim()) || 0, partes[2] ? partes[2].trim() : "Chat", imgToCart);
            respostaFinal = respostaFinal.replace(comandoAdd[0], "");
        }

        falarComVozDoKalango(respostaFinal, false);
        area.innerHTML += `<div class="chat-ai text-sm mb-2 animate-fade-in">${respostaFinal.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</div>`;

    } catch (e) {
        document.getElementById(id).remove();
        area.innerHTML += `<div class="chat-ai text-sm mb-2 text-red-400 animate-fade-in"><i class="fas fa-exclamation-triangle mr-1"></i> Erro de conexão.</div>`;
    }
    rolarChatParaFim();
}


// =========================================================================
// LÓGICA DO APLICATIVO E RENDERIZAÇÃO NEUBRUTAL (IMAGEM)
// =========================================================================

function fazerLoginGoogle() { 
    const provider = new firebase.auth.GoogleAuthProvider(); 
    auth.signInWithPopup(provider).catch((error) => { auth.signInWithRedirect(provider); }); 
}

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

// 🔥 Novo ADICIONAR AO CARRINHO (Suporta IMAGEM)
function adicionarAoCarrinho(produto, preco, mercado, imagem = '') {
    const id = produto + mercado; 
    const existente = carrinho.find(i => i.id === id);
    if (existente) existente.qtd++; else carrinho.push({ id, produto, preco, mercado, qtd: 1, imagem: imagem || FallbackImage });
    salvarCarrinho(); mostrarNotificacao(`+1 ${produto}`);
    atualizarContadorCarrinho();
}

function toggleCarrinho() { 
    const m = document.getElementById('cart-modal'); const c = document.getElementById('cart-content'); 
    if (m.classList.contains('hidden')) { renderizarCarrinho(); m.classList.remove('hidden'); setTimeout(() => c.classList.remove('translate-y-full'), 10); 
    } else { c.classList.add('translate-y-full'); setTimeout(() => m.classList.add('hidden'), 300); } 
}
function atualizarContadorCarrinho() { const c = carrinho.reduce((a, b) => a + b.qtd, 0); const b = document.getElementById('cart-count'); if(b) { b.textContent = c; b.classList.toggle('hidden', c === 0); } }
function alterarQtd(id, d) { const i = carrinho.find(x => x.id === id); if (i) { i.qtd += d; if (i.qtd <= 0) carrinho = carrinho.filter(x => x.id !== id); } salvarCarrinho(); renderizarCarrinho(); }

function limparCarrinho() { 
    if(confirm("Limpar carrinho e resetar papo do Kalango?")) { 
        carrinho = []; salvarCarrinho(); renderizarCarrinho(); toggleCarrinho(); historicoChat = []; localStorage.removeItem('kalango_chat_history');
    } 
}
function salvarCarrinho() { localStorage.setItem('kalango_cart', JSON.stringify(carrinho)); atualizarContadorCarrinho(); }

// 🔥 RENDERIZAR CARRINHO NEUBRUTAL (Com IMAGEM)
function renderizarCarrinho() { 
    const c = document.getElementById('cart-items'); const t = document.getElementById('cart-total-price'); const q = document.getElementById('cart-total-items'); 
    if (carrinho.length === 0) { c.innerHTML = '<p class="text-center opacity-30 p-10 pt-20">Seu carrinho está vazio, macho!</p>'; t.textContent = "R$ 0,00"; q.textContent = "0"; return; } 
    c.innerHTML = ''; let total = 0; let qtd = 0; 
    carrinho.forEach(i => { 
        total += i.preco * i.qtd; qtd += i.qtd; 
        c.innerHTML += `
        <div class="glass-panel p-3 mb-2 flex justify-between items-center rounded-lg border border-black animate-fade-in">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 border border-black rounded overflow-hidden">
                    <img src="${i.imagem}" class="w-full h-full object-cover">
                </div>
                <div>
                    <b class="text-sm">${i.produto}</b><br>
                    <small class="text-slate-600 uppercase text-[8px]">${i.mercado}</small>
                </div>
            </div>
            <div class="text-right">
                <span class="text-black font-black block text-sm">R$ ${(i.preco * i.qtd).toFixed(2)}</span>
                <div class="flex items-center gap-2 bg-[#f1f1f1] rounded px-1.5 py-0.5 border border-black mt-1">
                    <button onclick="alterarQtd('${i.id}',-1)" class="text-red-600 font-bold px-1.5 text-xs">-</button> 
                    <span class="text-black font-bold text-xs">${i.qtd}</span> 
                    <button onclick="alterarQtd('${i.id}',1)" class="text-black font-bold px-1.5 text-xs">+</button>
                </div>
            </div>
        </div>`; 
    }); 
    t.textContent = `R$ ${total.toFixed(2)}`; q.textContent = `${qtd}`; 
}
function abrirModalLimpeza() { if(confirm("Limpar Carrinho?")) { limparCarrinho(); } }

async function trocarAba(aba) { 
    const abas = ['registrar', 'consultar', 'catalogo', 'chat']; if (scannerIsRunning) fecharCamera(); 
    abas.forEach(a => { document.getElementById(a + '-container').classList.add('hidden'); document.getElementById('nav-' + a).classList.remove('active-tab'); }); 
    document.getElementById(aba + '-container').classList.remove('hidden'); document.getElementById('nav-' + aba).classList.add('active-tab'); 
    if(aba === 'catalogo') carregarCatalogo(); 
    if (aba === 'chat') setTimeout(rolarChatParaFim, 100); 
}

async function carregarCatalogo() { try { const r = await fetch(`${APPS_SCRIPT_URL}?acao=listarCatalogo`, { redirect: 'follow' }); const d = await r.json(); catalogoDados = d.catalogo || []; atualizarListaCatalogo(catalogoDados); } catch(e) {} }

// 🔥 RENDERIZAR CATÁLOGO NEUBRUTAL (Com IMAGEM central)
function atualizarListaCatalogo(d) { 
    const l = document.getElementById('lista-catalogo'); l.innerHTML = ''; 
    d.forEach(i => { 
        l.innerHTML += `
        <div class="produto-card animate-fade-in">
            <div class="produto-img-wrapper">
                <img src="${i.imagem || FallbackImage}" alt="${i.produto}" onerror="this.src='${FallbackImage}'">
            </div>
            <div class="flex-1 flex justify-between items-center">
                <div>
                    <b class="text-sm block text-black">${i.produto}</b>
                    <span class="text-[9px] uppercase tracking-wider bg-cyber-yellow px-1 rounded font-bold">${i.mercado}</span>
                </div>
                <div class="text-right">
                    <span class="text-black font-black block text-xl leading-none">R$ ${i.preco.toFixed(2)}</span>
                    <button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}', '${i.imagem}')" class="btn-cyber px-3 py-1 rounded text-[10px] mt-1.5">+ ADD</button>
                </div>
            </div>
        </div>`; 
    }); 
}

// 🔥 RENDERIZAR BUSCA NEUBRUTAL (Com IMAGEM)
async function pesquisarPrecos() { 
    const t = document.getElementById('ean-busca').value; if (!t) return mostrarNotificacao("Digite algo", "erro");
    mostrarNotificacao("Buscando ofertas...");
    const r = await fetch(`${APPS_SCRIPT_URL}?acao=consultarPrecos&ean=${encodeURIComponent(t)}`, { redirect: 'follow' }); const d = await r.json(); const c = document.getElementById('resultados-consulta'); 
    c.innerHTML = ''; if (!d.resultados || d.resultados.length === 0) { c.innerHTML = '<p class="text-center opacity-50 p-5pt-20">Nada encontrado pro "'+t+'", visse?</p>'; return; }
    d.resultados.forEach(i => { 
        c.innerHTML += `
        <div class="produto-card animate-fade-in">
            <div class="produto-img-wrapper">
                <img src="${i.imagem || FallbackImage}" onerror="this.src='${FallbackImage}'">
            </div>
            <div class="flex-1 flex justify-between items-center">
                <div>
                    <b class="text-black font-bold">${i.produto}</b><br>
                    <span class="text-[10px] bg-[#f1f1f1] px-2 py-0.5 rounded border border-black uppercase font-bold">${i.mercado}</span>
                </div>
                <div class="text-right">
                    <span class="text-black font-black text-2xl lidering-none">R$ ${i.preco.toFixed(2)}</span>
                    <button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}', '${i.imagem}')" class="btn-cyber px-3 py-1 rounded text-[10px] mt-1.5">+ ADD</button>
                </div>
            </div>
        </div>`; 
    }); 
}

function mostrarNotificacao(m, tipo = 'sucesso') { 
    const t = document.getElementById('toast-notification'); document.getElementById('toast-message').textContent = m; 
    const icon = document.getElementById('toast-icon');
    if(tipo === 'erro') { t.className = "fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded shadow-2xl z-[200] flex items-center gap-3 font-bold transition-all duration-300 pointer-events-none bg-red-100 text-red-700 border border-red-600"; icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    } else { t.className = "fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded shadow-2xl z-[200] flex items-center gap-3 font-bold transition-all duration-300 pointer-events-none bg-emerald-100 text-emerald-800 border border-emerald-600"; icon.innerHTML = '<i class="fas fa-check-circle"></i>'; }
    t.classList.remove('-translate-y-32', 'opacity-0'); setTimeout(() => t.classList.add('-translate-y-32', 'opacity-0'), 3000); 
}

// Câmera e Salvar (Mantidos da v49)
async function iniciarCamera(m) { modoScanAtual = m; document.getElementById('scanner-modal').classList.remove('hidden'); document.getElementById('scanner-modal').classList.add('flex'); try { html5QrCode = new Html5Qrcode("reader"); scannerIsRunning = true; await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess); } catch(e){mostrarNotificacao("Erro na câmera"); fecharCamera(); } }
function fecharCamera() { if(scannerIsRunning && html5QrCode) { html5QrCode.stop(); scannerIsRunning = false; } document.getElementById('scanner-modal').classList.add('hidden'); document.getElementById('scanner-modal').classList.remove('flex');}
async function onScanSuccess(t) { fecharCamera(); if (modoScanAtual === 'pesquisar') { trocarAba('consultar'); document.getElementById('ean-busca').value = t; pesquisarPrecos(); } else { trocarAba('registrar'); document.getElementById('registrar-home').classList.add('hidden'); document.getElementById('price-form-section').classList.remove('hidden'); document.getElementById('ean-field').value = t; document.getElementById('product-name').value = "Buscando..."; try { const res = await fetch(`${APPS_SCRIPT_URL}?ean=${t}`, { redirect: 'follow' }); const data = await res.json(); document.getElementById('product-name').value = data.nome || ""; if (data.imagem && data.imagem.startsWith('http')) { document.getElementById('image-url-field').value = data.imagem; document.getElementById('preview-imagem').src = data.imagem; document.getElementById('preview-imagem').classList.remove('hidden'); document.getElementById('btn-camera-foto').classList.add('hidden'); } } catch(e) { document.getElementById('product-name').value = ""; } } }
async function salvarPreco(e) { e.preventDefault();mostrarNotificacao("Enviando oferta..."); const p = { ean: document.getElementById('ean-field').value, produto: document.getElementById('product-name').value, preco: document.getElementById('price').value, mercado: document.getElementById('market').value, usuario: document.getElementById('username').value, imagem: document.getElementById('image-url-field').value }; await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(p), mode: 'no-cors' }); mostrarNotificacao("Oferta salva! Valeu, macho!"); setTimeout(() => location.reload(), 1500); }
function comprimirImagem(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (e) => { const img = new Image(); img.src = e.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const scale = 800 / img.width; canvas.width = 800; canvas.height = img.height * scale; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.6)); }; }; }); }

document.addEventListener('DOMContentLoaded', () => { 
    atualizarContadorCarrinho(); 
    document.getElementById('btn-enviar-chat').addEventListener('click', enviarMensagemGemini);
    document.getElementById('chat-input').addEventListener('keypress', function (e) { if (e.key === 'Enter') enviarMensagemGemini(); });
    const btnFoto = document.getElementById('btn-camera-foto'); const inputFoto = document.getElementById('input-foto-produto'); const imgPreview = document.getElementById('preview-imagem'); const urlField = document.getElementById('image-url-field');
    btnFoto.addEventListener('click', () => inputFoto.click()); inputFoto.addEventListener('change', async (e) => { if(e.target.files && e.target.files[0]) { btnFoto.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; const file = e.target.files[0]; try { const base64 = await comprimirImagem(file); imgPreview.src = base64; imgPreview.classList.remove('hidden'); btnFoto.classList.add('hidden'); urlField.value = base64; } catch(err) { mostrarNotificacao("Erro na foto", "erro"); btnFoto.innerHTML = '<i class="fas fa-camera text-black text-xl"></i>'; } } });
    document.getElementById('filtro-mercado-catalogo').addEventListener('change', (e) => { const v = e.target.value; if(v === 'todos') atualizarListaCatalogo(catalogoDados); else atualizarListaCatalogo(catalogoDados.filter(i => i.mercado === v)); });
    document.getElementById('btn-pesquisar').addEventListener('click', pesquisarPrecos);
    document.getElementById('price-form').addEventListener('submit', salvarPreco);
    (async () => { try { const res = await fetch(`${APPS_SCRIPT_URL}?acao=buscarMercados`, { redirect: 'follow' }); const d = await res.json(); const s = document.getElementById('market'); if(d.mercados) { s.innerHTML = ''; d.mercados.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; s.appendChild(o); }); } } catch(e) {} })(); 
});
