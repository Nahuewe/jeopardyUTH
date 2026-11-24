/* Alta, edición y baja de jugadores y equipos (diálogos con SweetAlert2). */

import Swal from 'sweetalert2';
import { Dialog } from './dialog.ts';
import { Effects } from './effects.ts';
import type { GameState } from './gameState.ts';
import type { Player, Team } from './types.ts';
import { DEFAULT_AVATAR, esc, fileToAvatar, generateColor, uid } from './utils.ts';

const LABEL = 'display:block;text-align:left;font-weight:bold;margin-top:10px;';
const COLOR_INPUT = 'width:100%;height:50px;border-radius:8px;cursor:pointer;margin-top:5px;';

const input = (id: string) => document.getElementById(id) as HTMLInputElement;

interface TeamForm { name: string; color: string; memberIds: string[]; score: number }

export class Participants {
    #state: GameState;

    constructor(state: GameState) {
        this.#state = state;
    }

    /* ---------- Jugadores ---------- */

    async addPlayer(): Promise<void> {
        const res = await Dialog.fire({
            title: 'Nuevo jugador',
            html: `
                <input id="pName" class="swal2-input" placeholder="Nombre del jugador" maxlength="40">
                <input id="pColor" type="color" value="${generateColor()}" style="${COLOR_INPUT}">
                <label for="pAvatar" style="${LABEL}">Avatar (opcional):</label>
                <input id="pAvatar" type="file" accept="image/*" style="padding-left:0;">`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Agregar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#27ae60',
            preConfirm: async () => {
                const name = input('pName').value.trim();
                if (!name) { Swal.showValidationMessage('Poné un nombre.'); return false; }
                const file = input('pAvatar').files?.[0];
                return { name, color: input('pColor').value, avatar: file ? await fileToAvatar(file) : '' };
            }
        });
        if (!res.isConfirmed) return;

        const s = this.#state;
        const v = res.value as { name: string; color: string; avatar: string };
        const player: Player = { id: uid(), name: v.name, score: 0, color: v.color, avatar: v.avatar };
        s.players.push(player);
        if (!s.session.turnId && !s.isTeamRound()) s.session.turnId = player.id;
        s.commit();
        Effects.toast(`🎮 ${player.name} agregado`, 'success');
    }

    async editPlayer(id: string): Promise<void> {
        const s = this.#state;
        const p = s.players.find(x => x.id === id);
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
                input('eAvatar').addEventListener('change', async (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (f) (document.getElementById('ePreview') as HTMLImageElement).src = await fileToAvatar(f);
                });
            },
            preConfirm: async () => {
                const name = input('eName').value.trim();
                if (!name) { Swal.showValidationMessage('El nombre no puede estar vacío.'); return false; }
                const file = input('eAvatar').files?.[0];
                return {
                    name,
                    color: input('eColor').value,
                    score: parseInt(input('eScore').value, 10) || 0,
                    avatar: file ? await fileToAvatar(file) : p.avatar
                };
            }
        });
        if (!res.isConfirmed) return;

        const v = res.value as Pick<Player, 'name' | 'color' | 'score' | 'avatar'>;
        if (v.score !== p.score) s.pushHistory(`Ajuste manual de ${p.name}`);
        Object.assign(p, v);
        s.commit();
        Effects.toast('Jugador actualizado', 'success');
    }

    async removePlayer(id: string): Promise<void> {
        const s = this.#state;
        const p = s.players.find(x => x.id === id);
        if (!p) return;
        if (!await Dialog.confirm({ title: `¿Eliminar a ${p.name}?`, confirmText: 'Eliminar' })) return;

        s.players = s.players.filter(x => x.id !== id);
        s.teams.forEach(t => { t.memberIds = t.memberIds.filter(m => m !== id); });
        if (s.session.turnId === id) s.session.turnId = s.players[0]?.id ?? null;
        s.commit();
    }

    /* ---------- Equipos ---------- */

    async createTeam(): Promise<void> {
        const s = this.#state;
        if (!s.players.length) {
            await Dialog.info('No hay jugadores', 'Primero agregá jugadores individuales para formar equipos.');
            return;
        }
        const used = new Set(s.teams.flatMap(t => t.memberIds));
        const available = s.players.filter(p => !used.has(p.id));
        if (!available.length) {
            await Dialog.info('Todos asignados', 'Todos los jugadores ya están en un equipo.');
            return;
        }
        const data = await this.#teamDialog({ title: 'Crear equipo', confirm: 'Crear equipo', candidates: available });
        if (!data) return;

        const team: Team = { id: uid(), name: data.name, score: 0, color: data.color, memberIds: data.memberIds };
        s.teams.push(team);
        if (s.isTeamRound() && !s.session.turnId) s.session.turnId = team.id;
        s.commit();
        Effects.toast(`👥 Equipo ${data.name} creado`, 'success');
    }

    async editTeam(id: string): Promise<void> {
        const s = this.#state;
        const t = s.teams.find(x => x.id === id);
        if (!t) return;
        const usedByOthers = new Set(s.teams.filter(x => x.id !== id).flatMap(x => x.memberIds));
        const candidates = s.players.filter(p => !usedByOthers.has(p.id));
        const data = await this.#teamDialog({ title: 'Editar equipo', confirm: 'Guardar', candidates, team: t });
        if (!data) return;

        if (data.score !== t.score) s.pushHistory(`Ajuste manual de ${t.name}`);
        Object.assign(t, data);
        s.commit();
        Effects.toast('Equipo actualizado', 'success');
    }

    async removeTeam(id: string): Promise<void> {
        const s = this.#state;
        const t = s.teams.find(x => x.id === id);
        if (!t) return;
        const ok = await Dialog.confirm({
            title: `¿Eliminar al equipo ${t.name}?`,
            text: 'Los jugadores individuales permanecen; solo se disuelve el equipo.',
            confirmText: 'Eliminar'
        });
        if (!ok) return;
        s.teams = s.teams.filter(x => x.id !== id);
        if (s.session.turnId === id) s.session.turnId = s.teams[0]?.id ?? null;
        s.commit();
    }

    async #teamDialog({ title, confirm, candidates, team }: { title: string; confirm: string; candidates: Player[]; team?: Team }): Promise<TeamForm | null> {
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
                <input id="tColor" type="color" value="${esc(team?.color ?? generateColor())}" style="${COLOR_INPUT}">
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
                const name = input('tName').value.trim();
                const memberIds = [...document.querySelectorAll<HTMLInputElement>('input[name="teamMember"]:checked')].map(el => el.value);
                if (!name) { Swal.showValidationMessage('El equipo necesita un nombre.'); return false; }
                if (!memberIds.length) { Swal.showValidationMessage('Elegí al menos un miembro.'); return false; }
                return { name, memberIds, color: input('tColor').value, score: team ? (parseInt(input('tScore').value, 10) || 0) : 0 };
            }
        });
        return res.isConfirmed ? (res.value as TeamForm) : null;
    }
}
