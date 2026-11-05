/* ================================
   ROULETTE
   Ruleta global (fuera de las preguntas) para elegir quién juega.
   Se renderiza en admin y anunciador; solo el admin la gira.
================================ */

import { Effects } from './effects.js';
import { esc } from './utils.js';

const $ = (id) => document.getElementById(id);
const MIN_SPIN_MS = 5000;
const MAX_SPIN_MS = 10000;

export class Roulette {
    constructor({ state, live, scoring, role }) {
        this.state = state;
        this.live = live;
        this.scoring = scoring;
        this.admin = role === 'admin';

        this.wrapper = $('rouletteGlobalWrapper');
        this.wheel = $('rouletteWheel');
        this.wheelSig = '';
        this.nonce = -1;
        this.raf = null;
        this.lastTick = null;
        this.spinTimeout = null;

        live.on('change', (d) => this.render(d));
        state.on('change', () => this.render(live.data));
    }

    render(l = this.live.data) {
        const r = l.roulette;
        const visible = r.visible && l.screen === 'board';
        this.wrapper.classList.toggle('hidden', !visible);
        $('openRouletteGlobalBtn')?.classList.toggle('active-roulette', r.visible);

        const list = this.state.participants();
        const sig = list.map(p => `${p.id}|${p.name}|${p.color}`).join(';');
        if (sig !== this.wheelSig && !r.spinning) {
            this.wheelSig = sig;
            this.#build(list);
        }

        if (r.nonce !== this.nonce) {
            this.nonce = r.nonce;
            if (r.spinning) {
                this.wheel.style.transition = `transform ${r.durationMs}ms cubic-bezier(0.17, 0.67, 0.12, 1)`;
                this.wheel.style.transform = `rotate(${r.angle}deg)`;
                this.#startPointerLoop(list.length);
            } else {
                this.wheel.style.transition = 'none';
                this.wheel.style.transform = `rotate(${r.angle}deg)`;
            }
        }

        this.wheel.querySelectorAll('.roulette-label').forEach(label => {
            label.classList.toggle('winner', !!r.selectedId && label.dataset.id === r.selectedId);
        });

        const winner = !r.spinning && r.selectedId ? this.state.participantById(r.selectedId) : null;
        const banner = $('rouletteWinner');
        if (banner) {
            banner.innerHTML = winner ? `🎯 ¡Le toca jugar a <strong style="color:${esc(winner.color)}">${esc(winner.name)}</strong>!` : '';
            banner.classList.toggle('show', !!winner);
        }

        const spin = $('spinRouletteBtn');
        if (spin && this.admin) {
            spin.disabled = r.spinning;
            spin.textContent = r.spinning ? 'Girando…' : r.selectedId ? 'Girar de nuevo' : 'Girar';
        }
    }

    #build(list) {
        this.wheel.innerHTML = '';
        if (!list.length) { this.wheel.style.background = ''; return; }
        const slice = 360 / list.length;
        this.wheel.style.background = `conic-gradient(${list.map((p, i) => `${p.color}55 ${i * slice}deg ${(i + 1) * slice}deg`).join(',')})`;

        list.forEach((p, i) => {
            const label = document.createElement('div');
            label.className = 'roulette-label';
            label.dataset.id = p.id;
            label.textContent = p.name;
            const angleDeg = slice * i + slice / 2;
            const rad = (angleDeg - 90) * Math.PI / 180;
            const r = 0.55 * 50;
            label.style.cssText = `position:absolute;left:${50 + r * Math.cos(rad)}%;top:${50 + r * Math.sin(rad)}%;transform:translate(-50%,-50%) rotate(${angleDeg}deg);`;
            label.style.setProperty('--label-color', p.color || '#fff');
            this.wheel.appendChild(label);
        });
    }

    /** Hace "tic" el puntero según la posición real de la rueda. */
    #startPointerLoop(n) {
        cancelAnimationFrame(this.raf);
        if (!n) return;
        const slice = 360 / n;
        const pointer = document.querySelector('.roulette-pointer');
        this.lastTick = null;
        const loop = () => {
            const m = new DOMMatrix(getComputedStyle(this.wheel).transform);
            const angle = (Math.atan2(m.b, m.a) * 180 / Math.PI + 360) % 360;
            const idx = Math.floor(((360 - angle) % 360) / slice) % n;
            if (idx !== this.lastTick) {
                this.lastTick = idx;
                pointer?.classList.remove('hit');
                void pointer?.offsetWidth;
                pointer?.classList.add('hit');
            }
            if (this.live.data.roulette.spinning) this.raf = requestAnimationFrame(loop);
        };
        loop();
    }

    /* ---------- Acciones (admin) ---------- */

    toggle() {
        this.live.patchRoulette({ visible: !this.live.data.roulette.visible, selectedId: null });
    }

    spin() {
        const r = this.live.data.roulette;
        if (r.spinning || this.live.data.screen !== 'board') return;
        const list = this.state.participants();
        if (!list.length) return Effects.toast('No hay participantes para la ruleta', 'error');

        const slice = 360 / list.length;
        const duration = Math.floor(Math.random() * (MAX_SPIN_MS - MIN_SPIN_MS + 1)) + MIN_SPIN_MS;
        const target = r.angle + (8 + Math.floor(Math.random() * 4)) * 360 + Math.random() * 360;
        const final = ((target % 360) + 360) % 360;
        const winner = list[Math.floor(((360 - final) % 360) / slice) % list.length];

        this.live.patchRoulette({ visible: true, spinning: true, angle: target, durationMs: duration, nonce: r.nonce + 1, selectedId: null });
        Effects.sound('roulette');

        clearTimeout(this.spinTimeout);
        this.spinTimeout = setTimeout(() => {
            this.live.patchRoulette({ spinning: false, selectedId: winner.id });
            this.scoring.setTurn(winner.id);
            Effects.toast(`🎯 Le toca a ${winner.name}`, 'success');
        }, duration);
    }
}
