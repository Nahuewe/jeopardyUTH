/* Todas las operaciones que cambian puntajes, turnos y preguntas usadas
   pasan por acá (con historial/deshacer). */

import { Dialog } from './dialog.ts';
import { Effects } from './effects.ts';
import type { GameState } from './gameState.ts';

export interface ScoreContext {
    roundId?: string;
    col?: number;
    row?: number;
    usedOptions?: boolean;
    category?: string;
    consume?: boolean;
}

export class Scoring {
    state: GameState;

    constructor(state: GameState) {
        this.state = state;
    }

    /** Suma puntos por acierto. */
    award(pid: string, points: number, ctx: ScoreContext = {}): void {
        const s = this.state;
        const p = s.participantById(pid);
        if (!p) return;
        s.pushHistory(`+$${points} → ${p.name}`);

        p.score += points;
        if (ctx.col !== undefined) this.#markUsed(ctx.roundId, ctx.col, ctx.row, ctx.usedOptions);
        s.session.turnId = pid;

        const st = s.stat(pid);
        st.correct += 1;
        st.points += points;
        s.addLog({ kind: 'correct', pid, points, category: ctx.category, roundId: ctx.roundId });

        s.commit();
        Effects.fire('win');
        Effects.toast(`✅ +$${points} → ${p.name}`, 'success');
    }

    /** Resta puntos por fallo (si la opción está activa). */
    penalize(pid: string, points: number, ctx: ScoreContext = {}): void {
        const s = this.state;
        const p = s.participantById(pid);
        if (!p) return;
        s.pushHistory(`Fallo de ${p.name}`);

        const loss = s.settings.deductOnWrong ? points : 0;
        p.score -= loss;
        const st = s.stat(pid);
        st.wrong += 1;
        st.points -= loss;
        if (ctx.consume && ctx.col !== undefined) this.#markUsed(ctx.roundId, ctx.col, ctx.row, ctx.usedOptions);
        s.addLog({ kind: 'wrong', pid, points: -loss, category: ctx.category, roundId: ctx.roundId });

        s.commit();
        Effects.fire('deduct');
        Effects.toast(loss ? `❌ -$${loss} → ${p.name}` : `❌ ${p.name} falló`, 'error');
    }

    /** Ajuste directo (ronda relámpago, correcciones manuales). */
    addPoints(pid: string, points: number, { kind = 'manual', label }: { kind?: string; label?: string } = {}): void {
        const s = this.state;
        const p = s.participantById(pid);
        if (!p) return;
        s.pushHistory(label || `${points >= 0 ? '+' : ''}${points} → ${p.name}`);
        p.score += points;
        const st = s.stat(pid);
        st.points += points;
        if (kind === 'lightning') st.correct += 1;
        s.addLog({ kind, pid, points });
        s.commit();
    }

    /** Nadie acertó: marca la pregunta como usada y rota el turno. */
    markUnanswered(ctx: Required<Pick<ScoreContext, 'roundId' | 'col' | 'row'>> & { category?: string }): void {
        const s = this.state;
        s.pushHistory('Pregunta sin respuesta');
        this.#markUsed(ctx.roundId, ctx.col, ctx.row, false);
        s.session.turnId = s.nextParticipantId(s.session.turnId, s.roundById(ctx.roundId) ?? undefined);
        s.addLog({ kind: 'none', category: ctx.category, roundId: ctx.roundId });
        s.commit();
    }

    setTurn(pid: string): void {
        this.state.session.turnId = pid;
        this.state.commit();
    }

    #markUsed(roundId: string | undefined, col: number, row: number | undefined, usedOptions?: boolean): void {
        if (!roundId || row === undefined) return;
        const q = this.state.getQuestion(roundId, col, row);
        if (!q) return;
        q.used = true;
        q.usedWithOptions = !!usedOptions;
    }

    async resetScores(): Promise<void> {
        const ok = await Dialog.confirm({
            icon: 'warning',
            title: '¿Reiniciar puntos?',
            text: 'Todos los jugadores y equipos volverán a $0 y se borran las estadísticas.',
            confirmText: 'Reiniciar',
            color: '#e67e22'
        });
        if (!ok) return;
        const s = this.state;
        s.pushHistory('Reinicio de puntos');
        [...s.players, ...s.teams].forEach(p => { p.score = 0; });
        s.session.stats = {};
        s.session.log = [];
        s.commit();
        Effects.toast('🔄 Puntos reiniciados', 'info');
    }

    async resetQuestions(): Promise<void> {
        const ok = await Dialog.confirm({
            icon: 'warning',
            title: '¿Reiniciar preguntas?',
            text: `Todas las preguntas de "${this.state.round.name}" volverán a estar disponibles.`,
            confirmText: 'Reiniciar'
        });
        if (!ok) return;
        const s = this.state;
        s.pushHistory('Reinicio de preguntas');
        s.round.questions.forEach(col => col.forEach(q => { q.used = false; q.usedWithOptions = false; }));
        s.commit();
        Effects.toast('🔁 Preguntas reiniciadas', 'info');
    }

    undo(): boolean {
        const label = this.state.undo();
        Effects.toast(label ? `↩️ Deshecho: ${label}` : 'No hay nada para deshacer', 'info');
        return !!label;
    }
}
