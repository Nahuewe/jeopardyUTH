/* Ruleta global (fuera de las preguntas) para elegir quién juega.
   Solo el admin la gira; la vista (<RouletteView />) se dibuja desde LiveState. */

import { Effects } from './effects.ts';
import type { GameState } from './gameState.ts';
import type { LiveState } from './liveState.ts';
import type { Scoring } from './scoring.ts';

const MIN_SPIN_MS = 5000;
const MAX_SPIN_MS = 10000;

export class RouletteController {
    #spinTimeout: ReturnType<typeof setTimeout> | null = null;
    #state: GameState;
    #live: LiveState;
    #scoring: Scoring;

    constructor(state: GameState, live: LiveState, scoring: Scoring) {
        this.#state = state;
        this.#live = live;
        this.#scoring = scoring;
    }

    toggle(): void {
        this.#live.patchRoulette({ visible: !this.#live.data.roulette.visible, selectedId: null });
    }

    spin(): void {
        const r = this.#live.data.roulette;
        if (r.spinning || this.#live.data.screen !== 'board') return;
        const list = this.#state.participants();
        if (!list.length) { Effects.toast('No hay participantes para la ruleta', 'error'); return; }

        const slice = 360 / list.length;
        const duration = Math.floor(Math.random() * (MAX_SPIN_MS - MIN_SPIN_MS + 1)) + MIN_SPIN_MS;
        const target = r.angle + (8 + Math.floor(Math.random() * 4)) * 360 + Math.random() * 360;
        const final = ((target % 360) + 360) % 360;
        const winner = list[Math.floor(((360 - final) % 360) / slice) % list.length];

        this.#live.patchRoulette({ visible: true, spinning: true, angle: target, durationMs: duration, nonce: r.nonce + 1, selectedId: null });
        Effects.sound('roulette');

        if (this.#spinTimeout) clearTimeout(this.#spinTimeout);
        this.#spinTimeout = setTimeout(() => {
            this.#live.patchRoulette({ spinning: false, selectedId: winner.id });
            this.#scoring.setTurn(winner.id);
            Effects.toast(`🎯 Le toca a ${winner.name}`, 'success');
        }, duration);
    }
}
