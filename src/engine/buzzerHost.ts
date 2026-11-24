/* Buzzers remotos (solo admin): recibe el "buzz" de los celulares por WebRTC (PeerJS).
   No hay servidor propio: PeerJS solo hace la señalización inicial. */

import Peer, { type DataConnection } from 'peerjs';
import { EventBus } from './eventBus.ts';
import type { GameState } from './gameState.ts';
import type { LiveState } from './liveState.ts';
import type { QuestionController } from './question.ts';

const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const peerId = (room: string) => `jpduth-${room}`;
const genCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export type HostStatus = 'off' | 'starting' | 'on' | 'error';

/** Mensajes celular -> admin. */
type ClientMsg =
    | { t: 'hello'; device?: string; playerId?: string | null }
    | { t: 'join'; playerId: string }
    | { t: 'leave' }
    | { t: 'buzz' };

/** Estado que se le muestra al celular. */
export type BuzzState = 'idle' | 'noteam' | 'you' | 'other' | 'out' | 'foul' | 'armed' | 'wait';
interface StatusMsg { t: 'status'; state: BuzzState; name: string; color: string; score: number; who?: string; ms?: number }

interface Entry { conn: DataConnection; playerId: string | null; device: string | null; last: string }

export class BuzzerHost extends EventBus<{ change: BuzzerHost }> {
    status: HostStatus = 'off';
    error = '';
    version = 0;
    #peer: Peer | null = null;
    #entries = new Map<string, Entry>();
    #retries = 0;
    #pushQueued = false;
    #foulTimer: ReturnType<typeof setTimeout> | undefined;
    #state: GameState;
    #live: LiveState;
    #question: QuestionController;

    constructor(state: GameState, live: LiveState, question: QuestionController) {
        super();
        this.#state = state;
        this.#live = live;
        this.#question = question;
        const schedule = () => this.#schedulePush();
        live.on('change', schedule);
        state.on('change', schedule);
    }

    /** Arranca solo si estaba activado en la sesión anterior. */
    autoStart(): void {
        if (this.#state.settings.buzzerEnabled) void this.start();
    }

    get connectedCount(): number { return this.#live.data.connected.length; }

    #changed(): void {
        this.version++;
        this.emit('change', this);
    }

    /* ---------- Conexión ---------- */

    async start(): Promise<void> {
        if (this.#peer) return;
        this.#setStatus('starting');

        const s = this.#state.settings;
        if (!s.roomCode) { s.roomCode = genCode(); this.#state.commit(); }

        const peer = new Peer(peerId(s.roomCode));
        this.#peer = peer;

        peer.on('open', () => {
            this.#retries = 0;
            s.buzzerEnabled = true;
            this.#state.commit();
            this.#setStatus('on');
        });
        peer.on('connection', (conn) => this.#onConnection(conn));
        peer.on('disconnected', () => { if (this.#peer === peer && !peer.destroyed) peer.reconnect(); });
        peer.on('error', (err) => {
            if (this.#peer !== peer) return;
            if (err.type === 'unavailable-id') {
                // Puede ser el registro anterior de esta misma pestaña: reintentar antes de cambiar el código.
                this.#teardown();
                if (++this.#retries <= 3) { setTimeout(() => void this.start(), 2500); return; }
                s.roomCode = genCode();
                this.#state.commit();
                this.#retries = 0;
                void this.start();
                return;
            }
            if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
                this.#fail('No se pudo contactar el servidor de señalización de PeerJS.');
                return;
            }
            console.warn('PeerJS:', err);
        });
    }

    stop(persist = true): void {
        this.#teardown();
        if (persist) {
            this.#state.settings.buzzerEnabled = false;
            this.#state.commit();
        }
        this.#setStatus('off');
    }

    async newCode(): Promise<void> {
        this.stop(false);
        this.#state.settings.roomCode = genCode();
        this.#state.commit();
        await this.start();
    }

    #teardown(): void {
        this.#entries.forEach(({ conn }) => { try { conn.close(); } catch { /* ya cerrada */ } });
        this.#entries.clear();
        try { this.#peer?.destroy(); } catch { /* ya destruido */ }
        this.#peer = null;
        this.#updateConnected();
    }

    #fail(message: string): void {
        this.#teardown();
        this.error = message;
        this.#setStatus('error');
    }

    #setStatus(status: HostStatus): void {
        if (status !== 'error') this.error = '';
        this.status = status;
        this.#live.set({ buzzerOn: status === 'on' });
        this.#changed();
    }

    /* ---------- Mensajes ---------- */

    #onConnection(conn: DataConnection): void {
        const entry: Entry = { conn, playerId: null, device: null, last: '' };
        this.#entries.set(conn.connectionId, entry);

        conn.on('data', (msg) => this.#onData(entry, msg as ClientMsg));
        const drop = () => { this.#entries.delete(conn.connectionId); this.#updateConnected(); };
        conn.on('close', drop);
        conn.on('error', drop);
    }

    #send(entry: Entry, payload: unknown): void {
        try { if (entry.conn.open) void entry.conn.send(payload); } catch (e) { console.warn('Buzzer: envío fallido', e); }
    }

    #onData(entry: Entry, msg: ClientMsg): void {
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
            if (pid) this.#question.buzz(pid, { remote: true });
        }
    }

    #tryJoin(entry: Entry, playerId: string): boolean {
        const player = this.#state.players.find(p => p.id === playerId);
        if (!player) return false;
        // Si el mismo dispositivo se reconecta, se descarta la conexión vieja.
        for (const [id, other] of this.#entries) {
            if (other === entry || other.playerId !== playerId) continue;
            if (other.device && other.device === entry.device) {
                this.#entries.delete(id);
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

    #sendRoster(entry: Entry): void {
        const taken = new Set([...this.#entries.values()].filter(e => e !== entry && e.playerId).map(e => e.playerId));
        this.#send(entry, {
            t: 'roster',
            players: this.#state.players.map(p => ({ id: p.id, name: p.name, color: p.color, taken: taken.has(p.id) }))
        });
    }

    /** Participante que puntúa cuando este jugador aprieta (él mismo o su equipo). */
    #target(playerId: string | null): string | null {
        const q = this.#live.data.q;
        const round = q && this.#state.roundById(q.roundId);
        if (!round || !playerId) return null;
        if (!this.#state.isTeamRound(round)) return this.#state.players.some(p => p.id === playerId) ? playerId : null;
        return this.#state.teams.find(t => t.memberIds.includes(playerId))?.id ?? null;
    }

    #statusFor(entry: Entry): StatusMsg {
        const l = this.#live.data;
        const q = l.q;
        const player = this.#state.players.find(p => p.id === entry.playerId);
        const base = { t: 'status' as const, name: player?.name ?? '', color: player?.color ?? '#5865f2', score: player?.score ?? 0 };

        if (l.screen !== 'question' || !q || q.phase !== 'open' || q.result) return { ...base, state: 'idle' };

        const target = this.#target(entry.playerId);
        if (!target) return { ...base, state: 'noteam' };
        if (q.buzzedId) {
            return q.buzzedId === target
                ? { ...base, state: 'you' }
                : { ...base, state: 'other', who: this.#state.participantById(q.buzzedId)?.name ?? '' };
        }
        if (q.lockedOut.includes(target)) return { ...base, state: 'out' };
        const foulMs = (q.fouls[target] ?? 0) - Date.now();
        if (foulMs > 0) return { ...base, state: 'foul', ms: foulMs };
        return { ...base, state: q.buzzOpen ? 'armed' : 'wait' };
    }

    #schedulePush(): void {
        if (this.#pushQueued || this.status !== 'on') return;
        this.#pushQueued = true;
        queueMicrotask(() => { this.#pushQueued = false; this.#push(); });
    }

    #push(): void {
        clearTimeout(this.#foulTimer);
        let nextExpiry = Infinity;
        for (const entry of this.#entries.values()) {
            if (!entry.playerId) continue;
            if (!this.#state.players.some(p => p.id === entry.playerId)) {
                entry.playerId = null;
                this.#sendRoster(entry);
                continue;
            }
            const status = this.#statusFor(entry);
            if (status.state === 'foul') nextExpiry = Math.min(nextExpiry, status.ms ?? Infinity);
            const sig = JSON.stringify({ ...status, ms: status.state === 'foul' ? Math.round((status.ms ?? 0) / 250) : undefined });
            if (sig !== entry.last) { entry.last = sig; this.#send(entry, status); }
        }
        if (nextExpiry < Infinity) this.#foulTimer = setTimeout(() => this.#push(), nextExpiry + 30);
    }

    #updateConnected(): void {
        const ids = [...new Set([...this.#entries.values()].map(e => e.playerId).filter((id): id is string => !!id))];
        const prev = this.#live.data.connected;
        if (ids.length === prev.length && ids.every(i => prev.includes(i))) return;
        this.#live.set({ connected: ids });
        this.#changed();
    }

    /* ---------- Link para los jugadores ---------- */

    link(): string {
        const s = this.#state.settings;
        let base = s.publicUrl.trim();
        if (!base) base = new URL('.', location.href).toString();
        if (!base.endsWith('/')) base += '/';
        return `${base}buzzer.html?room=${encodeURIComponent(s.roomCode)}`;
    }

    isLocalLink(): boolean {
        return !this.#state.settings.publicUrl.trim()
            && /^(localhost|127\.|\[::1\]|192\.168\.|10\.)/.test(location.hostname);
    }
}
