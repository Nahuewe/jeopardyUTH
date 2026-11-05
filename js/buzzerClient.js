/* ================================
   BUZZER CLIENT (celular / navegador del jugador)
   Se conecta por WebRTC al admin y manda el "buzz".
================================ */

import { esc, uid } from './utils.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const peerId = (room) => `jpduth-${room}`;

const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* modo privado */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* modo privado */ } }
};

const device = store.get('jpd-device') || uid();
store.set('jpd-device', device);

let room = (params.get('room') || '').trim().toLowerCase();
let peer = null;
let conn = null;
let me = null;               // { id, name, color }
let lastStatus = null;
let retryTimer = null;
let connectTimeout = null;
let connected = false;
let foulTimer = null;

/* ---------- Vistas ---------- */

function showMessage(html, { retry = false } = {}) {
    app.innerHTML = `<div class="bz-center"><p class="bz-msg">${html}</p>${retry ? '<button class="bz-btn-secondary" id="retry">Reintentar</button>' : ''}</div>`;
    document.getElementById('retry')?.addEventListener('click', connect);
}

function showRoomForm(error = '') {
    app.innerHTML = `
        <form class="bz-center" id="roomForm">
            <h1>Buzzer</h1>
            ${error ? `<p class="bz-error">${esc(error)}</p>` : ''}
            <label>Código de sala<input id="roomInput" autocomplete="off" autocapitalize="none" maxlength="12" required></label>
            <button class="bz-btn-primary" type="submit">Entrar</button>
        </form>`;
    document.getElementById('roomForm').addEventListener('submit', (e) => {
        e.preventDefault();
        room = document.getElementById('roomInput').value.trim().toLowerCase();
        history.replaceState(null, '', `?room=${encodeURIComponent(room)}`);
        connect();
    });
}

function showRoster(players, error = '') {
    app.innerHTML = `
        <div class="bz-center">
            <h1>¿Quién sos?</h1>
            ${error ? `<p class="bz-error">${esc(error)}</p>` : ''}
            <div class="bz-roster">
                ${players.map(p => `
                    <button class="bz-player" data-id="${esc(p.id)}" style="--c:${esc(p.color)}" ${p.taken ? 'disabled' : ''}>
                        ${esc(p.name)}${p.taken ? ' <small>(en uso)</small>' : ''}
                    </button>`).join('') || '<p class="bz-msg">El admin todavía no cargó jugadores.</p>'}
            </div>
        </div>`;
    app.querySelectorAll('.bz-player').forEach(btn => btn.addEventListener('click', () => {
        send({ t: 'join', playerId: btn.dataset.id });
    }));
}

const LABELS = {
    idle: ['Esperando una pregunta…', 'idle'],
    wait: ['Escuchá la pregunta… ¡no aprietes todavía!', 'wait'],
    foul: ['⚠️ ¡Te adelantaste!', 'foul'],
    armed: ['¡APRETÁ!', 'armed'],
    you: ['¡Tenés la palabra!', 'you'],
    other: ['respondió primero', 'other'],
    out: ['Ya fallaste en esta pregunta', 'out'],
    noteam: ['No estás en ningún equipo', 'out']
};

function showPlay(status) {
    const s = status || lastStatus || { state: 'idle', name: me?.name, color: me?.color, score: 0 };
    const [text, cls] = LABELS[s.state] ?? LABELS.idle;
    const label = s.state === 'other' ? `${esc(s.who || 'Otro jugador')} ${text}`
        : s.state === 'foul' ? `${text}<small id="foulLeft">Esperá ${Math.ceil((s.ms || 0) / 1000)} s</small>` : text;
    // En 'wait' el botón responde (apretar antes de tiempo es falta); en 'foul' reinicia el castigo.
    const enabled = s.state === 'armed' || s.state === 'wait' || s.state === 'foul';

    app.innerHTML = `
        <div class="bz-play">
            <header style="--c:${esc(s.color || '#5865f2')}">
                <span class="bz-name">${esc(s.name || me?.name || '')}</span>
                <span class="bz-score">$${Number(s.score || 0)}</span>
            </header>
            <button id="buzz" class="bz-buzz ${cls}" ${enabled ? '' : 'disabled'} aria-label="Buzzer">${label}</button>
            <footer>${connected ? '🟢 Conectado' : '🟠 Reconectando…'} · <button id="leave" class="bz-link">No soy yo</button></footer>
        </div>`;

    clearInterval(foulTimer);
    if (s.state === 'foul') {
        const end = Date.now() + (s.ms || 0);
        foulTimer = setInterval(() => {
            const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            const el = document.getElementById('foulLeft');
            if (el) el.textContent = `Esperá ${left} s`;
            if (left <= 0) clearInterval(foulTimer);
        }, 250);
    }

    const buzz = document.getElementById('buzz');
    // pointerdown responde más rápido que click en celulares.
    buzz.addEventListener('pointerdown', (e) => {
        if (buzz.disabled) return;
        e.preventDefault();
        send({ t: 'buzz' });
        navigator.vibrate?.(60);
        if (buzz.classList.contains('armed')) {
            buzz.disabled = true;
            buzz.textContent = 'Enviado…';
        } else {
            navigator.vibrate?.([120, 60, 120]);
        }
    });
    document.getElementById('leave').addEventListener('click', () => {
        store.del(`jpd-player-${room}`);
        me = null;
        lastStatus = null;
        send({ t: 'leave' });
    });
}

/* ---------- Conexión ---------- */

function send(payload) {
    try { if (conn?.open) conn.send(payload); } catch (e) { console.warn(e); }
}

function onData(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'roster') {
        me = null;
        showRoster(msg.players);
    } else if (msg.t === 'joined') {
        me = msg.player;
        store.set(`jpd-player-${room}`, me.id);
        showPlay();
    } else if (msg.t === 'status') {
        const changed = !lastStatus || lastStatus.state !== msg.state;
        lastStatus = msg;
        showPlay(msg);
        if (changed && msg.state === 'armed') navigator.vibrate?.(30);
        if (changed && msg.state === 'you') navigator.vibrate?.([80, 40, 80]);
    } else if (msg.t === 'error') {
        showRoster([], msg.message);
    }
}

function connect() {
    clearTimeout(retryTimer);
    clearTimeout(connectTimeout);
    if (!room) return showRoomForm();
    if (typeof Peer === 'undefined') return showMessage('No se pudo cargar la librería de conexión. Revisá tu internet.', { retry: true });

    try { conn?.close(); peer?.destroy(); } catch { /* ya cerrados */ }
    showMessage('Conectando a la sala…');

    peer = new Peer();
    peer.on('open', () => {
        conn = peer.connect(peerId(room), { reliable: true });

        connectTimeout = setTimeout(() => {
            if (!connected) {
                try { peer.destroy(); } catch { /* ya destruido */ }
                showMessage('No encontré la sala. Revisá el código y que el admin tenga los buzzers activados.', { retry: true });
            }
        }, 12000);

        conn.on('open', () => {
            clearTimeout(connectTimeout);
            connected = true;
            send({ t: 'hello', device, playerId: store.get(`jpd-player-${room}`) });
        });
        conn.on('data', onData);
        conn.on('close', onDisconnect);
        conn.on('error', onDisconnect);
    });
    peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
            clearTimeout(connectTimeout);
            showMessage('La sala no existe o el admin no activó los buzzers.', { retry: true });
        } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
            showMessage('No se pudo contactar el servidor de conexión.', { retry: true });
        }
    });
}

function onDisconnect() {
    if (!connected) return;
    connected = false;
    if (me) showPlay();
    else showMessage('Conexión perdida. Reconectando…');
    retryTimer = setTimeout(connect, 2000);
}

connect();
