import { useEffect, useMemo, useRef } from 'react';
import { MediaStore } from '../engine/media.ts';
import { useEngine, useGame, useLive } from '../hooks/useEngine.tsx';

const SPEED = 55;       // px por segundo
const MIN_SECONDS = 24;

/** Créditos finales en cascada, al estilo "Star Wars". */
export function CreditsView() {
    const { admin } = useEngine();
    const state = useGame();
    const live = useLive();
    const { creditsNonce, screen } = live.data;
    const c = state.credits;
    const crawlRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);

    // Mismo rol (sin importar mayúsculas ni espacios) = un solo bloque con todos los nombres.
    const entries = useMemo(() => {
        const groups = new Map<string, { role: string; names: string[] }>();
        for (const e of c.entries) {
            const role = e.role.trim(), name = e.name.trim();
            if (!role && !name) continue;
            const key = role.toLowerCase();
            if (!groups.has(key)) groups.set(key, { role, names: [] });
            if (name) groups.get(key)!.names.push(name);
        }
        return [...groups.values()].map(g => ({ role: g.role, name: g.names.join(' · ') }));
    }, [c.entries]);

    const images = c.images.map(m => MediaStore.urlSync(m)).filter(Boolean);
    const sig = JSON.stringify([creditsNonce, c]);

    // Cada cambio de contenido o "repetir" reinicia la animación.
    useEffect(() => {
        if (screen !== 'credits') return;
        const crawl = crawlRef.current, stage = stageRef.current;
        if (!crawl || !stage) return;
        crawl.classList.remove('run');
        let cancelled = false;
        const run = () => {
            if (cancelled) return;
            const travel = crawl.offsetHeight + stage.offsetHeight * 1.1;
            crawl.style.setProperty('--cr-travel', `${travel}px`);
            crawl.style.setProperty('--cr-dur', `${Math.max(MIN_SECONDS, travel / SPEED)}s`);
            void crawl.offsetWidth; // fuerza reflow para reiniciar la animación
            crawl.classList.add('run');
        };
        // Las imágenes cambian la altura: se espera a que carguen antes de medir.
        const pending = [...crawl.querySelectorAll('img')].filter(i => !i.complete)
            .map(i => new Promise<void>(r => { i.onload = i.onerror = () => r(); }));
        let timer: ReturnType<typeof setTimeout>;
        void Promise.all(pending).then(() => { timer = setTimeout(run, 50); });
        return () => { cancelled = true; clearTimeout(timer); };
    }, [sig, screen]);

    const active = screen === 'credits';
    useEffect(() => {
        document.body.classList.toggle('modal-open', active);
        return () => document.body.classList.remove('modal-open');
    }, [active]);

    return (
        <div className={active ? 'modal active' : 'modal'} id="creditsModal" aria-label="Créditos">
            {active && (
                <>
                    <div className="cr-stars" aria-hidden="true" />
                    <div className="cr-stage" ref={stageRef}>
                        <div className="cr-plane">
                            <div className="cr-crawl" ref={crawlRef} aria-label="Créditos">
                                <h2 className="cr-heading">Créditos</h2>
                                <p className="cr-title">{c.title}</p>
                                {entries.map((e, i) => (
                                    <div className="cr-entry" key={i}>
                                        <div className="cr-role">{e.role}</div>
                                        <div className="cr-name">{e.name}</div>
                                    </div>
                                ))}
                                {images.length > 0 && (
                                    <div className="cr-images">{images.map(u => <img key={u} src={u} alt="" />)}</div>
                                )}
                                {c.thanks && <p className="cr-thanks">{c.thanks}</p>}
                            </div>
                        </div>
                    </div>
                    {admin && (
                        <div className="cr-controls admin-only">
                            <button type="button" className="btn" onClick={() => live.set({ creditsNonce: creditsNonce + 1 })}>↺ Repetir</button>
                            <button type="button" className="btn danger" onClick={() => live.set({ screen: 'board' })}>✕ Cerrar créditos</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
