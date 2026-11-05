/* ================================
   BOARD
   Tablero. Se renderiza igual en admin y anunciador;
   solo el admin puede abrir celdas.
================================ */

export class Board {
    constructor(state, role) {
        this.state = state;
        this.role = role;
        this.el = document.getElementById('board');
    }

    render() {
        const round = this.state.round;
        this.el.innerHTML = '';

        if (!round?.categories.length) {
            this.el.innerHTML = `
                <div class="board-empty">
                    <span>📋</span>
                    <p>No hay categorías creadas para esta ronda.</p>
                    ${this.role === 'admin' ? '<small>Usá <strong>Editar Preguntas</strong> en el Modo Edición.</small>' : ''}
                </div>`;
        } else {
            round.categories.forEach((category, col) => {
                this.el.appendChild(this.#column(round, category, col));
            });
        }
        this.#renderLightningTile();
    }

    #column(round, category, col) {
        const column = document.createElement('div');
        column.className = 'column';

        const header = document.createElement('div');
        header.className = 'category';
        header.textContent = category;
        column.appendChild(header);

        (round.questions[col] || []).forEach((q, row) => column.appendChild(this.#cell(round, q, col, row)));
        return column;
    }

    #cell(round, q, col, row) {
        const cell = document.createElement('div');
        cell.className = 'cell';

        if (q.used) {
            cell.classList.add('used');
            cell.innerHTML = '<span class="cell-used-icon">✓</span>';
            cell.setAttribute('aria-label', 'Pregunta ya usada');
            return cell;
        }

        cell.textContent = `$${q.value}`;
        if (this.role === 'admin') {
            cell.tabIndex = 0;
            cell.setAttribute('role', 'button');
            cell.setAttribute('aria-label', `${round.categories[col]} por ${q.value} puntos`);
            cell.dataset.action = 'open-cell';
            cell.dataset.col = col;
            cell.dataset.row = row;
            if (q.dailyDouble && this.state.settings.dailyDoubleEnabled) {
                cell.classList.add('dd-hint');
                cell.title = 'Daily Double (solo lo ves vos)';
            }
        }
        return cell;
    }

    #renderLightningTile() {
        const host = document.getElementById('gameModeContainer');
        let tile = document.getElementById('finalQuestionTile');
        if (!tile) {
            tile = document.createElement('div');
            tile.id = 'finalQuestionTile';
            host.appendChild(tile);
        }
        const admin = this.role === 'admin';
        tile.className = 'final-question-tile';
        tile.innerHTML = `
            <div class="final-tile-inner">
                <div class="final-title">⭐ RONDA RELÁMPAGO</div>
            </div>`;
        if (admin) {
            tile.dataset.action = 'open-lightning';
            tile.tabIndex = 0;
            tile.setAttribute('role', 'button');
        }
    }
}
