/* ================================
   SETTINGS
   Ajustes de la partida
================================ */

import { Dialog } from './dialog.js';
import { Effects } from './effects.js';
import { Voice } from './voice.js';
import { esc } from './utils.js';

export class Settings {
    constructor(state) {
        this.state = state;
    }

    async open() {
        const s = this.state.settings;
        const check = (id, label, value, hint = '') => `
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
                    ${check('setDD', 'Daily Double habilitada', s.dailyDoubleEnabled, 'Las casillas marcadas piden apuesta.')}
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
                document.getElementById('setVoiceTest')?.addEventListener('click', () => {
                    Voice.speak('Hola, soy la presentadora. Esta es la pregunta de prueba para el concursillo.', {
                        name: document.getElementById('setVoiceName').value,
                        rate: document.getElementById('setVoiceRate').value
                    });
                });
            },
            willClose: () => Voice.stop(),
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#27ae60',
            preConfirm: () => ({
                timerEnabled: document.getElementById('setTimerEnabled').checked,
                timerSeconds: Math.max(5, parseInt(document.getElementById('setTimerSeconds').value, 10) || 30),
                autoTimer: document.getElementById('setAutoTimer').checked,
                buzzFoulSeconds: Math.max(0, parseInt(document.getElementById('setFoul').value, 10) || 0),
                autoCloseOnCorrect: document.getElementById('setAutoClose').checked,
                deductOnWrong: document.getElementById('setDeduct').checked,
                dailyDoubleEnabled: document.getElementById('setDD').checked,
                lightningPoints: Math.max(0, parseInt(document.getElementById('setLightning').value, 10) || 0),
                sfx: document.getElementById('setSfx').checked,
                voiceEnabled: document.getElementById('setVoice').checked,
                voiceName: document.getElementById('setVoiceName').value,
                voiceRate: Math.min(1.6, Math.max(0.6, parseFloat(document.getElementById('setVoiceRate').value) || 1))
            })
        });
        if (!res.isConfirmed) return;

        Object.assign(this.state.settings, res.value);
        this.state.commit();
        Effects.toast('Ajustes guardados', 'success');
    }
}
