/* Ronda Relámpago: turno por turno, con eliminación. Es el cierre del juego. */

import { Dialog } from './dialog.ts';
import { Effects } from './effects.ts';
import type { GameState } from './gameState.ts';
import type { LiveState } from './liveState.ts';
import type { Scoring } from './scoring.ts';
import type { LightningState } from './types.ts';

export const SUGGESTED_CATEGORIES = [
    'Videojuegos', 'Historia', 'Ciencia', 'Deportes', 'Música', 'Cine & Series',
    'Geografía', 'Cultura General', 'Literatura', 'Arte', 'Tecnología', 'Gastronomía'
];

export class LightningController {
    #state: GameState;
    #live: LiveState;
    #scoring: Scoring;

    constructor(state: GameState, live: LiveState, scoring: Scoring) {
        this.#state = state;
        this.#live = live;
        this.#scoring = scoring;
    }

    get #lr(): LightningState | null { return this.#live.data.lightning; }

    open(): void {
        const players = this.#state.players;
        if (!players.length) {
            void Dialog.info('Sin jugadores', 'Agregá jugadores antes de iniciar la Ronda Relámpago.', 'warning');
            return;
        }
        this.#live.set({
            screen: 'lightning',
            lightning: {
                phase: 'setup', category: '', order: players.map(p => p.id),
                idx: 0, eliminated: [], points: this.#state.settings.lightningPoints
            }
        });
    }

    close(): void {
        this.#live.set({ screen: 'board', lightning: null });
    }

    patch(patch: Partial<LightningState>): void {
        if (this.#lr) this.#live.set({ lightning: { ...this.#lr, ...patch } });
    }

    start(category: string): void {
        if (!category.trim()) return;
        this.patch({ phase: 'play', category: category.trim(), idx: 0 });
    }

    correct(): void {
        const lr = this.#lr;
        if (!lr) return;
        const pid = lr.order[lr.idx];
        const p = this.#state.participantById(pid);
        this.#scoring.addPoints(pid, lr.points, { kind: 'lightning', label: `⚡ +${lr.points} → ${p?.name}` });
        Effects.fire('win');
        Effects.toast(`⚡ +${lr.points} → ${p?.name}`, 'success');
        this.patch({ idx: (lr.idx + 1) % lr.order.length });
    }

    async eliminate(): Promise<void> {
        const lr = this.#lr;
        if (!lr) return;
        const p = this.#state.participantById(lr.order[lr.idx]);
        const ok = await Dialog.confirm({
            title: `¿Eliminar a ${p?.name}?`,
            html: '<p style="color:#b9bbbe">Se elimina de la <strong>Ronda Relámpago</strong>.<br>Sus puntos quedan intactos.</p>',
            confirmText: 'Eliminar de la ronda',
            color: '#f04747'
        });
        const cur = this.#lr;
        if (!ok || !cur) return;

        const order = cur.order.filter((_, i) => i !== cur.idx);
        const eliminated = [...cur.eliminated, cur.order[cur.idx]];
        const idx = cur.idx >= order.length ? 0 : cur.idx;
        if (order.length <= 1) {
            this.patch({ order, eliminated, idx: 0, phase: 'winner' });
            Effects.fire('tada');
        } else {
            this.patch({ order, eliminated, idx });
        }
    }

    async changeCategory(): Promise<void> {
        const ok = await Dialog.confirm({
            title: '¿Cambiar categoría?',
            text: 'Elegís una nueva categoría y seguís con los jugadores restantes.',
            confirmText: 'Cambiar', cancelText: 'Quedarse', color: '#5865f2'
        });
        if (ok) this.patch({ phase: 'setup', category: '' });
    }
}
