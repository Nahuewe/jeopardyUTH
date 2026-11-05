/* ================================
   SCOREBOARD
   Marcador de jugadores / equipos
================================ */

import { esc, DEFAULT_AVATAR, Utils } from './utils.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export class Scoreboard {
    constructor(state, role, live) {
        this.state = state;
        this.role = role;
        this.live = live;
        this.connectedSig = '';
        // Redibuja solo si cambió quién tiene el celular conectado.
        live?.on('change', (d) => {
            const sig = d.connected.join();
            if (sig !== this.connectedSig) { this.connectedSig = sig; this.render(); }
        });
        this.el = document.getElementById('scoreboard');
        this.prevScores = new Map();
    }

    render() {
        const s = this.state;
        if (s.mode !== 'game') {
            this.el.innerHTML = '';
            return;
        }

        const list = s.participants();
        const teamMode = s.isTeamRound();
        this.el.innerHTML = '';

        if (!list.length) {
            this.el.innerHTML = `
                <div class="scoreboard-empty">
                    <span class="scoreboard-empty-icon">${teamMode ? '👥' : '🎮'}</span>
                    <p>${teamMode
                    ? 'Ronda grupal: todavía no hay equipos.'
                    : 'Todavía no hay jugadores.'}${this.role === 'admin' ? ' Agregalos desde el Modo Edición → Acciones.' : ''}</p>
                </div>`;
            return;
        }

        const ranked = [...list].sort((a, b) => b.score - a.score);
        const rank = new Map(ranked.map((p, i) => [p.id, i]));
        const display = [...list].sort((a, b) => a.name.localeCompare(b.name));

        for (const p of display) {
            const changed = this.prevScores.has(p.id) && this.prevScores.get(p.id) !== p.score;
            this.prevScores.set(p.id, p.score);
            this.el.appendChild(this.#card(p, rank.get(p.id), teamMode, changed));
        }
    }

    #isConnected(p, teamMode) {
        const connected = this.live?.data.connected ?? [];
        return teamMode ? (p.memberIds || []).some(id => connected.includes(id)) : connected.includes(p.id);
    }

    #card(p, rank, teamMode, changed) {
        const s = this.state;
        const card = document.createElement('div');
        card.className = 'player-card';
        card.style.setProperty('--card-color', p.color);
        card.style.borderTop = `4px solid ${p.color}`;

        const hasTurn = s.session.turnId === p.id;
        if (hasTurn) card.classList.add('has-turn');
        if (changed) {
            card.classList.add('score-updated');
            setTimeout(() => card.classList.remove('score-updated'), 700);
        }

        const medal = rank < 3 && p.score > 0
            ? `<span class="player-medal">${MEDALS[rank]}</span>`
            : `<span class="player-rank">#${rank + 1}</span>`;

        const members = teamMode
            ? `<p class="team-members">👥 ${esc(s.memberNames(p).join(' · '))}</p>` : '';
        const avatar = (!teamMode && p.avatar) ? p.avatar : DEFAULT_AVATAR;

        const showControls = this.role === 'admin' && !s.uiHidden;
        const kind = teamMode ? 'team' : 'player';
        const controls = showControls ? `
            <div class="controls">
                <button class="player-card-turn-btn" data-action="set-turn" data-id="${esc(p.id)}" title="Darle el turno">🎯 Turno</button>
                <button class="player-card-edit-btn" data-action="edit-${kind}" data-id="${esc(p.id)}">Editar</button>
                <button class="player-card-remove-btn" data-action="remove-${kind}" data-id="${esc(p.id)}">Eliminar</button>
            </div>` : '';

        card.innerHTML = `
            ${hasTurn ? '<div class="turn-badge" title="Tiene el turno">🎯 TURNO</div>' : ''}
            ${this.#isConnected(p, teamMode) ? '<div class="phone-badge" title="Celular conectado">📱</div>' : ''}
            <div class="player-card-top">
                ${medal}
                <div class="player-card-avatar-wrap">
                    <img src="${esc(avatar)}" alt="${esc(p.name)}" class="scoreboard-avatar" style="border-color:${esc(p.color)};">
                </div>
            </div>
            <h3 class="player-card-name" title="${esc(p.name)}">${esc(p.name)}</h3>
            ${members}
            <div class="${p.score < 0 ? 'score score-negative' : 'score'}">${Utils.formatScore(p.score)}</div>
            ${controls}`;
        return card;
    }
}
