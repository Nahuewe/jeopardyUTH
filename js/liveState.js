/* ================================
   LIVE STATE
   Estado efímero de la "pantalla en vivo": pregunta abierta,
   temporizador, ruleta, ronda relámpago, podio, música.
   El admin lo modifica; el anunciador solo lo recibe.
================================ */

import { EventBus } from './eventBus.js';

export const defaultLive = () => ({
    screen: 'board',            // 'board' | 'question' | 'lightning' | 'podium'
    q: null,
    timer: null,
    roulette: { visible: false, angle: 0, spinning: false, durationMs: 0, selectedId: null, nonce: 0 },
    lightning: null,
    buzzerOn: false,            // el host de buzzers remotos está activo
    connected: [],              // ids de jugadores con el celular conectado
    music: { playing: false, volume: 0.35 }
});

export class LiveState extends EventBus {
    constructor() {
        super();
        this.data = defaultLive();
    }

    /** Aplica un parche superficial (admin). */
    set(patch) {
        Object.assign(this.data, patch);
        this.emit('change', this.data);
    }

    /** Modifica el objeto q de la pregunta actual. */
    patchQ(patch) {
        if (!this.data.q) return;
        this.data.q = { ...this.data.q, ...patch };
        this.emit('change', this.data);
    }

    patchRoulette(patch) {
        this.data.roulette = { ...this.data.roulette, ...patch };
        this.emit('change', this.data);
    }

    /** Reemplaza todo (anunciador). */
    replace(data) {
        this.data = { ...defaultLive(), ...data };
        this.emit('change', this.data);
    }

    /** Milisegundos restantes del temporizador. */
    timerRemaining() {
        const t = this.data.timer;
        if (!t) return 0;
        return t.running ? Math.max(0, t.endsAt - Date.now()) : t.remainingMs;
    }
}
