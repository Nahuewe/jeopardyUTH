/* ================================
   TEAM MANAGER
   Gestión de equipos para modo grupal
================================ */

import { Utils } from './utils.js';
import { Storage } from './storage.js';

export class TeamManager {
    constructor(gameState, scoreboard) {
        this.gameState = gameState;
        this.scoreboard = scoreboard;
    }

    create() {
        if (this.gameState.players.length === 0) {
            return Swal.fire({
                icon: 'info',
                title: 'No hay jugadores',
                text: 'Necesitas agregar jugadores individuales primero para formar equipos.',
                confirmButtonColor: '#5865f2'
            });
        }

        const availablePlayers = this.getAvailablePlayers();

        if (availablePlayers.length === 0) {
            return Swal.fire({
                icon: 'info',
                title: 'Todos los jugadores asignados',
                text: 'Todos los jugadores individuales ya están en un equipo.',
                confirmButtonColor: '#5865f2'
            });
        }

        this.showCreateDialog(availablePlayers);
    }

    getAvailablePlayers() {
        return this.gameState.players.filter(player =>
            !this.gameState.teams.some(team => team.members.includes(player.name))
        );
    }

    showCreateDialog(availablePlayers) {
        const playersHTML = availablePlayers.map(player => `
            <label class="player-selection-item" style="--player-color: ${player.color};">
                <input type="checkbox" name="teamMember" value="${player.name}" class="hidden-checkbox">
                <span class="player-badge">${player.name}</span>
            </label>
        `).join('');

        Swal.fire({
            title: "Crear Nuevo Equipo",
            html: `
                <input id="teamName" class="swal2-input" placeholder="Nombre del Equipo (e.g., Los Vengadores)">
                <input id="teamColor" type="color" value="${Utils.generateColor()}"
                       style="width: 100%; height: 50px; border-radius: 8px; cursor: pointer; margin-top:10px;">
                <div style="text-align: left; margin-top: 15px; border-top: 1px solid #36393f; padding-top: 10px;">
                    <strong>Selecciona miembros:</strong>
                    <div id="availablePlayersList" style="max-height: 200px; overflow-y: auto;">
                        ${playersHTML}
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Crear Equipo",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#5865f2",
            preConfirm: () => {
                const name = document.getElementById("teamName").value.trim();
                const color = document.getElementById("teamColor").value;
                const selectedMembers = Array.from(
                    document.querySelectorAll('input[name="teamMember"]:checked')
                ).map(el => el.value);

                if (!name) {
                    Swal.showValidationMessage("El equipo necesita un nombre.");
                    return false;
                }

                if (selectedMembers.length < 1) {
                    Swal.showValidationMessage("Selecciona al menos un jugador para el equipo.");
                    return false;
                }

                return { name, color, members: selectedMembers };
            }
        }).then(result => {
            if (result.isConfirmed) {
                this.gameState.teams.push({
                    name: result.value.name,
                    score: 0,
                    color: result.value.color,
                    members: result.value.members
                });

                Storage.saveTeams(this.gameState.teams);

                if (this.gameState.activeRound === 'grupal') {
                    this.scoreboard.render();
                }

                Swal.fire({
                    icon: "success",
                    title: "Equipo Creado",
                    text: `${result.value.name} está listo para el Modo Grupal.`,
                    confirmButtonColor: "#57f287"
                });
            }
        });
    }

    edit(index) {
        Swal.fire({
            icon: 'info',
            title: 'Funcionalidad de Edición',
            text: 'La edición de equipos (miembros, nombre, color) se implementará aquí.',
            confirmButtonColor: '#5865f2'
        });
    }

    remove(index) {
        const team = this.gameState.teams[index];

        Swal.fire({
            icon: 'question',
            title: `¿Eliminar al equipo ${team.name}?`,
            text: 'Los jugadores individuales permanecerán, pero el equipo se disolverá.',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#e74c3c'
        }).then(result => {
            if (result.isConfirmed) {
                this.gameState.teams.splice(index, 1);
                Storage.saveTeams(this.gameState.teams);

                if (this.gameState.activeRound === 'grupal') {
                    this.scoreboard.render();
                }
            }
        });
    }
}
