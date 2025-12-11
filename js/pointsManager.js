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
        this.gameState.players[playerIndex].score += finalPoints;

        this.markQuestionAsUsed(col, row, usedOptions);
        this.completeAward();
    }

    deductPlayer(playerIndex, points) {
        const player = this.gameState.players[playerIndex];

        Swal.fire({
            icon: 'question',
            title: '¿Restar puntos?',
            text: `¿Quitar $${points} a ${player.name}?`,
            showCancelButton: true,
            confirmButtonText: 'Restar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        }).then(result => {
            if (result.isConfirmed) {
                player.score -= points;
                Storage.savePlayers(this.gameState.players);
                this.scoreboard.render();

                Swal.fire({
                    icon: 'success',
                    title: 'Puntos restados',
                    text: `${player.name} perdió $${points}.`,
                    confirmButtonColor: '#27ae60'
                });
            }
        });
    }

    awardTeam(teamIndex, points, col, row, usedOptions) {
        const finalPoints = usedOptions ? Math.ceil(points / 2) : points;
        this.gameState.teams[teamIndex].score += finalPoints;

        this.markQuestionAsUsed(col, row, usedOptions);
        this.completeAward();
        Storage.saveTeams(this.gameState.teams);
    }

    deductTeam(teamIndex, points) {
        const team = this.gameState.teams[teamIndex];

        Swal.fire({
            icon: 'question',
            title: '¿Restar puntos?',
            text: `¿Quitar $${points} a ${team.name}?`,
            showCancelButton: true,
            confirmButtonText: 'Restar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        }).then(result => {
            if (result.isConfirmed) {
                team.score -= points;
                Storage.saveTeams(this.gameState.teams);
                this.scoreboard.render();

                Swal.fire({
                    icon: 'success',
                    title: 'Puntos restados',
                    text: `${team.name} perdió $${points}.`,
                    confirmButtonColor: '#27ae60'
                });
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

        document.getElementById('modal').classList.remove('active');
    }

    resetScores() {
        Swal.fire({
            icon: 'warning',
            title: '¿Reiniciar puntos?',
            text: 'Todos los jugadores volverán a 0.',
            showCancelButton: true,
            confirmButtonText: 'Reiniciar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#e67e22'
        }).then(result => {
            if (result.isConfirmed) {
                this.gameState.players.forEach(p => p.score = 0);
                Storage.savePlayers(this.gameState.players);
                this.scoreboard.render();

                Swal.fire({
                    icon: 'success',
                    title: 'Listo',
                    text: 'Los puntos se reiniciaron.',
                    confirmButtonColor: '#27ae60'
                });
            }
        });
    }

    resetQuestions() {
        Swal.fire({
            icon: 'warning',
            title: '¿Reiniciar preguntas?',
            text: 'Esto hará que todas las preguntas de la ronda actual vuelvan a estar disponibles.',
            showCancelButton: true,
            confirmButtonText: 'Reiniciar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        }).then(result => {
            if (result.isConfirmed) {
                const currentData = this.gameState.getCurrentRoundData();
                currentData.questions.forEach(col =>
                    col.forEach(q => q.used = false)
                );

                if (currentData.finalQuestion) {
                    currentData.finalQuestion.used = false;
                }

                this.gameState.usedCells.clear();
                Storage.saveGameData(this.gameState.roundsData);
                this.board.render();
                this.board.renderFinalQuestionTile();

                Swal.fire({
                    icon: 'success',
                    title: 'Preguntas reiniciadas',
                    text: 'Todas las preguntas de la ronda actual están disponibles nuevamente.',
                    confirmButtonColor: '#27ae60'
                });
            }
        });
    }
}
