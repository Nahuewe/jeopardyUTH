/* Conecta el motor (clases con eventos) con React. */

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { bootEngine, createEngine, roleFromUrl, type Engine } from '../engine/app.ts';
import type { GameState } from '../engine/gameState.ts';
import type { LiveState } from '../engine/liveState.ts';

const EngineContext = createContext<Engine | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
    const [engine] = useState(() => createEngine(roleFromUrl()));
    const [ready, setReady] = useState(false);

    useEffect(() => {
        document.body.classList.add(`view-${engine.role}`);
        let alive = true;
        void bootEngine(engine).then(() => { if (alive) setReady(true); });
        if (import.meta.env.DEV) (window as unknown as { game: Engine }).game = engine;
        return () => { alive = false; };
    }, [engine]);

    if (!ready) return null;
    return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useEngine(): Engine {
    const e = useContext(EngineContext);
    if (!e) throw new Error('useEngine fuera de EngineProvider');
    return e;
}

/** Devuelve la partida y vuelve a renderizar en cada cambio. */
export function useGame(): GameState {
    const { state } = useEngine();
    useSyncExternalStore(
        (cb) => state.on('change', cb),
        () => state.version
    );
    return state;
}

/** Devuelve el estado "en vivo" y vuelve a renderizar en cada cambio. */
export function useLive(): LiveState {
    const { live } = useEngine();
    useSyncExternalStore(
        (cb) => live.on('change', cb),
        () => live.version
    );
    return live;
}

/** ¿Hay un anunciador conectado? (se actualiza con la presencia). */
export function useAnnouncerPresent(): boolean {
    const { sync } = useEngine();
    return useSyncExternalStore(
        (cb) => sync.on('presence', cb),
        () => sync.announcerPresent
    );
}
