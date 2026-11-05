/* ================================
   LIGHTNING ROUND (Ronda Relámpago)
   Turno por turno, con eliminación. Es el cierre del juego.
   Se renderiza desde LiveState en admin y anunciador.
================================ */

import { Dialog } from './dialog.js';
import { Effects } from './effects.js';
import { esc, Utils, DEFAULT_AVATAR } from './utils.js';

const SUGGESTED = [
    'Videojuegos', 'Historia', 'Ciencia', 'Deportes', 'Música', 'Cine & Series',
    'Geografía', 'Cultura General', 'Literatura', 'Arte', 'Tecnología', 'Gastronomía'
];

export class LightningRound {
    constructor({ state, live, scoring, role }) {
        this.state = state;
        this.live = live;
        this.scoring = scoring;
        this.admin = role === 'admin';
        this.el = document.getElementById('lightningModal');
        this.renderKey = '';

        live.on('change', (d) => this.render(d));
        state.on('change', () => this.render(live.data));

        if (this.admin) {
            this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
            this.el.addEventListener('input', (e) => {
                if (e.target.id === 'lrCategoryInput') this.#setCategory(e.target.value.trim(), false);
            });
        }
    }

    get lr() {
        return this.live.data.lightning;
    }

    /* =========================================================
       ACCIONES (admin)
    ========================================================= */

    open() {
        const players = this.state.players;
        if (!players.length) {
            return Dialog.info('Sin jugadores', 'Agregá jugadores antes de iniciar la Ronda Relámpago.', 'warning');
        }
        this.live.set({
            screen: 'lightning',
            lightning: {
                phase: 'setup', category: '', order: players.map(p => p.id),
                idx: 0, eliminated: [], points: this.state.settings.lightningPoints
            }
        });
    }

    close() {
        this.live.set({ screen: 'board', lightning: null });
    }

    #patch(patch) {
        this.live.set({ lightning: { ...this.lr, ...patch } });
    }

    #setCategory(category, rerender = true) {
        if (!this.lr) return;
        if (rerender) this.#patch({ category });
        else { this.lr.category = category; this.live.emit('change', this.live.data); }
    }

    selectCategory(category) {
        const input = document.getElementById('lrCategoryInput');
        if (input) input.value = '';
        this.#setCategory(category);
    }

    start() {
        const input = document.getElementById('lrCategoryInput')?.value.trim();
        const category = input || this.lr.category;
        if (!category) return;
        this.#patch({ phase: 'play', category, idx: 0 });
    }

    correct() {
        const lr = this.lr;
        const pid = lr.order[lr.idx];
        const p = this.state.participantById(pid);
        this.scoring.addPoints(pid, lr.points, { kind: 'lightning', label: `⚡ +${lr.points} → ${p?.name}` });
        Effects.fire('win');
        Effects.toast(`⚡ +${lr.points} → ${p?.name}`, 'success');
        this.#patch({ idx: (lr.idx + 1) % lr.order.length });
    }

    async eliminate() {
        const lr = this.lr;
        const p = this.state.participantById(lr.order[lr.idx]);
        const ok = await Dialog.confirm({
            title: `¿Eliminar a ${p?.name}?`,
            html: '<p style="color:#b9bbbe">Se elimina de la <strong>Ronda Relámpago</strong>.<br>Sus puntos quedan intactos.</p>',
            confirmText: 'Eliminar de la ronda',
            color: '#f04747'
        });
        if (!ok || !this.lr) return;

        const cur = this.lr;
        const order = cur.order.filter((_, i) => i !== cur.idx);
        const eliminated = [...cur.eliminated, cur.order[cur.idx]];
        const idx = cur.idx >= order.length ? 0 : cur.idx;
        if (order.length <= 1) {
            this.#patch({ order, eliminated, idx: 0, phase: 'winner' });
            Effects.fire('tada');
        } else {
            this.#patch({ order, eliminated, idx });
        }
    }

    async changeCategory() {
        const ok = await Dialog.confirm({
            title: '¿Cambiar categoría?',
            text: 'Elegís una nueva categoría y seguís con los jugadores restantes.',
            confirmText: 'Cambiar', cancelText: 'Quedarse', color: '#5865f2'
        });
        if (ok) this.#patch({ phase: 'setup', category: '' });
    }

    /* =========================================================
       RENDER
    ========================================================= */

    render(l = this.live.data) {
        const lr = l.lightning;
        const visible = l.screen === 'lightning' && lr;
        this.el.classList.toggle('active', !!visible);
        if (!visible) {
            if (this.renderKey) { this.el.innerHTML = ''; this.renderKey = ''; }
            return;
        }

        const scores = lr.order.map(id => this.state.participantById(id)?.score).join(',');
        const key = lr.phase === 'setup'
            ? `setup|${lr.order.join()}`
            : `${lr.phase}|${lr.order.join()}|${lr.idx}|${lr.eliminated.join()}|${lr.category}|${scores}`;

        if (key !== this.renderKey) {
            this.renderKey = key;
            this.el.innerHTML = lr.phase === 'setup' ? this.#setupHTML(lr)
                : lr.phase === 'play' ? this.#playHTML(lr) : this.#winnerHTML(lr);
        }
        if (lr.phase === 'setup') this.#patchSetup(lr);
    }

    #patchSetup(lr) {
        this.el.querySelectorAll('.lr-chip').forEach(c => c.classList.toggle('selected', c.dataset.cat === lr.category));
        const badge = document.getElementById('lrSetupBadge');
        if (badge) badge.textContent = lr.category || '…';
        const btn = document.getElementById('lrStartBtn');
        if (btn) btn.disabled = !lr.category;
    }

    #header(lr, title = 'Ronda Relámpago') {
        return `
            <div class="lr-header">
                <span class="lr-bolt">⚡</span>
                <div><h2>${title}</h2>${lr?.category && lr.phase !== 'setup' ? `<span class="lr-category-badge">${esc(lr.category)}</span>` : ''}</div>
                <span class="lr-bolt">⚡</span>
            </div>`;
    }

    #avatar(p) {
        return p.avatar || DEFAULT_AVATAR;
    }

    #setupHTML(lr) {
        const players = lr.order.map(id => this.state.participantById(id)).filter(Boolean);
        const tags = players.map(p => `
            <span class="lr-player-tag" style="border-color:${esc(p.color)};background:${esc(p.color)}22;">
                ${p.avatar ? `<img src="${esc(p.avatar)}" class="lr-tag-avatar" alt="">` : ''}${esc(p.name)}
            </span>`).join('');

        const adminPart = this.admin ? `
            <p class="lr-setup-label">Elegí la categoría de preguntas:</p>
            <div class="lr-category-chips">
                ${SUGGESTED.map(c => `<button class="lr-chip" data-action="lr-category" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
            </div>
            <div class="lr-category-custom">
                <input type="text" id="lrCategoryInput" class="lr-input" placeholder="O escribí una categoría personalizada…" value="${SUGGESTED.includes(lr.category) ? '' : esc(lr.category)}">
            </div>` : `
            <p class="lr-setup-label">Categoría elegida:</p>
            <div class="lr-category-badge" id="lrSetupBadge" style="font-size:1.6rem;">…</div>`;

        const actions = this.admin ? `
            <div class="lr-setup-actions">
                <button class="lr-btn lr-btn-start" id="lrStartBtn" data-action="lr-start" disabled>⚡ ¡Comenzar Ronda!</button>
                <button class="lr-btn lr-btn-cancel" data-action="lr-close">Cancelar</button>
            </div>` : '';

        return `
            <div class="lr-modal-content">
                ${this.#header(lr)}
                <div class="lr-setup">
                    ${adminPart}
                    <div class="lr-setup-players">
                        <p class="lr-setup-label">Jugadores en esta ronda (${players.length}):</p>
                        <div class="lr-player-chips">${tags}</div>
                    </div>
                    ${actions}
                </div>
            </div>`;
    }

    #playHTML(lr) {
        const cur = this.state.participantById(lr.order[lr.idx]);
        if (!cur) return '';
        const ordered = [...lr.order.slice(lr.idx), ...lr.order.slice(0, lr.idx)]
            .map(id => this.state.participantById(id)).filter(Boolean);

        const actions = this.admin ? `
            <div class="lr-actions">
                <button class="lr-btn lr-btn-correct" data-action="lr-correct">✅ Siguiente jugador <span class="lr-pts">+${lr.points} pts</span></button>
                <button class="lr-btn lr-btn-eliminate" data-action="lr-eliminate">❌ Eliminar jugador</button>
            </div>` : '';
        const footer = this.admin ? `
            <div class="lr-footer-btns">
                <button class="lr-btn lr-btn-change-cat" data-action="lr-change-category">🔀 Cambiar categoría</button>
                <button class="lr-btn lr-btn-cancel" data-action="lr-close">Cerrar</button>
            </div>` : '';

        return `
            <div class="lr-modal-content lr-game-layout">
                ${this.#header(lr)}
                <div class="lr-active-player" style="--player-color:${esc(cur.color)};">
                    <div class="lr-active-glow"></div>
                    <img src="${esc(this.#avatar(cur))}" alt="${esc(cur.name)}" class="lr-active-avatar" style="border-color:${esc(cur.color)};">
                    <div class="lr-active-name" style="color:${esc(cur.color)};">${esc(cur.name)}</div>
                    <div class="lr-active-score">${Utils.formatScore(cur.score)}</div>
                    <div class="lr-active-hint">¡Tu turno! Respondé rápido ⚡</div>
                </div>
                ${actions}
                <div class="lr-queue">
                    <p class="lr-queue-label">Orden de turno (${ordered.length} restantes):</p>
                    <div class="lr-queue-list">
                        ${ordered.map((p, i) => `
                            <div class="lr-queue-item ${i === 0 ? 'lr-queue-current' : ''}" style="border-color:${esc(p.color)};">
                                ${p.avatar ? `<img src="${esc(p.avatar)}" class="lr-queue-avatar" alt="">`
                : `<span class="lr-queue-initial" style="background:${esc(p.color)};">${esc(p.name[0] ?? '?')}</span>`}
                                <span class="lr-queue-name">${i === 0 ? '👉 ' : ''}${esc(p.name)}</span>
                                <span class="lr-queue-score">${Utils.formatScore(p.score)}</span>
                            </div>`).join('')}
                    </div>
                </div>
                <div class="lr-footer">
                    ${lr.eliminated.length ? `<span class="lr-eliminated-count">${lr.eliminated.length} eliminado${lr.eliminated.length > 1 ? 's' : ''} esta ronda</span>` : ''}
                    ${footer}
                </div>
            </div>`;
    }

    #winnerHTML(lr) {
        const winner = this.state.participantById(lr.order[0]);
        if (!winner) return '';
        const elim = lr.eliminated.map(id => this.state.participantById(id)).filter(Boolean);
        const actions = this.admin ? `
            <div class="lr-winner-actions">
                <button class="lr-btn lr-btn-start" data-action="lr-open">⚡ Nueva Ronda Relámpago</button>
                <button class="lr-btn lr-btn-cancel" data-action="lr-close">Cerrar</button>
            </div>` : '';

        return `
            <div class="lr-modal-content lr-winner-layout">
                ${this.#header(lr, '¡Ganador de la Ronda Relámpago!')}
                <div class="lr-winner-card" style="--player-color:${esc(winner.color)};">
                    <div class="lr-winner-crown">👑</div>
                    <img src="${esc(this.#avatar(winner))}" alt="${esc(winner.name)}" class="lr-winner-avatar" style="border-color:${esc(winner.color)};">
                    <div class="lr-winner-name" style="color:${esc(winner.color)};">${esc(winner.name)}</div>
                    <div class="lr-winner-score">${Utils.formatScore(winner.score)}</div>
                </div>
                ${elim.length ? `
                    <div class="lr-eliminated-list">
                        <p>Eliminados esta ronda:</p>
                        <div class="lr-elim-chips">${elim.map(p => `<span class="lr-elim-chip" style="border-color:${esc(p.color)};">${esc(p.name)}</span>`).join('')}</div>
                    </div>` : ''}
                ${actions}
            </div>`;
    }
}
