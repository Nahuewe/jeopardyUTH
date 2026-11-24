/* Diálogo de ajustes de la partida. */

import { Dialog } from './dialog.ts';
import { Effects } from './effects.ts';
import type { GameState } from './gameState.ts';
import type { Settings } from './types.ts';
import { esc } from './utils.ts';
import { Voice } from './voice.ts';

const el = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;

export async function openSettings(state: GameState): Promise<void> {
    const s = state.settings;
    const check = (id: string, label: string, value: boolean, hint = '') => `
        <label class="set-row">
            <input type="checkbox" id="${id}" ${value ? 'checked' : ''}>
            <span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
        </label>`;

    const res = await Dialog.fire({
        title: '⚙️ Ajustes',
        html: `
            <div class="settings-form">
                ${check('setTimerEnabled', 'Temporizador por pregunta', s.timerEnabled)}
                <label class="set-row"><span>Segundos por pregunta</span>
                    <input type="number" id="setTimerSeconds" min="5" max="300" step="5" value="${s.timerSeconds}"></label>
                ${check('setAutoTimer', 'Iniciar el timer al terminar de escribirse la pregunta', s.autoTimer)}
                <label class="set-row"><span>Castigo por adelantarse con el buzzer (seg)<small>Si apretás antes de que abran, quedás bloqueado este tiempo + 1 a 3 s al azar (se renueva en cada apretón). 0 = solo se ignora.</small></span>
                    <input type="number" id="setFoul" min="0" max="30" step="1" value="${s.buzzFoulSeconds}"></label>
                ${check('setAutoClose', 'Cerrar sola la pregunta tras un acierto', s.autoCloseOnCorrect, 'Si está apagado, la cerrás vos con Terminar/Cerrar.')}
                ${check('setDeduct', 'Restar puntos al fallar', s.deductOnWrong, 'Si está apagado, fallar solo bloquea al participante.')}
                ${check('setDD', 'Daily Double habilitada', s.dailyDoubleEnabled, 'Las casillas marcadas valen el doble de puntos.')}
                <label class="set-row"><span>Puntos por acierto en Ronda Relámpago</span>
                    <input type="number" id="setLightning" min="0" step="50" value="${s.lightningPoints}"></label>
                ${check('setSfx', 'Efectos de sonido', s.sfx)}
                ${check('setVoice', '🎙️ La presentadora lee las preguntas', s.voiceEnabled,
                    Voice.supported ? 'Habla el anunciador (o el admin si no hay anunciador). Las voces dependen del navegador: en Edge suenan mejor.' : 'Este navegador no soporta voz.')}
                <label class="set-row"><span>Voz<small>Las voces se cargan del dispositivo donde se muestra el juego.</small></span>
                    <select id="setVoiceName">
                        <option value="">Automática (femenina en español)</option>
                        ${Voice.list().map(v => `<option value="${esc(v.name)}" ${v.name === s.voiceName ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
                    </select></label>
                <label class="set-row"><span>Velocidad de la voz</span>
                    <input type="number" id="setVoiceRate" min="0.6" max="1.6" step="0.1" value="${s.voiceRate}"></label>
                <button type="button" class="mini-btn" id="setVoiceTest">▶ Probar voz</button>
            </div>`,
        didOpen: () => {
            el('setVoiceTest')?.addEventListener('click', () => {
                Voice.speak('Hola, soy la presentadora. Esta es la pregunta de prueba para el concursillo.', {
                    name: el<HTMLSelectElement>('setVoiceName').value,
                    rate: Number(el('setVoiceRate').value)
                });
            });
        },
        willClose: () => Voice.stop(),
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#27ae60',
        preConfirm: (): Partial<Settings> => ({
            timerEnabled: el('setTimerEnabled').checked,
            timerSeconds: Math.max(5, parseInt(el('setTimerSeconds').value, 10) || 30),
            autoTimer: el('setAutoTimer').checked,
            buzzFoulSeconds: Math.max(0, parseInt(el('setFoul').value, 10) || 0),
            autoCloseOnCorrect: el('setAutoClose').checked,
            deductOnWrong: el('setDeduct').checked,
            dailyDoubleEnabled: el('setDD').checked,
            lightningPoints: Math.max(0, parseInt(el('setLightning').value, 10) || 0),
            sfx: el('setSfx').checked,
            voiceEnabled: el('setVoice').checked,
            voiceName: el<HTMLSelectElement>('setVoiceName').value,
            voiceRate: Math.min(1.6, Math.max(0.6, parseFloat(el('setVoiceRate').value) || 1))
        })
    });
    if (!res.isConfirmed) return;

    Object.assign(state.settings, res.value as Partial<Settings>);
    state.commit();
    Effects.toast('Ajustes guardados', 'success');
}
