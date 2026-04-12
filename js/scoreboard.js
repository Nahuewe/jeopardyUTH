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
        this._prevScores = {};
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

        const sorted = [...scorables].sort((a, b) => b.score - a.score);
        const rankMap = {};
        sorted.forEach((s, i) => { rankMap[s.name] = i; });

        const display = [...scorables].sort((a, b) => a.name.localeCompare(b.name));

        display.forEach((scorable) => {
            const originalIndex = scorables.indexOf(scorable);
            const rank = rankMap[scorable.name];
            const prevScore = this._prevScores[scorable.name] ?? scorable.score;
            const scoreChanged = prevScore !== scorable.score;
            const card = this.createScorableCard(scorable, originalIndex, isTeamMode, rank, scoreChanged);
            this.scoreboardElement.appendChild(card);
            this._prevScores[scorable.name] = scorable.score;
        });
    }

    showEmptyMessage(isTeamMode) {
        const icon = isTeamMode ? '👥' : '🎮';
        const message = isTeamMode
            ? "Modo Grupal: No hay equipos aún. ¡Ve a Acciones y creá un equipo!"
            : "No hay jugadores aún. ¡Andá a Acciones para agregar!";

        this.scoreboardElement.innerHTML = `
            <div class="scoreboard-empty">
                <span class="scoreboard-empty-icon">${icon}</span>
                <p>${message}</p>
            </div>`;
    }

    createScorableCard(scorable, index, isTeamMode, rank, scoreChanged) {
        const card = document.createElement('div');
        card.className = 'player-card';
        const hideControls = this.gameState.uiHidden;
        card.style.setProperty('--card-color', scorable.color);
        card.style.borderTop = `4px solid ${scorable.color}`;

        if (scoreChanged) {
            card.classList.add('score-updated');
            setTimeout(() => card.classList.remove('score-updated'), 700);
        }

        const medals = ['🥇', '🥈', '🥉'];
        const medalHTML = rank < 3
            ? `<span class="player-medal">${medals[rank]}</span>`
            : `<span class="player-rank">#${rank + 1}</span>`;

        const detailsHTML = isTeamMode
            ? `<p class="team-members">${scorable.members.join(' · ')}</p>`
            : '';

        const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="%237f8c8d" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3c0 16.2 13.1 29.7 30 29.7H418c16.9 0 30-13.5 30-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>`;

        let avatarWrapHTML;
        if (isTeamMode && scorable.members && scorable.members.length > 0) {
            const memberAvatars = scorable.members.map(memberName => {
                const player = this.gameState.players.find(p => p.name === memberName);
                const src = (player && player.avatar) ? player.avatar : defaultAvatar;
                return `<img src="${src}" alt="${memberName}" class="scoreboard-avatar team-member-mini" style="border-color:${scorable.color};" title="${memberName}">`;
            }).join('');
            avatarWrapHTML = `<div class="team-avatars-row scoreboard-team-avatars">${memberAvatars}</div>`;
        } else {
            const avatarSrc = scorable.avatar ? scorable.avatar : defaultAvatar;
            avatarWrapHTML = `<img src="${avatarSrc}" alt="${scorable.name}" class="scoreboard-avatar" style="border-color:${scorable.color};">`;
        }

        const editAction = isTeamMode
            ? `window.game.teamManager.edit(${index})`
            : `window.game.playerManager.edit(${index})`;
        const removeAction = isTeamMode
            ? `window.game.teamManager.remove(${index})`
            : `window.game.playerManager.remove(${index})`;

        const scoreFormatted = scorable.score < 0
            ? `-$${Math.abs(scorable.score)}`
            : `$${scorable.score}`;
        const scoreClass = scorable.score < 0 ? 'score score-negative' : 'score';

        const controlsHTML = hideControls
            ? ''
            : `
        <div class="controls">
            <button class="player-card-edit-btn" onclick="${editAction}">Editar</button>
            <button class="player-card-remove-btn" onclick="${removeAction}">Eliminar</button>
        </div>
        `;

        card.innerHTML = `
        <div class="player-card-top">
            ${medalHTML}
            <div class="player-card-avatar-wrap">
                ${avatarWrapHTML}
            </div>
        </div>
        <h3 class="player-card-name" title="${scorable.name}">${scorable.name}</h3>
        ${detailsHTML}
        <div class="${scoreClass}">${scoreFormatted}</div>
        ${controlsHTML}
    `;

        return card;
    }
}
