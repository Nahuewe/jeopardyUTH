/* ================================
   SETTINGS
   Ajustes de la partida
================================ */

import { Dialog } from './dialog.js';
import { Effects } from './effects.js';

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
                </div>`,
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
                sfx: document.getElementById('setSfx').checked
            })
        });
        if (!res.isConfirmed) return;

        Object.assign(this.state.settings, res.value);
        this.state.commit();
        Effects.toast('Ajustes guardados', 'success');
    }
}
