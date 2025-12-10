/* ================================
   BOARD COMPONENT
   Renderizado del tablero de juego
================================ */

export class Board {
    constructor(gameState, questionModal) {
        this.gameState = gameState;
        this.questionModal = questionModal;
        this.boardElement = document.getElementById("board");
    }

    render() {
        if (this.gameState.currentMode !== 'game') return;

        this.boardElement.innerHTML = "";
        const currentData = this.gameState.getCurrentRoundData();

        if (!currentData.categories.length) {
            this.boardElement.innerHTML = "<p class='empty'>No hay categorías creadas aún para esta ronda.</p>";
            return;
        }

        currentData.categories.forEach((category, colIndex) => {
            const column = this.createColumn(category, currentData.questions[colIndex] || [], colIndex);
            this.boardElement.appendChild(column);
        });

        this.renderFinalQuestion(currentData);
    }

    createColumn(categoryName, questions, colIndex) {
        const column = document.createElement("div");
        column.className = "column";

        const header = document.createElement("div");
        header.className = "category";
        header.textContent = categoryName;
        column.appendChild(header);

        questions.forEach((question, rowIndex) => {
            const cell = this.createCell(question, colIndex, rowIndex);
            column.appendChild(cell);
        });

        return column;
    }

    createCell(question, colIndex, rowIndex) {
        const cell = document.createElement("div");
        cell.className = "cell";

        let displayValue = question.value;
        if (question.used && question.usedWithOptions) {
            displayValue = Math.ceil(question.value / 2);
        }

        cell.textContent = `$${displayValue}`;
        cell.onclick = () => this.questionModal.open(colIndex, rowIndex);

        if (question.used) {
            cell.classList.add("used");
        }

        return cell;
    }

    renderFinalQuestion(currentData) {
        const existing = document.getElementById('finalQuestionWide');
        if (existing) existing.remove();

        const finalQuestion = currentData.finalQuestion;
        if (!finalQuestion) return;

        const finalWrapper = document.createElement('div');
        finalWrapper.id = 'finalQuestionWide';
        finalWrapper.className = 'final-question-wide';
        finalWrapper.style.border = `3px dashed ${this.gameState.activeRound === 'individual' ? 'var(--accent)' : '#ffd700'}`;

        const questionPreview = finalQuestion.question
            ? (finalQuestion.question.length > 120
                ? finalQuestion.question.slice(0, 120) + '...'
                : finalQuestion.question)
            : '(Sin texto)';

        finalWrapper.innerHTML = `
            <div class="final-header">Pregunta Final</div>
            <div class="final-body">
                <div class="final-question-preview">${questionPreview}</div>
                <div class="final-meta">$${finalQuestion.value} ${finalQuestion.used ? ' (usada)' : ''}</div>
                <button onclick="window.game.questionModal.openFinal()" ${finalQuestion.used ? 'disabled' : ''}>
                    Abrir Pregunta Final
                </button>
            </div>
        `;
    }

    renderFinalQuestionTile() {
        const gameContainer = document.getElementById("gameModeContainer");
        let finalTile = document.getElementById("finalQuestionTile");

        if (!finalTile) {
            finalTile = document.createElement("div");
            finalTile.id = "finalQuestionTile";
            finalTile.className = "final-question-tile";
            finalTile.onclick = () => this.questionModal.openFinal();
            gameContainer.appendChild(finalTile);
        }

        const finalQuestion = this.gameState.getCurrentRoundData().finalQuestion || { value: 0 };

        finalTile.innerHTML = `
            <div class="final-title">PREGUNTA FINAL</div>
            <div class="final-value">$${finalQuestion.value || 0}</div>
        `;
    }
}
