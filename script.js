// script.js - v35.0 (Com Voz do Kalango!)

// ⚠️ VERIFIQUE SE ESTE LINK ABAIXO É O DO SEU APPS SCRIPT
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzs1hlJIptANs_zPYIB4KWgsNmoXsPxp874bOti2jkSt0yCHh4Oj-fQuRMC57ygntNw/exec'; 

// --- CHAVE DO FIREBASE (LOGIN DO GOOGLE) ---
const firebaseConfig = {
  apiKey: "AIzaSyCwNVNTZiUJ9qeqniRK9GHDofB9HaQTJ_c",
  authDomain: "kalango-app.firebaseapp.com",
  projectId: "kalango-app",
  storageBucket: "kalango-app.firebasestorage.app",
  messagingSenderId: "1060554025879",
  appId: "1:1060554025879:web:c41affa1cd8e8b346172d2",
  measurementId: "G-SMR42PSTBS"
};

// Inicializa o Firebase se não estiver iniciado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

let html5QrCode;
let scannerIsRunning = false;
let catalogoDados = [];
let carrinho = JSON.parse(localStorage.getItem('kalango_cart')) || [];
let modoScanAtual = 'registrar';
let currentUser = null; 

const USUARIOS_VERIFICADOS = ['Will', 'Admin', 'Kalango', 'WillWeb', 'Suporte'];

// =========================================================================
// CHAT E INTELIGÊNCIA ARTIFICIAL (VOZ E TEXTO)
// =========================================================================

// NOVIDADE: O Motor de Voz do Kalango
function falarComVozDoKalango(texto) {
    if (!('speechSynthesis' in window)) return; // Verifica se o celular suporta
    
    window.speechSynthesis.cancel(); // Para de falar a msg antiga, se estiver falando
    
    // Limpa o texto (tira marcações como **, _ ou tags HTML) para a voz sair natural
    const textoLimpo = texto.replace(/<[^>]*>?/gm, '').replace(/[*_]/g, '');
    
    const fala = new SpeechSynthesisUtterance(textoLimpo);
    fala.lang = 'pt-BR'; // Português do Brasil
    fala.rate = 1.05;    // Velocidade um pouquinho mais rápida e dinâmica
    fala.pitch = 1.1;    // Tom de voz levemente mais agudo pra dar personalidade
    
    window.speechSynthesis.speak(fala);
}

async function enviarMensagemGemini() {
    const input = document.getElementById('chat-input');
    const area = document.getElementById('chat-messages');
    const txt = input.value.trim();
    
    if (!txt) return;

    const divUser = document.createElement('div');
    divUser.className = 'chat-user text-sm mb-2';
    divUser.textContent = txt;
    area.appendChild(divUser);
    
    input.value = ''; 
    area.scrollTop = area.scrollHeight;

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

        // Lê comandos de carrinho invisíveis
        const comandoAdd = respostaFinal.match(/\|\|ADD:(.*?)\|\|/);
        if (comandoAdd && comandoAdd[1]) {
            const partes = comandoAdd[1].split('::');
            const prod = partes[0].trim();
            const prec = parseFloat(partes[1].trim()) || 0;
            const merc = partes[2] ? partes[2].trim() : "Chat";
            
            adicionarAoCarrinho(prod, prec, merc);
            respostaFinal = respostaFinal.replace(comandoAdd[0], "");
        }

        // 🌟 AQUI A MÁGICA ACONTECE: Manda o Kalango falar a resposta em voz alta!
        falarComVozDoKalango(respostaFinal);

        // Exibe o texto na tela
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

function iniciarGravacaoVoz() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { 
        mostrarNotificacao("Seu navegador não suporta gravação de voz.", "erro"); 
        return; 
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    
    const btnMic = document.getElementById('btn-mic-chat');
    const inputChat = document.getElementById('chat-input');
    const iconOriginal = btnMic.innerHTML;
    
    rec.onstart = () => { 
        btnMic.innerHTML = '<i class="fas fa-microphone text-red-500 fa-beat"></i>'; 
        inputChat.placeholder = "Ouvindo patrão..."; 
        // Para o Kalango de falar se você for falar algo novo por cima
        window.speechSynthesis.cancel(); 
    };
    
    rec.onresult = (e) => {
        const textoFalado = e.results[0][0].transcript;
        inputChat.value = textoFalado;
        setTimeout(enviarMensagemGemini, 500); 
    };
    
    rec.onerror = () => { mostrarNotificacao("Não entendi direito.", "erro"); };
    
    rec.onend = () => { 
        btnMic.innerHTML = iconOriginal; 
        inputChat.placeholder = "Digite ou mande áudio..."; 
    };
    
    rec.start();
}


// =========================================================================
// GESTÃO DO CARRINHO DE COMPRAS
// =========================================================================

function adicionarAoCarrinho(produto, preco, mercado) {
    const id = produto + mercado; 
    const existente = carrinho.find(i => i.id === id);
    
    if (existente) {
        existente.qtd++; 
    } else {
        carrinho.push({ id, produto, preco, mercado, qtd: 1 });
    }
    
    salvarCarrinho();
    mostrarNotificacao(`+1 ${produto}`);
    
    const btn = document.getElementById('btn-carrinho-flutuante');
    if(btn) { 
        btn.classList.remove('hidden'); 
        btn.classList.add('scale-125'); 
        setTimeout(() => btn.classList.remove('scale-125'), 200); 
    }
}

function toggleCarrinho() { 
    const m = document.getElementById('cart-modal'); 
    const c = document.getElementById('cart-content'); 
    
    if (m.classList.contains('hidden')) { 
        renderizarCarrinho(); 
        m.classList.remove('hidden'); 
        setTimeout(() => c.classList.remove('translate-y-full'), 10); 
    } else { 
        c.classList.add('translate-y-full'); 
        setTimeout(() => m.classList.add('hidden'), 300); 
    } 
}

function atualizarContadorCarrinho() { 
    const c = carrinho.reduce((a, b) => a + b.qtd, 0); 
    const b = document.getElementById('cart-count'); 
    if(b) { 
        b.textContent = c; 
        b.classList.toggle('hidden', c === 0); 
    } 
}

function alterarQtd(id, d) { 
    const i = carrinho.find(x => x.id === id); 
    if (i) { 
        i.qtd += d; 
        if (i.qtd <= 0) {
            carrinho = carrinho.filter(x => x.id !== id); 
        }
    } 
    salvarCarrinho(); 
    renderizarCarrinho(); 
}

function limparCarrinho() { 
    if(confirm("Limpar lista?")) { 
        carrinho = []; 
        salvarCarrinho(); 
        renderizarCarrinho(); 
        toggleCarrinho(); 
    } 
}

function salvarCarrinho() { 
    localStorage.setItem('kalango_cart', JSON.stringify(carrinho)); 
    atualizarContadorCarrinho(); 
}

function renderizarCarrinho() { 
    const c = document.getElementById('cart-items'); 
    const t = document.getElementById('cart-total-price'); 
    const q = document.getElementById('cart-total-items'); 
    
    if (carrinho.length === 0) { 
        c.innerHTML = '<p class="text-center opacity-30 p-10">Vazio</p>'; 
        t.textContent = "R$ 0,00"; 
        q.textContent = "0"; 
        return; 
    } 
    
    c.innerHTML = ''; 
    let total = 0; 
    let qtd = 0; 
    
    carrinho.forEach(i => { 
        total += i.preco * i.qtd; 
        qtd += i.qtd; 
        c.innerHTML += `
        <div class="bg-slate-800 p-3 rounded mb-2 flex justify-between items-center border border-slate-700">
            <div>
                <b>${i.produto}</b><br>
                <small class="text-slate-400">${i.mercado}</small>
            </div>
            <div class="text-right">
                <span class="text-emerald-400 font-bold block mb-1">R$ ${(i.preco * i.qtd).toFixed(2)}</span>
                <div class="flex items-center gap-2 bg-slate-900 rounded px-2 py-1">
                    <button onclick="alterarQtd('${i.id}',-1)" class="text-red-400 font-bold px-1">-</button> 
                    <span class="text-xs">${i.qtd}</span> 
                    <button onclick="alterarQtd('${i.id}',1)" class="text-emerald-400 font-bold px-1">+</button>
                </div>
            </div>
        </div>`; 
    }); 
    
    t.textContent = `R$ ${total.toFixed(2)}`; 
    q.textContent = `${qtd}`; 
}

function abrirModalLimpeza() { 
    if(confirm("Limpar?")) { 
        carrinho=[]; 
        salvarCarrinho(); 
        renderizarCarrinho(); 
        toggleCarrinho(); 
    } 
}


// =========================================================================
// SISTEMA DE ABAS E LOGIN
// =========================================================================

function fazerLoginGoogle() { 
    const provider = new firebase.auth.GoogleAuthProvider(); 
    auth.signInWithPopup(provider).catch(e => alert(e.message)); 
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
        
        document.getElementById('username').value = user.displayName; 
        atualizarContadorCarrinho(); 
        
        if(typeof carregarCatalogo === 'function') carregarCatalogo();
        
        trocarAba('chat');
        
    } else { 
        currentUser = null; 
        document.getElementById('login-screen').classList.remove('hidden'); 
    } 
});

async function trocarAba(aba) { 
    const abas = ['registrar', 'consultar', 'catalogo', 'chat']; 
    if (scannerIsRunning) fecharCamera(); 
    
    abas.forEach(a => { 
        document.getElementById(a + '-container').classList.add('hidden'); 
        document.getElementById('nav-' + a).className = "nav-btn text-slate-500 hover:text-emerald-400"; 
    }); 
    
    document.getElementById(aba + '-container').classList.remove('hidden'); 
    document.getElementById('nav-' + aba).className = "nav-btn text-emerald-400 bg-emerald-500/10 rounded-2xl py-1 px-2"; 
    
    if(aba === 'catalogo') carregarCatalogo(); 
    if (aba === 'chat') { 
        const chatArea = document.getElementById('chat-messages'); 
        setTimeout(() => chatArea.scrollTop = chatArea.scrollHeight, 100); 
    } 
}


// =========================================================================
// CATÁLOGO E PESQUISA
// =========================================================================

async function carregarCatalogo() { 
    try { 
        const r = await fetch(`${APPS_SCRIPT_URL}?acao=listarCatalogo`, { redirect: 'follow' }); 
        const d = await r.json(); 
        catalogoDados = d.catalogo || []; 
        atualizarListaCatalogo(catalogoDados); 
    } catch(e) {} 
}

function atualizarListaCatalogo(d) { 
    const l = document.getElementById('lista-catalogo'); 
    l.innerHTML = ''; 
    d.forEach(i => { 
        l.innerHTML += `
        <div class="bg-slate-800 p-3 rounded mb-2 flex justify-between border border-slate-700">
            <div>
                <b>${i.produto}</b><br>
                <span class="text-emerald-400 font-bold">R$ ${i.preco.toFixed(2)}</span>
            </div>
            <button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}')" class="text-white bg-emerald-600 hover:bg-emerald-500 w-10 h-10 rounded-full flex items-center justify-center">
                <i class="fas fa-cart-plus"></i>
            </button>
        </div>`; 
    }); 
}

async function pesquisarPrecos() { 
    const t = document.getElementById('ean-busca').value; 
    if (!t) return mostrarNotificacao("Digite o nome ou EAN", "erro");
    
    const r = await fetch(`${APPS_SCRIPT_URL}?acao=consultarPrecos&ean=${encodeURIComponent(t)}`, { redirect: 'follow' }); 
    const d = await r.json(); 
    const c = document.getElementById('resultados-consulta'); 
    
    c.innerHTML = ''; 
    if (!d.resultados || d.resultados.length === 0) {
        c.innerHTML = '<p class="text-center opacity-50 p-5">Nada encontrado.</p>';
        return;
    }
    
    d.resultados.forEach(i => { 
        c.innerHTML += `
        <div class="bg-slate-800 p-4 rounded-xl mb-3 border border-slate-700 flex justify-between items-center">
            <div>
                <b class="text-lg text-white">${i.produto}</b><br>
                <span class="text-emerald-400 font-black text-xl">R$ ${i.preco.toFixed(2)}</span>
                <span class="text-xs bg-slate-700 px-2 py-1 rounded ml-2">${i.mercado}</span>
            </div>
            <button onclick="adicionarAoCarrinho('${i.produto.replace(/'/g, "\\'")}',${i.preco},'${i.mercado.replace(/'/g, "\\'")}')" class="text-white bg-emerald-600 hover:bg-emerald-500 w-12 h-12 rounded-full flex items-center justify-center shadow-lg">
                <i class="fas fa-plus"></i>
            </button>
        </div>`; 
    }); 
}


// =========================================================================
// CÂMERA, REGISTRO E UTILIDADES
// =========================================================================

function mostrarNotificacao(m, tipo = 'sucesso') { 
    const t = document.getElementById('toast-notification'); 
    document.getElementById('toast-message').textContent = m; 
    
    if(tipo === 'erro') {
        t.className = "fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 font-bold transition-all duration-300 pointer-events-none bg-red-500 text-white";
    } else {
        t.className = "fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 font-bold transition-all duration-300 pointer-events-none bg-emerald-600 text-white";
    }
    
    t.classList.remove('-translate-y-32', 'opacity-0'); 
    setTimeout(() => t.classList.add('-translate-y-32', 'opacity-0'), 3000); 
}

async function iniciarCamera(m) { 
    modoScanAtual = m; 
    document.getElementById('scanner-modal').classList.remove('hidden'); 
    try { 
        html5QrCode = new Html5Qrcode("reader"); 
        scannerIsRunning = true; 
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess); 
    } catch(e){ 
        alert("Erro ao iniciar a Câmera"); 
        fecharCamera(); 
    } 
}

function fecharCamera() { 
    if(scannerIsRunning && html5QrCode) { 
        html5QrCode.stop(); 
        scannerIsRunning = false; 
    } 
    document.getElementById('scanner-modal').classList.add('hidden'); 
}

function onScanSuccess(t) { 
    fecharCamera(); 
    if(modoScanAtual === 'pesquisar') { 
        trocarAba('consultar'); 
        document.getElementById('ean-busca').value = t; 
        pesquisarPrecos(); 
    } else { 
        trocarAba('registrar'); 
        document.getElementById('ean-field').value = t; 
    } 
}

async function salvarPreco(e) { 
    e.preventDefault(); 
    const p = { 
        ean: document.getElementById('ean-field').value, 
        produto: document.getElementById('product-name').value, 
        preco: document.getElementById('price').value, 
        mercado: document.getElementById('market').value, 
        usuario: document.getElementById('username').value 
    }; 
    await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(p), mode: 'no-cors' }); 
    mostrarNotificacao("Salvo!"); 
    setTimeout(() => location.reload(), 1500);
}

function comprimirImagem(file) { 
    return new Promise((resolve) => { 
        const reader = new FileReader(); 
        reader.readAsDataURL(file); 
        reader.onload = (e) => { 
            const img = new Image(); 
            img.src = e.target.result; 
            img.onload = () => { 
                const canvas = document.createElement('canvas'); 
                const ctx = canvas.getContext('2d'); 
                const scale = 800 / img.width; 
                canvas.width = 800; 
                canvas.height = img.height * scale; 
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                resolve(canvas.toDataURL('image/jpeg', 0.6)); 
            }; 
        }; 
    }); 
}

// =========================================================================
// EVENT LISTENERS DE INICIALIZAÇÃO
// =========================================================================

document.addEventListener('DOMContentLoaded', () => { 
    atualizarContadorCarrinho(); 
    
    if(document.getElementById('btn-enviar-chat')) {
        document.getElementById('btn-enviar-chat').addEventListener('click', enviarMensagemGemini); 
    }
    
    const inputChat = document.getElementById('chat-input');
    if(inputChat) {
        inputChat.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                enviarMensagemGemini();
            }
        });
    }
    
    const btnFoto = document.getElementById('btn-camera-foto'); 
    const inputFoto = document.getElementById('input-foto-produto'); 
    const imgPreview = document.getElementById('preview-imagem'); 
    const urlField = document.getElementById('image-url-field');
    
    if(btnFoto && inputFoto) { 
        btnFoto.addEventListener('click', () => inputFoto.click()); 
        
        inputFoto.addEventListener('change', async (e) => { 
            if(e.target.files && e.target.files[0]) { 
                const file = e.target.files[0]; 
                btnFoto.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; 
                try { 
                    const base64 = await comprimirImagem(file); 
                    imgPreview.src = base64; 
                    imgPreview.classList.remove('hidden'); 
                    btnFoto.classList.add('hidden'); 
                    urlField.value = base64; 
                } catch(err) { 
                    mostrarNotificacao("Erro na foto", "erro"); 
                    btnFoto.innerHTML = '<i class="fas fa-camera text-slate-400 text-2xl mb-1"></i><span class="text-[9px] text-slate-400 font-bold uppercase">Foto</span>'; 
                } 
            } 
        }); 
    }
    
    const f = document.getElementById('filtro-mercado-catalogo'); 
    if(f) {
        f.addEventListener('change', () => { 
            const v = f.value; 
            if(v === 'todos') atualizarListaCatalogo(catalogoDados); 
            else atualizarListaCatalogo(catalogoDados.filter(i => i.mercado === v)); 
        });
    }
    
    if(document.getElementById('btn-pesquisar')) {
        document.getElementById('btn-pesquisar').addEventListener('click', pesquisarPrecos); 
    }
    
    if(document.getElementById('price-form')) {
        document.getElementById('price-form').addEventListener('submit', salvarPreco); 
    }
    
    (async () => { 
        try { 
            const res = await fetch(`${APPS_SCRIPT_URL}?acao=buscarMercados`, { redirect: 'follow' }); 
            const d = await res.json(); 
            const s = document.getElementById('market'); 
            
            if(d.mercados && s) { 
                s.innerHTML = ''; 
                d.mercados.forEach(m => { 
                    const o = document.createElement('option'); 
                    o.value = m; 
                    o.textContent = m; 
                    s.appendChild(o); 
                }); 
            } 
        } catch(e) {} 
    })(); 
});
