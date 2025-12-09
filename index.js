/* ================================
   VARIABLES GLOBALES
================================ */

let roundsData = {
    individual: { categories: [], questions: [], name: "Ronda Individual" },
    grupal: { categories: [], questions: [], name: "Ronda Grupal" }
};
let activeRound = 'individual';
let currentMode = 'game';

let teams = [];
let players = [];
let usedCells = new Set();
let editingGameData = null;
const TYPING_SPEED = 30;

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
    const saved = localStorage.getItem("jeopardyRoundsData");
    if (saved) {
        roundsData = JSON.parse(saved);
        if (!roundsData.individual) roundsData.individual = { categories: [], questions: [], name: "Ronda Individual" };
        if (!roundsData.grupal) roundsData.grupal = { categories: [], questions: [], name: "Ronda Grupal" };
    } else {
        roundsData = {
            individual: { categories: [], questions: [], name: "Ronda Individual" },
            grupal: { categories: [], questions: [], name: "Ronda Grupal" }
        };
    }
}

function saveGameDataUsed() {
    localStorage.setItem("jeopardyRoundsData", JSON.stringify(roundsData));
}

function persistGameData() {
    roundsData[activeRound] = JSON.parse(JSON.stringify(editingGameData));
    localStorage.setItem("jeopardyRoundsData", JSON.stringify(roundsData));
}

/* ================================
   INICIALIZACIÓN Y CAMBIO DE MODO
================================ */

function initGame() {
    loadGameData();
    loadPlayers();
    loadTeams();
    setMode('game');
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("mainActionsBtn");
    const menu = document.getElementById("mainActionsMenu");
    if (btn && menu) {
        btn.onclick = () => menu.classList.toggle("open");
        document.addEventListener("click", (e) => {
            const dropdown = document.getElementById("actionsDropdown");
            if (dropdown && !dropdown.contains(e.target)) {
                menu.classList.remove("open");
            }
        });
    }
    initGame();
});

function setMode(mode) {
    currentMode = mode;
    document.getElementById('gameModeContainer').style.display = (mode === 'game' ? 'block' : 'none');
    document.getElementById('editModeContainer').style.display = (mode === 'edit' ? 'block' : 'none');

    // 👇 Modificación clave aquí 👇
    const actionsDropdown = document.getElementById('actionsDropdown');
    if (actionsDropdown) {
        actionsDropdown.style.display = (mode === 'edit' ? 'flex' : 'none');
    }
    // 👆 Fin de modificación 👆

    document.getElementById('modeGameBtn').classList.toggle('active', mode === 'game');
    document.getElementById('modeEditBtn').classList.toggle('active', mode === 'edit');

    if (mode === 'game') {
        renderScoreboard();
        renderBoard();
        closeEditor();
    } else {
        renderTabs();
    }
}

/* ================================
   PESTAÑAS DE RONDAS (AHORA DENTRO DEL CONTENEDOR DE EDICIÓN)
================================ */

function renderTabs() {
    const tabsContainer = document.getElementById('tabsContainer');
    if (!tabsContainer || currentMode !== 'edit') return;

    tabsContainer.innerHTML = '';

    Object.keys(roundsData).forEach(key => {
        const round = roundsData[key];
        const button = document.createElement('button');
        button.className = `tab-btn ${key === activeRound ? 'active' : ''}`;
        button.textContent = round.name;

        button.onclick = () => {
            switchRound(key);
            if (document.getElementById('editorModal').classList.contains('active')) {
                openEditor();
            }
        };
        tabsContainer.appendChild(button);
    });
}

function switchRound(roundKey) {
    if (activeRound === roundKey) return;
    activeRound = roundKey;
    usedCells.clear();

    if (!roundsData[roundKey] || !roundsData[roundKey].categories) {
        roundsData[roundKey] = { categories: [], questions: [], name: roundsData[roundKey] ? roundsData[roundKey].name : (roundKey === 'individual' ? "Ronda Individual" : "Ronda Grupal") };
        saveGameDataUsed();
    }

    if (currentMode === 'game') {
        renderBoard();
    }

    if (currentMode === 'edit') {
        renderTabs();
    }
}

/* ================================
   TABLERO PRINCIPAL (Solo se renderiza si es el modo activo)
================================ */

function getCurrentRoundData() {
    return roundsData[activeRound];
}

function renderBoard() {
    if (currentMode !== 'game') return;

    const board = document.getElementById("board");
    board.innerHTML = "";
    const currentData = getCurrentRoundData();
    if (!currentData.categories.length) {
        board.innerHTML = "<p class='empty'>No hay categorías creadas aún para esta ronda.</p>";
        return;
    }

    currentData.categories.forEach((cat, colIndex) => {
        const column = document.createElement("div");
        column.className = "column";

        const header = document.createElement("div");
        header.className = "category";
        header.textContent = cat;
        column.appendChild(header);

        const questions = currentData.questions[colIndex] || [];
        questions.forEach((q, rowIndex) => {
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
   SCOREBOARD (Solo se renderiza si es el modo activo)
================================ */

function renderScoreboard() {
    const scoreboard = document.getElementById('scoreboard');

    if (currentMode !== 'game') {
        scoreboard.innerHTML = '';
        return;
    }

    scoreboard.innerHTML = '';
    let currentScorables;
    let isTeamMode = false;

    if (activeRound === 'individual') {
        currentScorables = players;
        isTeamMode = false;

        if (!currentScorables.length) {
            scoreboard.innerHTML = "<p class='empty'>No hay jugadores individuales aún. ¡Ve a Acciones para agregar!</p>";
            return;
        }

    } else if (activeRound === 'grupal') {
        currentScorables = teams;
        isTeamMode = true;

        if (!currentScorables.length) {
            scoreboard.innerHTML = "<p class='empty'>Modo Grupal: No hay equipos aún. ¡Ve a Acciones y crea un equipo!</p>";
            return;
        }
    }

    currentScorables.forEach((scorable, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.style.border = `3px solid ${scorable.color}`;

        let controlsHtml;
        let detailsHtml = '';
        let editAction;
        let removeAction;

        if (isTeamMode) {
            detailsHtml = `<p class="team-members">Miembros: ${scorable.members.join(', ')}</p>`;
            editAction = `editTeam(${index})`;
            removeAction = `removeTeam(${index})`;
        } else {
            editAction = `editPlayerName(${index})`;
            removeAction = `removePlayer(${index})`;
        }

        playerCard.innerHTML = `
            <h3>${scorable.name}</h3>
            ${detailsHtml}
            <div class="score">$${scorable.score}</div>
            <div class="controls">
                <button onclick="${editAction}">Editar</button>
                <button onclick="${removeAction}" style="background: var(--danger-red); color: white;">Eliminar</button>
            </div>
        `;
        scoreboard.appendChild(playerCard);
    });
}

/* ================================
   DROPDOWN PRINCIPAL (Añadido el cambio de modo al dropdown)
================================ */

function toggleDropdown() {
    document.getElementById("mainActionsMenu").classList.toggle("open");
}
document.addEventListener("click", function (e) {
    const dropdown = document.getElementById("actionsDropdown");
    const menu = document.getElementById("mainActionsMenu");
    if (dropdown && menu && !dropdown.contains(e.target)) {
        menu.classList.remove("open");
    }
});

/* ================================
   EFECTO VISUAL NOVEL
================================ */

function typeWriterEffect(element, text, mediaHTML = '') {
    element.innerHTML = '';
    let i = 0;

    const interval = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            element.parentElement.scrollTop = element.parentElement.scrollHeight;
        } else {
            clearInterval(interval);
            if (mediaHTML) {
                element.innerHTML += mediaHTML;
            }
        }
    }, TYPING_SPEED);

    return interval;
}

/* ================================
   MODAL DE PREGUNTAS
================================ */

let currentTypingInterval = null;

function openQuestion(col, row) {
    const currentData = getCurrentRoundData();
    const cellId = `${col}-${row}`;

    if (currentData.questions[col][row].used) return;

    const questionData = currentData.questions[col][row];

    document.getElementById('categoryTitle').textContent = currentData.categories[col];
    document.getElementById('pointValue').textContent = `$${questionData.value}`;

    const qContent = document.getElementById('questionText');
    qContent.innerHTML = '';

    if (currentTypingInterval) {
        clearInterval(currentTypingInterval);
    }

    let mediaHTML = '';
    if (questionData.media) {
        let mediaElement;
        if (questionData.media.type === "image") {
            mediaElement = `<img class="spoiler-content-media" src="${questionData.media.url}" style="max-width:300px;">`;
        } else if (questionData.media.type === "video") {
            mediaElement = `<video class="spoiler-content-media" src="${questionData.media.url}" controls style="max-width:320px;"></video>`;
        } else if (questionData.media.type === "audio") {
            mediaElement = `<audio class="spoiler-content-media" src="${questionData.media.url}" controls style="max-width:200px;"></audio>`;
        }

        if (questionData.media.type === "image" || questionData.media.type === "audio") {
            mediaHTML = `
                <div class="spoiler-container" onclick="this.classList.add('revealed')">
                    <span class="spoiler-label">Click para revelar</span>
                    <div class="spoiler-content">${mediaElement}</div>
                </div>`;
        } else {
            mediaHTML = `<br>${mediaElement}`;
        }
    }

    currentTypingInterval = typeWriterEffect(qContent, questionData.question || "(Sin texto)", mediaHTML);
    document.getElementById('answerText').textContent = `Respuesta: ${questionData.answer}`;
    document.getElementById('answerText').classList.remove('show');
    document.getElementById('modal').classList.add('active');

    const playersArea = document.getElementById("playersArea");
    let currentScorables;
    let updateFunction;

    if (activeRound === 'individual') {
        currentScorables = players;
        updateFunction = 'awardPoints';
    } else {
        currentScorables = teams;
        updateFunction = 'awardTeamPoints';
    }

    if (!currentScorables.length) {
        playersArea.innerHTML = `<p style="color:var(--danger-red);">¡No hay ${activeRound === 'individual' ? 'jugadores' : 'equipos'} para asignar puntos!</p>`;
    } else {
        playersArea.innerHTML = currentScorables.map((scorable, index) => `
        <div class="player-btn-group">
            <button
                class="player-add"
                style="background:${scorable.color}; color:white;"
                onclick="${updateFunction}(${index}, ${questionData.value}, ${col}, ${row})"
            >
                ${scorable.name} +${questionData.value}
            </button>
            <button
                class="player-deduct"
                style="background:var(--danger-red); color: white;"
                onclick="${updateFunction.replace('award', 'deduct')}(${index}, ${questionData.value})"
            >
                ${scorable.name} -${questionData.value}
            </button>
        </div>
    `).join("");
    }
}

function awardTeamPoints(teamIndex, points, col, row) {
    teams[teamIndex].score += points;

    const currentData = getCurrentRoundData();
    currentData.questions[col][row].used = true;

    renderScoreboard();
    saveTeams();
    saveGameDataUsed();
    renderBoard();
    closeModal();
}

function deductTeamPoints(teamIndex, points) {
    Swal.fire({
        icon: 'question',
        title: '¿Restar puntos?',
        text: `¿Quitar $${points} a ${teams[teamIndex].name}?`,
        showCancelButton: true,
        confirmButtonText: 'Restar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#c0392b'
    }).then(result => {
        if (result.isConfirmed) {
            teams[teamIndex].score -= points;
            saveTeams();
            renderScoreboard();
            Swal.fire({
                icon: 'success',
                title: 'Puntos restados',
                text: `${teams[teamIndex].name} perdió $${points}.`,
                confirmButtonColor: '#27ae60'
            });
        }
    });
}

function showAnswer() {
    document.getElementById('answerText').classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
    if (currentTypingInterval) {
        clearInterval(currentTypingInterval);
        currentTypingInterval = null;
    }
}

document.getElementById('modal').onclick = function (e) {
    if (e.target === this) closeModal();
};

/* ================================
   ASIGNACIÓN Y DEDUCCIÓN DE PUNTOS
================================ */
function awardPoints(playerIndex, points, col, row) {
    players[playerIndex].score += points;
    const currentData = getCurrentRoundData();
    currentData.questions[col][row].used = true;

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
   GESTIÓN DE EQUIPOS (Modo Grupal)
================================ */

function saveTeams() {
    localStorage.setItem("jeopardyTeams", JSON.stringify(teams));
}

function loadTeams() {
    const saved = localStorage.getItem("jeopardyTeams");
    teams = saved ? JSON.parse(saved) : [];
}

function openTeamCreator() {
    if (players.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'No hay jugadores',
            text: 'Necesitas agregar jugadores individuales primero para formar equipos.',
            confirmButtonColor: '#5865f2'
        });
    }

    const availablePlayers = players.filter(p => !teams.some(t => t.members.includes(p.name)));
    if (availablePlayers.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'Todos los jugadores asignados',
            text: 'Todos los jugadores individuales ya están en un equipo.',
            confirmButtonColor: '#5865f2'
        });
    }

    const playersHtml = availablePlayers.map(p => `
        <label class="player-selection-item" style="--player-color: ${p.color};">
            <input type="checkbox" name="teamMember" value="${p.name}" class="hidden-checkbox">
            <span class="player-badge">
                ${p.name}
            </span>
        </label>
    `).join('');

    Swal.fire({
        title: "Crear Nuevo Equipo",
        html: `
            <input id="teamName" class="swal2-input" placeholder="Nombre del Equipo (e.g., Los Vengadores)">
            <input id="teamColor" type="color" value="${generateColor()}" style="width: 100%; height: 50px; border-radius: 8px; cursor: pointer; margin-top:10px;">
            <div style="text-align: left; margin-top: 15px; border-top: 1px solid #36393f; padding-top: 10px;">
                <strong>Selecciona miembros:</strong>
                <div id="availablePlayersList" style="max-height: 200px; overflow-y: auto;">
                    ${playersHtml}
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Crear Equipo",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#5865f2",
        preConfirm: () => {
            const name = document.getElementById("teamName").value.trim();
            const color = document.getElementById("teamColor").value;
            const selectedMembers = Array.from(document.querySelectorAll('input[name="teamMember"]:checked')).map(el => el.value);

            if (!name) {
                Swal.showValidationMessage("El equipo necesita un nombre.");
                return false;
            }
            if (selectedMembers.length < 1) {
                Swal.showValidationMessage("Selecciona al menos un jugador para el equipo.");
                return false;
            }

            return { name, color, members: selectedMembers };
        }
    }).then(result => {
        if (result.isConfirmed) {
            teams.push({
                name: result.value.name,
                score: 0,
                color: result.value.color,
                members: result.value.members
            });
            saveTeams();
            if (activeRound === 'grupal') {
                renderScoreboard();
            }

            Swal.fire({
                icon: "success",
                title: "Equipo Creado",
                text: `${result.value.name} está listo para el Modo Grupal.`,
                confirmButtonColor: "#57f287"
            });
        }
    });
}

function editTeam(index) {
    Swal.fire({
        icon: 'info',
        title: 'Funcionalidad de Edición',
        text: 'La edición de equipos (miembros, nombre, color) se implementará aquí.',
        confirmButtonColor: '#5865f2'
    });
}

function removeTeam(index) {
    Swal.fire({
        icon: 'question',
        title: `¿Eliminar al equipo ${teams[index].name}?`,
        text: 'Los jugadores individuales permanecerán, pero el equipo se disolverá.',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e74c3c'
    }).then(result => {
        if (result.isConfirmed) {
            teams.splice(index, 1);
            saveTeams();
            if (activeRound === 'grupal') {
                renderScoreboard();
            }
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
        text: 'Esto hará que todas las preguntas de la ronda actual vuelvan a estar disponibles.',
        showCancelButton: true,
        confirmButtonText: 'Reiniciar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#c0392b'
    }).then(result => {
        if (result.isConfirmed) {
            const currentData = getCurrentRoundData();
            currentData.questions.forEach(col =>
                col.forEach(q => q.used = false)
            );
            usedCells.clear();
            saveGameDataUsed();
            renderBoard();
            Swal.fire({
                icon: 'success',
                title: 'Preguntas reiniciadas',
                text: 'Todas las preguntas de la ronda actual están disponibles nuevamente.',
                confirmButtonColor: '#27ae60'
            });
        }
    });
}
/* ================================
   EDITOR DE CATEGORÍAS Y PREGUNTAS
================================ */

function openEditor() {
    editingGameData = JSON.parse(JSON.stringify(roundsData[activeRound]));
    document.getElementById('editorTitle').textContent = `Editor de: ${roundsData[activeRound].name}`;
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

    if (!editingGameData || !editingGameData.categories) editingGameData = { categories: [], questions: [] };

    editingGameData.categories.forEach((category, catIndex) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-editor';

        const questions = editingGameData.questions[catIndex] || [];

        const questionsHTML = questions.map((q, qIndex) => `
            <div class="question-item">
                <div class="question-header">
                    <h4>Pregunta ${qIndex + 1}</h4>
                    <button class="btn-danger" onclick="removeQuestion(${catIndex}, ${qIndex})">Eliminar</button>
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
                    <label>Multimedia (Imagen/Audio/Video):</label>
                    <input type="file" accept="image/*,video/*,audio/*" onchange="handleMediaUpload(event, ${catIndex}, ${qIndex})">
                    ${q.media ? `
                        <div class="media-preview">
                            ${q.media.type === 'image'
                    ? `<img src="${q.media.url}" style="max-width:120px;">`
                    : q.media.type === 'audio'
                        ? `<audio src="${q.media.url}" controls style="max-width:150px;"></audio>`
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
            renderEditor();
        }
    });
}

function addQuestion(catIndex) {
    if (!editingGameData.questions[catIndex]) {
        editingGameData.questions[catIndex] = [];
    }

    const questions = editingGameData.questions[catIndex];
    const last = questions.length > 0 ? questions.slice(-1)[0] : null;

    questions.push({
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

    let dataToSave = JSON.parse(JSON.stringify(editingGameData));
    dataToSave.questions = dataToSave.questions.map(col =>
        col.map(q => ({
            value: Number(q.value) || 100,
            question: q.question || "",
            answer: q.answer || "",
            media: q.media ? { ...q.media } : null
        }))
    );

    let saveSuccessful = false;
    let hadLargeMedia = false;

    try {
        roundsData[activeRound] = dataToSave;
        localStorage.setItem("jeopardyRoundsData", JSON.stringify(roundsData));
        saveSuccessful = true;
    } catch (err) {
        console.error('Error al guardar con multimedia. Intentando sin multimedia.', err);
        hadLargeMedia = true;

        roundsData[activeRound].questions.forEach(col => {
            col.forEach(q => {
                if (q.media) {
                    q.media = null;
                }
            });
        });

        try {
            localStorage.setItem("jeopardyRoundsData", JSON.stringify(roundsData));
            saveSuccessful = true;
        } catch (finalErr) {
            console.error('Fallo final al guardar.', finalErr);
            Swal.fire({
                icon: 'error',
                title: 'Error Crítico de Guardado',
                text: 'No se pudo guardar el juego ni siquiera sin multimedia. Tu LocalStorage está lleno.',
                confirmButtonColor: '#e74c3c'
            });
            return;
        }
    }

    if (saveSuccessful) {
        loadGameData();

        usedCells.clear();
        renderBoard();
        renderScoreboard();

        document.getElementById('editorModal').classList.remove('active');
        editingGameData = null;

        if (hadLargeMedia) {
            Swal.fire({
                icon: 'warning',
                title: 'Juego Guardado, ¡pero con advertencia!',
                html: `El juego se guardó correctamente, pero algunas imágenes/videos eran demasiado grandes. Tuvimos que **quitar la multimedia pesada** de esta ronda para evitar que **localStorage** colapse.
                <br><br><strong>Solución:</strong> Debes usar archivos multimedia más pequeños o usar la URL pública.`,
                confirmButtonColor: '#f39c12'
            });
        } else {
            Swal.fire({
                icon: 'success',
                title: 'Juego guardado',
                text: 'Los cambios se guardaron correctamente.',
                confirmButtonColor: '#27ae60'
            });
        }
    }
}

/* ================================
   MULTIMEDIA EN EL EDITOR
================================ */

function handleMediaUpload(event, catIndex, qIndex) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        Swal.fire({
            icon: 'warning',
            title: 'Archivo grande',
            text: `El archivo es grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Esto podría causar problemas de guardado persistente.`,
            confirmButtonColor: '#f39c12'
        });
    }

    const reader = new FileReader();
    reader.onload = () => {
        let type;
        if (file.type.startsWith("video")) {
            type = "video";
        } else if (file.type.startsWith("audio")) {
            type = "audio";
        } else {
            type = "image";
        }

        editingGameData.questions[catIndex][qIndex].media = {
            type: type,
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
