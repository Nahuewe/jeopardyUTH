/* ================================
   POINTS MANAGER
   Gestión de puntos de jugadores y equipos
================================ */

import { Utils } from './utils.js';
import { Storage } from './storage.js';

export class PointsManager {
    constructor(gameState, board, scoreboard) {
        this.gameState = gameState;
        this.board = board;
        this.scoreboard = scoreboard;
    }

    awardPlayer(playerIndex, points, col, row, usedOptions) {
        const finalPoints = usedOptions ? Math.ceil(points / 2) : points;
        const player = this.gameState.players[playerIndex];
        player.score += finalPoints;

        this.markQuestionAsUsed(col, row, usedOptions);
        this.completeAward();
        window.game.questionModal.updatePlayersArea();
        Utils.toast(`✅ +$${finalPoints} → ${player.name}`, 'success');
        window.game.questionModal.showCorrectAnimation();
        window.game.questionModal.lockButtons();
    }

    deductPlayer(playerIndex, points) {
        const player = this.gameState.players[playerIndex];

        Swal.fire({
            icon: 'question',
            title: `¿Restar puntos?`,
            html: `<p>¿Quitarle <strong>$${points}</strong> a <strong>${player.name}</strong>?</p>`,
            showCancelButton: true,
            confirmButtonText: 'Restar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b',
            background: '#2f3136',
            color: '#dcddde'
        }).then(result => {
            if (result.isConfirmed) {
                player.score -= points;
                Storage.savePlayers(this.gameState.players);
                window.game.questionModal.updatePlayersArea();
                window.game.questionModal.showIncorrectAnimation();
                this.scoreboard.render();
                Utils.playDeductionEffects();
                Utils.toast(`❌ -$${points} → ${player.name}`, 'error');
            }
        });
    }

    awardTeam(teamIndex, points, col, row, usedOptions) {
        const finalPoints = usedOptions ? Math.ceil(points / 2) : points;
        const team = this.gameState.teams[teamIndex];
        team.score += finalPoints;

        this.markQuestionAsUsed(col, row, usedOptions);
        this.completeAward();
        window.game.questionModal.updatePlayersArea();
        Utils.toast(`✅ +$${finalPoints} → ${team.name}`, 'success');
        Storage.saveTeams(this.gameState.teams);
        window.game.questionModal.showCorrectAnimation();
        window.game.questionModal.lockButtons();
    }

    deductTeam(teamIndex, points) {
        const team = this.gameState.teams[teamIndex];

        Swal.fire({
            icon: 'question',
            title: `¿Restar puntos?`,
            html: `<p>¿Quitarle <strong>$${points}</strong> a <strong>${team.name}</strong>?</p>`,
            showCancelButton: true,
            confirmButtonText: 'Restar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b',
            background: '#2f3136',
            color: '#dcddde'
        }).then(result => {
            if (result.isConfirmed) {
                team.score -= points;
                Storage.saveTeams(this.gameState.teams);
                window.game.questionModal.updatePlayersArea();
                window.game.questionModal.showIncorrectAnimation();
                this.scoreboard.render();
                Utils.playDeductionEffects();
                Utils.toast(`❌ -$${points} → ${team.name}`, 'error');
            }
        });
    }

    markQuestionAsUsed(col, row, usedOptions) {
        const currentData = this.gameState.getCurrentRoundData();

        if (col === -1) {
            if (!currentData.finalQuestion) currentData.finalQuestion = {};
            currentData.finalQuestion.used = true;
            currentData.finalQuestion.usedWithOptions = usedOptions;
        } else {
            currentData.questions[col][row].used = true;
            currentData.questions[col][row].usedWithOptions = usedOptions;
        }
    }

    completeAward() {
        Utils.playWinEffects();
        this.scoreboard.render();
        Storage.savePlayers(this.gameState.players);
        Storage.saveGameData(this.gameState.roundsData);
        this.board.render();
        this.board.renderFinalQuestionTile();
    }

    resetScores() {
        Swal.fire({
            icon: 'warning',
            title: '¿Reiniciar puntos?',
            text: 'Todos los jugadores y equipos volverán a $0.',
            showCancelButton: true,
            confirmButtonText: 'Reiniciar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#e67e22',
            background: '#2f3136',
            color: '#dcddde'
        }).then(result => {
            if (result.isConfirmed) {
                this.gameState.players.forEach(p => p.score = 0);
                this.gameState.teams.forEach(t => t.score = 0);
                Storage.savePlayers(this.gameState.players);
                Storage.saveTeams(this.gameState.teams);
                this.scoreboard.render();
                Utils.toast('🔄 Puntos reiniciados', 'info');
            }
        });
    }

    resetQuestions() {
        Swal.fire({
            icon: 'warning',
            title: '¿Reiniciar preguntas?',
            text: 'Todas las preguntas de la ronda actual volverán a estar disponibles.',
            showCancelButton: true,
            confirmButtonText: 'Reiniciar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b',
            background: '#2f3136',
            color: '#dcddde'
        }).then(result => {
            if (result.isConfirmed) {
                const currentData = this.gameState.getCurrentRoundData();
                currentData.questions.forEach(col =>
                    col.forEach(q => { q.used = false; q.usedWithOptions = false; })
                );

                if (currentData.finalQuestion) {
                    currentData.finalQuestion.used = false;
                    currentData.finalQuestion.usedWithOptions = false;
                }

                this.gameState.usedCells.clear();
                Storage.saveGameData(this.gameState.roundsData);
                this.board.render();
                this.board.renderFinalQuestionTile();
                Utils.toast('❌ Preguntas reiniciadas', 'info');
            }
        });
    }
}
