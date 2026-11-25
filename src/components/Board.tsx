import type { KeyboardEvent } from 'react';
import { useEngine, useGame } from '../hooks/useEngine.ts';

interface BoardProps {
    /** Abre la pregunta de la celda (solo admin). */
    onOpenCell?: (col: number, row: number) => void;
    onOpenLightning?: () => void;
}

const onActivate = (fn: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
};

export function Board({ onOpenCell, onOpenLightning }: BoardProps) {
    const { admin } = useEngine();
    const state = useGame();
    const round = state.round;

    return (
        <>
            <div className="board" id="board">
                {!round?.categories.length ? (
                    <div className="board-empty">
                        <span>📋</span>
                        <p>No hay categorías creadas para esta ronda.</p>
                        {admin && <small>Usá <strong>Editar Preguntas</strong> en el Modo Edición.</small>}
                    </div>
                ) : round.categories.map((category, col) => (
                    <div className="column" key={col}>
                        <div className="category">{category}</div>
                        {(round.questions[col] || []).map((q, row) => {
                            if (q.used) {
                                return (
                                    <div key={row} className="cell used" aria-label="Pregunta ya usada">
                                        <span className="cell-used-icon">✓</span>
                                    </div>
                                );
                            }
                            const open = () => onOpenCell?.(col, row);
                            const hint = admin && q.dailyDouble && state.settings.dailyDoubleEnabled;
                            return admin ? (
                                <div key={row} className={hint ? 'cell dd-hint' : 'cell'} tabIndex={0} role="button"
                                    aria-label={`${category} por ${q.value} puntos`}
                                    title={hint ? 'Daily Double (solo lo ves vos)' : undefined}
                                    onClick={open} onKeyDown={onActivate(open)}>
                                    ${q.value}
                                </div>
                            ) : (
                                <div key={row} className="cell">${q.value}</div>
                            );
                        })}
                    </div>
                ))}
            </div>

            <div id="finalQuestionTile" className="final-question-tile"
                {...(admin ? { tabIndex: 0, role: 'button', onClick: onOpenLightning, onKeyDown: onActivate(() => onOpenLightning?.()) } : {})}>
                <div className="final-tile-inner">
                    <div className="final-title">⭐ RONDA RELÁMPAGO</div>
                </div>
            </div>
        </>
    );
}
