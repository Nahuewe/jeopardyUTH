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
            else if (f === 'dailyDouble') { this.#q(e.target).dailyDouble = e.target.checked; this.render(); }
            else if (f === 'media') await this.#upload(e.target);
        });

        // Clic en el fondo oscuro = cerrar (pide confirmar si hay cambios sin guardar).
        this.modal.addEventListener('mousedown', (e) => { this.backdropDown = e.target === this.modal; });
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal && this.backdropDown) this.requestClose();
        });
    }

    #q(el) {
        return this.draft.questions[+el.dataset.cat][+el.dataset.q];
    }

    /* ---------- Abrir / cerrar ---------- */

    async open() {
        this.draft = structuredClone(this.state.round);
        await MediaStore.preload(this.draft.questions.flat().flatMap(q => [q.media1, q.media2]));
        this.snapshot = JSON.stringify(this.draft);
        document.getElementById('editorTitle').textContent = this.state.round.name;
        document.getElementById('roundName').value = this.draft.name;
        document.getElementById('roundMode').value = this.draft.mode;
        this.render();
        this.modal.classList.add('active');
        document.body.classList.add('modal-open');
        this.modal.querySelector('.ed-body').scrollTop = 0;
    }

    close() {
        this.modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        this.draft = null;
    }

    get dirty() {
        return !!this.draft && JSON.stringify(this.draft) !== this.snapshot;
    }

    /** X, Cancelar, Esc y clic afuera: si hay cambios sin guardar, se pregunta antes de descartarlos. */
    async requestClose() {
        if (!this.draft) return;
        if (this.dirty) {
            const ok = await Dialog.confirm({
                icon: 'warning', title: '¿Descartar los cambios?',
                text: 'Tenés cambios sin guardar en esta ronda.',
                confirmText: 'Descartar', cancelText: 'Seguir editando'
            });
            if (!ok) return;
        }
        this.close();
    }

    get isOpen() {
        return this.modal.classList.contains('active');
    }

    /* ---------- Render ---------- */

    render() {
        const body = this.modal.querySelector('.ed-body');
        const scroll = body?.scrollTop ?? 0;
        this.list.innerHTML = this.draft.categories.map((c, i) => this.#categoryHTML(c, i)).join('')
            || '<p class="ed-empty">Esta ronda no tiene categorías todavía. Agregá una con "＋ Categoría".</p>';
        if (body) body.scrollTop = scroll;
        this.#summary();
    }

    #summary() {
        const qs = this.draft.questions.flat();
        const dd = qs.filter(q => q.dailyDouble).length;
        const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
        document.getElementById('editorSummary').textContent =
            `${plural(this.draft.categories.length, 'categoría', 'categorías')} · ${plural(qs.length, 'pregunta', 'preguntas')}`
            + (dd ? ` · ${plural(dd, 'Daily Double', 'Daily Doubles')}` : '');
    }

    #categoryHTML(category, c) {
        const questions = this.draft.questions[c] || [];
        return `
            <section class="ed-cat">
                <div class="ed-cat-head">
                    <span class="ed-cat-num">${c + 1}</span>
                    <input type="text" class="ed-cat-name" value="${esc(category)}" data-field="category" data-cat="${c}" aria-label="Nombre de la categoría" placeholder="Nombre de la categoría">
                    <div class="ed-tools">
                        <button type="button" class="ed-icon" data-action="ed-move-cat" data-cat="${c}" data-dir="-1" title="Subir categoría" aria-label="Subir categoría">⬆</button>
                        <button type="button" class="ed-icon" data-action="ed-move-cat" data-cat="${c}" data-dir="1" title="Bajar categoría" aria-label="Bajar categoría">⬇</button>
                        <button type="button" class="ed-icon ed-icon-text" data-action="ed-sort" data-cat="${c}" title="Ordenar preguntas por puntos">↕ Ordenar</button>
                        <button type="button" class="ed-icon ed-icon-danger" data-action="ed-remove-category" data-cat="${c}" title="Eliminar categoría" aria-label="Eliminar categoría">🗑</button>
                    </div>
                </div>
                <div class="ed-qlist">
                    ${questions.map((q, i) => this.#questionHTML(q, c, i)).join('')}
                </div>
                <button type="button" class="ed-add-q" data-action="ed-add-question" data-cat="${c}">＋ Agregar pregunta</button>
            </section>`;
    }

    #questionHTML(q, c, i) {
        const at = `data-cat="${c}" data-q="${i}"`;
        return `
            <article class="ed-q ${q.dailyDouble ? 'is-dd' : ''}">
                <div class="ed-q-head">
                    <span class="ed-q-num">${i + 1}</span>
                    <span class="ed-q-points">$${q.value}${q.dailyDouble ? ` <em>→ $${q.value * 2}</em>` : ''}</span>
                    ${q.dailyDouble ? '<span class="ed-badge">🎲 Daily Double x2</span>' : ''}
                    <div class="ed-tools">
                        <button type="button" class="ed-icon" data-action="ed-move-q" ${at} data-dir="-1" title="Subir pregunta" aria-label="Subir pregunta">⬆</button>
                        <button type="button" class="ed-icon" data-action="ed-move-q" ${at} data-dir="1" title="Bajar pregunta" aria-label="Bajar pregunta">⬇</button>
                        <button type="button" class="ed-icon ed-icon-danger" data-action="ed-remove-question" ${at} title="Eliminar pregunta" aria-label="Eliminar pregunta">🗑</button>
                    </div>
                </div>

                <div class="ed-row">
                    <label class="ed-field ed-field-sm">
                        <span class="ed-label">Puntos</span>
                        <input type="number" value="${q.value}" data-field="value" ${at} min="0" step="100">
                    </label>
                    <label class="ed-field ed-field-sm">
                        <span class="ed-label">⏱ Timer propio (seg)</span>
                        <input type="number" value="${q.timer || 0}" data-field="timer" ${at} min="0" max="600" step="5" title="0 = usa el de Ajustes">
                    </label>
                    <label class="ed-switch" title="La pregunta vale el doble de puntos">
                        <input type="checkbox" data-field="dailyDouble" ${at} ${q.dailyDouble ? 'checked' : ''}>
                        <span class="ed-switch-ui" aria-hidden="true"></span>
                        <span>🎲 Daily Double <small>vale el doble</small></span>
                    </label>
                </div>

                <div class="ed-row ed-row-2">
                    <label class="ed-field">
                        <span class="ed-label">Pregunta</span>
                        <textarea data-field="question" ${at} rows="3" placeholder="Escribí la pregunta…">${esc(q.question)}</textarea>
                    </label>
                    <label class="ed-field">
                        <span class="ed-label">Respuesta</span>
                        <textarea data-field="answer" ${at} rows="3" placeholder="Respuesta correcta…">${esc(q.answer)}</textarea>
                    </label>
                </div>

                <div class="ed-field">
                    <span class="ed-label">Opciones múltiples (pistas)
                        <button type="button" class="ed-chip" data-action="ed-tf" ${at}>Verdadero / Falso</button>
                    </span>
                    <textarea data-field="multipleChoice" ${at} rows="2" aria-label="Opciones múltiples" placeholder="Ej: a) Opción 1 / b) Opción 2 / c) Opción 3 (separar con '/')">${esc(q.multipleChoice)}</textarea>
                </div>

                <div class="ed-row ed-row-2 ed-media-row">
                    ${this.#mediaHTML(q, c, i, 'media1')}
                    ${this.#mediaHTML(q, c, i, 'media2')}
                </div>
            </article>`;
    }

    #mediaHTML(q, c, i, slot) {
        const media = q[slot];
        return `
            <div class="ed-media">
                <span class="ed-label">Multimedia ${slot === 'media1' ? 1 : 2} <small>imagen · audio · video</small></span>
                <input type="file" accept="image/*,video/*,audio/*" data-field="media" data-cat="${c}" data-q="${i}" data-slot="${slot}">
                ${media ? `<div class="ed-media-preview">${MediaStore.previewHtml(media, `ed-${c}-${i}-${slot}`)}
                    <button type="button" class="ed-chip ed-chip-danger" data-action="ed-remove-media" data-cat="${c}" data-q="${i}" data-slot="${slot}">Quitar</button></div>` : ''}
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
