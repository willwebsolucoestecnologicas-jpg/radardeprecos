// script.js - v33.0 (Versão Final com Correção de Chat e Carrinho)
// ⚠️ SE VOCÊ MUDOU O CÓDIGO NO APPS SCRIPT, VERIFIQUE SE ESTE LINK ABAIXO É O NOVO
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzs1hlJIptANs_zPYIB4KWgsNmoXsPxp874bOti2jkSt0yCHh4Oj-fQuRMC57ygntNw/exec'; 

// CHAVE DO FIREBASE (NÃO MEXA, É A DE LOGIN)
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
let modoScanAtual = 'registrar';
let currentUser = null; 

const USUARIOS_VERIFICADOS = ['Will', 'Admin', 'Kalango', 'WillWeb', 'Suporte'];

// --- CHAT INTELIGENTE COM COMANDO DE CARRINHO ---
async function enviarMensagemGemini() {
    const input = document.getElementById('chat-input');
    const area = document.getElementById('chat-messages');
    const txt = input.value.trim();
    if (!txt) return;

    // Renderiza msg do usuário (Verde)
    const divUser = document.createElement('div');
    divUser.className = 'chat-user text-sm mb-2';
    divUser.textContent = txt;
    area.appendChild(divUser);
    
    input.value = ''; 
    area.scrollTop = area.scrollHeight;

    // Loading
    const id = 'load-' + Date.now();
    const divLoad = document.createElement('div');
    divLoad.id = id;
    divLoad.className = 'chat-ai text-sm mb-2 opacity-50';
    divLoad.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Digitando...';
    area.appendChild(divLoad);
    area.scrollTop = area.scrollHeight;

    try {
        const res = await fetch(`${APPS_SCRIPT_URL}?acao=chatGemini&pergunta=${encodeURIComponent(txt)}`, { redirect: 'follow' });
        const data = await res.json();
        
        document.getElementById(id).remove();
        
        let respostaFinal = data.resposta || "Sem resposta.";

        // --- LÓGICA DO CARRINHO (IMPORTANTE) ---
        const comandoAdd = respostaFinal.match(/\|\|ADD:(.*?)\|\|/);
        if (comandoAdd && comandoAdd[1]) {
            const partes = comandoAdd[1].split('::');
            const prod = partes[0].trim();
            const prec = parseFloat(partes[1].trim()) || 0;
            const merc = partes[2] ? partes[2].trim() : "Chat";
            
            adicionarAoCarrinho(prod, prec, merc);
            respostaFinal = respostaFinal.replace(comandoAdd[0], "");
        }
        // ----------------------------------------

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
    area.scrollTop = area.scrollHeight;
}

// --- FUNÇÕES DE CARRINHO ---
function adicionarAoCarrinho(produto, preco, mercado) {
    const id = produto + mercado; 
    const existente = carrinho.find(i => i.id === id);
    if (existente) existente.qtd++; else carrinho.push({ id, produto, preco, mercado, qtd: 1 });
    salvarCarrinho();
    mostrarNotificacao(`+1 ${produto}`);
    const btn = document.getElementById('btn-carrinho-flutuante');
    if(btn) { 
        btn.classList.remove('hidden'); 
        btn.classList.add('scale-125'); 
        setTimeout(() => btn.classList.remove('scale-125'), 200); 
    }
}

// --- RESTO DAS FUNÇÕES (IGUAIS AO SEU ORIGINAL) ---
function fazerLoginGoogle() { const provider = new firebase.auth.GoogleAuthProvider(); auth.signInWithPopup(provider).catch(e => alert(e.message)); }
auth.onAuthStateChanged((user) => { if (user) { currentUser = user; document.getElementById('login-screen').classList.add('hidden'); if(document.getElementById('user-profile')) { document.getElementById('user-profile').classList.remove('hidden'); document.getElementById('user-profile').classList.add('flex'); document.getElementById('user-name-display').textContent = user.displayName.split(' ')[0]; document.getElementById('user-avatar').src = user.photoURL; } document.getElementById('username').value = user.displayName; atualizarContadorCarrinho(); if(typeof carregarCatalogo === 'function') carregarCatalogo(); } else { currentUser = null; document.getElementById('login-screen').classList.remove('hidden'); } });
function toggleCarrinho() { const m = document.getElementById('cart-modal'); const c = document.getElementById('cart-content'); if (m.classList.contains('hidden')) { renderizarCarrinho(); m.classList.remove('hidden'); setTimeout(() => c.classList.remove('translate-y-full'), 10); } else { c.classList.add('translate-y-full'); setTimeout(() => m.classList.add('hidden'), 300); } }
function atualizarContadorCarrinho() { const c = carrinho.reduce((a, b) => a + b.qtd, 0); const b = document.getElementById('cart-count'); if(b) { b.textContent = c; b.classList.toggle('hidden', c === 0); } }
function alterarQtd(id, d) { const i = carrinho.find(x => x.id === id); if (i) { i.qtd += d; if (i.qtd <= 0) carrinho = carrinho.filter(x => x.id !== id); } salvarCarrinho(); renderizarCarrinho(); }
function limparCarrinho() { if(confirm("Limpar lista?")) { carrinho=[]; salvarCarrinho(); renderizarCarrinho(); toggleCarrinho(); } }
function salvarCarrinho() { localStorage.setItem('kalango_cart', JSON.stringify(carrinho)); atualizarContadorCarrinho(); }
function renderizarCarrinho() { const c = document.getElementById('cart-items'); const t = document.getElementById('cart-total-price'); const q = document.getElementById('cart-total-items'); if (carrinho.length === 0) { c.innerHTML = '<p class="text-center opacity-30 p-10">Vazio</p>'; t.textContent = "R$ 0,00"; q.textContent = "0"; return; } c.innerHTML = ''; let total = 0; let qtd = 0; carrinho.forEach(i => { total += i.preco * i.qtd; qtd += i.qtd; c.innerHTML += `<div class="bg-slate-800 p-3 rounded mb-2 flex justify-between"><div><b>${i.produto}</b><br><small>${i.mercado}</small></div><div>R$ ${(i.preco * i.qtd).toFixed(2)} <button onclick="alterarQtd('${i.id}',-1)">-</button> ${i.qtd} <button onclick="alterarQtd('${i.id}',1)">+</button></div></div>`; }); t.textContent = `R$ ${total.toFixed(2)}`; q.textContent = `${qtd}`; }
function abrirModalLimpeza() { if(confirm("Limpar?")) { carrinho=[]; salvarCarrinho(); renderizarCarrinho(); toggleCarrinho(); } }
async function trocarAba(aba) { const abas = ['registrar', 'consultar', 'catalogo', 'chat']; if (scannerIsRunning) fecharCamera(); abas.forEach(a => { document.getElementById(a + '-container').classList.add('hidden'); document.getElementById('nav-' + a).className = "nav-btn text-slate-500"; }); document.getElementById(aba + '-container').classList.remove('hidden'); document.getElementById('nav-' + aba).className = "nav-btn text-emerald-500"; if(aba === 'catalogo') carregarCatalogo(); if (aba === 'chat') { const chatArea = document.getElementById('chat-messages'); setTimeout(() => chatArea.scrollTop = chatArea.scrollHeight, 100); } }
async function carregarCatalogo() { try { const r = await fetch(`${APPS_SCRIPT_URL}?acao=listarCatalogo`, { redirect: 'follow' }); const d = await r.json(); catalogoDados = d.catalogo || []; atualizarListaCatalogo(catalogoDados); } catch(e){} }
function atualizarListaCatalogo(d) { const l = document.getElementById('lista-catalogo'); l.innerHTML = ''; d.forEach(i => { l.innerHTML += `<div class="bg-slate-800 p-3 rounded mb-2 flex justify-between"><div><b>${i.produto}</b><br>R$ ${i.preco}</div><button onclick="adicionarAoCarrinho('${i.produto}',${i.preco},'${i.mercado}')" class="text-emerald-500"><i class="fas fa-plus"></i></button></div>`; }); }
function mostrarNotificacao(m) { const t = document.getElementById('toast-notification'); document.getElementById('toast-message').textContent = m; t.classList.remove('-translate-y-32', 'opacity-0'); setTimeout(() => t.classList.add('-translate-y-32', 'opacity-0'), 3000); }
async function iniciarCamera(m) { modoScanAtual = m; document.getElementById('scanner-modal').classList.remove('hidden'); try { html5QrCode = new Html5Qrcode("reader"); scannerIsRunning = true; await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess); } catch(e){ alert("Câmera erro"); fecharCamera(); } }
function fecharCamera() { if(scannerIsRunning && html5QrCode) { html5QrCode.stop(); scannerIsRunning = false; } document.getElementById('scanner-modal').classList.add('hidden'); }
function onScanSuccess(t) { fecharCamera(); if(modoScanAtual==='pesquisar') { trocarAba('consultar'); document.getElementById('ean-busca').value = t; pesquisarPrecos(); } else { trocarAba('registrar'); document.getElementById('ean-field').value = t; } }
async function pesquisarPrecos() { const t = document.getElementById('ean-busca').value; const r = await fetch(`${APPS_SCRIPT_URL}?acao=consultarPrecos&ean=${t}`, { redirect: 'follow' }); const d = await r.json(); const c = document.getElementById('resultados-consulta'); c.innerHTML = ''; d.resultados.forEach(i => { c.innerHTML += `<div class="bg-slate-800 p-3 rounded mb-2"><b>${i.produto}</b> - R$ ${i.preco} (${i.mercado})</div>`; }); }
async function salvarPreco(e) { e.preventDefault(); const p = { ean: document.getElementById('ean-field').value, produto: document.getElementById('product-name').value, preco: document.getElementById('price').value, mercado: document.getElementById('market').value, usuario: document.getElementById('username').value }; await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(p), mode: 'no-cors' }); mostrarNotificacao("Salvo!"); }
function comprimirImagem(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (e) => { const img = new Image(); img.src = e.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const scale = 800 / img.width; canvas.width = 800; canvas.height = img.height * scale; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.6)); }; }; }); }
document.addEventListener('DOMContentLoaded', () => { atualizarContadorCarrinho(); if(document.getElementById('btn-enviar-chat')) document.getElementById('btn-enviar-chat').addEventListener('click', enviarMensagemGemini); 
    const btnFoto = document.getElementById('btn-camera-foto'); const inputFoto = document.getElementById('input-foto-produto'); const imgPreview = document.getElementById('preview-imagem'); const urlField = document.getElementById('image-url-field');
    if(btnFoto && inputFoto) { btnFoto.addEventListener('click', () => inputFoto.click()); inputFoto.addEventListener('change', async (e) => { if(e.target.files && e.target.files[0]) { const file = e.target.files[0]; btnFoto.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; try { const base64 = await comprimirImagem(file); imgPreview.src = base64; imgPreview.classList.remove('hidden'); btnFoto.classList.add('hidden'); urlField.value = base64; } catch(err) { mostrarNotificacao("Erro na foto", "erro"); btnFoto.innerHTML = '<i class="fas fa-camera text-slate-400 text-2xl mb-1"></i><span class="text-[9px] text-slate-400 font-bold uppercase">Foto</span>'; } } }); }
    const f = document.getElementById('filtro-mercado-catalogo'); if(f) f.addEventListener('change', () => { const v = f.value; if(v === 'todos') atualizarListaCatalogo(catalogoDados); else atualizarListaCatalogo(catalogoDados.filter(i => i.mercado === v)); });
    if(document.getElementById('btn-pesquisar')) document.getElementById('btn-pesquisar').addEventListener('click', pesquisarPrecos); if(document.getElementById('price-form')) document.getElementById('price-form').addEventListener('submit', salvarPreco); (async () => { try { const res = await fetch(`${APPS_SCRIPT_URL}?acao=buscarMercados`, { redirect: 'follow' }); const d = await res.json(); const s = document.getElementById('market'); if(d.mercados && s) { s.innerHTML = ''; d.mercados.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; s.appendChild(o); }); } } catch(e) {} })(); });
