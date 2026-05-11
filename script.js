// script.js - v50.0 (Cyber-Glass, Modo Voz Imersivo e Memória)

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
        
        // Mágica da Animação do Espectrograma
        if (isModoVoz) {
            const espectro = document.getElementById('spectrogram');
            const statusText = document.getElementById('voice-status');
            
            kalangoAudioAtual.onplay = () => { espectro.classList.add('espectro-ativo'); };
            kalangoAudioAtual.onended = () => { 
                espectro.classList.remove('espectro-ativo'); 
                statusText.textContent = "Toque para Falar"; 
            };
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
        if(modoVozAtivo) {
            statusText.textContent = "Ouvindo...";
            btnCentral.classList.add('mic-pulsing');
            document.getElementById('spectrogram').classList.remove('espectro-ativo');
        } else {
            document.getElementById('chat-input').placeholder = "Ouvindo...";
        }
    };
    
    rec.onresult = (e) => {
        const textoOuvido = e.results[0][0].transcript;
        if(modoVozAtivo) {
            btnCentral.classList.remove('mic-pulsing');
            processarMensagemVoz(textoOuvido);
        } else {
            document.getElementById('chat-input').value = textoOuvido;
            setTimeout(enviarMensagemGemini, 500); 
        }
    };
    
    rec.onerror = () => { if(modoVozAtivo) { statusText.textContent = "Não entendi, tente de novo."; btnCentral.classList.remove('mic-pulsing'); } };
    rec.onend = () => { if(!modoVozAtivo) document.getElementById('chat-input').placeholder = "Pergunte ao Kalango..."; };
    rec.start();
}

async function processarMensagemVoz(txt) {
    const statusText = document.getElementById('voice-status');
    const userName = currentUser ? currentUser.displayName.split(' ')[0] : "Amigo";
    statusText.textContent = "Kalango Pensando...";

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
            adicionarAoCarrinho(p[0].trim(), parseFloat(p[1].trim())||0, p[2]?p[2].trim():"Chat");
            resposta = resposta.replace(cmd[0], "");
        }

        statusText.textContent = "Kalango Falando...";
        await falarComVozDoKalango(resposta, true);

    } catch (e) {
        statusText.textContent = "Erro de conexão.";
    }
}

function rolarChatParaFim() {
    const area = document.getElementById('chat-messages');
    let spacer = document.getElementById('chat-spacer');
    if (!spacer) {
        spacer = document.createElement('div');
        spacer.id = 'chat-spacer';
        spacer.className = 'h-32 w-full shrink-0'; 
    }
    area.appendChild(spacer); 
    area.scrollTop = area.scrollHeight; 
}

async function enviarMensagemGemini() {
    const input = document.getElementById('chat-input');
    const area = document.getElementById('chat-messages');
    const txt = input.value.trim();
    if (!txt) return;

    const userName = currentUser ? currentUser.displayName.split(' ')[0] : "Amigo(a)";

    const divUser = document.createElement('div');
    divUser.className = 'chat-user text-sm mb-2';
    divUser.textContent = txt;
    area.appendChild(divUser);
    
    input.value = ''; rolarChatParaFim();

    const id = 'load-' + Date.now();
    const divLoad = document.createElement('div');
    divLoad.id = id;
    divLoad.className = 'chat-ai text-sm mb-2 opacity-50';
    divLoad.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Pensando...';
    area.appendChild(divLoad);
    rolarChatParaFim();

    const historyString = historicoChat.slice(-6).join("\n");
    historicoChat.push(userName + ": " + txt);
    localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

    try {
        const fetchUrl = `${APPS_SCRIPT_URL}?acao=chatGemini&pergunta=${encodeURIComponent(txt)}&nome=${encodeURIComponent(userName)}&historico=${encodeURIComponent(historyString)}`;
        const res = await fetch(fetchUrl, { redirect: 'follow' });
        const data = await res.json();
        
        document.getElementById(id).remove();
        let respostaFinal = data.resposta || "Sem resposta.";

        historicoChat.push("Kalango: " + respostaFinal.replace(/\|\|ADD:(.*?)\|\|/g, ""));
        localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

        const comandoAdd = respostaFinal.match(/\|\|ADD:(.*?)\|\|/);
        if (comandoAdd && comandoAdd[1]) {
            const partes = comandoAdd[1].split('::');
            adicionarAoCarrinho(partes[0].trim(), parseFloat(partes[1].trim()) || 0, partes[2] ? partes[2].trim() : "Chat");
            respostaFinal = respostaFinal.replace(comandoAdd[0], "");
        }

        falarComVozDoKalango(respostaFinal, false);

        const divAI = document.createElement('div');
        divAI.className = 'chat-ai text-sm mb-2';
        divAI.innerHTML = respostaFinal.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        area.appendChild(divAI);

    } catch (e) {
        if(document.getElementById(id)) document.getElementById(id).remove();
        const divErr = document.createElement('div');
        divErr.className = 'chat-ai text-sm mb-2 text-red-400';
        divErr.textContent = "Erro de conexão.";
        area.appendChild(divErr);
    }
    rolarChatParaFim();
}


// =========================================================================
// LÓGICA DO APLICATIVO
// =========================================================================

function fazerLoginGoogle() { 
    const provider = new firebase.auth.GoogleAuthProvider(); 
    provider.setCustomParameters({ prompt: 'select_account' });
    auth.signInWithPopup(provider).catch((error) => {
        if (error.code === 'auth/unauthorized-domain') alert("⚠️ Domínio não autorizado no Firebase!");
        else auth.signInWithRedirect(provider);
    }); 
}

auth.onAuthStateChanged((user) => { 
    if (user) { 
        currentUser = user; 
        document.getElementById('login-screen').classList.add('hidden'); 
        document.getElementById('app-content').classList.remove('hidden');
        document.getElementById('app-content').classList.add('flex');
        
        document.getElementById('user-profile').classList.remove('hidden'); 
        document.getElementById('user-profile').classList.add('flex'); 
        document.getElementById('user-name-display').textContent = user.displayName.split(' ')[0]; 
        document.getElementById('user-avatar').src = user.photoURL; 
        
        document.getElementById('username').value = user.displayName; 
        atualizarContadorCarrinho(); 
        carregarCatalogo();
        trocarAba('chat');
    } else { 
        currentUser = null; 
        document.getElementById('login-screen').classList.remove('hidden'); 
        document.getElementById('app-content').classList.add('hidden');
        document.getElementById('app-content').classList.remove('flex');
    } 
});

function adicionarAoCarrinho(produto, preco, mercado) {
    const id = produto + mercado; 
    const existente = carrinho.find(i => i.id === id);
    if (existente) existente.qtd++; else carrinho.push({ id, produto, preco, mercado, qtd: 1 });
    salvarCarrinho(); mostrarNotificacao(`+1 ${produto}`);
    const btn = document.getElementById('btn-carrinho-flutuante');
    if(btn) { btn.classList.remove('hidden'); btn.classList.add('scale-110'); setTimeout(() => btn.classList.remove('scale-110'), 200); }
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
        carrinho = []; salvarCarrinho(); renderizarCarrinho(); toggleCarrinho(); 
        historicoChat = []; localStorage.removeItem('kalango_chat_history');
    } 
}
function salvarCarrinho() { localStorage.setItem('kalango_cart', JSON.stringify(carrinho)); atualizarContadorCarrinho(); }
function renderizarCarrinho() { 
    const c = document.getElementById('cart-items'); const t = document.getElementById('cart-total-price'); const q = document.getElementById('cart-total-items'); 
    if (carrinho.length === 0) { c.innerHTML = '<p class="text-center opacity-30 p-10">Vazio</p>'; t.textContent = "R$ 0,00"; q.textContent = "0"; return; } 
    c.innerHTML = ''; let total = 0; let qtd = 0; 
    carrinho.forEach(i => { 
        total += i.preco * i.qtd; qtd += i.qtd; 
        c.innerHTML += `<div class="glass-panel p-3 rounded-xl mb-2 flex justify-between items-center"><div class="flex-1"><b>${i.produto}</b><br><small class="text-emerald-500/80 uppercase tracking-wider text-[9px]">${i.mercado}</small></div><div class="text-right"><span class="text-emerald-400 font-black block mb-1">R$ ${(i.preco * i.qtd).toFixed(2)}</span><div class="flex items-center gap-2 bg-[#020617] rounded-lg px-2 py-1 border border-white/5"><button onclick="alterarQtd('${i.id}',-1)" class="text-red-400 font-bold px-2">-</button> <span class="text-xs w-4 text-center">${i.qtd}</span> <button onclick="alterarQtd('${i.id}',1)" class="text-emerald-400 font-bold px-2">+</button></div></div></div>`; 
    }); 
    t.textContent = `R$ ${total.toFixed(2)}`; q.textContent = `${qtd}`; 
}
function abrirModalLimpeza() { if(confirm("Limpar Carrinho?")) { limparCarrinho(); } }

async function trocarAba(aba) { 
    const abas = ['registrar', 'consultar', 'catalogo', 'chat']; if (scannerIsRunning) fecharCamera(); 
    abas.forEach(a => { document.getElementById(a + '-container').classList.add('hidden'); document.getElementById('nav-' + a).classList.remove('text-emerald-400'); }); 
    document.getElementById(aba + '-container').classList.remove('hidden'); document.getElementById('nav-' + aba).classList.add('text-emerald-400'); 
    if(aba === 'catalogo') carregarCatalogo(); 
    if (aba === 'chat') setTimeout(() => rolarChatParaFim(), 100); 
}

async function carregarCatalogo() { try { const r = await fetch(`${APPS_SCRIPT_URL}?acao=listarCatalogo`, { redirect: 'follow' }); const d = await r.json(); catalogoDados = d.catalogo || []; atualizarListaCatalogo(catalogoDados); } catch(e) {} }
function atualizarListaCatalogo(d) { 
    const l = document.getElementById('lista-catalogo'); l.innerHTML = ''; 
    d.forEach(i => { 
        l.innerHTML += `
        <div class="glass-panel p-4 mb-3 flex justify-between items-center rounded-2xl">
            <div class="flex gap-3 items-center">
                <div class="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10"><i class="fas fa-box text-emerald-500"></i></div>
                <div><b class="text-white block text-sm">${i.produto}</b><span class="text-[9px] uppercase tracking-wider opacity-50">${i.mercado}</span></div>
            </div>
            <div class="text-right">
                <span class="text-emerald-400 font-black block text-lg">R$ ${i.preco.toFixed(2)}</span>
                <button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}')" class="btn-cyber px-3 py-1 rounded-lg mt-1 text-[10px]">+ ADD</button>
            </div>
        </div>`; 
    }); 
}

async function pesquisarPrecos() { 
    const t = document.getElementById('ean-busca').value; if (!t) return mostrarNotificacao("Digite algo", "erro");
    const r = await fetch(`${APPS_SCRIPT_URL}?acao=consultarPrecos&ean=${encodeURIComponent(t)}`, { redirect: 'follow' }); const d = await r.json(); const c = document.getElementById('resultados-consulta'); 
    c.innerHTML = ''; if (!d.resultados || d.resultados.length === 0) { c.innerHTML = '<p class="text-center opacity-50 p-5">Nada encontrado.</p>'; return; }
    d.resultados.forEach(i => { 
        c.innerHTML += `<div class="glass-panel p-4 rounded-2xl mb-3 flex justify-between items-center"><div><b class="text-white">${i.produto}</b><br><span class="text-emerald-400 font-black text-xl">R$ ${i.preco.toFixed(2)}</span><span class="text-[9px] bg-white/10 px-2 py-1 rounded ml-2 uppercase tracking-wider">${i.mercado}</span></div><button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}')" class="text-white bg-emerald-600 hover:bg-emerald-500 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"><i class="fas fa-plus"></i></button></div>`; 
    }); 
}

function mostrarNotificacao(m, tipo = 'sucesso') { 
    const t = document.getElementById('toast-notification'); document.getElementById('toast-message').textContent = m; 
    if(tipo === 'erro') { t.className = "fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-[0_10px_40px_rgba(239,68,68,0.5)] z-[100] flex items-center gap-3 font-bold transition-all duration-300 bg-red-500 text-white border border-red-400";
    } else { t.className = "fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.5)] z-[100] flex items-center gap-3 font-bold transition-all duration-300 bg-emerald-600 text-white border border-emerald-400"; }
    t.classList.remove('-translate-y-32', 'opacity-0'); setTimeout(() => t.classList.add('-translate-y-32', 'opacity-0'), 3000); 
}

async function iniciarCamera(m) { 
    modoScanAtual = m; document.getElementById('scanner-modal').classList.remove('hidden'); document.getElementById('scanner-modal').classList.add('flex');
    try { html5QrCode = new Html5Qrcode("reader"); scannerIsRunning = true; await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess); } catch(e){ alert("Erro na Câmera"); fecharCamera(); } 
}
function fecharCamera() { if(scannerIsRunning && html5QrCode) { html5QrCode.stop(); scannerIsRunning = false; } document.getElementById('scanner-modal').classList.add('hidden'); document.getElementById('scanner-modal').classList.remove('flex');}
async function onScanSuccess(t) { 
    fecharCamera(); 
    if (modoScanAtual === 'pesquisar') { trocarAba('consultar'); document.getElementById('ean-busca').value = t; pesquisarPrecos(); 
    } else { 
        trocarAba('registrar'); 
        document.getElementById('registrar-home').classList.add('hidden'); document.getElementById('price-form-section').classList.remove('hidden'); 
        document.getElementById('ean-field').value = t; document.getElementById('product-name').value = "Buscando..."; 
        try { 
            const res = await fetch(`${APPS_SCRIPT_URL}?ean=${t}`, { redirect: 'follow' }); const data = await res.json(); 
            document.getElementById('product-name').value = data.nome || ""; 
            if (data.imagem && data.imagem.startsWith('http')) { document.getElementById('image-url-field').value = data.imagem; document.getElementById('preview-imagem').src = data.imagem; document.getElementById('preview-imagem').classList.remove('hidden'); document.getElementById('btn-camera-foto').classList.add('hidden'); } 
        } catch(e) { document.getElementById('product-name').value = ""; } 
    } 
}

async function salvarPreco(e) { 
    e.preventDefault(); const p = { ean: document.getElementById('ean-field').value, produto: document.getElementById('product-name').value, preco: document.getElementById('price').value, mercado: document.getElementById('market').value, usuario: document.getElementById('username').value }; 
    await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(p), mode: 'no-cors' }); mostrarNotificacao("Salvo com sucesso!"); setTimeout(() => location.reload(), 1500);
}

function comprimirImagem(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (e) => { const img = new Image(); img.src = e.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const scale = 800 / img.width; canvas.width = 800; canvas.height = img.height * scale; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.6)); }; }; }); }

document.addEventListener('DOMContentLoaded', () => { 
    atualizarContadorCarrinho(); 
    if(document.getElementById('btn-enviar-chat')) { document.getElementById('btn-enviar-chat').addEventListener('click', enviarMensagemGemini); }
    const inputChat = document.getElementById('chat-input');
    if(inputChat) { inputChat.addEventListener('keypress', function (e) { if (e.key === 'Enter') { enviarMensagemGemini(); } }); }
    const btnFoto = document.getElementById('btn-camera-foto'); const inputFoto = document.getElementById('input-foto-produto'); const imgPreview = document.getElementById('preview-imagem'); const urlField = document.getElementById('image-url-field');
    if(btnFoto && inputFoto) { btnFoto.addEventListener('click', () => inputFoto.click()); inputFoto.addEventListener('change', async (e) => { if(e.target.files && e.target.files[0]) { const file = e.target.files[0]; btnFoto.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; try { const base64 = await comprimirImagem(file); imgPreview.src = base64; imgPreview.classList.remove('hidden'); btnFoto.classList.add('hidden'); urlField.value = base64; } catch(err) { mostrarNotificacao("Erro na foto", "erro"); btnFoto.innerHTML = '<i class="fas fa-camera text-emerald-400 text-xl mb-1"></i><span class="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">Foto</span>'; } } }); }
    const f = document.getElementById('filtro-mercado-catalogo'); if(f) { f.addEventListener('change', () => { const v = f.value; if(v === 'todos') atualizarListaCatalogo(catalogoDados); else atualizarListaCatalogo(catalogoDados.filter(i => i.mercado === v)); }); }
    if(document.getElementById('btn-pesquisar')) { document.getElementById('btn-pesquisar').addEventListener('click', pesquisarPrecos); }
    if(document.getElementById('price-form')) { document.getElementById('price-form').addEventListener('submit', salvarPreco); }
    (async () => { try { const res = await fetch(`${APPS_SCRIPT_URL}?acao=buscarMercados`, { redirect: 'follow' }); const d = await res.json(); const s = document.getElementById('market'); if(d.mercados && s) { s.innerHTML = ''; d.mercados.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; s.appendChild(o); }); } } catch(e) {} })(); 
});
