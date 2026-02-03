// script.js - v22.0 (Carrinho Fixo + Login OK + Chat OK)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzs1hlJIptANs_zPYIB4KWgsNmoXsPxp874bOti2jkSt0yCHh4Oj-fQuRMC57ygntNw/exec'; 

// SUA CHAVE FIREBASE (Login) - MANTIDA
const firebaseConfig = {
  apiKey: "AIzaSyCwNVNTZiUJ9qeqniRK9GHDofB9HaQTJ_c",
  authDomain: "kalango-app.firebaseapp.com",
  projectId: "kalango-app",
  storageBucket: "kalango-app.firebasestorage.app",
  messagingSenderId: "1060554025879",
  appId: "1:1060554025879:web:c41affa1cd8e8b346172d2",
  measurementId: "G-SMR42PSTBS"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

let html5QrCode;
let scannerIsRunning = false;
let catalogoDados = [];
let carrinho = JSON.parse(localStorage.getItem('kalango_cart')) || [];
let currentUser = null; 

const USUARIOS_VERIFICADOS = ['Will', 'Admin', 'Kalango', 'WillWeb', 'Suporte'];

// LOGIN
function fazerLoginGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const btn = document.querySelector('button[onclick="fazerLoginGoogle()"]');
    if(btn) { btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> ...'; btn.disabled = true; }

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => { return auth.signInWithPopup(provider); })
        .then((result) => { mostrarNotificacao(`Oi, ${result.user.displayName.split(' ')[0]}!`); })
        .catch((error) => {
            if(btn) { btn.innerHTML = 'Tentar Novamente'; btn.disabled = false; }
            alert("Erro Login: " + error.message);
        });
}

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        if(document.getElementById('user-profile')) {
            document.getElementById('user-profile').classList.remove('hidden');
            document.getElementById('user-profile').classList.add('flex');
            document.getElementById('user-name-display').textContent = user.displayName.split(' ')[0];
            document.getElementById('user-avatar').src = user.photoURL;
        }
        if(document.getElementById('username')) document.getElementById('username').value = user.displayName;
        
        // FORÇA ATUALIZAÇÃO DO CARRINHO AO LOGAR
        atualizarContadorCarrinho();
        if(typeof carregarCatalogo === 'function') carregarCatalogo();
        verificarSaudacaoChat();
    } else {
        currentUser = null;
        document.getElementById('login-screen').classList.remove('hidden');
        if(document.getElementById('user-profile')) document.getElementById('user-profile').classList.add('hidden');
    }
});

// CHAT
function verificarSaudacaoChat() {
    const area = document.getElementById('chat-messages');
    if(area && area.innerHTML.trim() === "") {
        const nome = currentUser ? currentUser.displayName.split(' ')[0] : "Visitante";
        area.innerHTML = `<div class="chat-ai text-sm mb-2">Opa, <b>${nome}</b>! 🦎<br>Diga o que precisa que eu busco o preço.</div>`;
    }
}

async function enviarMensagemGemini() {
    const input = document.getElementById('chat-input');
    const txt = input.value.trim();
    if (!txt || !currentUser) return;
    
    input.value = ''; 
    renderizarMensagem(txt, 'user');
    
    const idLoad = 'load-' + Date.now();
    const area = document.getElementById('chat-messages');
    area.innerHTML += `<div id="${idLoad}" class="chat-ai text-sm mb-2 opacity-50"><i class="fas fa-keyboard fa-pulse"></i> Digitando...</div>`;
    area.scrollTop = area.scrollHeight;
    
    try {
        const promptContexto = `[User:${currentUser.displayName}] ${txt}`;
        const res = await fetch(`${APPS_SCRIPT_URL}?acao=chatGemini&pergunta=${encodeURIComponent(promptContexto)}`, { redirect: 'follow' });
        const data = await res.json();
        
        if(document.getElementById(idLoad)) document.getElementById(idLoad).remove();
        
        let resposta = data.resposta || "Sem resposta.";
        
        const comandoAdd = resposta.match(/\|\|ADD:(.*?)\|\|/);
        if (comandoAdd && comandoAdd[1]) {
            const partes = comandoAdd[1].split('::');
            const prod = partes[0].trim();
            const prec = parseFloat(partes[1].trim()) || 0;
            const merc = partes[2] ? partes[2].trim() : "Chat";
            adicionarAoCarrinho(prod, prec, merc);
            resposta = resposta.replace(comandoAdd[0], "");
        }
        renderizarMensagem(resposta, 'ai');
    } catch (e) {
        if(document.getElementById(idLoad)) document.getElementById(idLoad).remove();
        renderizarMensagem("⚠️ Erro de conexão.", 'ai');
    }
}

function renderizarMensagem(texto, remetente) {
    const area = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = remetente === 'user' ? "chat-user text-sm mb-2" : "chat-ai text-sm mb-2";
    div.innerHTML = texto.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

// VOZ
function iniciarGravacaoVoz() {
    if (!('webkitSpeechRecognition' in window)) { alert("Sem suporte a voz."); return; }
    const rec = new webkitSpeechRecognition();
    rec.lang = 'pt-BR';
    
    const btnMic = document.getElementById('btn-mic-chat');
    const iconOriginal = btnMic.innerHTML;
    
    rec.onstart = () => { btnMic.innerHTML = '<i class="fas fa-microphone-lines text-red-500 fa-beat"></i>'; mostrarNotificacao("Ouvindo..."); };
    rec.onresult = (e) => {
        document.getElementById('chat-input').value = e.results[0][0].transcript;
        setTimeout(enviarMensagemGemini, 500);
    };
    rec.onend = () => { btnMic.innerHTML = iconOriginal; };
    rec.start();
}

// CARRINHO (CORRIGIDO PARA NÃO SUMIR)
function atualizarContadorCarrinho() {
    const count = carrinho.reduce((acc, item) => acc + item.qtd, 0);
    
    // Badge do Header
    const badge = document.getElementById('cart-count');
    const btnHeader = document.getElementById('btn-carrinho-header');
    
    if(badge) {
        badge.textContent = count;
        // Mostra o badge se tiver item, esconde se zero
        badge.classList.toggle('hidden', count === 0);
    }
    
    if(btnHeader) {
        // Mostra o botão do carrinho no header SE tiver itens
        if (count > 0) btnHeader.classList.remove('hidden');
        else btnHeader.classList.add('hidden');
    }

    // Botão Flutuante (Menu Inferior)
    const btnFloat = document.getElementById('btn-carrinho-flutuante');
    const abaChat = !document.getElementById('chat-container').classList.contains('hidden');
    
    if (btnFloat) {
        // Regra: Tem itens? E não tá no chat? Mostra.
        if (count > 0 && !abaChat) {
            btnFloat.classList.remove('hidden');
        } else {
            btnFloat.classList.add('hidden');
        }
    }
}

function adicionarAoCarrinho(produto, preco, mercado) {
    const id = produto + mercado; 
    const existente = carrinho.find(i => i.id === id);
    if (existente) existente.qtd++; else carrinho.push({ id, produto, preco: parseFloat(preco)||0, mercado, qtd: 1 });
    salvarCarrinho();
    mostrarNotificacao(`+1 ${produto}`);
}

function salvarCarrinho() {
    localStorage.setItem('kalango_cart', JSON.stringify(carrinho));
    atualizarContadorCarrinho();
}

function toggleCarrinho() {
    const modal = document.getElementById('cart-modal');
    const content = document.getElementById('cart-content');
    
    // Se estiver escondido, mostra e renderiza
    if (modal.classList.contains('hidden')) {
        renderizarCarrinho(); // Garante que a lista tá atualizada
        modal.classList.remove('hidden');
        setTimeout(() => content.classList.remove('translate-y-full'), 10);
    } else {
        content.classList.add('translate-y-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

function renderizarCarrinho() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-price');
    const totalItemsEl = document.getElementById('cart-total-items');
    
    if (carrinho.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-30"><i class="fas fa-basket-shopping text-3xl mb-2"></i><p>Vazio.</p></div>`;
        totalEl.textContent = "R$ 0,00";
        totalItemsEl.textContent = "0 itens";
        return;
    }
    
    container.innerHTML = '';
    let total = 0;
    let qtdTotal = 0;
    
    carrinho.forEach(item => {
        total += item.preco * item.qtd;
        qtdTotal += item.qtd;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700 mb-2";
        div.innerHTML = `
            <div class="flex-1 min-w-0 pr-2">
                <h4 class="text-sm font-bold text-white truncate">${item.produto}</h4>
                <p class="text-[10px] text-slate-400">${item.mercado}</p>
                <p class="text-xs text-emerald-400 font-bold mt-1">R$ ${(item.preco * item.qtd).toFixed(2)}</p>
            </div>
            <div class="flex items-center gap-3 bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button onclick="alterarQtd('${item.id}', -1)" class="w-8 h-8 text-red-400 hover:bg-slate-800 rounded font-bold">-</button>
                <span class="text-sm font-bold text-white w-4 text-center">${item.qtd}</span>
                <button onclick="alterarQtd('${item.id}', 1)" class="w-8 h-8 text-emerald-400 hover:bg-slate-800 rounded font-bold">+</button>
            </div>
        `;
        container.appendChild(div);
    });
    
    totalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    totalItemsEl.textContent = `${qtdTotal} itens`;
}

function alterarQtd(id, delta) {
    const item = carrinho.find(i => i.id === id);
    if (item) { item.qtd += delta; if (item.qtd <= 0) carrinho = carrinho.filter(i => i.id !== id); }
    salvarCarrinho();
    renderizarCarrinho(); // Atualiza a lista visualmente na hora
}

function confirmarLimpeza() { carrinho = []; salvarCarrinho(); renderizarCarrinho(); fecharModalConfirmacao(); toggleCarrinho(); }
function abrirModalLimpeza() { document.getElementById('confirm-modal').classList.remove('hidden'); }
function fecharModalConfirmacao() { document.getElementById('confirm-modal').classList.add('hidden'); }

// RESTO DAS FUNÇÕES (Mantidas simplificadas para caber)
function mostrarNotificacao(msg, tipo='sucesso') {
    const t = document.getElementById('toast-notification');
    const m = document.getElementById('toast-message');
    if(!t) return;
    m.textContent = msg;
    t.className = `fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 font-bold transition-all duration-300 w-max max-w-[90%] pointer-events-auto ${tipo === 'erro' ? "bg-red-500 text-white" : "bg-emerald-600 text-white"}`;
    t.classList.remove('-translate-y-32', 'opacity-0');
    setTimeout(() => { t.classList.add('-translate-y-32', 'opacity-0'); }, 3000);
}

function gerarSeloUsuario(nome) {
    if (!nome) return `<span class="text-[9px] text-slate-500 italic">Anônimo</span>`;
    const isVerificado = USUARIOS_VERIFICADOS.some(u => u.toLowerCase() === nome.toLowerCase());
    return isVerificado ? `<span class="text-[9px] text-blue-400 font-bold flex items-center gap-1 bg-blue-400/10 px-1.5 py-0.5 rounded-full border border-blue-400/20"><i class="fas fa-certificate text-[8px]"></i> ${nome}</span>` : `<span class="text-[9px] text-slate-400 flex items-center gap-1"><i class="fas fa-user text-[8px]"></i> ${nome}</span>`;
}

async function trocarAba(aba) {
    const abas = ['registrar', 'consultar', 'catalogo', 'chat'];
    if (scannerIsRunning) await fecharCamera();
    abas.forEach(a => { 
        document.getElementById(a + '-container').classList.add('hidden'); 
        document.getElementById('nav-' + a).className = "nav-btn text-slate-500";
    });
    document.getElementById(aba + '-container').classList.remove('hidden');
    document.getElementById('nav-' + aba).className = "nav-btn text-emerald-500";
    atualizarContadorCarrinho(); // Garante visibilidade correta do botão
    if (aba === 'catalogo') carregarCatalogo();
    if (aba === 'chat') { verificarSaudacaoChat(); const ca = document.getElementById('chat-messages'); setTimeout(() => ca.scrollTop = ca.scrollHeight, 100); }
}

async function iniciarCamera(modo) {
    if (scannerIsRunning) return;
    modoScanAtual = modo;
    document.getElementById('scanner-title').textContent = modo === 'pesquisar' ? "Escanear para Buscar" : "Escanear para Registrar";
    document.getElementById('scanner-modal').classList.remove('hidden'); document.getElementById('scanner-modal').classList.add('flex');
    try { if (!html5QrCode) html5QrCode = new Html5Qrcode("reader"); scannerIsRunning = true; await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess); } catch (err) { fecharCamera(); mostrarNotificacao("Erro: Permita a câmera!", "erro"); }
}
async function fecharCamera() { if (html5QrCode && scannerIsRunning) { try { await html5QrCode.stop(); } catch(e) {} scannerIsRunning = false; document.getElementById('reader').innerHTML = ''; } document.getElementById('scanner-modal').classList.add('hidden'); document.getElementById('scanner-modal').classList.remove('flex'); }
async function onScanSuccess(decodedText) {
    fecharCamera();
    if (modoScanAtual === 'pesquisar') { trocarAba('consultar'); document.getElementById('ean-busca').value = decodedText; pesquisarPrecos(); } 
    else {
        trocarAba('registrar');
        document.getElementById('registrar-home').classList.add('hidden');
        document.getElementById('price-form-section').classList.remove('hidden');
        document.getElementById('ean-field').value = decodedText;
        document.getElementById('product-name').value = "Buscando...";
        try { const res = await fetch(`${APPS_SCRIPT_URL}?ean=${decodedText}`, { redirect: 'follow' }); const data = await res.json(); document.getElementById('product-name').value = data.nome || ""; if(data.imagem && data.imagem.startsWith('http')) { document.getElementById('image-url-field').value = data.imagem; document.getElementById('preview-imagem').src = data.imagem; document.getElementById('preview-imagem').classList.remove('hidden'); document.getElementById('btn-camera-foto').classList.add('hidden'); } } catch(e) { document.getElementById('product-name').value = ""; }
    }
}
async function salvarPreco(e) { 
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const txt = btn.innerHTML; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...'; btn.disabled = true; 
    const payload = { ean: document.getElementById('ean-field').value, produto: document.getElementById('product-name').value, preco: document.getElementById('price').value, mercado: document.getElementById('market').value, usuario: document.getElementById('username').value, imagem: document.getElementById('image-url-field').value }; 
    try { await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }); mostrarNotificacao("Preço salvo!"); setTimeout(() => location.reload(), 1500); } catch (err) { mostrarNotificacao("Erro ao salvar.", "erro"); btn.innerHTML = txt; btn.disabled = false; } 
}
function comprimirImagem(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (e) => { const img = new Image(); img.src = e.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const scale = 800 / img.width; canvas.width = 800; canvas.height = img.height * scale; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.6)); }; }; }); }
async function carregarCatalogo() {
    const lista = document.getElementById('lista-catalogo'); const select = document.getElementById('filtro-mercado-catalogo'); if(!lista) return;
    lista.innerHTML = `<div class="text-center py-10 opacity-30"><i class="fas fa-spinner fa-spin text-2xl"></i><p>Buscando ofertas...</p></div>`;
    try { 
        const res = await fetch(`${APPS_SCRIPT_URL}?acao=listarCatalogo`, { redirect: 'follow' }); const data = await res.json(); 
        if (data.catalogo && data.catalogo.length > 0) { 
            catalogoDados = data.catalogo; atualizarListaCatalogo(catalogoDados); 
            if(select && select.options.length <= 1) { [...new Set(catalogoDados.map(i => i.mercado))].forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; select.appendChild(opt); }); }
        } else { lista.innerHTML = `<div class="text-center py-10 opacity-30"><p>Nada cadastrado.</p></div>`; } 
    } catch (e) { lista.innerHTML = `<div class="text-center py-10 opacity-50"><p>Erro ao carregar.</p></div>`; }
}
function atualizarListaCatalogo(dados) {
    const lista = document.getElementById('lista-catalogo'); if(!lista) return; lista.innerHTML = '';
    dados.forEach(item => { 
        const img = (item.imagem && item.imagem.length > 10) ? item.imagem : "https://cdn-icons-png.flaticon.com/512/2748/2748558.png"; 
        const div = document.createElement('div'); div.className = "bg-slate-800 border border-slate-700 p-3 rounded-xl flex gap-3 items-center shadow-sm mb-3"; 
        div.innerHTML = `<div class="w-12 h-12 bg-white/5 rounded-lg p-1 flex-shrink-0 flex items-center justify-center"><img src="${img}" class="max-w-full max-h-full object-contain"></div><div class="flex-1 min-w-0"><h4 class="text-xs font-bold text-white truncate">${item.produto}</h4><div class="flex justify-between items-end mt-1"><div><span class="text-emerald-400 font-black text-sm block">R$ ${item.preco.toFixed(2).replace('.', ',')}</span><span class="text-[9px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded truncate max-w-[80px] inline-block">${item.mercado}</span></div><div class="text-right">${gerarSeloUsuario(item.usuario)}</div></div></div><button onclick="adicionarAoCarrinho('${item.produto.replace(/'/g, "\\'")}', ${item.preco}, '${item.mercado.replace(/'/g, "\\'")}')" class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors"><i class="fas fa-plus"></i></button>`; lista.appendChild(div); 
    });
}
async function pesquisarPrecos() {
    const busca = document.getElementById('ean-busca').value; const container = document.getElementById('resultados-consulta'); const btn = document.getElementById('btn-pesquisar'); if (!busca) return mostrarNotificacao("Digite algo!", "erro");
    const iconOriginal = btn.innerHTML; btn.innerHTML = '<div class="loader w-4 h-4 border-slate-900"></div>'; container.innerHTML = ''; 
    try { 
        const res = await fetch(`${APPS_SCRIPT_URL}?acao=consultarPrecos&ean=${encodeURIComponent(busca)}`, { redirect: 'follow' }); const data = await res.json(); btn.innerHTML = iconOriginal; 
        if (!data.resultados || data.resultados.length === 0) { container.innerHTML = `<div class="text-center py-8 opacity-50 bg-slate-800 rounded-xl"><p>Não achei nada.</p></div>`; return; } 
        const lista = data.resultados.sort((a, b) => a.preco - b.preco);
        const h = document.createElement('div'); h.className = "mb-4 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20"; h.innerHTML = `<h3 class="text-sm font-bold text-emerald-400">Resultados para "${busca}"</h3>`; container.appendChild(h); 
        lista.forEach((item, index) => { const eMaisBarato = index === 0; const img = (item.imagem && item.imagem.length > 10) ? item.imagem : "https://cdn-icons-png.flaticon.com/512/2748/2748558.png"; const card = document.createElement('div'); card.className = `p-4 rounded-2xl mb-3 relative overflow-hidden flex gap-3 ${eMaisBarato ? 'bg-gradient-to-br from-emerald-900 to-slate-800 border border-emerald-500 shadow-lg' : 'bg-slate-800 border border-slate-700'}`; card.innerHTML = `<div class="w-14 h-14 bg-white/5 rounded-xl p-1 flex-shrink-0 flex items-center justify-center"><img src="${img}" class="max-w-full max-h-full object-contain"></div><div class="flex-1 relative z-10 min-w-0">${eMaisBarato ? `<span class="bg-emerald-500 text-slate-900 text-[8px] font-black px-1.5 py-0.5 rounded uppercase absolute -top-1 right-0">Melhor Preço</span>` : ''}<h3 class="text-xl font-black ${eMaisBarato ? 'text-emerald-400' : 'text-white'}">R$ ${item.preco.toFixed(2).replace('.', ',')}</h3><p class="font-bold text-xs uppercase text-slate-300 truncate">${item.mercado}</p><div class="mt-1 flex justify-between items-end"><p class="text-[9px] text-slate-500 truncate max-w-[100px]">${item.produto}</p>${gerarSeloUsuario(item.usuario)}</div></div><button onclick="adicionarAoCarrinho('${item.produto.replace(/'/g, "\\'")}', ${item.preco}, '${item.mercado.replace(/'/g, "\\'")}')" class="self-center w-10 h-10 rounded-full bg-slate-700 hover:bg-emerald-500 hover:text-white text-emerald-500 flex items-center justify-center transition-colors shadow-lg z-20"><i class="fas fa-cart-plus"></i></button>`; container.appendChild(card); }); 
    } catch (err) { mostrarNotificacao("Erro na busca.", "erro"); btn.innerHTML = iconOriginal; }
}

document.addEventListener('DOMContentLoaded', () => {
    atualizarContadorCarrinho();
    const f = document.getElementById('filtro-mercado-catalogo'); if(f) f.addEventListener('change', () => { const v = f.value; if(v === 'todos') atualizarListaCatalogo(catalogoDados); else atualizarListaCatalogo(catalogoDados.filter(i => i.mercado === v)); });
    if(document.getElementById('btn-enviar-chat')) document.getElementById('btn-enviar-chat').addEventListener('click', enviarMensagemGemini);
    if(document.getElementById('btn-pesquisar')) document.getElementById('btn-pesquisar').addEventListener('click', pesquisarPrecos);
    if(document.getElementById('price-form')) document.getElementById('price-form').addEventListener('submit', salvarPreco);
    
    // Injeção do botão de microfone
    const divInput = document.getElementById('chat-input').parentElement;
    if(divInput && !document.getElementById('btn-mic-chat')) {
        const btnMic = document.createElement('button');
        btnMic.id = 'btn-mic-chat';
        btnMic.className = 'absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors';
        btnMic.innerHTML = '<i class="fas fa-microphone"></i>';
        btnMic.onclick = iniciarGravacaoVoz;
        divInput.appendChild(btnMic);
    }
    
    const btnFoto = document.getElementById('btn-camera-foto'); const inputFoto = document.getElementById('input-foto-produto'); const imgPreview = document.getElementById('preview-imagem'); const urlField = document.getElementById('image-url-field');
    if(btnFoto && inputFoto) { btnFoto.addEventListener('click', () => inputFoto.click()); inputFoto.addEventListener('change', async (e) => { if(e.target.files && e.target.files[0]) { const file = e.target.files[0]; btnFoto.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; try { const base64 = await comprimirImagem(file); imgPreview.src = base64; imgPreview.classList.remove('hidden'); btnFoto.classList.add('hidden'); urlField.value = base64; } catch(err) { mostrarNotificacao("Erro na foto", "erro"); btnFoto.innerHTML = '<i class="fas fa-camera text-slate-400 text-2xl mb-1"></i><span class="text-[9px] text-slate-400 font-bold uppercase">Foto</span>'; } } }); }
    
    (async () => { try { const res = await fetch(`${APPS_SCRIPT_URL}?acao=buscarMercados`, { redirect: 'follow' }); const d = await res.json(); const s = document.getElementById('market'); if(d.mercados && s) { s.innerHTML = ''; d.mercados.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; s.appendChild(o); }); } } catch(e) {} })();
    
    if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(function(registrations) { for(let registration of registrations) { registration.unregister(); } }); }
});
