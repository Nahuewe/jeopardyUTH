import { useState } from 'react';
import { SUGGESTED_CATEGORIES } from '../engine/lightning.ts';
import type { LightningState, Participant } from '../engine/types.ts';
import { DEFAULT_AVATAR, formatScore } from '../engine/utils.ts';
import { useEngine, useGame, useLive } from '../hooks/useEngine.tsx';

const avatarOf = (p: Participant) => ('avatar' in p && p.avatar) || DEFAULT_AVATAR;

function Header({ lr, title = 'Ronda Relámpago' }: { lr: LightningState; title?: string }) {
    return (
        <div className="lr-header">
            <span className="lr-bolt">⚡</span>
            <div><h2>{title}</h2>{lr.category && lr.phase !== 'setup' && <span className="lr-category-badge">{lr.category}</span>}</div>
            <span className="lr-bolt">⚡</span>
        </div>
    );
}

function Setup({ lr }: { lr: LightningState }) {
    const { admin, lightning } = useEngine();
    const state = useGame();
    const [custom, setCustom] = useState(SUGGESTED_CATEGORIES.includes(lr.category) ? '' : lr.category);
    const players = lr.order.map(id => state.participantById(id)).filter((p): p is Participant => !!p);
    const category = custom.trim() || lr.category;

    return (
        <div className="lr-modal-content">
            <Header lr={lr} />
            <div className="lr-setup">
                {admin ? (
                    <>
                        <p className="lr-setup-label">Elegí la categoría de preguntas:</p>
                        <div className="lr-category-chips">
                            {SUGGESTED_CATEGORIES.map(c => (
                                <button key={c} className={lr.category === c && !custom.trim() ? 'lr-chip selected' : 'lr-chip'}
                                    onClick={() => { setCustom(''); lightning.patch({ category: c }); }}>{c}</button>
                            ))}
                        </div>
                        <div className="lr-category-custom">
                            <input type="text" id="lrCategoryInput" className="lr-input" placeholder="O escribí una categoría personalizada…"
                                value={custom} onChange={e => { setCustom(e.target.value); lightning.patch({ category: e.target.value.trim() }); }} />
                        </div>
                    </>
                ) : (
                    <>
                        <p className="lr-setup-label">Categoría elegida:</p>
                        <div className="lr-category-badge" style={{ fontSize: '1.6rem' }}>{lr.category || '…'}</div>
                    </>
                )}
                <div className="lr-setup-players">
                    <p className="lr-setup-label">Jugadores en esta ronda ({players.length}):</p>
                    <div className="lr-player-chips">
                        {players.map(p => (
                            <span key={p.id} className="lr-player-tag" style={{ borderColor: p.color, background: `${p.color}22` }}>
                                {'avatar' in p && p.avatar && <img src={p.avatar} className="lr-tag-avatar" alt="" />}{p.name}
                            </span>
                        ))}
                    </div>
                </div>
                {admin && (
                    <div className="lr-setup-actions">
                        <button className="lr-btn lr-btn-start" disabled={!category} onClick={() => lightning.start(category)}>⚡ ¡Comenzar Ronda!</button>
                        <button className="lr-btn lr-btn-cancel" onClick={() => lightning.close()}>Cancelar</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Play({ lr }: { lr: LightningState }) {
    const { admin, lightning } = useEngine();
    const state = useGame();
    const cur = state.participantById(lr.order[lr.idx]);
    if (!cur) return null;
    const ordered = [...lr.order.slice(lr.idx), ...lr.order.slice(0, lr.idx)]
        .map(id => state.participantById(id)).filter((p): p is Participant => !!p);

    return (
        <div className="lr-modal-content lr-game-layout">
            <Header lr={lr} />
            <div className="lr-active-player" style={{ ['--player-color' as string]: cur.color }}>
                <div className="lr-active-glow" />
                <img src={avatarOf(cur)} alt={cur.name} className="lr-active-avatar" style={{ borderColor: cur.color }} />
                <div className="lr-active-name" style={{ color: cur.color }}>{cur.name}</div>
                <div className="lr-active-score">{formatScore(cur.score)}</div>
                <div className="lr-active-hint">¡Tu turno! Respondé rápido ⚡</div>
            </div>
            {admin && (
                <div className="lr-actions">
                    <button className="lr-btn lr-btn-correct" onClick={() => lightning.correct()}>✅ Siguiente jugador <span className="lr-pts">+{lr.points} pts</span></button>
                    <button className="lr-btn lr-btn-eliminate" onClick={() => void lightning.eliminate()}>❌ Eliminar jugador</button>
                </div>
            )}
            <div className="lr-queue">
                <p className="lr-queue-label">Orden de turno ({ordered.length} restantes):</p>
                <div className="lr-queue-list">
                    {ordered.map((p, i) => (
                        <div key={p.id} className={i === 0 ? 'lr-queue-item lr-queue-current' : 'lr-queue-item'} style={{ borderColor: p.color }}>
                            {'avatar' in p && p.avatar
                                ? <img src={p.avatar} className="lr-queue-avatar" alt="" />
                                : <span className="lr-queue-initial" style={{ background: p.color }}>{p.name[0] ?? '?'}</span>}
                            <span className="lr-queue-name">{i === 0 ? '👉 ' : ''}{p.name}</span>
                            <span className="lr-queue-score">{formatScore(p.score)}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="lr-footer">
                {lr.eliminated.length > 0 && <span className="lr-eliminated-count">{lr.eliminated.length} eliminado{lr.eliminated.length > 1 ? 's' : ''} esta ronda</span>}
                {admin && (
                    <div className="lr-footer-btns">
                        <button className="lr-btn lr-btn-change-cat" onClick={() => void lightning.changeCategory()}>🔀 Cambiar categoría</button>
                        <button className="lr-btn lr-btn-cancel" onClick={() => lightning.close()}>Cerrar</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Winner({ lr }: { lr: LightningState }) {
    const { admin, lightning } = useEngine();
    const state = useGame();
    const winner = state.participantById(lr.order[0]);
    if (!winner) return null;
    const elim = lr.eliminated.map(id => state.participantById(id)).filter((p): p is Participant => !!p);

    return (
        <div className="lr-modal-content lr-winner-layout">
            <Header lr={lr} title="¡Ganador de la Ronda Relámpago!" />
            <div className="lr-winner-card" style={{ ['--player-color' as string]: winner.color }}>
                <div className="lr-winner-crown">👑</div>
                <img src={avatarOf(winner)} alt={winner.name} className="lr-winner-avatar" style={{ borderColor: winner.color }} />
                <div className="lr-winner-name" style={{ color: winner.color }}>{winner.name}</div>
                <div className="lr-winner-score">{formatScore(winner.score)}</div>
            </div>
            {elim.length > 0 && (
                <div className="lr-eliminated-list">
                    <p>Eliminados esta ronda:</p>
                    <div className="lr-elim-chips">{elim.map(p => <span key={p.id} className="lr-elim-chip" style={{ borderColor: p.color }}>{p.name}</span>)}</div>
                </div>
            )}
            {admin && (
                <div className="lr-winner-actions">
                    <button className="lr-btn lr-btn-start" onClick={() => lightning.open()}>⚡ Nueva Ronda Relámpago</button>
                    <button className="lr-btn lr-btn-cancel" onClick={() => lightning.close()}>Cerrar</button>
                </div>
            )}
        </div>
    );
}

export function LightningView() {
    const { admin, lightning } = useEngine();
    const live = useLive();
    const lr = live.data.lightning;
    const visible = live.data.screen === 'lightning' && !!lr;

    return (
        <div className={visible ? 'modal active' : 'modal'} id="lightningModal"
            onClick={e => { if (admin && e.target === e.currentTarget) lightning.close(); }}>
            {visible && lr && (lr.phase === 'setup' ? <Setup lr={lr} /> : lr.phase === 'play' ? <Play lr={lr} /> : <Winner lr={lr} />)}
        </div>
    );
}
