// script.js - v102.0 (Dark Mode Fixes, Photo Preview & Autor)

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
// SPLASH SCREEN (SINCRONIZADA COM O VÍDEO)
// =========================================================================
window.addEventListener('load', () => {
    const video = document.getElementById('intro-video');
    const splash = document.getElementById('splash-screen');

    function finalizarIntro() {
        if (splash && !splash.classList.contains('opacity-0')) {
            splash.classList.add('opacity-0');
            setTimeout(() => {
                splash.remove(); 
                if(currentUser) mostrarInterfacePrincipal();
                else mostrarTelaLogin();
            }, 1000); 
        }
    }

    if (video) {
        video.onended = finalizarIntro;
        setTimeout(finalizarIntro, 8000); 
    } else {
        setTimeout(finalizarIntro, 3000);
    }
});

function mostrarInterfacePrincipal() {
    const login = document.getElementById('login-screen');
    if(login) login.classList.add('hidden'); 
    
    const header = document.getElementById('main-header');
    if(header) header.classList.remove('hidden');
    
    const main = document.getElementById('main-container');
    if(main) {
        main.classList.remove('hidden'); 
        main.classList.add('flex');
    }
    
    trocarAba('chat');
}

function mostrarTelaLogin() {
    const login = document.getElementById('login-screen');
    if(login) {
        login.classList.remove('hidden');
        login.classList.remove('opacity-0');
    }
    
    const header = document.getElementById('main-header');
    if(header) header.classList.add('hidden');
    
    const main = document.getElementById('main-container');
    if(main) {
        main.classList.add('hidden'); 
        main.classList.remove('flex');
    }
}

// =========================================================================
// MENU LATERAL E ABAS
// =========================================================================
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full'); sidebar.classList.add('translate-x-0');
        overlay.classList.remove('hidden'); setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    } else {
        sidebar.classList.add('-translate-x-full'); sidebar.classList.remove('translate-x-0');
        overlay.classList.add('opacity-0'); setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

async function trocarAba(aba) { 
    const abas = ['registrar', 'consultar', 'catalogo', 'chat']; 
    if (scannerIsRunning) fecharCamera(); 
    
    abas.forEach(a => { 
        const container = document.getElementById(a + '-container');
        if(container) container.classList.add('hidden'); 
        const nav = document.getElementById('nav-' + a);
        if(nav) nav.classList.remove('active-tab'); 
    }); 
    
    const containerAtivo = document.getElementById(aba + '-container');
    if(containerAtivo) containerAtivo.classList.remove('hidden'); 
    const navAtivo = document.getElementById('nav-' + aba);
    if(navAtivo) navAtivo.classList.add('active-tab'); 
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) toggleMenu(); 
    
    if(aba === 'catalogo') carregarCatalogo(); 
    if (aba === 'chat') setTimeout(rolarChatParaFim, 100); 
}

// =========================================================================
// MODO VOZ E AZURE
// =========================================================================
let kalangoAudioAtual = null; let modoVozAtivo = false;
function abrirModoVoz() { modoVozAtivo = true; document.getElementById('voice-mode-overlay').classList.remove('hidden'); document.getElementById('voice-mode-overlay').classList.add('flex'); iniciarGravacaoVoz(); }
function fecharModoVoz() { modoVozAtivo = false; document.getElementById('voice-mode-overlay').classList.add('hidden'); document.getElementById('voice-mode-overlay').classList.remove('flex'); if (kalangoAudioAtual) { kalangoAudioAtual.pause(); kalangoAudioAtual.currentTime = 0; } }

async function falarComVozDoKalango(texto, isModoVoz = false) {
    const P1 = "w8U2w2dwLljaTDN0Dt9AIHiGt8"; const P2 = "olZ4YTYqUJR10T79iTRHZjHCWLJQQJ99CEACYeBjFXJ3w3AAAYACOGrJEO"; const CHAVE_AZURE = P1 + P2; const REGIAO_AZURE = "eastus";
    if (kalangoAudioAtual) { kalangoAudioAtual.pause(); kalangoAudioAtual.currentTime = 0; }
    let textoLimpo = texto.replace(/<[^>]*>?/gm, '').replace(/[*_]/g, '').replace(/\.\.\./g, ', ').replace(/!/g, '. ').replace(/hummm/gi, '');
    const ssml = `<speak version='1.0' xml:lang='pt-BR'><voice xml:lang='pt-BR' xml:gender='Male' name='pt-BR-AntonioNeural'><prosody rate="1.07" pitch="1.5%">${textoLimpo}</prosody></voice></speak>`;
    const url = `https://${REGIAO_AZURE}.tts.speech.microsoft.com/cognitiveservices/v1`;
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': CHAVE_AZURE, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3' }, body: ssml });
        kalangoAudioAtual = new Audio(URL.createObjectURL(await response.blob()));
        if (isModoVoz) {
            const espectro = document.getElementById('spectrogram'); const statusText = document.getElementById('voice-status');
            kalangoAudioAtual.onplay = () => { espectro.classList.remove('opacity-0'); statusText.textContent = "Falando..."; };
            kalangoAudioAtual.onended = () => { espectro.classList.add('opacity-0'); statusText.textContent = "Ouvindo..."; };
        }
        kalangoAudioAtual.play();
    } catch (e) { kalangoAudioAtual = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textoLimpo)}&tl=pt-BR&client=tw-ob`); kalangoAudioAtual.play(); }
}

function iniciarGravacaoVoz() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return mostrarNotificacao("Voz não suportada", "erro");
    const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)(); rec.lang = 'pt-BR'; rec.interimResults = false;
    const statusText = document.getElementById('voice-status');
    rec.onstart = () => { if(modoVozAtivo) statusText.textContent = "Pode falar..."; else document.getElementById('chat-input').placeholder = "Ouvindo..."; };
    rec.onresult = (e) => { const txt = e.results[0][0].transcript; if(modoVozAtivo) processarMensagemVoz(txt); else { document.getElementById('chat-input').value = txt; setTimeout(enviarMensagemGemini, 500); } };
    rec.onerror = () => { if(modoVozAtivo) statusText.textContent = "Tente novamente"; };
    rec.onend = () => { if(!modoVozAtivo) document.getElementById('chat-input').placeholder = "Mensagem..."; };
    rec.start();
}

async function processarMensagemVoz(txt) {
    const statusText = document.getElementById('voice-status'); const userName = currentUser ? (currentUser.displayName || "Usuário").split(' ')[0] : "Usuário";
    statusText.textContent = "Pensando...";
    historicoChat.push(userName + " (Áudio): " + txt); localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));
    try {
        const r = await fetch(`${APPS_SCRIPT_URL}?acao=chatGemini&pergunta=${encodeURIComponent(txt)}&nome=${encodeURIComponent(userName)}&historico=${encodeURIComponent(historicoChat.slice(-6).join("\n"))}`);
        const data = await r.json(); let resposta = data.resposta || "Erro.";
        historicoChat.push("Kalango: " + resposta.replace(/\|\|ADD:(.*?)\|\|/g, "")); localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));
        const cmd = resposta.match(/\|\|ADD:(.*?)\|\|/);
        if (cmd && cmd[1]) {
            const p = cmd[1].split('::'); const catItem = catalogoDados.find(i => i.produto === p[0].trim());
            adicionarAoCarrinho(p[0].trim(), parseFloat(p[1].trim())||0, p[2]?p[2].trim():"Chat", catItem ? catItem.imagem : FallbackImage);
            resposta = resposta.replace(cmd[0], "");
        }
        await falarComVozDoKalango(resposta, true);
    } catch (e) { statusText.textContent = "Erro de rede"; }
}

function rolarChatParaFim() { const area = document.getElementById('chat-messages'); if(area) area.scrollTop = area.scrollHeight; }

async function enviarMensagemGemini() {
    const input = document.getElementById('chat-input'); const area = document.getElementById('chat-messages'); const txt = input.value.trim();
    if (!txt) return; const userName = currentUser ? (currentUser.displayName || "Usuário").split(' ')[0] : "Usuário";
    area.innerHTML += `<div class="chat-user animate-fade-in">${txt}</div>`; input.value = ''; rolarChatParaFim();
    const id = 'load-' + Date.now(); area.innerHTML += `<div id="${id}" class="chat-ai opacity-50"><i class="fas fa-circle-notch fa-spin text-[#ff7e21] mr-2"></i>Pensando...</div>`; rolarChatParaFim();
    historicoChat.push(userName + ": " + txt); localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));

    try {
        const fetchUrl = `${APPS_SCRIPT_URL}?acao=chatGemini&pergunta=${encodeURIComponent(txt)}&nome=${encodeURIComponent(userName)}&historico=${encodeURIComponent(historicoChat.slice(-6).join("\n"))}`;
        const res = await fetch(fetchUrl, { redirect: 'follow' }); const data = await res.json();
        const loadDiv = document.getElementById(id); if(loadDiv) loadDiv.remove(); 
        let respostaFinal = data.resposta || "Sem resposta.";
        historicoChat.push("Kalango: " + respostaFinal.replace(/\|\|ADD:(.*?)\|\|/g, "")); localStorage.setItem('kalango_chat_history', JSON.stringify(historicoChat));
        const comandoAdd = respostaFinal.match(/\|\|ADD:(.*?)\|\|/);
        if (comandoAdd && comandoAdd[1]) {
            const partes = comandoAdd[1].split('::'); const catItem = catalogoDados.find(i => i.produto === partes[0].trim());
            adicionarAoCarrinho(partes[0].trim(), parseFloat(partes[1].trim()) || 0, partes[2] ? partes[2].trim() : "Chat", catItem ? catItem.imagem : FallbackImage);
            respostaFinal = respostaFinal.replace(comandoAdd[0], "");
        }
        falarComVozDoKalango(respostaFinal, false);
        area.innerHTML += `<div class="chat-ai animate-fade-in">${respostaFinal.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</div>`;
    } catch (e) { const loadDiv = document.getElementById(id); if(loadDiv) loadDiv.remove(); area.innerHTML += `<div class="chat-ai text-red-500"><i class="fas fa-exclamation-triangle"></i> Erro.</div>`; }
    rolarChatParaFim();
}

// =========================================================================
// INICIALIZAÇÃO DE LOGIN
// =========================================================================
function fazerLoginGoogle() { const provider = new firebase.auth.GoogleAuthProvider(); auth.signInWithPopup(provider).catch(() => auth.signInWithRedirect(provider)); }

auth.onAuthStateChanged((user) => { 
    if (user) { 
        currentUser = user; 
        try {
            const nomeCompleto = user.displayName || "Usuário";
            const primeiroNome = nomeCompleto.split(' ')[0];
            const foto = user.photoURL || FallbackImage;
            
            const sideName = document.getElementById('user-name-display'); if(sideName) sideName.textContent = primeiroNome + "!"; 
            const sideAvatar = document.getElementById('user-avatar'); if(sideAvatar) sideAvatar.src = foto; 
            
            const headerName = document.getElementById('header-name'); if(headerName) headerName.textContent = primeiroNome;
            const headerAvatar = document.getElementById('header-avatar'); if(headerAvatar) headerAvatar.src = foto;
            const usernameInput = document.getElementById('username'); if(usernameInput) usernameInput.value = nomeCompleto;
        } catch (erro) { console.error("Erro perfil:", erro); }

        atualizarContadorCarrinho(); 
        carregarCatalogo(); 

        const splash = document.getElementById('splash-screen');
        if(!splash) mostrarInterfacePrincipal();

    } else { 
        currentUser = null; 
        const splash = document.getElementById('splash-screen');
        if(!splash) mostrarTelaLogin();
    } 
});

// =========================================================================
// FUNÇÕES DE INTERFACE ATUALIZADAS (DARK MODE + AUTOR DO CADASTRO)
// =========================================================================
function adicionarAoCarrinho(produto, preco, mercado, imagem = '') { const id = produto + mercado; const existente = carrinho.find(i => i.id === id); if (existente) existente.qtd++; else carrinho.push({ id, produto, preco, mercado, qtd: 1, imagem: imagem || FallbackImage }); salvarCarrinho(); mostrarNotificacao(`Adicionado!`); atualizarContadorCarrinho(); }
function toggleCarrinho() { const m = document.getElementById('cart-modal'); const c = document.getElementById('cart-content'); if (m.classList.contains('hidden')) { renderizarCarrinho(); m.classList.remove('hidden'); setTimeout(() => c.classList.remove('translate-y-full'), 10); } else { c.classList.add('translate-y-full'); setTimeout(() => m.classList.add('hidden'), 300); } }
function atualizarContadorCarrinho() { const c = carrinho.reduce((a, b) => a + b.qtd, 0); const b = document.getElementById('cart-count'); if(b) { b.textContent = c; b.classList.toggle('hidden', c === 0); } }
function alterarQtd(id, d) { const i = carrinho.find(x => x.id === id); if (i) { i.qtd += d; if (i.qtd <= 0) carrinho = carrinho.filter(x => x.id !== id); } salvarCarrinho(); renderizarCarrinho(); }
function limparCarrinho() { if(confirm("Esvaziar o carrinho?")) { carrinho = []; salvarCarrinho(); renderizarCarrinho(); toggleCarrinho(); historicoChat = []; localStorage.removeItem('kalango_chat_history'); } }
function salvarCarrinho() { localStorage.setItem('kalango_cart', JSON.stringify(carrinho)); atualizarContadorCarrinho(); }

function renderizarCarrinho() { 
    const c = document.getElementById('cart-items'); const t = document.getElementById('cart-total-price'); 
    if (carrinho.length === 0) { c.innerHTML = '<p class="text-center opacity-40 pt-10 text-sm font-bold text-white">Vazio</p>'; t.textContent = "R$ 0,00"; return; } 
    c.innerHTML = ''; let total = 0; 
    carrinho.forEach(i => { 
        total += i.preco * i.qtd; 
        c.innerHTML += `
        <div class="app-card p-4 flex justify-between items-center animate-fade-in border border-white/5 bg-[#161e2d] rounded-2xl mb-3">
            <div class="flex items-center gap-3 w-2/3">
                <div class="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-[#0a0f18] border border-[#ff7e21]/20">
                    <img src="${i.imagem}" onerror="this.src='${FallbackImage}'" class="w-full h-full object-cover">
                </div>
                <div class="truncate">
                    <b class="text-white text-sm truncate block w-full">${i.produto}</b>
                    <small class="text-[#ff7e21] font-bold text-[10px] block uppercase">${i.mercado}</small>
                </div>
            </div>
            <div class="text-right">
                <span class="text-white font-bold block text-base mb-2">R$ ${(i.preco * i.qtd).toFixed(2)}</span>
                <div class="flex items-center justify-end gap-2 bg-[#0a0f18] rounded-xl border border-white/5 p-1">
                    <button onclick="alterarQtd('${i.id}',-1)" class="text-slate-400 font-bold hover:text-red-500 px-2 text-lg">-</button> 
                    <span class="text-white font-bold text-sm w-4 text-center">${i.qtd}</span> 
                    <button onclick="alterarQtd('${i.id}',1)" class="text-slate-400 font-bold hover:text-[#ff7e21] px-2 text-lg">+</button>
                </div>
            </div>
        </div>`; 
    }); 
    t.textContent = `R$ ${total.toFixed(2)}`; 
}
function abrirModalLimpeza() { if(confirm("Esvaziar o carrinho?")) { limparCarrinho(); } }

async function carregarCatalogo() { try { const r = await fetch(`${APPS_SCRIPT_URL}?acao=listarCatalogo`, { redirect: 'follow' }); const d = await r.json(); catalogoDados = d.catalogo || []; atualizarListaCatalogo(catalogoDados); } catch(e) {} }

function atualizarListaCatalogo(d) { 
    const l = document.getElementById('lista-catalogo'); if(!l) return; l.innerHTML = ''; 
    if(d.length === 0) { l.innerHTML = '<p class="text-center text-slate-500 mt-10 text-sm">Nenhuma oferta encontrada.</p>'; return; }
    
    d.forEach(i => { 
        l.innerHTML += `
        <div class="app-card p-4 mb-4 flex justify-between items-center animate-fade-in gap-3 relative border border-white/5 bg-[#161e2d] rounded-2xl">
            <div class="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-[#0a0f18] border border-[#ff7e21]/20 relative z-10">
                <img src="${i.imagem || FallbackImage}" onerror="this.src='${FallbackImage}'" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 flex flex-col overflow-hidden relative z-10">
                <b class="text-white text-sm block truncate mb-1">${i.produto}</b>
                <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-[9px] text-[#ff7e21] font-bold bg-[#ff7e21]/10 px-2 py-0.5 rounded uppercase tracking-wider">${i.mercado}</span>
                </div>
                <span class="text-[10px] text-slate-400 font-medium truncate"><i class="fas fa-user-edit text-slate-500 mr-1"></i> Por: ${i.usuario || 'Anônimo'}</span>
            </div>
            <div class="text-right shrink-0 flex flex-col items-end gap-2 relative z-10">
                <span class="text-[#ff7e21] font-black block text-xl leading-none">R$ ${i.preco.toFixed(2)}</span>
                <button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}', '${i.imagem}')" class="bg-[#ff7e21] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-[#ff7e21]/20 active:scale-95 transition-all flex items-center gap-1">
                    <i class="fas fa-plus"></i> Add
                </button>
            </div>
        </div>`; 
    }); 
}

async function pesquisarPrecos() { 
    const t = document.getElementById('ean-busca').value; if (!t) return mostrarNotificacao("Digite algo", "erro");
    mostrarNotificacao("Buscando no radar...");
    const r = await fetch(`${APPS_SCRIPT_URL}?acao=consultarPrecos&ean=${encodeURIComponent(t)}`, { redirect: 'follow' }); const d = await r.json(); const c = document.getElementById('resultados-consulta'); 
    c.innerHTML = ''; if (!d.resultados || d.resultados.length === 0) { c.innerHTML = '<p class="text-center opacity-50 pt-10 text-sm font-bold text-slate-500">Nenhum produto encontrado.</p>'; return; }
    
    d.resultados.forEach(i => { 
        c.innerHTML += `
        <div class="app-card p-4 mb-4 flex justify-between items-center animate-fade-in gap-3 border border-white/5 bg-[#161e2d] rounded-2xl">
            <div class="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-[#0a0f18] border border-[#ff7e21]/20">
                <img src="${i.imagem || FallbackImage}" onerror="this.src='${FallbackImage}'" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 flex flex-col overflow-hidden">
                <b class="text-white text-sm block truncate mb-1">${i.produto}</b>
                <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-[9px] text-[#ff7e21] font-bold bg-[#ff7e21]/10 px-2 py-0.5 rounded uppercase tracking-wider">${i.mercado}</span>
                </div>
                <span class="text-[10px] text-slate-400 font-medium truncate"><i class="fas fa-user-edit text-slate-500 mr-1"></i> Por: ${i.usuario || 'Anônimo'}</span>
            </div>
            <div class="text-right shrink-0 flex flex-col items-end gap-2">
                <span class="text-[#ff7e21] font-black block text-xl leading-none">R$ ${i.preco.toFixed(2)}</span>
                <button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}', '${i.imagem}')" class="bg-[#ff7e21] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-[#ff7e21]/20 active:scale-95 transition-all flex items-center gap-1">
                    <i class="fas fa-plus"></i> Add
                </button>
            </div>
        </div>`; 
    }); 
}

function mostrarNotificacao(m, tipo = 'sucesso') { 
    const t = document.getElementById('toast-notification'); document.getElementById('toast-message').textContent = m; const icon = document.getElementById('toast-icon');
    if(tipo === 'erro') { t.style.backgroundColor = '#ef4444'; icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>'; } 
    else { t.style.backgroundColor = '#ffffff'; icon.innerHTML = '<i class="fas fa-check-circle text-[#ff7e21]"></i>'; }
    t.classList.remove('-translate-y-32', 'opacity-0'); setTimeout(() => t.classList.add('-translate-y-32', 'opacity-0'), 3000); 
}

async function iniciarCamera(m) { modoScanAtual = m; document.getElementById('scanner-modal').classList.remove('hidden'); document.getElementById('scanner-modal').classList.add('flex'); try { html5QrCode = new Html5Qrcode("reader"); scannerIsRunning = true; await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess); } catch(e){mostrarNotificacao("Erro na câmera", "erro"); fecharCamera(); } }
function fecharCamera() { if(scannerIsRunning && html5QrCode) { html5QrCode.stop(); scannerIsRunning = false; } document.getElementById('scanner-modal').classList.add('hidden'); document.getElementById('scanner-modal').classList.remove('flex');}

// =========================================================================
// O SEGREDO DO "INATIVO" RESOLVIDO!
// =========================================================================
async function onScanSuccess(t) { 
    fecharCamera(); 
    if (modoScanAtual === 'pesquisar') { 
        trocarAba('consultar'); document.getElementById('ean-busca').value = t; pesquisarPrecos(); 
    } else { 
        trocarAba('registrar'); 
        document.getElementById('registrar-home').classList.add('hidden'); 
        document.getElementById('price-form-section').classList.remove('hidden'); 
        document.getElementById('ean-field').value = t; 
        document.getElementById('product-name').value = "Buscando dados..."; 
        
        // Limpa a foto anterior
        const imgP = document.getElementById('preview-imagem');
        imgP.src = ''; imgP.classList.add('hidden');
        
        // Põe o spinner de carregamento na câmera
        const iconCamera = document.querySelector('#btn-camera-foto i');
        if(iconCamera) iconCamera.className = 'fas fa-circle-notch fa-spin text-[#ff7e21] text-xl';
        
        try { 
            const res = await fetch(`${APPS_SCRIPT_URL}?ean=${t}`, { redirect: 'follow' }); 
            const data = await res.json(); 
            document.getElementById('product-name').value = data.nome || ""; 
            
            if (data.imagem && data.imagem.startsWith('http')) { 
                document.getElementById('image-url-field').value = data.imagem; 
                imgP.src = data.imagem; 
                imgP.classList.remove('hidden'); 
                // Esconde O ÍCONE (opacity-0) e não o botão, permitindo clicar de novo!
                if(iconCamera) iconCamera.className = 'fas fa-camera text-slate-500 opacity-0'; 
            } else {
                // Se não achar foto na API, volta o ícone da câmera para o usuário bater a foto
                if(iconCamera) iconCamera.className = 'fas fa-camera text-slate-500 text-xl';
            }
        } catch(e) { 
            document.getElementById('product-name').value = ""; 
            if(iconCamera) iconCamera.className = 'fas fa-camera text-slate-500 text-xl';
        } 
    } 
}

async function salvarPreco(e) { e.preventDefault();mostrarNotificacao("Salvando..."); const p = { ean: document.getElementById('ean-field').value, produto: document.getElementById('product-name').value, preco: document.getElementById('price').value, mercado: document.getElementById('market').value, usuario: document.getElementById('username').value, imagem: document.getElementById('image-url-field').value }; await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(p), mode: 'no-cors' }); mostrarNotificacao("Salvo com sucesso!"); setTimeout(() => location.reload(), 1500); }
function comprimirImagem(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (e) => { const img = new Image(); img.src = e.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const scale = 800 / img.width; canvas.width = 800; canvas.height = img.height * scale; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.6)); }; }; }); }

document.addEventListener('DOMContentLoaded', () => { 
    atualizarContadorCarrinho(); 
    document.getElementById('btn-enviar-chat').addEventListener('click', enviarMensagemGemini);
    document.getElementById('chat-input').addEventListener('keypress', function (e) { if (e.key === 'Enter') enviarMensagemGemini(); });
    
    // Tratamento correto do clique da câmera para manter o botão ativo
    const btnFoto = document.getElementById('btn-camera-foto'); 
    const inputFoto = document.getElementById('input-foto-produto'); 
    const imgPreview = document.getElementById('preview-imagem'); 
    const urlField = document.getElementById('image-url-field');
    
    if(btnFoto && inputFoto) {
        btnFoto.addEventListener('click', () => inputFoto.click()); 
        inputFoto.addEventListener('change', async (e) => { 
            if(e.target.files && e.target.files[0]) { 
                const iconeCamera = btnFoto.querySelector('i');
                if(iconeCamera) iconeCamera.className = 'fas fa-circle-notch fa-spin text-[#ff7e21] text-xl'; 
                const file = e.target.files[0]; 
                try { 
                    const base64 = await comprimirImagem(file); 
                    imgPreview.src = base64; 
                    imgPreview.classList.remove('hidden'); 
                    if(iconeCamera) iconeCamera.className = 'fas fa-camera text-slate-500 opacity-0'; 
                    urlField.value = base64; 
                } catch(err) { 
                    mostrarNotificacao("Erro", "erro"); 
                    if(iconeCamera) iconeCamera.className = 'fas fa-camera text-slate-400 text-xl'; 
                } 
            } 
        });
    }

    document.getElementById('filtro-mercado-catalogo').addEventListener('change', (e) => { const v = e.target.value; if(v === 'todos') atualizarListaCatalogo(catalogoDados); else atualizarListaCatalogo(catalogoDados.filter(i => i.mercado === v)); });
    document.getElementById('btn-pesquisar').addEventListener('click', pesquisarPrecos);
    document.getElementById('price-form').addEventListener('submit', salvarPreco);
    (async () => { try { const res = await fetch(`${APPS_SCRIPT_URL}?acao=buscarMercados`, { redirect: 'follow' }); const d = await res.json(); const s = document.getElementById('market'); if(d.mercados) { s.innerHTML = ''; d.mercados.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; s.appendChild(o); }); } } catch(e) {} })(); 
});
