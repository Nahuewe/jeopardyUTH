import { useEffect, useRef, useState } from 'react';
import type { Participant, Team } from '../engine/types.ts';
import { DEFAULT_AVATAR, formatScore } from '../engine/utils.ts';
import { useEngine, useGame, useLive } from '../hooks/useEngine.ts';

const MEDALS = ['🥇', '🥈', '🥉'];

const isTeam = (p: Participant): p is Team => 'memberIds' in p;

/** Marca un destello cuando el puntaje cambia. */
function useScoreFlash(score: number): boolean {
    const prev = useRef(score);
    const [flash, setFlash] = useState(false);
    useEffect(() => {
        if (prev.current === score) return;
        prev.current = score;
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 700);
        return () => clearTimeout(t);
    }, [score]);
    return flash;
}

interface CardProps { p: Participant; rank: number; teamMode: boolean }

function PlayerCard({ p, rank, teamMode }: CardProps) {
    const { admin, scoring, participants } = useEngine();
    const state = useGame();
    const live = useLive();
    const flash = useScoreFlash(p.score);

    const hasTurn = state.session.turnId === p.id;
    const connected = live.data.connected;
    const phone = isTeam(p) ? p.memberIds.some(id => connected.includes(id)) : connected.includes(p.id);
    const showControls = admin && !state.uiHidden;

    const cls = ['player-card', hasTurn && 'has-turn', flash && 'score-updated'].filter(Boolean).join(' ');

    return (
        <div className={cls} style={{ borderTop: `4px solid ${p.color}`, ['--card-color' as string]: p.color }}>
            {hasTurn && <div className="turn-badge" title="Tiene el turno">🎯 TURNO</div>}
            {phone && <div className="phone-badge" title="Celular conectado">📱</div>}

            <div className="player-card-top">
                {rank < 3 && p.score > 0
                    ? <span className="player-medal">{MEDALS[rank]}</span>
                    : <span className="player-rank">#{rank + 1}</span>}
                <div className="player-card-avatar-wrap">
                    {isTeam(p) && p.memberIds.length > 0 ? (
                        <div className="team-avatars-row scoreboard-team-avatars">
                            {p.memberIds.map(id => {
                                const m = state.players.find(x => x.id === id);
                                return m && (
                                    <img key={id} src={m.avatar || DEFAULT_AVATAR} alt={m.name} title={m.name}
                                        className="scoreboard-avatar team-member-mini" style={{ borderColor: p.color }} />
                                );
                            })}
                        </div>
                    ) : (
                        <img src={('avatar' in p && p.avatar) || DEFAULT_AVATAR} alt={p.name}
                            className="scoreboard-avatar" style={{ borderColor: p.color }} />
                    )}
                </div>
            </div>

            <h3 className="player-card-name" title={p.name}>{p.name}</h3>
            {teamMode && isTeam(p) && <p className="team-members">{state.memberNames(p).join(' · ')}</p>}
            <div className={p.score < 0 ? 'score score-negative' : 'score'}>{formatScore(p.score)}</div>

            {showControls && (
                <div className="controls">
                    <button className="player-card-turn-btn" onClick={() => scoring.setTurn(p.id)} title="Darle el turno">🎯 Turno</button>
                    <button className="player-card-edit-btn"
                        onClick={() => void (teamMode ? participants.editTeam(p.id) : participants.editPlayer(p.id))}>Editar</button>
                    <button className="player-card-remove-btn"
                        onClick={() => void (teamMode ? participants.removeTeam(p.id) : participants.removePlayer(p.id))}>Eliminar</button>
                </div>
            )}
        </div>
    );
}

export function Scoreboard() {
    const { admin } = useEngine();
    const state = useGame();
    useLive(); // el estado de "celular conectado" cambia en vivo

    if (state.mode !== 'game') return <div className="scoreboard" id="scoreboard" />;

    const list = state.participants();
    const teamMode = state.isTeamRound();

    if (!list.length) {
        return (
            <div className="scoreboard" id="scoreboard">
                <div className="scoreboard-empty">
                    <span className="scoreboard-empty-icon">{teamMode ? '👥' : '🎮'}</span>
                    <p>
                        {teamMode ? 'Ronda grupal: todavía no hay equipos.' : 'Todavía no hay jugadores.'}
                        {admin ? ' Agregalos desde el Modo Edición → Acciones.' : ''}
                    </p>
                </div>
            </div>
        );
    }

    const rank = new Map([...list].sort((a, b) => b.score - a.score).map((p, i) => [p.id, i]));
    const display = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="scoreboard" id="scoreboard">
            {display.map(p => <PlayerCard key={p.id} p={p} rank={rank.get(p.id) ?? 0} teamMode={teamMode} />)}
        </div>
    );
}
