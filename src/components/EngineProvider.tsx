/* Crea el motor, lo arranca y lo comparte con toda la interfaz. */

import { useEffect, useState, type ReactNode } from 'react';
import { bootEngine, createEngine, roleFromUrl, type Engine } from '../engine/app.ts';
import { EngineContext } from '../hooks/useEngine.ts';

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
