/* Comunicación entre pestañas (admin <-> anunciador) con BroadcastChannel.
   El admin es la fuente de verdad. Mismo protocolo que la versión anterior. */

import type { GameData, LiveData } from './types.ts';

export type Role = 'admin' | 'announcer';

/** Mensajes que viajan por el canal y el tipo de su carga. */
export interface SyncMessages {
    hello: undefined;
    ping: undefined;
    bye: undefined;
    'admin-hello': undefined;
    'admin-here': undefined;
    state: GameData;
    live: LiveData;
    fx: { name: string; soundOnly?: boolean };
    media: unknown;
    presence: boolean;
}

type Handler<K extends keyof SyncMessages> = (data: SyncMessages[K]) => void;

const CHANNEL = 'jeopardy-uth-sync';
const HEARTBEAT_MS = 2000;
const PRESENCE_TIMEOUT_MS = 6500;

export class Sync {
    readonly role: Role;
    readonly supported: boolean;
    otherAdmin = false;
    lastAnnouncerSeen = 0;
    lastAdminSeen = 0;
    #presence = false;
    #handlers = new Map<keyof SyncMessages, Set<Handler<never>>>();
    #channel: BroadcastChannel | null;
    #timers: ReturnType<typeof setInterval>[] = [];

    constructor(role: Role) {
        this.role = role;
        this.supported = typeof BroadcastChannel !== 'undefined';
        this.#channel = this.supported ? new BroadcastChannel(CHANNEL) : null;
        if (this.#channel) this.#channel.onmessage = (e) => this.#receive(e.data);

        if (role === 'announcer') {
            this.send('hello');
            this.#timers.push(setInterval(() => this.send('ping'), HEARTBEAT_MS));
            window.addEventListener('pagehide', () => this.send('bye'));
        } else {
            this.send('admin-hello');
            this.#timers.push(setInterval(() => this.#checkPresence(), 1500));
        }
    }

    on<K extends keyof SyncMessages>(type: K, fn: Handler<K>): () => void {
        let set = this.#handlers.get(type);
        if (!set) this.#handlers.set(type, (set = new Set()));
        set.add(fn as Handler<never>);
        return () => { set.delete(fn as Handler<never>); };
    }

    send<K extends keyof SyncMessages>(type: K, ...data: SyncMessages[K] extends undefined ? [] : [SyncMessages[K]]): void {
        try {
            this.#channel?.postMessage({ type, data: data[0], from: this.role });
        } catch (e) {
            console.warn('Sync: no se pudo enviar', type, e);
        }
    }

    /** ¿Hay una vista de anunciador viva? (solo tiene sentido en admin) */
    get announcerPresent(): boolean {
        return Date.now() - this.lastAnnouncerSeen < PRESENCE_TIMEOUT_MS;
    }

    destroy(): void {
        this.#timers.forEach(clearInterval);
        this.#channel?.close();
    }

    #checkPresence(): void {
        const now = this.announcerPresent;
        if (now !== this.#presence) {
            this.#presence = now;
            this.#dispatch('presence', now);
        }
    }

    #receive(msg: { type: keyof SyncMessages; data: never; from: Role } | null): void {
        if (!msg || (msg.from === this.role && msg.type !== 'admin-here' && msg.type !== 'admin-hello')) return;

        if (this.role === 'admin') {
            if (msg.from === 'announcer') {
                this.lastAnnouncerSeen = msg.type === 'bye' ? 0 : Date.now();
                this.#checkPresence();
            }
            if (msg.type === 'admin-hello' && msg.from === 'admin') this.send('admin-here');
            if (msg.type === 'admin-here' && msg.from === 'admin') this.otherAdmin = true;
        } else if (msg.from === 'admin') {
            this.lastAdminSeen = Date.now();
        }

        this.#dispatch(msg.type, msg.data);
    }

    #dispatch<K extends keyof SyncMessages>(type: K, data: SyncMessages[K]): void {
        this.#handlers.get(type)?.forEach(fn => {
            try { (fn as Handler<K>)(data); } catch (e) { console.error(`Sync handler "${String(type)}":`, e); }
        });
    }
}
