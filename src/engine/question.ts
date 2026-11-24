/* Acciones del admin sobre la pregunta abierta (abrir, buzzer, puntos, temporizador).
   No toca el DOM: la pantalla se dibuja en <QuestionModal /> a partir de LiveState. */

import { Effects } from './effects.ts';
import type { GameState } from './gameState.ts';
import type { LiveState } from './liveState.ts';
import type { ScoreContext, Scoring } from './scoring.ts';
import type { LiveQuestion } from './types.ts';
import { uid } from './utils.ts';

export class QuestionController {
    #timeouts = new Set<ReturnType<typeof setTimeout>>();
    #armHandle: ReturnType<typeof setTimeout> | null = null;
    #state: GameState;
    #live: LiveState;
    #scoring: Scoring;

    constructor(state: GameState, live: LiveState, scoring: Scoring) {
        this.#state = state;
        this.#live = live;
        this.#scoring = scoring;
    }

    /** ¿Hay una pregunta abierta? (para atajos de teclado) */
    get isOpen(): boolean {
        return this.#live.data.screen === 'question' && !!this.#live.data.q;
    }

    get #q(): LiveQuestion | null { return this.#live.data.q; }

    #later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
        const h = setTimeout(() => { this.#timeouts.delete(h); fn(); }, ms);
        this.#timeouts.add(h);
        return h;
    }

    #clearTimeouts(): void {
        this.#timeouts.forEach(clearTimeout);
        this.#timeouts.clear();
        this.#armHandle = null;
    }

    /* ---------- Abrir / cerrar ---------- */

    open(col: number, row: number): void {
        const s = this.#state;
        const round = s.round;
        const data = round?.questions[col]?.[row];
        if (!data || data.used) return;

        this.#clearTimeouts();
        const dd = !!data.dailyDouble && s.settings.dailyDoubleEnabled;
        const prev = this.#live.data.roulette;
        this.#live.set({
            screen: 'question',
            timer: null,
            roulette: { ...prev, visible: false, spinning: false, selectedId: null },
            q: {
                key: uid(), roundId: round.id, col, row,
                dd, phase: 'open',
                timerSeconds: data.timer > 0 ? data.timer : s.settings.timerSeconds,
                timerOff: !s.settings.timerEnabled,
                points: dd ? data.value * 2 : data.value,   // Daily Double: el doble de puntos
                optionsShown: false, answerShown: false,
                mediaRevealed: [false, false],
                responderId: null,
                buzzOpen: false, fouls: {}, lastFoul: null,
                buzzedId: null, lockedOut: [], result: null, mood: 'reading'
            }
        });
    }

    close(): void {
        this.#clearTimeouts();
        if (!this.#q) return;
        const prev = this.#live.data.roulette;
        this.#live.set({ screen: 'board', q: null, timer: null, roulette: { ...prev, visible: false, spinning: false } });
    }

    /* ---------- Contenido ---------- */

    toggleOptions(): void {
        const q = this.#q;
        if (!q || q.optionsShown || q.phase !== 'open') return;
        this.#live.patchQ({ optionsShown: true, points: Math.floor(q.points / 2) });
    }

    showAnswer(): void {
        this.#live.patchQ({ answerShown: true });
    }

    revealMedia(slot: 'media1' | 'media2'): void {
        const q = this.#q;
        if (!q) return;
        const mediaRevealed: [boolean, boolean] = [...q.mediaRevealed];
        mediaRevealed[slot === 'media2' ? 1 : 0] = true;
        this.#live.patchQ({ mediaRevealed });
    }

    /* ---------- Temporizador ---------- */

    startTimer(): void {
        const t = this.#live.data.timer;
        const dur = (this.#q?.timerSeconds || this.#state.settings.timerSeconds) * 1000;
        if (!t || t.finished) {
            this.#live.set({ timer: { durationMs: dur, remainingMs: dur, endsAt: Date.now() + dur, running: true, finished: false } });
        } else if (!t.running) {
            this.#live.set({ timer: { ...t, running: true, endsAt: Date.now() + t.remainingMs } });
        }
    }

    pauseTimer(): void {
        const t = this.#live.data.timer;
        if (!t || !t.running) return;
        this.#live.set({ timer: { ...t, running: false, remainingMs: this.#live.timerRemaining() } });
    }

    toggleTimer(): void {
        if (this.#live.data.timer?.running) this.pauseTimer(); else this.startTimer();
    }

    resetTimer(): void {
        this.#live.set({ timer: null });
    }

    /** Timer manual de esta pregunta (campo "Timer" del modal). */
    setTimerConfig(secs: number, textDone: boolean): void {
        if (!(secs > 0)) return this.disableTimer();
        this.#live.patchQ({ timerSeconds: secs, timerOff: false });
        this.resetTimer();
        if (textDone) this.startTimer();
    }

    disableTimer(): void {
        this.#live.patchQ({ timerOff: true });
        this.resetTimer();
    }

    /** Lo llama la pantalla cuando el tiempo llega a cero. */
    timeUp(): void {
        const t = this.#live.data.timer;
        if (!t || !t.running) return;
        this.#live.set({ timer: { ...t, running: false, remainingMs: 0, finished: true } });
        Effects.sound('timeup');
    }

    /** La pregunta terminó de leerse: abre buzzers y arranca el timer automático. */
    onQuestionRead(key: string): void {
        const cur = this.#live.data;
        if (cur.q?.key !== key || cur.q.result) return;
        if (!cur.q.buzzOpen) this.#armBuzzers();
        if (!cur.q.timerOff && this.#state.settings.autoTimer && !cur.timer) this.startTimer();
    }

    /* ---------- Buzzers ---------- */

    /** Abre los buzzers con una demora al azar de 1 a 3 s: antes de eso, apretar es falta. */
    #armBuzzers(): void {
        const key = this.#q?.key;
        if (this.#armHandle) clearTimeout(this.#armHandle);
        this.#armHandle = this.#later(() => {
            this.#armHandle = null;
            const cur = this.#q;
            if (cur && cur.key === key && !cur.buzzOpen && !cur.result) this.#live.patchQ({ buzzOpen: true });
        }, 1000 + Math.random() * 2000);
    }

    toggleBuzzers(): void {
        const q = this.#q;
        if (!q || q.phase !== 'open') return;
        if (q.buzzOpen || this.#armHandle) {
            if (this.#armHandle) clearTimeout(this.#armHandle);
            this.#armHandle = null;
            if (q.buzzOpen) this.#live.patchQ({ buzzOpen: false });
        } else {
            this.#armBuzzers();
        }
    }

    #foul(pid: string): void {
        const q = this.#q;
        const base = this.#state.settings.buzzFoulSeconds;
        if (!q || !base) return;
        // Castigo base + 1 a 3 s al azar en cada apretón, para que no se pueda calcular el momento de volver a tocar.
        const secs = Math.round((base + 1 + Math.random() * 2) * 10) / 10;
        const fouls = { ...q.fouls, [pid]: Date.now() + secs * 1000 };
        const first = !((q.fouls[pid] ?? 0) > Date.now());
        this.#live.patchQ({ fouls, lastFoul: { pid, at: Date.now() } });
        if (first) {
            Effects.sound('timeup');
            Effects.toast(`⚠️ ${this.#state.participantById(pid)?.name} se adelantó (-${secs.toFixed(1)}s)`, 'error');
        }
        this.#later(() => {
            const cur = this.#q;
            if (cur?.key === q.key && cur.lastFoul?.pid === pid) this.#live.patchQ({ lastFoul: null });
        }, 2500);
    }

    /** remote: viene de un celular, así que solo vale con los buzzers abiertos. */
    buzz(pid: string, { remote = false } = {}): void {
        const q = this.#q;
        if (!q || q.phase !== 'open' || q.buzzedId || q.result || q.lockedOut.includes(pid)) return;
        if (remote) {
            // Apretar antes de tiempo (o estando castigado) es una falta: el castigo se reinicia.
            if (!q.buzzOpen || (q.fouls[pid] ?? 0) > Date.now()) return this.#foul(pid);
        }
        const round = this.#state.roundById(q.roundId);
        if (!this.#state.participants(round ?? undefined).some(p => p.id === pid)) return;
        this.pauseTimer();
        this.#live.patchQ({ buzzedId: pid, responderId: pid });
        Effects.sound('buzz');
    }

    /* ---------- Resultado ---------- */

    #ctx(q: LiveQuestion): ScoreContext {
        return {
            roundId: q.roundId, col: q.col, row: q.row,
            usedOptions: q.optionsShown, category: this.#state.roundById(q.roundId)?.categories[q.col]
        };
    }

    correct(pid: string): void {
        const q = this.#q;
        if (!q || q.phase !== 'open' || q.result || q.lockedOut.includes(pid)) return;

        this.#scoring.award(pid, q.points, this.#ctx(q));
        this.pauseTimer();
        this.#live.patchQ({ result: { type: 'correct', pid }, mood: 'correct', answerShown: true, buzzedId: pid, responderId: pid });
        if (this.#state.settings.autoCloseOnCorrect) this.#later(() => this.close(), 4000);
    }

    wrong(pid: string): void {
        const q = this.#q;
        if (!q || q.phase !== 'open' || q.result || q.lockedOut.includes(pid)) return;

        this.#scoring.penalize(pid, q.points, this.#ctx(q));
        this.#live.patchQ({ lockedOut: [...q.lockedOut, pid], buzzedId: null, responderId: null, mood: 'incorrect' });
        this.#later(() => {
            const cur = this.#q;
            if (cur?.key === q.key && !cur.result) this.#live.patchQ({ mood: 'reading' });
        }, 4000);

        if (!this.#q?.timerOff && this.#live.data.timer) {
            this.resetTimer();
            if (this.#state.settings.autoTimer) this.startTimer();
        }
    }

    /** Nadie acertó: se marca como usada y se muestra la respuesta. */
    unanswered(): void {
        const q = this.#q;
        if (!q) return;
        if (q.result) return this.close(); // ya resuelta: "Terminar" solo cierra
        this.#scoring.markUnanswered({ roundId: q.roundId, col: q.col, row: q.row, category: this.#state.roundById(q.roundId)?.categories[q.col] });
        this.pauseTimer();
        this.#live.patchQ({ result: { type: 'none' }, answerShown: true });
        this.#later(() => this.close(), 3500);
    }
}
