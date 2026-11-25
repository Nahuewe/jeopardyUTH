import { useUi } from '../hooks/useUi.ts';
import { addRound, deleteRound, duplicateRound } from '../engine/rounds.ts';
import { useEngine, useGame } from '../hooks/useEngine.ts';

/** Panel de acciones del Modo Edición. */
export function ActionsPanel() {
    const { scoring, participants, data } = useEngine();
    const state = useGame();
    const ui = useUi();
    if (state.mode !== 'edit') return null;

    return (
        <div className="controls-panel admin-only">
            <div className="actions-list" id="actionsDropdown" style={{ display: 'flex' }}>
                <button className="action-btn" onClick={() => void participants.addPlayer()}>➕ Agregar Jugador</button>
                <button className="action-btn" onClick={() => void participants.createTeam()}>👥 Crear Equipo</button>
                <button className="action-btn" onClick={ui.openEditor}>✏️ Editar Preguntas</button>
                <button className="action-btn" onClick={() => void addRound(state)}>🆕 Nueva Ronda</button>
                <button className="action-btn" onClick={() => duplicateRound(state)}>📄 Duplicar Ronda</button>
                <button className="action-btn" onClick={() => void deleteRound(state)}>🗑️ Eliminar Ronda</button>
                <button className="action-btn" onClick={() => void scoring.resetScores()}>🔄 Reiniciar Puntos</button>
                <button className="action-btn" onClick={() => void scoring.resetQuestions()}>❌ Reiniciar Preguntas</button>
                <button className="action-btn" onClick={ui.openCreditsEditor}>🎬 Editar Créditos</button>
                <button className="action-btn" onClick={() => void data.exportJSON()}>📦 Exportar JSON</button>
                <button className="action-btn" onClick={() => void data.importJSON()}>📥 Importar JSON</button>
            </div>
        </div>
    );
}

/** Selector de ronda (Modo Edición). */
export function RoundTabs() {
    const state = useGame();
    if (state.mode !== 'edit') return null;
    return (
        <div id="editModeContainer" className="mode-content admin-only">
            <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Opciones de Ronda</h2>
            <p className="edit-info">Seleccioná la ronda para ver/editar su tablero de preguntas.</p>
            <div className="tabs-container" id="tabsContainer">
                {state.rounds.map(r => (
                    <button key={r.id} className={r.id === state.activeRoundId ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => state.setActiveRound(r.id)}>
                        {r.name} <small>{r.mode === 'team' ? '👥' : '🎮'}</small>
                    </button>
                ))}
            </div>
        </div>
    );
}
