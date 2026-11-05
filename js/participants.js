/* ================================
   PARTICIPANTS
   Alta, edición y baja de jugadores y equipos
================================ */

import { Dialog } from './dialog.js';
import { Effects } from './effects.js';
import { esc, uid, Utils, DEFAULT_AVATAR } from './utils.js';

const LABEL = 'display:block;text-align:left;font-weight:bold;margin-top:10px;';
const COLOR_INPUT = 'width:100%;height:50px;border-radius:8px;cursor:pointer;margin-top:5px;';

export class Participants {
    constructor(state) {
        this.state = state;
    }

    /* ---------- Jugadores ---------- */

    async addPlayer() {
        const res = await Dialog.fire({
            title: 'Nuevo jugador',
            html: `
                <input id="pName" class="swal2-input" placeholder="Nombre del jugador" maxlength="40">
                <input id="pColor" type="color" value="${Utils.generateColor()}" style="${COLOR_INPUT}">
                <label for="pAvatar" style="${LABEL}">Avatar (opcional):</label>
                <input id="pAvatar" type="file" accept="image/*" style="padding-left:0;">`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Agregar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#27ae60',
            preConfirm: async () => {
                const name = document.getElementById('pName').value.trim();
                if (!name) { Swal.showValidationMessage('Poné un nombre.'); return false; }
                const file = document.getElementById('pAvatar').files[0];
                return {
                    name,
                    color: document.getElementById('pColor').value,
                    avatar: file ? await Utils.fileToAvatar(file) : ''
                };
            }
        });
        if (!res.isConfirmed) return;

        const player = { id: uid(), name: res.value.name, score: 0, color: res.value.color, avatar: res.value.avatar };
        this.state.players.push(player);
        if (!this.state.session.turnId && !this.state.isTeamRound()) this.state.session.turnId = player.id;
        this.state.commit();
        Effects.toast(`🎮 ${player.name} agregado`, 'success');
    }

    async editPlayer(id) {
        const p = this.state.players.find(x => x.id === id);
        if (!p) return;

        const res = await Dialog.fire({
            title: 'Editar jugador',
            html: `
                <input id="eName" class="swal2-input" placeholder="Nombre" value="${esc(p.name)}" maxlength="40">
                <label style="${LABEL}">Color:</label>
                <input id="eColor" type="color" value="${esc(p.color)}" style="${COLOR_INPUT}">
                <label style="${LABEL}">Avatar:</label>
                <img id="ePreview" src="${esc(p.avatar || DEFAULT_AVATAR)}" alt="" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid ${esc(p.color)};margin:6px 0;">
                <input id="eAvatar" type="file" accept="image/*" style="padding-left:0;display:block;">
                <label style="${LABEL}">Puntos:</label>
                <input id="eScore" type="number" class="swal2-input" value="${p.score}" step="1">`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#27ae60',
            didOpen: () => {
                document.getElementById('eAvatar').addEventListener('change', async (e) => {
                    const f = e.target.files[0];
                    if (f) document.getElementById('ePreview').src = await Utils.fileToAvatar(f);
                });
            },
            preConfirm: async () => {
                const name = document.getElementById('eName').value.trim();
                if (!name) { Swal.showValidationMessage('El nombre no puede estar vacío.'); return false; }
                const file = document.getElementById('eAvatar').files[0];
                return {
                    name,
                    color: document.getElementById('eColor').value,
                    score: parseInt(document.getElementById('eScore').value, 10) || 0,
                    avatar: file ? await Utils.fileToAvatar(file) : p.avatar
                };
            }
        });
        if (!res.isConfirmed) return;

        if (res.value.score !== p.score) this.state.pushHistory(`Ajuste manual de ${p.name}`);
        Object.assign(p, res.value);
        this.state.commit();
        Effects.toast('Jugador actualizado', 'success');
    }

    async removePlayer(id) {
        const p = this.state.players.find(x => x.id === id);
        if (!p) return;
        const ok = await Dialog.confirm({ title: `¿Eliminar a ${p.name}?`, confirmText: 'Eliminar' });
        if (!ok) return;

        this.state.players = this.state.players.filter(x => x.id !== id);
        this.state.teams.forEach(t => { t.memberIds = t.memberIds.filter(m => m !== id); });
        if (this.state.session.turnId === id) this.state.session.turnId = this.state.players[0]?.id ?? null;
        this.state.commit();
    }

    /* ---------- Equipos ---------- */

    async createTeam() {
        if (!this.state.players.length) {
            return Dialog.info('No hay jugadores', 'Primero agregá jugadores individuales para formar equipos.');
        }
        const used = new Set(this.state.teams.flatMap(t => t.memberIds));
        const available = this.state.players.filter(p => !used.has(p.id));
        if (!available.length) {
            return Dialog.info('Todos asignados', 'Todos los jugadores ya están en un equipo.');
        }
        const data = await this.#teamDialog({ title: 'Crear equipo', confirm: 'Crear equipo', candidates: available });
        if (!data) return;

        this.state.teams.push({ id: uid(), name: data.name, score: 0, color: data.color, memberIds: data.memberIds });
        if (this.state.isTeamRound() && !this.state.session.turnId) this.state.session.turnId = this.state.teams.at(-1).id;
        this.state.commit();
        Effects.toast(`👥 Equipo ${data.name} creado`, 'success');
    }

    async editTeam(id) {
        const t = this.state.teams.find(x => x.id === id);
        if (!t) return;
        const usedByOthers = new Set(this.state.teams.filter(x => x.id !== id).flatMap(x => x.memberIds));
        const candidates = this.state.players.filter(p => !usedByOthers.has(p.id));
        const data = await this.#teamDialog({ title: 'Editar equipo', confirm: 'Guardar', candidates, team: t });
        if (!data) return;

        if (data.score !== t.score) this.state.pushHistory(`Ajuste manual de ${t.name}`);
        Object.assign(t, data);
        this.state.commit();
        Effects.toast('Equipo actualizado', 'success');
    }

    async removeTeam(id) {
        const t = this.state.teams.find(x => x.id === id);
        if (!t) return;
        const ok = await Dialog.confirm({
            title: `¿Eliminar al equipo ${t.name}?`,
            text: 'Los jugadores individuales permanecen; solo se disuelve el equipo.',
            confirmText: 'Eliminar'
        });
        if (!ok) return;
        this.state.teams = this.state.teams.filter(x => x.id !== id);
        if (this.state.session.turnId === id) this.state.session.turnId = this.state.teams[0]?.id ?? null;
        this.state.commit();
    }

    async #teamDialog({ title, confirm, candidates, team }) {
        const checked = new Set(team?.memberIds ?? []);
        const members = candidates.map(p => `
            <label class="player-selection-item" style="--player-color:${esc(p.color)};">
                <input type="checkbox" name="teamMember" value="${esc(p.id)}" class="hidden-checkbox" ${checked.has(p.id) ? 'checked' : ''}>
                <span class="player-badge">${esc(p.name)}</span>
            </label>`).join('');

        const res = await Dialog.fire({
            title,
            html: `
                <input id="tName" class="swal2-input" placeholder="Nombre del equipo" value="${esc(team?.name ?? '')}" maxlength="40">
                <input id="tColor" type="color" value="${esc(team?.color ?? Utils.generateColor())}" style="${COLOR_INPUT}">
                ${team ? `<label style="${LABEL}">Puntos:</label><input id="tScore" type="number" class="swal2-input" value="${team.score}" step="1">` : ''}
                <div style="text-align:left;margin-top:15px;border-top:1px solid #36393f;padding-top:10px;">
                    <strong>Miembros:</strong>
                    <div style="max-height:200px;overflow-y:auto;">${members}</div>
                </div>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: confirm,
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#5865f2',
            preConfirm: () => {
                const name = document.getElementById('tName').value.trim();
                const memberIds = [...document.querySelectorAll('input[name="teamMember"]:checked')].map(el => el.value);
                if (!name) { Swal.showValidationMessage('El equipo necesita un nombre.'); return false; }
                if (!memberIds.length) { Swal.showValidationMessage('Elegí al menos un miembro.'); return false; }
                return {
                    name, memberIds,
                    color: document.getElementById('tColor').value,
                    score: team ? (parseInt(document.getElementById('tScore').value, 10) || 0) : 0
                };
            }
        });
        return res.isConfirmed ? res.value : null;
    }
}
