import { useEffect, useRef } from 'react';
import { useEngine, useGame, useLive } from '../hooks/useEngine.tsx';

/** Ruleta global: se ve en admin y anunciador; solo el admin la gira. */
export function RouletteView() {
    const { admin, roulette } = useEngine();
    const state = useGame();
    const live = useLive();
    const r = live.data.roulette;
    const wheelRef = useRef<HTMLDivElement>(null);
    const pointerRef = useRef<HTMLDivElement>(null);
    const lastNonce = useRef(-1);
    const raf = useRef(0);

    const visible = r.visible && live.data.screen === 'board';
    const list = state.participants();
    const slice = 360 / (list.length || 1);
    const background = list.length
        ? `conic-gradient(${list.map((p, i) => `${p.color}55 ${i * slice}deg ${(i + 1) * slice}deg`).join(',')})`
        : undefined;

    // Aplica el giro cuando llega una "tirada" nueva (nonce distinto).
    useEffect(() => {
        const wheel = wheelRef.current;
        if (!wheel || r.nonce === lastNonce.current) return;
        lastNonce.current = r.nonce;
        if (!r.spinning) {
            wheel.style.transition = 'none';
            wheel.style.transform = `rotate(${r.angle}deg)`;
            return;
        }
        wheel.style.transition = `transform ${r.durationMs}ms cubic-bezier(0.17, 0.67, 0.12, 1)`;
        wheel.style.transform = `rotate(${r.angle}deg)`;

        // "Tic" del puntero según la posición real de la rueda.
        const n = state.participants().length;
        if (!n) return;
        const sl = 360 / n;
        let lastTick: number | null = null;
        const loop = () => {
            const m = new DOMMatrix(getComputedStyle(wheel).transform);
            const angle = (Math.atan2(m.b, m.a) * 180 / Math.PI + 360) % 360;
            const idx = Math.floor(((360 - angle) % 360) / sl) % n;
            if (idx !== lastTick) {
                lastTick = idx;
                const p = pointerRef.current;
                if (p) { p.classList.remove('hit'); void p.offsetWidth; p.classList.add('hit'); }
            }
            if (live.data.roulette.spinning) raf.current = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(raf.current);
    }, [r.nonce, r.spinning, r.angle, r.durationMs, state, live]);

    const winner = !r.spinning && r.selectedId ? state.participantById(r.selectedId) : null;

    return (
        <div id="rouletteGlobalWrapper" className={visible ? 'roulette-wrapper' : 'roulette-wrapper hidden'}>
            <div className="roulette-container">
                <div className="roulette-pointer" ref={pointerRef} />
                <div className="roulette-wheel" id="rouletteWheel" ref={wheelRef} style={{ background }}>
                    {list.map((p, i) => {
                        const angleDeg = slice * i + slice / 2;
                        const rad = (angleDeg - 90) * Math.PI / 180;
                        const radius = 0.55 * 50;
                        return (
                            <div key={p.id} className={r.selectedId === p.id ? 'roulette-label winner' : 'roulette-label'} data-id={p.id}
                                style={{
                                    position: 'absolute', left: `${50 + radius * Math.cos(rad)}%`, top: `${50 + radius * Math.sin(rad)}%`,
                                    transform: `translate(-50%,-50%) rotate(${angleDeg}deg)`, ['--label-color' as string]: p.color || '#fff'
                                }}>
                                {p.name}
                            </div>
                        );
                    })}
                </div>
                {admin && (
                    <button className="roulette-btn admin-only" disabled={r.spinning} onClick={() => roulette.spin()}>
                        {r.spinning ? 'Girando…' : r.selectedId ? 'Girar de nuevo' : 'Girar'}
                    </button>
                )}
            </div>
            <div className={winner ? 'roulette-winner show' : 'roulette-winner'} id="rouletteWinner" aria-live="polite">
                {winner && <>🎯 ¡Le toca jugar a <strong style={{ color: winner.color }}>{winner.name}</strong>!</>}
            </div>
        </div>
    );
}
