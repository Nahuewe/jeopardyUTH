/* Buzzer del jugador (celular): se conecta por WebRTC al admin y manda el "buzz". */

import Peer, { type DataConnection } from 'peerjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BuzzState } from '../engine/buzzerHost.ts';
import { uid } from '../engine/utils.ts';

const peerId = (room: string) => `jpduth-${room}`;

const store = {
    get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
    set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* modo privado */ } },
    del(k: string): void { try { localStorage.removeItem(k); } catch { /* modo privado */ } }
};

interface RosterPlayer { id: string; name: string; color: string; taken: boolean }
interface Me { id: string; name: string; color: string }
interface Status { state: BuzzState; name: string; color: string; score: number; who?: string; ms?: number }

type ServerMsg =
    | { t: 'roster'; players: RosterPlayer[] }
    | { t: 'joined'; player: Me }
    | ({ t: 'status' } & Status)
    | { t: 'error'; message: string };

type View =
    | { kind: 'message'; text: string; retry?: boolean }
    | { kind: 'room'; error?: string }
    | { kind: 'roster'; players: RosterPlayer[]; error?: string }
    | { kind: 'play' };

const LABELS: Record<BuzzState, [string, string]> = {
    idle: ['Esperando una pregunta…', 'idle'],
    wait: ['Escuchá la pregunta… ¡no aprietes todavía!', 'wait'],
    foul: ['⚠️ ¡Te adelantaste!', 'foul'],
    armed: ['¡APRETÁ!', 'armed'],
    you: ['¡Tenés la palabra!', 'you'],
    other: ['respondió primero', 'other'],
    out: ['Ya fallaste en esta pregunta', 'out'],
    noteam: ['No estás en ningún equipo', 'out']
};

const device = (() => {
    const d = store.get('jpd-device') || uid();
    store.set('jpd-device', d);
    return d;
})();

function BuzzButton({ status, connected, send, onLeave }: { status: Status; connected: boolean; send: (p: unknown) => void; onLeave: () => void }) {
    const [text, cls] = LABELS[status.state] ?? LABELS.idle;
    const enabled = status.state === 'armed' || status.state === 'wait' || status.state === 'foul';
    const [sent, setSent] = useState(false);
    const [left, setLeft] = useState(Math.ceil((status.ms ?? 0) / 1000));

    useEffect(() => { setSent(false); }, [status.state]);

    // Cuenta regresiva del castigo.
    useEffect(() => {
        if (status.state !== 'foul') return;
        const end = Date.now() + (status.ms ?? 0);
        const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [status.state, status.ms]);

    const label = status.state === 'other' ? `${status.who || 'Otro jugador'} ${text}` : text;

    return (
        <div className="bz-play">
            <header style={{ ['--c' as string]: status.color || '#5865f2' }}>
                <span className="bz-name">{status.name}</span>
                <span className="bz-score">${Number(status.score || 0)}</span>
            </header>
            {/* pointerdown responde más rápido que click en celulares */}
            <button className={`bz-buzz ${cls}`} disabled={!enabled || sent} aria-label="Buzzer"
                onPointerDown={e => {
                    if (!enabled || sent) return;
                    e.preventDefault();
                    send({ t: 'buzz' });
                    navigator.vibrate?.(60);
                    if (status.state === 'armed') setSent(true); else navigator.vibrate?.([120, 60, 120]);
                }}>
                {sent ? 'Enviado…' : label}
                {status.state === 'foul' && <small id="foulLeft">Esperá {left} s</small>}
            </button>
            <footer>{connected ? '🟢 Conectado' : '🟠 Reconectando…'} · <button className="bz-link" onClick={onLeave}>No soy yo</button></footer>
        </div>
    );
}

export function BuzzerApp() {
    const [room, setRoom] = useState(() => (new URLSearchParams(location.search).get('room') || '').trim().toLowerCase());
    const [view, setView] = useState<View>({ kind: 'message', text: 'Cargando…' });
    const [status, setStatus] = useState<Status | null>(null);
    const [me, setMe] = useState<Me | null>(null);
    const [connected, setConnected] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const conn = useRef<DataConnection | null>(null);
    const meRef = useRef<Me | null>(null);
    meRef.current = me;

    const send = useCallback((payload: unknown) => {
        try { if (conn.current?.open) void conn.current.send(payload); } catch (e) { console.warn(e); }
    }, []);

    useEffect(() => {
        if (!room) { setView({ kind: 'room' }); return; }
        setView({ kind: 'message', text: 'Conectando a la sala…' });
        let alive = true;
        let isConnected = false;
        let retry: ReturnType<typeof setTimeout> | undefined;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const peer = new Peer();

        const onDisconnect = () => {
            if (!isConnected || !alive) return;
            isConnected = false;
            setConnected(false);
            setView(meRef.current ? { kind: 'play' } : { kind: 'message', text: 'Conexión perdida. Reconectando…' });
            retry = setTimeout(() => setAttempt(n => n + 1), 2000);
        };

        peer.on('open', () => {
            const c = peer.connect(peerId(room), { reliable: true });
            conn.current = c;
            timeout = setTimeout(() => {
                if (!isConnected && alive) {
                    try { peer.destroy(); } catch { /* ya destruido */ }
                    setView({ kind: 'message', text: 'No encontré la sala. Revisá el código y que el admin tenga los buzzers activados.', retry: true });
                }
            }, 12000);

            c.on('open', () => {
                clearTimeout(timeout);
                isConnected = true;
                setConnected(true);
                send({ t: 'hello', device, playerId: store.get(`jpd-player-${room}`) });
            });
            c.on('data', (raw) => {
                const msg = raw as ServerMsg;
                if (!msg || typeof msg !== 'object') return;
                if (msg.t === 'roster') { setMe(null); setView({ kind: 'roster', players: msg.players }); }
                else if (msg.t === 'joined') { setMe(msg.player); store.set(`jpd-player-${room}`, msg.player.id); setView({ kind: 'play' }); }
                else if (msg.t === 'status') {
                    setStatus(prev => {
                        if (prev?.state !== msg.state) {
                            if (msg.state === 'armed') navigator.vibrate?.(30);
                            if (msg.state === 'you') navigator.vibrate?.([80, 40, 80]);
                        }
                        return msg;
                    });
                    setView({ kind: 'play' });
                } else if (msg.t === 'error') setView({ kind: 'roster', players: [], error: msg.message });
            });
            c.on('close', onDisconnect);
            c.on('error', onDisconnect);
        });
        peer.on('error', (err) => {
            if (!alive) return;
            if (err.type === 'peer-unavailable') {
                clearTimeout(timeout);
                setView({ kind: 'message', text: 'La sala no existe o el admin no activó los buzzers.', retry: true });
            } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
                setView({ kind: 'message', text: 'No se pudo contactar el servidor de conexión.', retry: true });
            }
        });

        return () => {
            alive = false;
            clearTimeout(retry);
            clearTimeout(timeout);
            try { conn.current?.close(); peer.destroy(); } catch { /* ya cerrados */ }
        };
    }, [room, attempt, send]);

    if (view.kind === 'message') {
        return (
            <div className="bz-center">
                <p className="bz-msg">{view.text}</p>
                {view.retry && <button className="bz-btn-secondary" onClick={() => setAttempt(n => n + 1)}>Reintentar</button>}
            </div>
        );
    }

    if (view.kind === 'room') {
        return (
            <form className="bz-center" onSubmit={e => {
                e.preventDefault();
                const value = (new FormData(e.currentTarget).get('room') as string).trim().toLowerCase();
                history.replaceState(null, '', `?room=${encodeURIComponent(value)}`);
                setRoom(value);
            }}>
                <h1>Buzzer</h1>
                {view.error && <p className="bz-error">{view.error}</p>}
                <label>Código de sala<input name="room" autoComplete="off" autoCapitalize="none" maxLength={12} required /></label>
                <button className="bz-btn-primary" type="submit">Entrar</button>
            </form>
        );
    }

    if (view.kind === 'roster') {
        return (
            <div className="bz-center">
                <h1>¿Quién sos?</h1>
                {view.error && <p className="bz-error">{view.error}</p>}
                <div className="bz-roster">
                    {view.players.map(p => (
                        <button key={p.id} className="bz-player" style={{ ['--c' as string]: p.color }} disabled={p.taken}
                            onClick={() => send({ t: 'join', playerId: p.id })}>
                            {p.name}{p.taken && <small> (en uso)</small>}
                        </button>
                    ))}
                    {view.players.length === 0 && <p className="bz-msg">El admin todavía no cargó jugadores.</p>}
                </div>
            </div>
        );
    }

    const current: Status = status ?? { state: 'idle', name: me?.name ?? '', color: me?.color ?? '#5865f2', score: 0 };
    return (
        <BuzzButton status={current} connected={connected} send={send}
            onLeave={() => { store.del(`jpd-player-${room}`); setMe(null); setStatus(null); send({ t: 'leave' }); }} />
    );
}
