import { useEffect } from 'react';
import { Effects } from '../engine/effects.ts';
import type { Participant } from '../engine/types.ts';
import { DEFAULT_AVATAR, formatScore } from '../engine/utils.ts';
import { useEngine, useGame, useLive } from '../hooks/useEngine.ts';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function PodiumBlock({ title, list }: { title: string; list: Participant[] }) {
    const state = useGame();
    if (!list.length) return null;
    const ranked = [...list].sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, 3);
    // Orden visual del podio: 2º, 1º, 3º
    const slots = [top[1], top[0], top[2]].map((p, i) => p && { p, place: [2, 1, 3][i] });

    return (
        <section className="pod-section">
            <h3>{title}</h3>
            <div className="pod-stage">
                {slots.map((s, i) => s ? (
                    <div key={s.p.id} className={`pod-col pod-place-${s.place}`}>
                        <img src={('avatar' in s.p && s.p.avatar) || DEFAULT_AVATAR} className="pod-avatar" style={{ borderColor: s.p.color }} alt="" />
                        <div className="pod-name" style={{ color: s.p.color }}>{s.p.name}</div>
                        <div className="pod-score">{formatScore(s.p.score)}</div>
                        <div className="pod-step">{MEDAL[s.place]}</div>
                    </div>
                ) : <div key={i} className="pod-col" />)}
            </div>
            <table className="pod-table">
                <thead><tr><th>#</th><th>Nombre</th><th>Puntos</th><th>✅</th><th>❌</th></tr></thead>
                <tbody>
                    {ranked.map((p, i) => {
                        const st = state.session.stats[p.id] || { correct: 0, wrong: 0, points: 0 };
                        return (
                            <tr key={p.id}>
                                <td>{i + 1}</td>
                                <td><span className="pod-dot" style={{ background: p.color }} />{p.name}</td>
                                <td>{formatScore(p.score)}</td>
                                <td>{st.correct}</td><td>{st.wrong}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </section>
    );
}

function Highlights() {
    const state = useGame();
    const byCat = new Map<string, { ok: number; bad: number }>();
    for (const e of state.session.log) {
        const category = e.category as string | undefined;
        if (!category || (e.kind !== 'correct' && e.kind !== 'wrong' && e.kind !== 'none')) continue;
        const c = byCat.get(category) ?? { ok: 0, bad: 0 };
        if (e.kind === 'correct') c.ok++; else c.bad++;
        byCat.set(category, c);
    }
    const rows = [...byCat.entries()].filter(([, c]) => c.ok + c.bad >= 2)
        .map(([name, c]) => ({ name, ...c, rate: c.ok / (c.ok + c.bad) }));
    if (!rows.length) return null;
    rows.sort((a, b) => a.rate - b.rate);
    const hardest = rows[0], easiest = rows[rows.length - 1];
    return (
        <div className="pod-highlights">
            <div>🔥 Más difícil: <strong>{hardest.name}</strong> ({Math.round(hardest.rate * 100)}% de aciertos)</div>
            <div>🍀 Más fácil: <strong>{easiest.name}</strong> ({Math.round(easiest.rate * 100)}% de aciertos)</div>
        </div>
    );
}

/** Pantalla final: podio y estadísticas de la partida. */
export function PodiumView() {
    const { admin } = useEngine();
    const state = useGame();
    const live = useLive();
    const visible = live.data.screen === 'podium';

    // El anunciador dispara el festejo al aparecer el podio (el admin lo hace al abrirlo).
    useEffect(() => { if (visible && !admin) Effects.fireLocal('tada'); }, [visible, admin]);

    return (
        <div className={visible ? 'modal active' : 'modal'} id="podiumModal">
            {visible && (
                <div className="pod-content">
                    <h2 className="pod-title">🏆 ¡Fin de la partida!</h2>
                    <PodiumBlock title="Jugadores" list={state.players} />
                    <PodiumBlock title="Equipos" list={state.teams} />
                    <Highlights />
                    {admin && (
                        <div className="pod-actions">
                            <button className="btn" onClick={() => live.set({ screen: 'credits', creditsNonce: live.data.creditsNonce + 1 })}>Créditos</button>{' '}
                            <button className="btn" onClick={() => live.set({ screen: 'board' })}>Volver al tablero</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
