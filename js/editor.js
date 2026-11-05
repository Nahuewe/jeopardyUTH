/* ================================
   EDITOR
   Editor de rondas, categorías y preguntas.
   Trabaja sobre una copia (draft) y solo escribe al guardar.
================================ */

import { Dialog } from './dialog.js';
import { Effects } from './effects.js';
import { MediaStore } from './media.js';
import { makeQuestion, makeRound } from './gameState.js';
import { esc, uid } from './utils.js';

const TF_OPTIONS = 'Verdadero / Falso';

const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; };

export class Editor {
    constructor(state) {
        this.state = state;
        this.modal = document.getElementById('editorModal');
        this.list = document.getElementById('categoriesEditor');
        this.draft = null;
        this.#bind();
    }

    #bind() {
        this.modal.addEventListener('input', (e) => {
            const f = e.target.dataset?.field;
            if (!f || !this.draft) return;
            if (f === 'roundName') this.draft.name = e.target.value;
            else if (f === 'category') this.draft.categories[+e.target.dataset.cat] = e.target.value;
            else if (['question', 'answer', 'multipleChoice'].includes(f)) {
                this.#q(e.target)[f] = e.target.value;
            } else if (f === 'value') {
                this.#q(e.target).value = parseInt(e.target.value, 10) || 0;
            } else if (f === 'timer') {
                this.#q(e.target).timer = Math.max(0, parseInt(e.target.value, 10) || 0);
            }
        });

        this.modal.addEventListener('change', async (e) => {
            const f = e.target.dataset?.field;
            if (!f || !this.draft) return;
            if (f === 'roundMode') this.draft.mode = e.target.value;
            else if (f === 'dailyDouble') this.#q(e.target).dailyDouble = e.target.checked;
            else if (f === 'media') await this.#upload(e.target);
        });
    }

    #q(el) {
        return this.draft.questions[+el.dataset.cat][+el.dataset.q];
    }

    /* ---------- Abrir / cerrar ---------- */

    async open() {
        this.draft = structuredClone(this.state.round);
        await MediaStore.preload(this.draft.questions.flat().flatMap(q => [q.media1, q.media2]));
        document.getElementById('editorTitle').textContent = `Editor de: ${this.state.round.name}`;
        document.getElementById('roundName').value = this.draft.name;
        document.getElementById('roundMode').value = this.draft.mode;
        this.render();
        this.modal.classList.add('active');
    }

    close() {
        this.modal.classList.remove('active');
        this.draft = null;
    }

    get isOpen() {
        return this.modal.classList.contains('active');
    }

    /* ---------- Render ---------- */

    render() {
        const scroll = this.modal.querySelector('.editor-content')?.scrollTop ?? 0;
        this.list.innerHTML = this.draft.categories.map((c, i) => this.#categoryHTML(c, i)).join('')
            || '<p class="edit-info">Esta ronda no tiene categorías todavía.</p>';
        const content = this.modal.querySelector('.editor-content');
        if (content) content.scrollTop = scroll;
    }

    #categoryHTML(category, c) {
        const questions = this.draft.questions[c] || [];
        return `
            <div class="category-editor">
                <div class="category-header">
                    <input type="text" value="${esc(category)}" data-field="category" data-cat="${c}" aria-label="Nombre de la categoría" placeholder="Nombre de la categoría">
                    <button data-action="ed-move-cat" data-cat="${c}" data-dir="-1" title="Subir" aria-label="Subir categoría">⬆</button>
                    <button data-action="ed-move-cat" data-cat="${c}" data-dir="1" title="Bajar" aria-label="Bajar categoría">⬇</button>
                    <button data-action="ed-sort" data-cat="${c}" title="Ordenar preguntas por puntos">↕ Ordenar</button>
                    <button data-action="ed-remove-category" data-cat="${c}">Eliminar</button>
                </div>
                ${questions.map((q, i) => this.#questionHTML(q, c, i)).join('')}
                <button class="add-question-btn" data-action="ed-add-question" data-cat="${c}">+ Agregar Pregunta</button>
            </div>`;
    }

    #questionHTML(q, c, i) {
        const at = `data-cat="${c}" data-q="${i}"`;
        return `
            <div class="question-item">
                <div class="question-header">
                    <h4>Pregunta ${i + 1}</h4>
                    <div class="question-tools">
                        <button data-action="ed-move-q" ${at} data-dir="-1" aria-label="Subir pregunta">⬆</button>
                        <button data-action="ed-move-q" ${at} data-dir="1" aria-label="Bajar pregunta">⬇</button>
                        <button class="btn-danger" data-action="ed-remove-question" ${at}>Eliminar</button>
                    </div>
                </div>
                <label>Puntos:</label>
                <input type="number" value="${q.value}" data-field="value" ${at} min="0" step="100">
                <label class="dd-check"><input type="checkbox" data-field="dailyDouble" ${at} ${q.dailyDouble ? 'checked' : ''}> 🎲 Daily Double (el jugador apuesta)</label>
                <label>Pregunta:</label>
                <textarea data-field="question" ${at}>${esc(q.question)}</textarea>
                <label>Respuesta:</label>
                <textarea data-field="answer" ${at}>${esc(q.answer)}</textarea>
                <label>Opciones múltiples:
                    <button type="button" class="mini-btn" data-action="ed-tf" ${at}>Verdadero/Falso</button></label>
                <textarea data-field="multipleChoice" ${at} placeholder="Ej: a) Opción 1 / b) Opción 2 / c) Opción 3 (separar con '/')">${esc(q.multipleChoice)}</textarea>
                <label>⏱️ Timer propio (segundos, 0 = el de Ajustes):</label>
                <input type="number" value="${q.timer || 0}" data-field="timer" ${at} min="0" max="600" step="5" style="width:120px;">
                ${this.#mediaHTML(q, c, i, 'media1')}
                ${this.#mediaHTML(q, c, i, 'media2')}
            </div>`;
    }

    #mediaHTML(q, c, i, slot) {
        const media = q[slot];
        return `
            <div class="media-section">
                <label>Multimedia ${slot === 'media1' ? 1 : 2} (imagen / audio / video):</label>
                <input type="file" accept="image/*,video/*,audio/*" data-field="media" data-cat="${c}" data-q="${i}" data-slot="${slot}">
                ${media ? `<div class="media-preview">${MediaStore.previewHtml(media, `ed-${c}-${i}-${slot}`)}
                    <button data-action="ed-remove-media" data-cat="${c}" data-q="${i}" data-slot="${slot}">Quitar</button></div>` : ''}
            </div>`;
    }

    /* ---------- Operaciones sobre el draft ---------- */

    handle(action, el) {
        const c = +el.dataset.cat, i = +el.dataset.q, dir = +el.dataset.dir;
        const d = this.draft;
        if (!d) return;

        switch (action) {
            case 'ed-add-category':
                d.categories.push('Nueva Categoría');
                d.questions.push([makeQuestion(100)]);
                break;
            case 'ed-remove-category':
                return this.#removeCategory(c);
            case 'ed-move-cat': {
                const j = c + dir;
                if (j < 0 || j >= d.categories.length) return;
                swap(d.categories, c, j);
                swap(d.questions, c, j);
                break;
            }
            case 'ed-sort':
                d.questions[c].sort((a, b) => a.value - b.value);
                break;
            case 'ed-add-question': {
                const list = d.questions[c] ??= [];
                list.push(makeQuestion(list.length ? list.at(-1).value + 100 : 100));
                break;
            }
            case 'ed-remove-question':
                return this.#removeQuestion(c, i);
            case 'ed-move-q': {
                const j = i + dir;
                if (j < 0 || j >= d.questions[c].length) return;
                swap(d.questions[c], i, j);
                break;
            }
            case 'ed-tf':
                d.questions[c][i].multipleChoice = TF_OPTIONS;
                break;
            case 'ed-remove-media':
                d.questions[c][i][el.dataset.slot] = null;
                break;
            case 'ed-random-dd':
                this.#randomDailyDouble();
                break;
            default: return;
        }
        this.render();
    }

    async #removeCategory(c) {
        const ok = await Dialog.confirm({
            icon: 'warning', title: `¿Eliminar la categoría "${this.draft.categories[c]}"?`, confirmText: 'Eliminar'
        });
        if (!ok || !this.draft) return;
        this.draft.categories.splice(c, 1);
        this.draft.questions.splice(c, 1);
        this.render();
    }

    async #removeQuestion(c, i) {
        if (this.draft.questions[c].length <= 1) {
            return Dialog.info('No permitido', 'Cada categoría necesita al menos una pregunta.');
        }
        const ok = await Dialog.confirm({ title: '¿Eliminar esta pregunta?', confirmText: 'Eliminar' });
        if (!ok || !this.draft) return;
        this.draft.questions[c].splice(i, 1);
        this.render();
    }

    #randomDailyDouble() {
        const all = this.draft.questions.flatMap((col, c) => col.map((q, i) => ({ q, c, i })));
        if (!all.length) return;
        all.forEach(({ q }) => { q.dailyDouble = false; });
        // Preferir las preguntas de mayor valor, como en el juego original.
        const maxValue = Math.max(...all.map(x => x.q.value));
        const pool = all.filter(x => x.q.value >= maxValue * 0.6);
        pool[Math.floor(Math.random() * pool.length)].q.dailyDouble = true;
        Effects.toast('🎲 Daily Double asignada al azar', 'info');
    }

    async #upload(input) {
        const file = input.files?.[0];
        if (!file) return;
        try {
            const media = await MediaStore.add(file);
            this.#q(input)[input.dataset.slot] = media;
            this.render();
        } catch (e) {
            console.error(e);
            Dialog.info('Error', 'No se pudo cargar el archivo multimedia.', 'error');
        }
    }

    /* ---------- Guardar ---------- */

    save() {
        const d = this.draft;
        if (!d) return;
        if (!d.name.trim()) return Dialog.info('Falta el nombre', 'La ronda necesita un nombre.', 'warning');
        if (d.categories.some(c => !c.trim())) return Dialog.info('Categoría sin nombre', 'Todas las categorías deben tener nombre.', 'warning');

        const s = this.state;
        const round = s.round;
        round.name = d.name.trim();
        round.mode = d.mode;
        round.categories = d.categories.map(c => c.trim());
        round.questions = d.questions;

        const list = s.participants(round);
        if (!list.some(p => p.id === s.session.turnId)) s.session.turnId = list[0]?.id ?? null;

        this.close();
        s.commit();
        Effects.toast(`✅ Ronda "${round.name}" guardada`, 'success');
    }

    /* ---------- Gestión de rondas ---------- */

    async addRound() {
        const res = await Dialog.fire({
            title: 'Nueva ronda',
            html: `
                <input id="nrName" class="swal2-input" placeholder="Nombre de la ronda" value="Ronda ${this.state.rounds.length + 1}">
                <select id="nrMode" class="swal2-select" style="display:flex;margin:12px auto;">
                    <option value="individual">Individual (jugadores)</option>
                    <option value="team">Grupal (equipos)</option>
                </select>`,
            showCancelButton: true, confirmButtonText: 'Crear', cancelButtonText: 'Cancelar', confirmButtonColor: '#27ae60',
            preConfirm: () => {
                const name = document.getElementById('nrName').value.trim();
                if (!name) { Swal.showValidationMessage('Poné un nombre.'); return false; }
                return { name, mode: document.getElementById('nrMode').value };
            }
        });
        if (!res.isConfirmed) return;
        const round = makeRound(res.value.name, res.value.mode);
        this.state.rounds.push(round);
        this.state.activeRoundId = round.id;
        this.state.commit();
    }

    duplicateRound() {
        const copy = structuredClone(this.state.round);
        copy.id = uid();
        copy.name = `${copy.name} (copia)`;
        copy.questions.forEach(col => col.forEach(q => { q.used = false; q.usedWithOptions = false; }));
        this.state.rounds.push(copy);
        this.state.activeRoundId = copy.id;
        this.state.commit();
        Effects.toast('Ronda duplicada', 'success');
    }

    async deleteRound() {
        if (this.state.rounds.length <= 1) return Dialog.info('No permitido', 'Debe quedar al menos una ronda.');
        const ok = await Dialog.confirm({
            icon: 'warning', title: `¿Eliminar "${this.state.round.name}"?`,
            text: 'Se pierden sus categorías y preguntas.', confirmText: 'Eliminar'
        });
        if (!ok) return;
        const s = this.state;
        s.rounds = s.rounds.filter(r => r.id !== s.activeRoundId);
        s.activeRoundId = s.rounds[0].id;
        s.commit();
    }
}
