/* ================================
   SCOREBOARD COMPONENT
   Renderizado del marcador
================================ */

export class Scoreboard {
    constructor(gameState, playerManager, teamManager) {
        this.gameState = gameState;
        this.playerManager = playerManager;
        this.teamManager = teamManager;
        this.scoreboardElement = document.getElementById('scoreboard');
    }

    render() {
        if (this.gameState.currentMode !== 'game') {
            this.scoreboardElement.innerHTML = '';
            return;
        }

        this.scoreboardElement.innerHTML = '';
        const scorables = this.gameState.getCurrentScorables();
        const isTeamMode = this.gameState.isTeamMode();

        if (!scorables.length) {
            this.showEmptyMessage(isTeamMode);
            return;
        }

        scorables.forEach((scorable, index) => {
            const card = this.createScorableCard(scorable, index, isTeamMode);
            this.scoreboardElement.appendChild(card);
        });
    }

    showEmptyMessage(isTeamMode) {
        const message = isTeamMode
            ? "Modo Grupal: No hay equipos aún. ¡Ve a Acciones y crea un equipo!"
            : "No hay jugadores individuales aún. ¡Ve a Acciones para agregar!";

        this.scoreboardElement.innerHTML = `<p class='empty'>${message}</p>`;
    }

    createScorableCard(scorable, index, isTeamMode) {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.style.border = `3px solid ${scorable.color}`;

        const detailsHTML = isTeamMode
            ? `<p class="team-members">Miembros: ${scorable.members.join(', ')}</p>`
            : '';

        const editAction = isTeamMode
            ? `window.game.teamManager.edit(${index})`
            : `window.game.playerManager.edit(${index})`;

        const removeAction = isTeamMode
            ? `window.game.teamManager.remove(${index})`
            : `window.game.playerManager.remove(${index})`;

        card.innerHTML = `
            <h3>${scorable.name}</h3>
            ${detailsHTML}
            <div class="score">$${scorable.score}</div>
            <div class="controls">
                <button onclick="${editAction}">Editar</button>
                <button onclick="${removeAction}" style="background: var(--danger-red); color: white;">
                    Eliminar
                </button>
            </div>
        `;

        return card;
    }
}
