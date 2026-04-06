/* ================================
   LIGHTNING ROUND MODULE
   Ronda Relámpago - Turno por turno
================================ */

import { Storage } from './storage.js';
import { Utils } from './utils.js';

export class LightningRound {
    constructor(gameState, scoreboard) {
        this.gameState = gameState;
        this.scoreboard = scoreboard;

        // Estado interno de la ronda relámpago
        this.active = false;
        this.participants = [];       // jugadores activos en esta ronda
        this.eliminatedThisRound = []; // eliminados en esta ronda (no del juego)
        this.currentIndex = 0;
        this.category = '';
        this.pointsPerCorrect = 100;

        this.modalEl = document.getElementById('lightningModal');
        this._bindClose();
    }

    _bindClose() {
        // Cerrar al hacer clic en el fondo
        this.modalEl.addEventListener('click', (e) => {
            if (e.target === this.modalEl) this.close();
        });
    }

    open() {
        const players = this.gameState.players;
        if (!players || players.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin jugadores',
                text: 'Agregá jugadores antes de iniciar la Ronda Relámpago.',
                confirmButtonColor: '#5865f2'
            });
            return;
        }

        // Resetear estado
        this.active = true;
        this.participants = players.map((p, i) => ({ ...p, originalIndex: i }));
        this.eliminatedThisRound = [];
        this.currentIndex = 0;
        this.category = '';

        this.modalEl.classList.add('active');
        this._renderSetup();
    }

    close() {
        this.active = false;
        this.modalEl.classList.remove('active');
        this.modalEl.innerHTML = '';
    }

    // ─────────────────────────────────────────
    //  PANTALLA DE CONFIGURACIÓN (elegir cat.)
    // ─────────────────────────────────────────
    _renderSetup(keepParticipants = false) {
        const suggestedCategories = [
            'Videojuegos', 'Historia', 'Ciencia', 'Deportes',
            'Música', 'Cine & Series', 'Geografía', 'Cultura General',
            'Literatura', 'Arte', 'Tecnología', 'Gastronomía'
        ];

        this.modalEl.innerHTML = `
            <div class="lr-modal-content">
                <div class="lr-header">
                    <span class="lr-bolt">⚡</span>
                    <h2>Ronda Relámpago</h2>
                    <span class="lr-bolt">⚡</span>
                </div>

                <div class="lr-setup">
                    <p class="lr-setup-label">Elegí la categoría de preguntas:</p>

                    <div class="lr-category-chips" id="lrCategoryChips">
                        ${suggestedCategories.map(cat => `
                            <button class="lr-chip" onclick="game.lightningRound._selectChip(this, '${cat}')">${cat}</button>
                        `).join('')}
                    </div>

                    <div class="lr-category-custom">
                        <input
                            type="text"
                            id="lrCategoryInput"
                            class="lr-input"
                            placeholder="O escribí una categoría personalizada…"
                            oninput="game.lightningRound._onCustomInput(this)"
                        >
                    </div>

                    <div class="lr-setup-players">
                        <p class="lr-setup-label">Jugadores en esta ronda (${this.participants.length}):</p>
                        <div class="lr-player-chips">
                            ${this.participants.map(p => `
                                <span class="lr-player-tag" style="border-color:${p.color}; background: ${p.color}22;">
                                    ${p.avatar ? `<img src="${p.avatar}" class="lr-tag-avatar">` : ''}
                                    ${p.name}
                                </span>
                            `).join('')}
                        </div>
                    </div>

                    <div class="lr-setup-actions">
                        <button class="lr-btn lr-btn-start" id="lrStartBtn" onclick="game.lightningRound._startRound()" disabled>
                            ⚡ ¡Comenzar Ronda!
                        </button>
                        <button class="lr-btn lr-btn-cancel" onclick="game.lightningRound.close()">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    _selectChip(btn, category) {
        // Deseleccionar otros chips
        document.querySelectorAll('.lr-chip').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('lrCategoryInput').value = '';
        this.category = category;
        this._updateStartBtn();
    }

    _onCustomInput(input) {
        // Deseleccionar chips si escribe
        document.querySelectorAll('.lr-chip').forEach(c => c.classList.remove('selected'));
        this.category = input.value.trim();
        this._updateStartBtn();
    }

    _updateStartBtn() {
        const btn = document.getElementById('lrStartBtn');
        if (btn) btn.disabled = !this.category;
    }

    _startRound() {
        const inputVal = document.getElementById('lrCategoryInput')?.value.trim();
        if (inputVal) this.category = inputVal;

        if (!this.category) return;

        this.currentIndex = 0;
        this._renderGame();
    }

    // ─────────────────────────────────────────
    //  PANTALLA DE JUEGO
    // ─────────────────────────────────────────
    _renderGame() {
        if (this.participants.length === 1) {
            this._renderWinner();
            return;
        }

        const current = this.participants[this.currentIndex];
        const remaining = this.participants.length;
        const eliminated = this.eliminatedThisRound.length;

        const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="%237f8c8d" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3c0 16.2 13.1 29.7 30 29.7H418c16.9 0 30-13.5 30-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>`;

        // Mini lista de próximos jugadores
        const nextPlayers = [...this.participants];
        // Rotar para mostrar en orden desde el current
        const ordered = [
            ...nextPlayers.slice(this.currentIndex),
            ...nextPlayers.slice(0, this.currentIndex)
        ];

        this.modalEl.innerHTML = `
            <div class="lr-modal-content lr-game-layout">

                <!-- HEADER -->
                <div class="lr-header">
                    <span class="lr-bolt">⚡</span>
                    <div>
                        <h2>Ronda Relámpago</h2>
                        <span class="lr-category-badge">${this.category}</span>
                    </div>
                    <span class="lr-bolt">⚡</span>
                </div>

                <!-- JUGADOR ACTIVO -->
                <div class="lr-active-player" style="--player-color: ${current.color};">
                    <div class="lr-active-glow"></div>
                    <img
                        src="${current.avatar || defaultAvatar}"
                        alt="${current.name}"
                        class="lr-active-avatar"
                        style="border-color: ${current.color};"
                    >
                    <div class="lr-active-name" style="color: ${current.color};">${current.name}</div>
                    <div class="lr-active-score">$${current.score}</div>
                    <div class="lr-active-hint">Hacé tu pregunta verbalmente ↑</div>
                </div>

                <!-- ACCIONES -->
                <div class="lr-actions">
                    <button class="lr-btn lr-btn-correct" onclick="game.lightningRound._correct()">
                        ✅ Siguiente jugador <span class="lr-pts">+${this.pointsPerCorrect} pts</span>
                    </button>
                    <button class="lr-btn lr-btn-eliminate" onclick="game.lightningRound._eliminate()">
                        ❌ Eliminar jugador
                    </button>
                </div>

                <!-- COLA DE JUGADORES -->
                <div class="lr-queue">
                    <p class="lr-queue-label">Orden de turno (${remaining} restantes):</p>
                    <div class="lr-queue-list">
                        ${ordered.map((p, i) => `
                            <div class="lr-queue-item ${i === 0 ? 'lr-queue-current' : ''}" style="border-color: ${p.color};">
                                ${p.avatar ? `<img src="${p.avatar}" class="lr-queue-avatar">` : `<span class="lr-queue-initial" style="background:${p.color};">${p.name[0]}</span>`}
                                <span class="lr-queue-name">${i === 0 ? '👉 ' : ''}${p.name}</span>
                                <span class="lr-queue-score">$${p.score}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- PIE -->
                <div class="lr-footer">
                    ${eliminated > 0 ? `<span class="lr-eliminated-count">${eliminated} eliminado${eliminated > 1 ? 's' : ''} esta ronda</span>` : ''}
                    <div class="lr-footer-btns">
                        <button class="lr-btn lr-btn-change-cat" onclick="game.lightningRound._changeCategory()">
                            🔀 Cambiar categoría
                        </button>
                        <button class="lr-btn lr-btn-cancel" onclick="game.lightningRound.close()">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    _correct() {
        const current = this.participants[this.currentIndex];

        // Sumar puntos al jugador original en gameState
        const originalPlayer = this.gameState.players[current.originalIndex];
        if (originalPlayer) {
            originalPlayer.score += this.pointsPerCorrect;
            current.score = originalPlayer.score; // sincronizar copia local
        }

        Storage.savePlayers(this.gameState.players);
        Utils.toast(`⚡ +${this.pointsPerCorrect} → ${current.name}`, 'success');
        this.scoreboard.render();

        // Avanzar al siguiente jugador (circular)
        this.currentIndex = (this.currentIndex + 1) % this.participants.length;
        this._renderGame();
    }

    _eliminate() {
        const current = this.participants[this.currentIndex];

        Swal.fire({
            icon: 'question',
            title: `¿Eliminar a ${current.name}?`,
            html: `
                <p style="color: #b9bbbe;">Se elimina de la <strong>Ronda Relámpago</strong>.<br>
                Sus puntos quedan intactos y sigue en el juego principal.</p>
            `,
            showCancelButton: true,
            confirmButtonText: 'Eliminar de la ronda',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#f04747',
            background: '#2f3136',
            color: '#dcddde'
        }).then(result => {
            if (result.isConfirmed) {
                // Mover a eliminados
                const eliminated = this.participants.splice(this.currentIndex, 1)[0];
                this.eliminatedThisRound.push(eliminated);

                // Ajustar índice para no saltar jugadores
                if (this.currentIndex >= this.participants.length) {
                    this.currentIndex = 0;
                }

                if (this.participants.length <= 1) {
                    this._renderWinner();
                } else {
                    this._renderGame();
                }
            }
        });
    }

    _changeCategory() {
        Swal.fire({
            title: '¿Cambiar categoría?',
            text: 'Podés elegir una nueva categoría y continuar con los jugadores restantes.',
            showCancelButton: true,
            confirmButtonText: 'Cambiar',
            cancelButtonText: 'Quedarse',
            confirmButtonColor: '#5865f2',
            background: '#2f3136',
            color: '#dcddde'
        }).then(result => {
            if (result.isConfirmed) {
                this._renderSetup(true);
            }
        });
    }

    // ─────────────────────────────────────────
    //  PANTALLA DE GANADOR
    // ─────────────────────────────────────────
    _renderWinner() {
        const winner = this.participants[0];
        const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="%237f8c8d" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3c0 16.2 13.1 29.7 30 29.7H418c16.9 0 30-13.5 30-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>`;

        this.modalEl.innerHTML = `
            <div class="lr-modal-content lr-winner-layout">
                <div class="lr-header">
                    <span class="lr-bolt">⚡</span>
                    <h2>¡Ganador de la Ronda Relámpago!</h2>
                    <span class="lr-bolt">⚡</span>
                </div>

                <div class="lr-winner-card" style="--player-color: ${winner.color};">
                    <div class="lr-winner-crown">👑</div>
                    <img
                        src="${winner.avatar || defaultAvatar}"
                        alt="${winner.name}"
                        class="lr-winner-avatar"
                        style="border-color: ${winner.color};"
                    >
                    <div class="lr-winner-name" style="color: ${winner.color};">${winner.name}</div>
                    <div class="lr-winner-score">$${winner.score}</div>
                </div>

                ${this.eliminatedThisRound.length > 0 ? `
                    <div class="lr-eliminated-list">
                        <p>Eliminados esta ronda:</p>
                        <div class="lr-elim-chips">
                            ${this.eliminatedThisRound.map(p => `
                                <span class="lr-elim-chip" style="border-color: ${p.color};">
                                    ${p.name}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="lr-winner-actions">
                    <button class="lr-btn lr-btn-start" onclick="game.lightningRound.open()">
                        ⚡ Nueva Ronda Relámpago
                    </button>
                    <button class="lr-btn lr-btn-cancel" onclick="game.lightningRound.close()">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
    }
}
