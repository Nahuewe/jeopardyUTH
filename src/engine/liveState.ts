/* Estado efímero de la "pantalla en vivo": pregunta abierta, temporizador,
   ruleta, ronda relámpago, podio, música. El admin lo modifica; el anunciador solo lo recibe. */

import { EventBus } from './eventBus.ts';
import type { LiveData, RouletteState } from './types.ts';

export const defaultLive = (): LiveData => ({
    screen: 'board',
    q: null,
    timer: null,
    roulette: { visible: false, angle: 0, spinning: false, durationMs: 0, selectedId: null, nonce: 0 },
    lightning: null,
    creditsNonce: 0,
    buzzerOn: false,
    connected: [],
    music: { playing: false, volume: 0.35, track: 0 }
});

export class LiveState extends EventBus<{ change: LiveData }> {
    data: LiveData = defaultLive();
    /** Se incrementa en cada cambio: sirve como "versión" para React. */
    version = 0;

    #notify(): void {
        this.version++;
        this.emit('change', this.data);
    }

    /** Aplica un parche superficial (admin). */
    set(patch: Partial<LiveData>): void {
        Object.assign(this.data, patch);
        this.#notify();
    }

    /** Modifica el objeto q de la pregunta actual. */
    patchQ(patch: Partial<NonNullable<LiveData['q']>>): void {
        if (!this.data.q) return;
        this.data.q = { ...this.data.q, ...patch };
        this.#notify();
    }

    patchRoulette(patch: Partial<RouletteState>): void {
        this.data.roulette = { ...this.data.roulette, ...patch };
        this.#notify();
    }

    /** Reemplaza todo (anunciador). */
    replace(data: Partial<LiveData>): void {
        this.data = { ...defaultLive(), ...data };
        this.#notify();
    }

    /** Milisegundos restantes del temporizador. */
    timerRemaining(): number {
        const t = this.data.timer;
        if (!t) return 0;
        return t.running ? Math.max(0, t.endsAt - Date.now()) : t.remainingMs;
    }
}
