let gameData = {
    categories: [],
    questions: []
};

let players = [];

let usedCells = new Set();
let editingGameData = null;

function savePlayers() {
    localStorage.setItem("jeopardyPlayers", JSON.stringify(players));
}

function loadGameData() {
    const saved = localStorage.getItem("jeopardyData");
    if (saved) {
        gameData = JSON.parse(saved);
    } else {
        gameData = {
            categories: [],
            questions: []
        };
    }
}

function loadPlayers() {
    const saved = localStorage.getItem("jeopardyPlayers");
    if (saved) {
        players = JSON.parse(saved);
    } else {
        players = [];
    }
}

function initGame() {
    loadGameData();
    loadPlayers();
    renderBoard();
    renderScoreboard();
}

function persistGameData() {
    localStorage.setItem("jeopardyData", JSON.stringify(editingGameData));
}

function renderBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";

    if (!gameData.categories.length) {
        document.getElementById("board").innerHTML =
            "<p class='empty'>No hay categorías creadas aún.</p>";
        return;
    }


    gameData.categories.forEach((cat, colIndex) => {
        const column = document.createElement("div");
        column.className = "column";

        const header = document.createElement("div");
        header.className = "category";
        header.textContent = cat;
        column.appendChild(header);

        gameData.questions[colIndex].forEach((q, rowIndex) => {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.textContent = `$${q.value}`;

            cell.onclick = () => openQuestion(colIndex, rowIndex);

            if (q.used) cell.classList.add("used");

            column.appendChild(cell);
        });

        board.appendChild(column);
    });
}

function renderScoreboard() {
    const scoreboard = document.getElementById('scoreboard');
    scoreboard.innerHTML = '';

    if (!players.length) {
        scoreboard.innerHTML = "<p class='empty'>No hay jugadores aún.</p>";
        return;
    }

    players.forEach((player, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.innerHTML = `
                    <h3>${player.name}</h3>
                    <div class="score">$${player.score}</div>
                    <div class="controls">
                        <button onclick="editPlayerName(${index})">Editar</button>
                        <button onclick="removePlayer(${index})" style="background: #ff4444; color: white;">Eliminar</button>
                    </div>
                `;
        scoreboard.appendChild(playerCard);
    });
}

function openQuestion(col, row) {
    const cellId = `${col}-${row}`;
    if (usedCells.has(cellId)) return;

    const question = gameData.questions[col][row];
    const modal = document.getElementById('modal');

    document.getElementById('categoryTitle').textContent = gameData.categories[col];
    document.getElementById('pointValue').textContent = `$${question.value}`;
    document.getElementById('questionText').textContent = question.question;
    document.getElementById('answerText').textContent = `Respuesta: ${question.answer}`;
    document.getElementById('answerText').classList.remove('show');

    modal.classList.add('active');

    // Crear botones para dar puntos a jugadores
    const buttonsDiv = document.querySelector('.modal-content .buttons');
    buttonsDiv.innerHTML = `
                <button class="btn-show" onclick="showAnswer()">Mostrar Respuesta</button>
                ${players.map((player, index) =>
        `<button style="background: #28a745; color: white;" onclick="awardPoints(${index}, ${question.value}, '${cellId}')">
                        ✓ ${player.name}
                    </button>`
    ).join('')}
                <button class="btn-close" onclick="closeModal()">Cerrar</button>
            `;
}

function showAnswer() {
    document.getElementById('answerText').classList.add('show');
}

function awardPoints(playerIndex, points, cellId) {
    players[playerIndex].score += points;
    usedCells.add(cellId);
    renderScoreboard();
    savePlayers();
    renderBoard();
    closeModal();
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function addPlayer() {
    const name = prompt('Nombre del jugador:', `Jugador ${players.length + 1}`);
    if (name) {
        players.push({ name: name, score: 0 });
        savePlayers();
        renderScoreboard();
    }
}

function editPlayerName(index) {
    const newName = prompt('Nuevo nombre:', players[index].name);
    if (newName) {
        players[index].name = newName;
        savePlayers();
        renderScoreboard();
    }
}

function removePlayer(index) {
    if (players.length === 1) {
        return Swal.fire({
            icon: 'warning',
            title: 'No permitido',
            text: 'Debe haber al menos un jugador.'
        });
    }

    Swal.fire({
        icon: 'question',
        title: `¿Eliminar a ${players[index].name}?`,
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e74c3c'
    }).then(result => {
        if (result.isConfirmed) {
            players.splice(index, 1);
            savePlayers();
            renderScoreboard();
        }
    });
}

function resetGame() {
    Swal.fire({
        icon: 'warning',
        title: '¿Reiniciar el juego?',
        text: 'Esto borrará todos los puntajes y preguntas usadas.',
        showCancelButton: true,
        confirmButtonText: 'Reiniciar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d35400'
    }).then(result => {
        if (result.isConfirmed) {
            players.forEach(player => player.score = 0);
            usedCells.clear();
            renderBoard();
            renderScoreboard();
        }
    });
}

// Open game editor modal
function openEditor() {
    editingGameData = JSON.parse(JSON.stringify(gameData));
    renderEditor();

    const modal = document.getElementById('editorModal');
    modal.classList.add('active');
}

// Close game editor modal
function closeEditor() {
    const modal = document.getElementById('editorModal');
    modal.classList.remove('active');
    editingGameData = null;
}

// Render game editor
function renderEditor() {
    const container = document.getElementById('categoriesEditor');
    container.innerHTML = '';

    editingGameData.categories.forEach((category, catIndex) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-editor';

        let questionsHTML = editingGameData.questions[catIndex].map((q, qIndex) => `
                    <div class="question-item">
                        <div class="question-header">
                            <h4>Pregunta ${qIndex + 1}</h4>
                            <button onclick="removeQuestion(${catIndex}, ${qIndex})">Eliminar</button>
                        </div>
                        <label>Puntos:</label>
                        <input type="number" value="${q.value}" onchange="updateQuestion(${catIndex}, ${qIndex}, 'value', this.value)" min="0" step="100">
                        <label>Pregunta:</label>
                        <textarea onchange="updateQuestion(${catIndex}, ${qIndex}, 'question', this.value)">${q.question}</textarea>
                        <label>Respuesta:</label>
                        <textarea onchange="updateQuestion(${catIndex}, ${qIndex}, 'answer', this.value)">${q.answer}</textarea>
                    </div>
                `).join('');

        categoryDiv.innerHTML = `
                    <div class="category-header">
                        <input type="text" value="${category}" onchange="updateCategory(${catIndex}, this.value)" placeholder="Nombre de la categoría">
                        <button onclick="removeCategory(${catIndex})">Eliminar</button>
                    </div>
                    ${questionsHTML}
                    <button class="add-question-btn" onclick="addQuestion(${catIndex})">+ Agregar Pregunta</button>
                `;

        container.appendChild(categoryDiv);
    });
}

// Update category name
function updateCategory(catIndex, newName) {
    editingGameData.categories[catIndex] = newName;
}

// Update question details
function updateQuestion(catIndex, qIndex, field, value) {
    if (field === 'value') {
        editingGameData.questions[catIndex][qIndex][field] = parseInt(value) || 0;
    } else {
        editingGameData.questions[catIndex][qIndex][field] = value;
    }
}

// Add new category
function addCategory() {
    editingGameData.categories.push('Nueva Categoría');
    editingGameData.questions.push([
        { value: 100, question: 'Nueva pregunta', answer: 'Nueva respuesta' }
    ]);
    renderEditor();
}

// Remove category
function removeCategory(catIndex) {
    if (editingGameData.categories.length <= 1) {
        return Swal.fire({
            icon: 'info',
            title: 'No permitido',
            text: 'Debe haber al menos una categoría.'
        });
    }

    Swal.fire({
        icon: 'warning',
        title: `¿Eliminar la categoría "${editingGameData.categories[catIndex]}"?`,
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#c0392b'
    }).then(result => {
        if (result.isConfirmed) {
            editingGameData.categories.splice(catIndex, 1);
            editingGameData.questions.splice(catIndex, 1);

            persistGameData();   // 🔥 ESTE ERA EL FALTANTE

            renderEditor();
        }
    });
}

// Add new question to a category
function addQuestion(catIndex) {
    const lastQuestion = editingGameData.questions[catIndex][editingGameData.questions[catIndex].length - 1];
    const newValue = lastQuestion ? lastQuestion.value + 100 : 100;

    editingGameData.questions[catIndex].push({
        value: newValue,
        question: 'Nueva pregunta',
        answer: 'Nueva respuesta'
    });
    renderEditor();
}

// Remove question from a category
function removeQuestion(catIndex, qIndex) {
    if (editingGameData.questions[catIndex].length <= 1) {
        return Swal.fire({
            icon: 'info',
            title: 'No permitido',
            text: 'Debe haber al menos una pregunta por categoría.'
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
            editingGameData.questions[catIndex].splice(qIndex, 1);
            renderEditor();
        }
    });
}

function saveGame() {
    // Validación: no dejar categorías vacías
    if (!editingGameData || !Array.isArray(editingGameData.categories)) {
        alert('No hay datos para guardar.');
        return;
    }
    if (editingGameData.categories.some(cat => !cat || !cat.toString().trim())) {
        alert('Todas las categorías deben tener un nombre');
        return;
    }

    // Normalizar estructura: asegurar que questions exista y coincida en longitud con categories
    if (!Array.isArray(editingGameData.questions)) editingGameData.questions = [];
    const catCount = editingGameData.categories.length;
    for (let i = 0; i < catCount; i++) {
        if (!Array.isArray(editingGameData.questions[i])) {
            // crear una pregunta por defecto si falta la columna
            editingGameData.questions[i] = [
                { value: 100, question: 'Nueva pregunta', answer: 'Nueva respuesta' }
            ];
        }

        // Asegurar que cada pregunta tenga campos válidos
        editingGameData.questions[i] = editingGameData.questions[i].map(q => {
            const out = {};
            out.value = Number.isFinite(Number(q && q.value)) ? Number(q.value) : 100;
            out.question = (q && q.question) ? String(q.question) : 'Nueva pregunta';
            out.answer = (q && q.answer) ? String(q.answer) : 'Nueva respuesta';
            return out;
        });
    }

    // Asignar, persistir y re-renderizar
    gameData = JSON.parse(JSON.stringify(editingGameData));
    try {
        const key = (typeof STORAGE_KEY !== 'undefined') ? STORAGE_KEY : 'jeopardyData';
        localStorage.setItem(key, JSON.stringify(gameData));
    } catch (err) {
        console.error('Error guardando en localStorage:', err);
        alert('No se pudo guardar localmente (localStorage). Revisa permisos o espacio.');
    }

    usedCells.clear();
    if (typeof renderBoard === 'function') renderBoard();
    if (typeof renderScoreboard === 'function') renderScoreboard();

    const editorModal = document.getElementById('editorModal');
    if (editorModal) editorModal.classList.remove('active');

    editingGameData = null;
    Swal.fire({
        icon: 'success',
        title: 'Juego guardado',
        text: 'Los cambios se guardaron correctamente.',
        confirmButtonColor: '#27ae60'
    });
}

// Cerrar modal al hacer clic fuera
document.getElementById('modal').onclick = function (e) {
    if (e.target === this) {
        closeModal();
    }
};

// Inicializar el juego
initGame();
