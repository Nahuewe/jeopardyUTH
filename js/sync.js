/* ================================
   SYNC
   Comunicación entre pestañas (admin <-> anunciador)
   mediante BroadcastChannel. El admin es la fuente de verdad.
================================ */

const CHANNEL = 'jeopardy-uth-sync';
const HEARTBEAT_MS = 2000;
const PRESENCE_TIMEOUT_MS = 6500;

export class Sync {
    constructor(role) {
        this.role = role; // 'admin' | 'announcer'
        this.handlers = new Map();
        this.lastAnnouncerSeen = 0;
        this.lastAdminSeen = 0;
        this.otherAdmin = false;
        this._presence = false;
        this.supported = typeof BroadcastChannel !== 'undefined';
        this.channel = this.supported ? new BroadcastChannel(CHANNEL) : null;

        if (this.channel) {
            this.channel.onmessage = (e) => this.#receive(e.data);
        }

        if (role === 'announcer') {
            this.send('hello');
            this.heartbeat = setInterval(() => this.send('ping'), HEARTBEAT_MS);
            window.addEventListener('pagehide', () => this.send('bye'));
        } else {
            this.send('admin-hello');
            this.presenceTimer = setInterval(() => this.#checkPresence(), 1500);
        }
    }

    on(type, fn) {
        if (!this.handlers.has(type)) this.handlers.set(type, new Set());
        this.handlers.get(type).add(fn);
        return () => this.handlers.get(type)?.delete(fn);
    }

    send(type, data) {
        try {
            this.channel?.postMessage({ type, data, from: this.role });
        } catch (e) {
            console.warn('Sync: no se pudo enviar', type, e);
        }
    }

    /** ¿Hay una vista de anunciador viva? (solo tiene sentido en admin) */
    get announcerPresent() {
        return Date.now() - this.lastAnnouncerSeen < PRESENCE_TIMEOUT_MS;
    }

    #checkPresence() {
        const now = this.announcerPresent;
        if (now !== this._presence) {
            this._presence = now;
            this.#dispatch('presence', now);
        }
    }

    #receive(msg) {
        if (!msg || msg.from === this.role && msg.type !== 'admin-here' && msg.type !== 'admin-hello') return;

        if (this.role === 'admin') {
            if (msg.from === 'announcer') {
                if (msg.type === 'bye') {
                    this.lastAnnouncerSeen = 0;
                } else {
                    this.lastAnnouncerSeen = Date.now();
                }
                this.#checkPresence();
            }
            if (msg.type === 'admin-hello' && msg.from === 'admin') this.send('admin-here');
            if (msg.type === 'admin-here' && msg.from === 'admin') this.otherAdmin = true;
        } else if (msg.from === 'admin') {
            this.lastAdminSeen = Date.now();
        }

        this.#dispatch(msg.type, msg.data);
    }

    #dispatch(type, data) {
        this.handlers.get(type)?.forEach(fn => {
            try { fn(data); } catch (e) { console.error(`Sync handler "${type}":`, e); }
        });
    }
}
