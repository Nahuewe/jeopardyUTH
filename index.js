/* ================================
   VARIABLES GLOBALES
================================ */
let gameData = { categories: [], questions: [] };
let players = [];
let usedCells = new Set();
let editingGameData = null;

/* ================================
   LOCAL STORAGE
================================ */
function savePlayers() {
    localStorage.setItem("jeopardyPlayers", JSON.stringify(players));
}

function loadPlayers() {
    const saved = localStorage.getItem("jeopardyPlayers");
    players = saved ? JSON.parse(saved) : [];

    players.forEach(p => {
        if (!p.color) p.color = generateColor();
    });
}

function loadGameData() {
    const saved = localStorage.getItem("jeopardyData");
    gameData = saved ? JSON.parse(saved) : { categories: [], questions: [] };
}

function saveGameDataUsed() {
    localStorage.setItem("jeopardyData", JSON.stringify(gameData));
}

function persistGameData() {
    localStorage.setItem("jeopardyData", JSON.stringify(editingGameData));
}

/* ================================
   INICIALIZACIÓN
================================ */
function initGame() {
    loadGameData();
    loadPlayers();
    renderBoard();
    renderScoreboard();
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("mainActionsBtn");
    const menu = document.getElementById("mainActionsMenu");

    btn.onclick = () => menu.classList.toggle("hidden");

    document.addEventListener("click", (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add("hidden");
        }
    });
});

initGame();

/* ================================
   TABLERO PRINCIPAL
================================ */
function renderBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";

    if (!gameData.categories.length) {
        board.innerHTML = "<p class='empty'>No hay categorías creadas aún.</p>";
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

/* ================================
   SCOREBOARD (Jugadores)
================================ */
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

        playerCard.style.borderLeft = `6px solid ${player.color}`;
        playerCard.style.background = `${player.color}15`; // suave

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

/* ================================
   MODAL DE PREGUNTAS
================================ */
function openQuestion(col, row) {
    const cellId = `${col}-${row}`;
    if (usedCells.has(cellId)) return;
    if (gameData.questions[col][row].used) return;

    const question = gameData.questions[col][row];

    document.getElementById('categoryTitle').textContent = gameData.categories[col];
    document.getElementById('pointValue').textContent = `$${question.value}`;

    const qContent = document.getElementById('questionText');
    qContent.innerHTML = question.question || "(Sin texto)";

    if (question.media) {
        qContent.innerHTML += question.media.type === "image"
            ? `<br><img src="${question.media.url}" style="max-width:300px;">`
            : `<br><video src="${question.media.url}" controls style="max-width:320px;"></video>`;
    }

    document.getElementById('answerText').textContent = `Respuesta: ${question.answer}`;
    document.getElementById('answerText').classList.remove('show');
    document.getElementById('modal').classList.add('active');

    const playersArea = document.getElementById("playersArea");
    playersArea.innerHTML = players.map((player, index) => `
    <div class="player-btn-group">

        <!-- SUMAR (usa el color del jugador) -->
        <button
            class="player-add"
            style="background:${player.color}; color:white;"
            onclick="awardPoints(${index}, ${question.value}, '${cellId}')"
        >
            ${player.name} +${question.value}
        </button>

        <!-- RESTAR (SIEMPRE ROJO) -->
        <button
            class="player-deduct"
            style="background:#f55c5c; color: white;"
            onclick="deductPoints(${index}, ${question.value})"
        >
            ${player.name} -${question.value}
        </button>

    </div>
`).join("");
}

function showAnswer() {
    document.getElementById('answerText').classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

document.getElementById('modal').onclick = function (e) {
    if (e.target === this) closeModal();
};

/* ================================
   ASIGNACIÓN Y DEDUCCIÓN DE PUNTOS
================================ */
function awardPoints(playerIndex, points, cellId) {
    players[playerIndex].score += points;
    const [col, row] = cellId.split("-").map(Number);

    gameData.questions[col][row].used = true;
    usedCells.add(cellId);

    renderScoreboard();
    savePlayers();
    saveGameDataUsed();
    renderBoard();
    closeModal();
}

function deductPoints(playerIndex, points) {
    Swal.fire({
        icon: 'question',
        title: '¿Restar puntos?',
        text: `¿Quitar $${points} a ${players[playerIndex].name}?`,
        showCancelButton: true,
        confirmButtonText: 'Restar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#c0392b'
    }).then(result => {
        if (result.isConfirmed) {
            players[playerIndex].score -= points;
            if (players[playerIndex].score < 0) players[playerIndex].score = 0;

            savePlayers();
            renderScoreboard();

            Swal.fire({
                icon: 'success',
                title: 'Puntos restados',
                text: `${players[playerIndex].name} perdió $${points}.`,
                confirmButtonColor: '#27ae60'
            });
        }
    });
}

/* ================================
   GESTIÓN DE JUGADORES
================================ */
function generateColor() {
    const colors = ["#ff7675", "#74b9ff", "#55efc4", "#ffeaa7", "#a29bfe", "#fab1a0", "#81ecec", "#fd79a8"];
    return colors[Math.floor(Math.random() * colors.length)];
}

function addPlayer() {
    Swal.fire({
        title: "Nuevo jugador",
        html: `
            <input id="playerName" class="swal2-input" placeholder="Nombre del jugador">
            <input id="playerColor" type="color" value="#3498db"
                style="width: 100%; height: 50px; border-radius: 8px; cursor: pointer; margin-top:5px;">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Agregar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#27ae60",
        preConfirm: () => {
            const name = document.getElementById("playerName").value.trim();
            const color = document.getElementById("playerColor").value;

            if (!name) {
                Swal.showValidationMessage("Poné un nombre válido, wachín.");
                return false;
            }

            return { name, color };
        }
    }).then(result => {
        if (result.isConfirmed) {
            players.push({
                name: result.value.name,
                score: 0,
                color: result.value.color
            });

            savePlayers();
            renderScoreboard();

            Swal.fire({
                icon: "success",
                title: "Jugador agregado",
                text: `${result.value.name} ya está listo.`,
                confirmButtonColor: "#3498db"
            });
        }
    });
}

function editPlayerName(index) {
    Swal.fire({
        title: "Editar jugador",
        html: `
            <input id="editName" class="swal2-input" placeholder="Nombre"
                   value="${players[index].name}">

            <label style="margin-top:10px; font-weight:bold;">Color:</label>
            <input id="editColor" type="color" value="${players[index].color}"
                style="width: 100%; height: 50px; border-radius: 8px; cursor: pointer; margin-top:5px;">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Guardar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#27ae60",
        preConfirm: () => {
            const name = document.getElementById("editName").value.trim();
            const color = document.getElementById("editColor").value;

            if (!name) {
                Swal.showValidationMessage("El nombre no puede estar vacío.");
                return false;
            }

            return { name, color };
        }
    }).then(result => {
        if (result.isConfirmed) {
            players[index].name = result.value.name;
            players[index].color = result.value.color;

            savePlayers();
            renderScoreboard();

            Swal.fire({
                icon: "success",
                title: "Jugador editado",
                text: "Los cambios fueron aplicados correctamente.",
                confirmButtonColor: "#3498db"
            });
        }
    });
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

/* ================================
   REINICIOS
================================ */
function resetScores() {
    Swal.fire({
        icon: 'warning',
        title: '¿Reiniciar puntos?',
        text: 'Todos los jugadores volverán a 0.',
        showCancelButton: true,
        confirmButtonText: 'Reiniciar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e67e22'
    }).then(result => {
        if (result.isConfirmed) {
            players.forEach(p => p.score = 0);
            savePlayers();
            renderScoreboard();
            Swal.fire({
                icon: 'success',
                title: 'Listo',
                text: 'Los puntos se reiniciaron.',
                confirmButtonColor: '#27ae60'
            });
        }
    });
}

function resetQuestions() {
    Swal.fire({
        icon: 'warning',
        title: '¿Reiniciar preguntas?',
        text: 'Esto hará que todas las preguntas vuelvan a estar disponibles.',
        showCancelButton: true,
        confirmButtonText: 'Reiniciar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#c0392b'
    }).then(result => {
        if (result.isConfirmed) {
            gameData.questions.forEach(col =>
                col.forEach(q => q.used = false)
            );

            usedCells.clear();
            saveGameDataUsed();
            renderBoard();

            Swal.fire({
                icon: 'success',
                title: 'Preguntas reiniciadas',
                text: 'Todas las preguntas están disponibles nuevamente.',
                confirmButtonColor: '#27ae60'
            });
        }
    });
}

/* ================================
   EDITOR DE CATEGORÍAS Y PREGUNTAS
================================ */
function openEditor() {
    editingGameData = JSON.parse(JSON.stringify(gameData));
    renderEditor();
    document.getElementById('editorModal').classList.add('active');
}

function closeEditor() {
    document.getElementById('editorModal').classList.remove('active');
    editingGameData = null;
}

function renderEditor() {
    const container = document.getElementById('categoriesEditor');
    container.innerHTML = '';

    editingGameData.categories.forEach((category, catIndex) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-editor';

        const questionsHTML = editingGameData.questions[catIndex].map((q, qIndex) => `
            <div class="question-item">
                <div class="question-header">
                    <h4>Pregunta ${qIndex + 1}</h4>
                    <button onclick="removeQuestion(${catIndex}, ${qIndex})">Eliminar</button>
                </div>

                <label>Puntos:</label>
                <input type="number" value="${q.value}"
                    onchange="updateQuestion(${catIndex}, ${qIndex}, 'value', this.value)"
                    min="0" step="100">

                <label>Pregunta:</label>
                <textarea onchange="updateQuestion(${catIndex}, ${qIndex}, 'question', this.value)">${q.question || ''}</textarea>

                <label>Respuesta:</label>
                <textarea onchange="updateQuestion(${catIndex}, ${qIndex}, 'answer', this.value)">${q.answer || ''}</textarea>

                <div class="media-section">
                    <label>Imagen / Video:</label>
                    <input type="file" accept="image/*,video/*" onchange="handleMediaUpload(event, ${catIndex}, ${qIndex})">

                    ${q.media ? `
                        <div class="media-preview">
                            ${q.media.type === 'image'
                    ? `<img src="${q.media.url}" style="max-width:120px;">`
                    : `<video src="${q.media.url}" controls style="max-width:150px;"></video>`
                }
                            <button onclick="removeMedia(${catIndex}, ${qIndex})">Quitar</button>
                        </div>` : ''
            }
                </div>
            </div>
        `).join('');

        categoryDiv.innerHTML = `
            <div class="category-header">
                <input type="text" value="${category}" onchange="updateCategory(${catIndex}, this.value)">
                <button onclick="removeCategory(${catIndex})">Eliminar</button>
            </div>
            ${questionsHTML}
            <button class="add-question-btn" onclick="addQuestion(${catIndex})">+ Agregar Pregunta</button>
        `;

        container.appendChild(categoryDiv);
    });
}

/* ================================
   MODIFICACIONES EN EL EDITOR
================================ */
function updateCategory(catIndex, newName) {
    editingGameData.categories[catIndex] = newName;
}

function updateQuestion(catIndex, qIndex, field, value) {
    editingGameData.questions[catIndex][qIndex][field] =
        field === 'value' ? parseInt(value) || 0 : value;
}

function addCategory() {
    editingGameData.categories.push('Nueva Categoría');
    editingGameData.questions.push([{ value: 100, question: '', answer: '', media: null }]);
    renderEditor();
}

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
            persistGameData();
            renderEditor();
        }
    });
}

function addQuestion(catIndex) {
    const last = editingGameData.questions[catIndex].slice(-1)[0];
    editingGameData.questions[catIndex].push({
        value: last ? last.value + 100 : 100,
        question: '',
        answer: '',
        media: null
    });
    renderEditor();
}

function removeQuestion(catIndex, qIndex) {
    if (editingGameData.questions[catIndex].length <= 1) {
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
            editingGameData.questions[catIndex].splice(qIndex, 1);
            renderEditor();
        }
    });
}

/* ================================
   GUARDAR JUEGO COMPLETO
================================ */
function saveGame() {
    if (!editingGameData || !editingGameData.categories.length) {
        alert('No hay datos para guardar.');
        return;
    }

    if (editingGameData.categories.some(cat => !cat.trim())) {
        alert('Todas las categorías deben tener un nombre');
        return;
    }

    editingGameData.questions = editingGameData.questions.map(col =>
        col.map(q => ({
            value: Number(q.value) || 100,
            question: q.question || "",
            answer: q.answer || "",
            media: q.media ? { ...q.media } : null
        }))
    );

    gameData = JSON.parse(JSON.stringify(editingGameData));

    try {
        localStorage.setItem("jeopardyData", JSON.stringify(gameData));
    } catch (err) {
        console.error('Error guardando en localStorage:', err);
        alert('No se pudo guardar localmente.');
    }

    usedCells.clear();
    renderBoard();
    renderScoreboard();

    document.getElementById('editorModal').classList.remove('active');
    editingGameData = null;

    Swal.fire({
        icon: 'success',
        title: 'Juego guardado',
        text: 'Los cambios se guardaron correctamente.',
        confirmButtonColor: '#27ae60'
    });
}

/* ================================
   MULTIMEDIA EN EL EDITOR
================================ */
function handleMediaUpload(event, catIndex, qIndex) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        editingGameData.questions[catIndex][qIndex].media = {
            type: file.type.startsWith("video") ? "video" : "image",
            url: reader.result
        };
        renderEditor();
    };

    reader.readAsDataURL(file);
}

function removeMedia(catIndex, qIndex) {
    editingGameData.questions[catIndex][qIndex].media = null;
    renderEditor();
}

/* ================================
   DROPDOWN PRINCIPAL
================================ */
function toggleDropdown() {
    document.getElementById("dropdownMenu").classList.toggle("open");
}

document.addEventListener("click", function (e) {
    const dropdown = document.getElementById("actionsDropdown");
    const menu = document.getElementById("dropdownMenu");

    if (!dropdown.contains(e.target)) {
        menu.classList.remove("open");
    }
});
