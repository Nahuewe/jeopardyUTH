/* ================================
   EDITOR COMPONENT
   Editor de categorías y preguntas
================================ */

import { Utils } from './utils.js';
import { Storage } from './storage.js';

export class Editor {
    constructor(gameState, board) {
        this.gameState = gameState;
        this.board = board;
        this.editorElement = document.getElementById('categoriesEditor');
        this.modalElement = document.getElementById('editorModal');
    }

    open() {
        this.gameState.startEditingRound();
        document.getElementById('editorTitle').textContent =
            `Editor de: ${this.gameState.roundsData[this.gameState.activeRound].name}`;
        this.render();
        this.modalElement.classList.add('active');
    }

    close() {
        this.modalElement.classList.remove('active');
        this.gameState.cancelEditing();
    }

    render() {
        this.editorElement.innerHTML = '';

        if (!this.gameState.editingGameData || !this.gameState.editingGameData.categories) {
            this.gameState.editingGameData = { categories: [], questions: [] };
        }

        this.renderCategories();
        this.renderFinalQuestion();
    }

    renderCategories() {
        this.gameState.editingGameData.categories.forEach((category, catIndex) => {
            const categoryDiv = this.createCategoryEditor(category, catIndex);
            this.editorElement.appendChild(categoryDiv);
        });
    }

    createCategoryEditor(category, catIndex) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-editor';

        const questions = this.gameState.editingGameData.questions[catIndex] || [];
        const questionsHTML = questions.map((q, qIndex) =>
            this.createQuestionHTML(q, catIndex, qIndex)
        ).join('');

        categoryDiv.innerHTML = `
            <div class="category-header">
                <input type="text" value="${category}"
                       onchange="window.game.editor.updateCategory(${catIndex}, this.value)">
                <button onclick="window.game.editor.removeCategory(${catIndex})">Eliminar</button>
            </div>
            ${questionsHTML}
            <button class="add-question-btn" onclick="window.game.editor.addQuestion(${catIndex})">
                + Agregar Pregunta
            </button>
        `;

        return categoryDiv;
    }

    createQuestionHTML(question, catIndex, qIndex) {
        return `
            <div class="question-item">
                <div class="question-header">
                    <h4>Pregunta ${qIndex + 1}</h4>
                    <button class="btn-danger" onclick="window.game.editor.removeQuestion(${catIndex}, ${qIndex})">
                        Eliminar
                    </button>
                </div>
                <label>Puntos:</label>
                <input type="number" value="${question.value}"
                    onchange="window.game.editor.updateQuestion(${catIndex}, ${qIndex}, 'value', this.value)"
                    min="0" step="100">
                <label>Pregunta:</label>
                <textarea onchange="window.game.editor.updateQuestion(${catIndex}, ${qIndex}, 'question', this.value)">${question.question || ''}</textarea>
                <label>Respuesta:</label>
                <textarea onchange="window.game.editor.updateQuestion(${catIndex}, ${qIndex}, 'answer', this.value)">${question.answer || ''}</textarea>
                <label>Opciones Múltiple:</label>
                <textarea onchange="window.game.editor.updateQuestion(${catIndex}, ${qIndex}, 'multipleChoice', this.value)"placeholder="Ej: a) Opción 1 / b) Opción 2 / c) Opción 3 (Separar con barras '/')">${question.multipleChoice || ''}</textarea>
                ${this.createMediaSection(question, catIndex, qIndex, 'media1')}
                ${this.createMediaSection(question, catIndex, qIndex, 'media2')}
            </div>
        `;
    }

    createMediaSection(question, catIndex, qIndex, mediaSlot) {
        const mediaData = question[mediaSlot];
        const mediaNumber = mediaSlot === 'media1' ? '1' : '2';

        return `
            <div class="media-section">
                <label>Multimedia ${mediaNumber} (Imagen/Audio/Video):</label>
                <input type="file" accept="image/*,video/*,audio/*"
                       onchange="window.game.editor.handleMediaUpload(event, ${catIndex}, ${qIndex}, '${mediaSlot}')">
                ${mediaData ? this.createMediaPreview(mediaData, catIndex, qIndex, mediaSlot) : ''}
            </div>
        `;
    }

    createMediaPreview(mediaData, catIndex, qIndex, mediaSlot) {
        const mediaHTML = Utils.createMediaHTML(mediaData);
        return `
            <div class="media-preview">
                ${mediaHTML}
                <button onclick="window.game.editor.removeMedia(${catIndex}, ${qIndex}, '${mediaSlot}')">
                    Quitar
                </button>
            </div>
        `;
    }

    renderFinalQuestion() {
        const finalDiv = document.createElement('div');
        finalDiv.className = 'question-item final-question';

        const fq = this.gameState.editingGameData.finalQuestion || {
            value: 500,
            question: '',
            answer: '',
            media1: null,
            media2: null,
            multipleChoice: '',
            used: false,
            usedWithOptions: false
        };

        finalDiv.innerHTML = `
        <div class="question-header" style="margin-top:1rem; border-top:1px dashed #444; padding-top:0.75rem;">
            <h3>Pregunta Final</h3>
        </div>

        <label>Puntos:</label>
        <input type="number" id="final_value" value="${fq.value}" min="0" step="50">

        <label>Pregunta:</label>
        <textarea id="final_question">${fq.question || ''}</textarea>

        <label>Respuesta:</label>
        <textarea id="final_answer">${fq.answer || ''}</textarea>

        <label>Opciones Múltiple:</label>
        <textarea id="final_multipleChoice"  placeholder="Ej: A / B / C (separar con /)">${fq.multipleChoice || ''}</textarea>

        <div class="media-section">
            <label style="margin-left:5px;">Multimedia 1:</label>
            <input style="margin-left:5px;" type="file" id="final_media1" accept="image/*,video/*,audio/*">
            <div id="final_media1_preview">
                ${fq.media1 ? this.createMediaPreview(fq.media1, -1, 0, 'media1') : ''}
            </div>
        </div>

        <div class="media-section">
            <label style="margin-left:5px;">Multimedia 2:</label>
            <input style="margin-left:5px;" type="file" id="final_media2" accept="image/*,video/*,audio/*">
            <div id="final_media2_preview">
                ${fq.media2 ? this.createMediaPreview(fq.media2, -1, 0, 'media2') : ''}
            </div>
        </div>
    `;

        this.editorElement.appendChild(finalDiv);

        setTimeout(() => {
            document.getElementById('final_media1')?.addEventListener('change',
                (e) => this.handleMediaUpload(e, -1, 0, 'media1'));

            document.getElementById('final_media2')?.addEventListener('change',
                (e) => this.handleMediaUpload(e, -1, 0, 'media2'));
        });
    }

    createFinalMediaPreview(mediaData, mediaSlot = 'media1') {
        if (!mediaData) return '';
        const mediaHTML = Utils.createMediaHTML(mediaData);
        return `
        <div class="media-preview">
            ${mediaHTML}
            <button onclick="window.game.editor.removeMedia(-1, 0, '${mediaSlot}')">
                Quitar
            </button>
        </div>
    `;
    }

    updateCategory(catIndex, newName) {
        this.gameState.editingGameData.categories[catIndex] = newName;
    }

    updateQuestion(catIndex, qIndex, field, value) {
        this.gameState.editingGameData.questions[catIndex][qIndex][field] =
            field === 'value' ? parseInt(value) || 0 : value;
    }

    addCategory() {
        this.gameState.editingGameData.categories.push('Nueva Categoría');
        this.gameState.editingGameData.questions.push([{
            value: 100,
            question: '',
            answer: '',
            media1: null,
            media2: null,
            multipleChoice: ''
        }]);
        this.render();
    }

    removeCategory(catIndex) {
        if (this.gameState.editingGameData.categories.length <= 1) {
            return Swal.fire({
                icon: 'info',
                title: 'No permitido',
                text: 'Debe haber al menos una categoría.'
            });
        }

        Swal.fire({
            icon: 'warning',
            title: `¿Eliminar la categoría "${this.gameState.editingGameData.categories[catIndex]}"?`,
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        }).then(result => {
            if (result.isConfirmed) {
                this.gameState.editingGameData.categories.splice(catIndex, 1);
                this.gameState.editingGameData.questions.splice(catIndex, 1);
                this.render();
            }
        });
    }

    addQuestion(catIndex) {
        if (!this.gameState.editingGameData.questions[catIndex]) {
            this.gameState.editingGameData.questions[catIndex] = [];
        }

        const questions = this.gameState.editingGameData.questions[catIndex];
        const lastQuestion = questions.length > 0 ? questions[questions.length - 1] : null;

        questions.push({
            value: lastQuestion ? lastQuestion.value + 100 : 100,
            question: '',
            answer: '',
            media1: null,
            media2: null,
            multipleChoice: ''
        });

        this.render();
    }

    removeQuestion(catIndex, qIndex) {
        if (this.gameState.editingGameData.questions[catIndex].length <= 1) {
            return Swal.fire({
                icon: 'info',
                title: 'No permitido',
                text: 'Debe haber al menos una pregunta.'
            });
        }

        Swal.fire({
            icon: 'question',
            title: '¿Eliminar esta pregunta?',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#e74c3c'
        }).then(result => {
            if (result.isConfirmed) {
                this.gameState.editingGameData.questions[catIndex].splice(qIndex, 1);
                this.render();
            }
        });
    }

    async handleMediaUpload(event, catIndex, qIndex, mediaSlot) {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const dataURL = await Utils.readFileAsDataURL(file);
            const type = Utils.getMediaType(file);
            const mediaObj = { type, url: dataURL };

            if (catIndex === -1) {
                if (!this.gameState.editingGameData.finalQuestion) {
                    this.gameState.editingGameData.finalQuestion = {
                        value: 500,
                        question: '',
                        answer: '',
                        multipleChoice: '',
                        media1: null,
                        media2: null,
                        used: false,
                        usedWithOptions: false
                    };
                }

                this.gameState.editingGameData.finalQuestion[mediaSlot] = mediaObj;

                const previewId = mediaSlot === 'media1' ? 'final_media1_preview' : 'final_media2_preview';
                const previewEl = document.getElementById(previewId);
                if (previewEl) {
                    previewEl.innerHTML = this.createFinalMediaPreview(mediaObj);
                }
            } else {
                this.gameState.editingGameData.questions[catIndex][qIndex][mediaSlot] = mediaObj;
            }

            this.render();
        } catch (error) {
            console.error("Error al cargar archivo:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo cargar el archivo multimedia.'
            });
        }
    }

    removeMedia(catIndex, qIndex, mediaSlot) {
        if (catIndex === -1) {
            if (!this.gameState.editingGameData.finalQuestion) return;

            this.gameState.editingGameData.finalQuestion[mediaSlot] = null;

            const previewId = mediaSlot === 'media1'
                ? 'final_media1_preview'
                : 'final_media2_preview';

            const el = document.getElementById(previewId);
            if (el) el.innerHTML = '';
        } else {
            this.gameState.editingGameData.questions[catIndex][qIndex][mediaSlot] = null;
        }

        this.render();
    }

    saveFinalQuestion() {
        this.gameState.editingGameData.finalQuestion = {
            value: parseInt(document.getElementById("final_value").value),
            question: document.getElementById("final_question").value,
            answer: document.getElementById("final_answer").value,
            multipleChoice: document.getElementById("final_multipleChoice").value,
            media1: this.gameState.editingGameData.finalQuestion?.media1 || null,
            media2: this.gameState.editingGameData.finalQuestion?.media2 || null
        };

        this.save();
    }

    clearFinalQuestion() {
        this.gameState.editingGameData.finalQuestion = null;
        this.render();
        Swal.fire({
            icon: 'info',
            title: 'Eliminada',
            text: 'Pregunta final borrada.'
        });
    }

    save() {
        if (!this.gameState.editingGameData || !this.gameState.editingGameData.categories.length) {
            alert('No hay datos para guardar.');
            return;
        }

        if (this.gameState.editingGameData.categories.some(cat => !cat.trim())) {
            alert('Todas las categorías deben tener un nombre');
            return;
        }

        if (document.getElementById("final_value")) {
            this.gameState.editingGameData.finalQuestion = {
                value: parseInt(document.getElementById("final_value").value) || 0,
                question: document.getElementById("final_question").value || "",
                answer: document.getElementById("final_answer").value || "",
                multipleChoice: document.getElementById("final_multipleChoice").value || "",
                media1: this.gameState.editingGameData.finalQuestion?.media1 || null,
                media2: this.gameState.editingGameData.finalQuestion?.media2 || null,
                used: false,
                usedWithOptions: false
            };
        }

        const roundData = this.gameState.roundsData[this.gameState.activeRound];
        roundData.categories = this.gameState.editingGameData.categories;
        roundData.questions = this.gameState.editingGameData.questions;
        roundData.finalQuestion = this.gameState.editingGameData.finalQuestion || null;

        Storage.saveGameData(this.gameState.roundsData);

        this.close();
        this.board.render();
        this.board.renderFinalQuestionTile();

        Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: `Los datos de la ronda "${roundData.name}" se han guardado exitosamente.`,
            confirmButtonColor: '#27ae60'
        });
    }
}
