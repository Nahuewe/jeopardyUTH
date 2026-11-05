/* ================================
   BUZZER HOST (solo admin)
   Recibe buzzers de jugadores remotos por WebRTC (PeerJS).
   No hay servidor propio: PeerJS solo hace la señalización inicial.
================================ */

import { Dialog } from './dialog.js';
import { Effects } from './effects.js';
import { Utils, esc } from './utils.js';

const PEER_SRC = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const QR_SRC = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const peerId = (room) => `jpduth-${room}`;
const genCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export class BuzzerHost {
    constructor({ state, live, modal }) {
        this.state = state;
        this.live = live;
        this.modal = modal;
        this.peer = null;
        this.entries = new Map();   // connectionId -> { conn, playerId, device, last }
        this.status = 'off';        // off | starting | on | error
        this.error = '';
        this.retries = 0;
        this.pushQueued = false;

        const schedule = () => this.#schedulePush();
        live.on('change', schedule);
        state.on('change', schedule);

        if (state.settings.buzzerEnabled) this.start();
    }

    /* =========================================================
       CONEXIÓN
    ========================================================= */

    async start() {
        if (this.peer) return;
        this.#setStatus('starting');
        try {
            await Utils.loadScript(PEER_SRC);
        } catch (e) {
            return this.#fail(e.message);
        }

        const s = this.state.settings;
        if (!s.roomCode) { s.roomCode = genCode(); this.state.commit(); }

        const peer = new Peer(peerId(s.roomCode));
        this.peer = peer;

        peer.on('open', () => {
            this.retries = 0;
            s.buzzerEnabled = true;
            this.state.commit();
            this.#setStatus('on');
        });
        peer.on('connection', (conn) => this.#onConnection(conn));
        peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed) peer.reconnect(); });
        peer.on('error', (err) => {
            if (this.peer !== peer) return;
            if (err.type === 'unavailable-id') {
                // Puede ser el registro anterior de esta misma pestaña: reintentar antes de cambiar el código.
                this.#teardown();
                if (++this.retries <= 3) return void setTimeout(() => this.start(), 2500);
                s.roomCode = genCode();
                this.state.commit();
                this.retries = 0;
                return void this.start();
            }
            if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
                return this.#fail('No se pudo contactar el servidor de señalización de PeerJS.');
            }
            console.warn('PeerJS:', err);
        });
    }

    stop(persist = true) {
        this.#teardown();
        if (persist) {
            this.state.settings.buzzerEnabled = false;
            this.state.commit();
        }
        this.#setStatus('off');
    }

    #teardown() {
        this.entries.forEach(({ conn }) => { try { conn.close(); } catch { /* ya cerrada */ } });
        this.entries.clear();
        try { this.peer?.destroy(); } catch { /* ya destruido */ }
        this.peer = null;
        this.#updateConnected();
    }

    #fail(message) {
        this.#teardown();
        this.error = message;
        this.#setStatus('error');
    }

    #setStatus(status) {
        if (status !== 'error') this.error = '';
        this.status = status;
        this.live.set({ buzzerOn: status === 'on' });
        document.getElementById('buzzerBtn')?.classList.toggle('on', status === 'on');
        if (Swal.isVisible() && document.getElementById('bzPanel')) this.#refreshDialog();
    }

    /* =========================================================
       MENSAJES
    ========================================================= */

    #onConnection(conn) {
        const entry = { conn, playerId: null, device: null, last: '' };
        this.entries.set(conn.connectionId, entry);

        conn.on('data', (msg) => this.#onData(entry, msg));
        const drop = () => {
            this.entries.delete(conn.connectionId);
            this.#updateConnected();
        };
        conn.on('close', drop);
        conn.on('error', drop);
    }

    #send(entry, payload) {
        try { if (entry.conn.open) entry.conn.send(payload); } catch (e) { console.warn('Buzzer: envío fallido', e); }
    }

    #onData(entry, msg) {
        if (!msg || typeof msg !== 'object') return;

        if (msg.t === 'hello') {
            entry.device = String(msg.device || '');
            if (msg.playerId && this.#tryJoin(entry, msg.playerId)) return;
            this.#sendRoster(entry);
        } else if (msg.t === 'join') {
            if (!this.#tryJoin(entry, msg.playerId)) {
                this.#send(entry, { t: 'error', message: 'Ese jugador ya está conectado desde otro dispositivo.' });
                this.#sendRoster(entry);
            }
        } else if (msg.t === 'leave') {
            entry.playerId = null;
            entry.last = '';
            this.#updateConnected();
            this.#sendRoster(entry);
        } else if (msg.t === 'buzz') {
            const pid = this.#target(entry.playerId);
            if (pid) this.modal.buzz(pid, { remote: true });
        }
    }

    #tryJoin(entry, playerId) {
        const player = this.state.players.find(p => p.id === playerId);
        if (!player) return false;
        // Si el mismo dispositivo se reconecta, se descarta la conexión vieja.
        for (const [id, other] of this.entries) {
            if (other === entry || other.playerId !== playerId) continue;
            if (other.device && other.device === entry.device) {
                this.entries.delete(id);
                try { other.conn.close(); } catch { /* ya cerrada */ }
            } else return false;
        }
        entry.playerId = playerId;
        entry.last = '';
        this.#send(entry, { t: 'joined', player: { id: player.id, name: player.name, color: player.color } });
        this.#updateConnected();
        this.#schedulePush();
        return true;
    }

    #sendRoster(entry) {
        const taken = new Set([...this.entries.values()].filter(e => e !== entry && e.playerId).map(e => e.playerId));
        this.#send(entry, {
            t: 'roster',
            players: this.state.players.map(p => ({ id: p.id, name: p.name, color: p.color, taken: taken.has(p.id) }))
        });
    }

    /** Participante que puntúa cuando este jugador aprieta (él mismo o su equipo). */
    #target(playerId) {
        const q = this.live.data.q;
        const round = q && this.state.roundById(q.roundId);
        if (!round || !playerId) return null;
        if (!this.state.isTeamRound(round)) return this.state.players.some(p => p.id === playerId) ? playerId : null;
        return this.state.teams.find(t => t.memberIds.includes(playerId))?.id ?? null;
    }

    #statusFor(entry) {
        const l = this.live.data;
        const q = l.q;
        const player = this.state.players.find(p => p.id === entry.playerId);
        const base = { t: 'status', name: player?.name ?? '', color: player?.color ?? '#5865f2', score: player?.score ?? 0 };

        if (l.screen !== 'question' || !q || q.phase !== 'open' || q.dd || q.result) return { ...base, state: 'idle' };

        const target = this.#target(entry.playerId);
        if (!target) return { ...base, state: 'noteam' };
        if (q.buzzedId) {
            return q.buzzedId === target
                ? { ...base, state: 'you' }
                : { ...base, state: 'other', who: this.state.participantById(q.buzzedId)?.name ?? '' };
        }
        if (q.lockedOut.includes(target)) return { ...base, state: 'out' };
        return { ...base, state: q.buzzOpen ? 'armed' : 'wait' };
    }

    #schedulePush() {
        if (this.pushQueued || this.status !== 'on') return;
        this.pushQueued = true;
        queueMicrotask(() => { this.pushQueued = false; this.#push(); });
    }

    #push() {
        for (const entry of this.entries.values()) {
            if (!entry.playerId) continue;
            if (!this.state.players.some(p => p.id === entry.playerId)) {
                entry.playerId = null;
                this.#sendRoster(entry);
                continue;
            }
            const status = this.#statusFor(entry);
            const sig = JSON.stringify(status);
            if (sig !== entry.last) { entry.last = sig; this.#send(entry, status); }
        }
    }

    #updateConnected() {
        const ids = [...new Set([...this.entries.values()].map(e => e.playerId).filter(Boolean))];
        const prev = this.live.data.connected;
        if (ids.length === prev.length && ids.every(i => prev.includes(i))) return;
        this.live.set({ connected: ids });
        if (Swal.isVisible() && document.getElementById('bzPanel')) this.#refreshDialog();
    }

    /* =========================================================
       DIÁLOGO DE ADMINISTRACIÓN
    ========================================================= */

    link() {
        const s = this.state.settings;
        let base = s.publicUrl.trim();
        if (!base) base = new URL('.', location.href).toString();
        if (!base.endsWith('/')) base += '/';
        return `${base}buzzer.html?room=${encodeURIComponent(s.roomCode)}`;
    }

    #isLocal() {
        return !this.state.settings.publicUrl.trim()
            && /^(localhost|127\.|\[::1\]|192\.168\.|10\.)/.test(location.hostname);
    }

    #dialogHTML() {
        const s = this.state.settings;
        const on = this.status === 'on';
        const label = { off: 'Apagado', starting: 'Conectando…', on: 'Activo', error: 'Error' }[this.status];
        const players = this.state.players.map(p => {
            const here = this.live.data.connected.includes(p.id);
            return `<li class="${here ? 'on' : ''}"><span class="bz-dot" style="background:${esc(p.color)}"></span>${esc(p.name)} <em>${here ? '📱 conectado' : '—'}</em></li>`;
        }).join('') || '<li><em>No hay jugadores todavía.</em></li>';

        return `
            <div class="bz-panel" id="bzPanel">
                <p>Estado: <strong class="bz-state bz-${this.status}">${label}</strong></p>
                ${this.error ? `<p class="bz-error">${esc(this.error)}</p>` : ''}
                ${on ? `
                    <label class="bz-label">Link para los jugadores
                        <input id="bzLink" class="swal2-input" readonly value="${esc(this.link())}" style="margin:4px 0;width:100%;box-sizing:border-box;">
                    </label>
                    <div id="bzQr" class="bz-qr"></div>
                    <p class="bz-code">Código de sala: <strong>${esc(s.roomCode)}</strong></p>` : ''}
                ${this.#isLocal() ? `<p class="bz-warn">⚠️ La app está en <code>${esc(location.host)}</code>: los celulares de otras redes no pueden abrir ese link.
                    Publicá la carpeta (GitHub Pages, Netlify…) y pegá abajo la URL pública.</p>` : ''}
                <label class="bz-label">URL pública de la app (opcional)
                    <input id="bzPublic" class="swal2-input" placeholder="https://usuario.github.io/jeopardy/" value="${esc(s.publicUrl)}" style="margin:4px 0;width:100%;box-sizing:border-box;">
                </label>
                <ul class="bz-list">${players}</ul>
                <div class="bz-actions">
                    <button class="btn ${on ? 'danger' : 'btn-save'}" data-action="bz-toggle">${on || this.status === 'starting' ? 'Desactivar buzzers' : 'Activar buzzers'}</button>
                    ${on ? '<button class="btn" data-action="bz-copy">📋 Copiar link</button><button class="btn" data-action="bz-newcode">🔁 Nuevo código</button>' : ''}
                </div>
            </div>`;
    }

    openDialog() {
        Dialog.fire({
            title: '📱 Buzzers remotos',
            html: this.#dialogHTML(),
            showConfirmButton: false,
            showCloseButton: true,
            width: 560,
            didOpen: () => this.#afterRender(),
            willClose: () => { /* nada */ }
        });
    }

    #refreshDialog() {
        const box = document.getElementById('bzPanel');
        if (!box) return;
        const focused = document.activeElement?.id;
        box.outerHTML = this.#dialogHTML();
        this.#afterRender();
        if (focused) document.getElementById(focused)?.focus();
    }

    async #afterRender() {
        document.getElementById('bzPublic')?.addEventListener('change', (e) => {
            this.state.settings.publicUrl = e.target.value.trim();
            this.state.commit();
            this.#refreshDialog();
        });

        const qrBox = document.getElementById('bzQr');
        if (qrBox) {
            try {
                await Utils.loadScript(QR_SRC);
                const qr = qrcode(0, 'M');
                qr.addData(this.link());
                qr.make();
                const el = document.getElementById('bzQr');
                if (el) el.innerHTML = qr.createSvgTag(5, 2);
            } catch { /* el QR es opcional */ }
        }
    }

    async handle(action) {
        if (action === 'bz-toggle') {
            if (this.status === 'on' || this.status === 'starting') this.stop(); else await this.start();
        } else if (action === 'bz-copy') {
            try {
                await navigator.clipboard.writeText(this.link());
                Effects.toast('📋 Link copiado', 'success');
            } catch {
                document.getElementById('bzLink')?.select();
                Effects.toast('Copiá el link con Ctrl+C', 'info');
            }
        } else if (action === 'bz-newcode') {
            this.stop(false);
            this.state.settings.roomCode = genCode();
            this.state.commit();
            await this.start();
        }
        this.#refreshDialog();
    }
}
