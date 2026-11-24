/* Gestión de rondas: crear, duplicar y eliminar. */

import Swal from 'sweetalert2';
import { Dialog } from './dialog.ts';
import { Effects } from './effects.ts';
import { makeRound, type GameState } from './gameState.ts';
import type { RoundMode } from './types.ts';
import { uid } from './utils.ts';

export async function addRound(state: GameState): Promise<void> {
    const res = await Dialog.fire({
        title: 'Nueva ronda',
        html: `
            <input id="nrName" class="swal2-input" placeholder="Nombre de la ronda" value="Ronda ${state.rounds.length + 1}">
            <select id="nrMode" class="swal2-select" style="display:flex;margin:12px auto;">
                <option value="individual">Individual (jugadores)</option>
                <option value="team">Grupal (equipos)</option>
            </select>`,
        showCancelButton: true, confirmButtonText: 'Crear', cancelButtonText: 'Cancelar', confirmButtonColor: '#27ae60',
        preConfirm: () => {
            const name = (document.getElementById('nrName') as HTMLInputElement).value.trim();
            if (!name) { Swal.showValidationMessage('Poné un nombre.'); return false; }
            return { name, mode: (document.getElementById('nrMode') as HTMLSelectElement).value as RoundMode };
        }
    });
    if (!res.isConfirmed) return;
    const v = res.value as { name: string; mode: RoundMode };
    const round = makeRound(v.name, v.mode);
    state.rounds.push(round);
    state.activeRoundId = round.id;
    state.commit();
}

export function duplicateRound(state: GameState): void {
    const copy = structuredClone(state.round);
    copy.id = uid();
    copy.name = `${copy.name} (copia)`;
    copy.questions.forEach(col => col.forEach(q => { q.used = false; q.usedWithOptions = false; }));
    state.rounds.push(copy);
    state.activeRoundId = copy.id;
    state.commit();
    Effects.toast('Ronda duplicada', 'success');
}

export async function deleteRound(state: GameState): Promise<void> {
    if (state.rounds.length <= 1) { await Dialog.info('No permitido', 'Debe quedar al menos una ronda.'); return; }
    const ok = await Dialog.confirm({
        icon: 'warning', title: `¿Eliminar "${state.round.name}"?`,
        text: 'Se pierden sus categorías y preguntas.', confirmText: 'Eliminar'
    });
    if (!ok) return;
    state.rounds = state.rounds.filter(r => r.id !== state.activeRoundId);
    state.activeRoundId = state.rounds[0].id;
    state.commit();
}
