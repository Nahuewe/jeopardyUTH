/* ================================
   PODIUM
   Pantalla final: podio y estadísticas de la partida
================================ */

import { Effects } from './effects.js';
import { esc, Utils, DEFAULT_AVATAR } from './utils.js';

export class Podium {
    constructor({ state, live, role }) {
        this.state = state;
        this.live = live;
        this.admin = role === 'admin';
        this.el = document.getElementById('podiumModal');
        this.shown = false;

        live.on('change', (d) => this.render(d));
        state.on('change', () => this.render(live.data));
    }

    open() {
        this.live.set({ screen: 'podium' });
        Effects.fire('tada');
    }

    close() {
        this.live.set({ screen: 'board' });
    }

    render(l = this.live.data) {
        const visible = l.screen === 'podium';
        this.el.classList.toggle('active', visible);
        if (!visible) { this.shown = false; this.el.innerHTML = ''; return; }
        this.el.innerHTML = this.#html();
        if (!this.shown) {
            this.shown = true;
            if (!this.admin) Effects.fireLocal('tada');
        }
    }

    #ranking(list) {
        return [...list].sort((a, b) => b.score - a.score);
    }

    #podiumBlock(title, list) {
        if (!list.length) return '';
        const ranked = this.#ranking(list);
        const top = ranked.slice(0, 3);
        // Orden visual del podio: 2º, 1º, 3º
        const slots = [top[1], top[0], top[2]].map((p, i) => p && { p, place: [2, 1, 3][i] });
        const medal = { 1: '🥇', 2: '🥈', 3: '🥉' };

        const stats = ranked.map((p, i) => {
            const st = this.state.session.stats[p.id] || { correct: 0, wrong: 0, points: 0 };
            return `<tr>
                <td>${i + 1}</td>
                <td><span class="pod-dot" style="background:${esc(p.color)}"></span>${esc(p.name)}</td>
                <td>${Utils.formatScore(p.score)}</td>
                <td>${st.correct}</td><td>${st.wrong}</td>
            </tr>`;
        }).join('');

        return `
            <section class="pod-section">
                <h3>${title}</h3>
                <div class="pod-stage">
                    ${slots.map(s => s ? `
                        <div class="pod-col pod-place-${s.place}">
                            <img src="${esc(s.p.avatar || DEFAULT_AVATAR)}" class="pod-avatar" style="border-color:${esc(s.p.color)}" alt="">
                            <div class="pod-name" style="color:${esc(s.p.color)}">${esc(s.p.name)}</div>
                            <div class="pod-score">${Utils.formatScore(s.p.score)}</div>
                            <div class="pod-step">${medal[s.place]}</div>
                        </div>` : '<div class="pod-col"></div>').join('')}
                </div>
                <table class="pod-table">
                    <thead><tr><th>#</th><th>Nombre</th><th>Puntos</th><th>✅</th><th>❌</th></tr></thead>
                    <tbody>${stats}</tbody>
                </table>
            </section>`;
    }

    #categoryHighlights() {
        const byCat = new Map();
        for (const e of this.state.session.log) {
            if (!e.category || (e.kind !== 'correct' && e.kind !== 'wrong' && e.kind !== 'none')) continue;
            const c = byCat.get(e.category) ?? { ok: 0, bad: 0 };
            if (e.kind === 'correct') c.ok++; else c.bad++;
            byCat.set(e.category, c);
        }
        const rows = [...byCat.entries()].filter(([, c]) => c.ok + c.bad >= 2)
            .map(([name, c]) => ({ name, ...c, rate: c.ok / (c.ok + c.bad) }));
        if (!rows.length) return '';
        rows.sort((a, b) => a.rate - b.rate);
        const hardest = rows[0], easiest = rows.at(-1);
        return `
            <div class="pod-highlights">
                <div>🔥 Más difícil: <strong>${esc(hardest.name)}</strong> (${Math.round(hardest.rate * 100)}% de aciertos)</div>
                <div>🍀 Más fácil: <strong>${esc(easiest.name)}</strong> (${Math.round(easiest.rate * 100)}% de aciertos)</div>
            </div>`;
    }

    #html() {
        const s = this.state;
        return `
            <div class="pod-content">
                <h2 class="pod-title">🏆 ¡Fin de la partida!</h2>
                ${this.#podiumBlock('Jugadores', s.players)}
                ${this.#podiumBlock('Equipos', s.teams)}
                ${this.#categoryHighlights()}
                ${this.admin ? '<div class="pod-actions"><button class="btn" data-action="podium-close">Volver al tablero</button></div>' : ''}
            </div>`;
    }
}
