/* ================================
    PLAYER MANAGER
    Gestión de jugadores individuales
================================ */

import { Storage } from './storage.js';

export class PlayerManager {
    defaultAvatar = '';

    constructor(gameState, scoreboard) {
        this.gameState = gameState;
        this.scoreboard = scoreboard;
    }

    getBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve(this.defaultAvatar);
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    add() {
        Swal.fire({
            title: "Nuevo jugador",
            html: `
                <input id="playerName" class="swal2-input" placeholder="Nombre del jugador">
                <input id="playerColor" type="color" value="#3498db"
                    style="width: 100%; height: 50px; border-radius: 8px; cursor: pointer; margin-top:5px;">
                <label for="playerAvatar" style="margin-top:10px; font-weight:bold; display:block; text-align:left;">Avatar (Opcional):</label>
                <input id="playerAvatar" type="file" accept="image/*" style="padding-left:0;">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Agregar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#27ae60",
            preConfirm: () => {
                const name = document.getElementById("playerName").value.trim();
                const color = document.getElementById("playerColor").value;
                const avatarFile = document.getElementById("playerAvatar").files[0];

                if (!name) {
                    Swal.showValidationMessage("Poné un nombre válido, wachín.");
                    return false;
                }

                return this.getBase64(avatarFile).then(avatarUrl => {
                    return { name, color, avatarUrl };
                });
            }
        }).then(result => {
            if (result.isConfirmed) {
                this.gameState.players.push({
                    name: result.value.name,
                    score: 0,
                    color: result.value.color,
                    avatar: result.value.avatarUrl
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
        const currentAvatar = player.avatar || this.defaultAvatar;

        Swal.fire({
            title: "Editar jugador",
            html: `
                <input id="editName" class="swal2-input" placeholder="Nombre"
                        value="${player.name}">
                <label style="margin-top:10px; font-weight:bold; display:block; text-align:left;">Color:</label>
                <input id="editColor" type="color" value="${player.color}"
                    style="width: 100%; height: 50px; border-radius: 8px; cursor: pointer; margin-top:5px;">
                <label style="margin-top:10px; font-weight:bold; display:block; text-align:left;">Avatar:</label>
                <div style="margin-bottom: 10px;">
                    <img id="currentAvatarPreview" src="${currentAvatar}"
                        style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid ${player.color};">
                </div>
                <input id="editAvatar" type="file" accept="image/*" style="padding-left:0;">
                <label style="margin-top:10px; font-weight:bold; display:block; text-align:left;">Puntos:</label>
                <input id="editScore" type="number" class="swal2-input"
                        value="${player.score}" min="-999999" step="1">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Guardar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#27ae60",
            didOpen: () => {
                document.getElementById('editAvatar').addEventListener('change', (event) => {
                    const file = event.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = e => {
                            document.getElementById('currentAvatarPreview').src = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    } else {
                        document.getElementById('currentAvatarPreview').src = currentAvatar;
                    }
                });
            },
            preConfirm: () => {
                const name = document.getElementById("editName").value.trim();
                const color = document.getElementById("editColor").value;
                const score = parseInt(document.getElementById("editScore").value) || 0;
                const avatarFile = document.getElementById("editAvatar").files[0];

                if (!name) {
                    Swal.showValidationMessage("El nombre no puede estar vacío.");
                    return false;
                }

                if (avatarFile) {
                    return this.getBase64(avatarFile).then(avatarUrl => {
                        return { name, color, score, avatarUrl };
                    });
                } else {
                    return Promise.resolve({ name, color, score, avatarUrl: player.avatar });
                }
            }
        }).then(result => {
            if (result.isConfirmed) {
                player.name = result.value.name;
                player.color = result.value.color;
                player.score = result.value.score;
                player.avatar = result.value.avatarUrl;

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
