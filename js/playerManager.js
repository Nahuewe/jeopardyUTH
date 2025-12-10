/* ================================
   PLAYER MANAGER
   Gestión de jugadores individuales
================================ */

import { Utils } from './utils.js';
import { Storage } from './storage.js';

export class PlayerManager {
    constructor(gameState, scoreboard) {
        this.gameState = gameState;
        this.scoreboard = scoreboard;
    }

    add() {
        Swal.fire({
            title: "Nuevo jugador",
            html: `
                <input id="playerName" class="swal2-input" placeholder="Nombre del jugador">
                <input id="playerColor" type="color" value="#3498db"
                    style="width: 100%; height: 50px; border-radius: 8px; cursor: pointer; margin-top:5px;">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Agregar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#27ae60",
            preConfirm: () => {
                const name = document.getElementById("playerName").value.trim();
                const color = document.getElementById("playerColor").value;

                if (!name) {
                    Swal.showValidationMessage("Poné un nombre válido, wachín.");
                    return false;
                }

                return { name, color };
            }
        }).then(result => {
            if (result.isConfirmed) {
                this.gameState.players.push({
                    name: result.value.name,
                    score: 0,
                    color: result.value.color
                });

                Storage.savePlayers(this.gameState.players);
                this.scoreboard.render();

                Swal.fire({
                    icon: "success",
                    title: "Jugador agregado",
                    text: `${result.value.name} ya está listo.`,
                    confirmButtonColor: "#3498db"
                });
            }
        });
    }

    edit(index) {
        const player = this.gameState.players[index];

        Swal.fire({
            title: "Editar jugador",
            html: `
                <input id="editName" class="swal2-input" placeholder="Nombre"
                       value="${player.name}">
                <label style="margin-top:10px; font-weight:bold;">Color:</label>
                <input id="editColor" type="color" value="${player.color}"
                    style="width: 100%; height: 50px; border-radius: 8px; cursor: pointer; margin-top:5px;">
                <label style="margin-top:10px; font-weight:bold;">Puntos:</label>
                <input id="editScore" type="number" class="swal2-input"
                       value="${player.score}" min="-999999" step="1">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Guardar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#27ae60",
            preConfirm: () => {
                const name = document.getElementById("editName").value.trim();
                const color = document.getElementById("editColor").value;
                const score = parseInt(document.getElementById("editScore").value) || 0;

                if (!name) {
                    Swal.showValidationMessage("El nombre no puede estar vacío.");
                    return false;
                }

                return { name, color, score };
            }
        }).then(result => {
            if (result.isConfirmed) {
                player.name = result.value.name;
                player.color = result.value.color;
                player.score = result.value.score;

                Storage.savePlayers(this.gameState.players);
                this.scoreboard.render();

                Swal.fire({
                    icon: "success",
                    title: "Jugador editado",
                    text: "Los cambios fueron aplicados correctamente.",
                    confirmButtonColor: "#3498db"
                });
            }
        });
    }

    remove(index) {
        if (this.gameState.players.length === 1) {
            return Swal.fire({
                icon: 'warning',
                title: 'No permitido',
                text: 'Debe haber al menos un jugador.'
            });
        }

        const player = this.gameState.players[index];

        Swal.fire({
            icon: 'question',
            title: `¿Eliminar a ${player.name}?`,
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#e74c3c'
        }).then(result => {
            if (result.isConfirmed) {
                this.gameState.players.splice(index, 1);
                Storage.savePlayers(this.gameState.players);
                this.scoreboard.render();
            }
        });
    }
}
