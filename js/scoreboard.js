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

        scorables.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

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

        const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="#7f8c8d" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3c0 16.2 13.1 29.7 30 29.7H418c16.9 0 30-13.5 30-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>';

        const avatarHTML = !isTeamMode && scorable.avatar
            ? `<img src="${scorable.avatar}" alt="Avatar" class="scoreboard-avatar" style="border: 2px solid ${scorable.color};">`
            : `<img src="${defaultAvatar}`;

        const editAction = isTeamMode
            ? `window.game.teamManager.edit(${index})`
            : `window.game.playerManager.edit(${index})`;

        const removeAction = isTeamMode
            ? `window.game.teamManager.remove(${index})`
            : `window.game.playerManager.remove(${index})`;

        card.innerHTML = `
            <div class="scorable-header">
                ${avatarHTML}
                <h3 style="margin-top:10px;">${scorable.name}</h3>
            </div>
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
