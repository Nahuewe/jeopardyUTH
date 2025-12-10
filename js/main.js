/* ================================
   MAIN APPLICATION
   Punto de entrada e inicialización
================================ */

import { GameState } from './gameState.js';
import { Storage } from './storage.js';
import { Board } from './board.js';
import { Scoreboard } from './scoreboard.js';
import { QuestionModal } from './questionModal.js';
import { PointsManager } from './pointsManager.js';
import { PlayerManager } from './playerManager.js';
import { TeamManager } from './teamManager.js';
import { Editor } from './editor.js';
import { Utils } from './utils.js';

class JeopardyGame {
    constructor() {
        this.state = new GameState();
        this.initializeComponents();
        this.setupGlobalReferences();
    }

    initializeComponents() {
        // Orden de inicialización es importante debido a dependencias
        this.board = new Board(this.state, null); // QuestionModal se asigna después
        this.scoreboard = new Scoreboard(this.state, null, null); // Managers se asignan después
        this.pointsManager = new PointsManager(this.state, this.board, this.scoreboard);
        this.questionModal = new QuestionModal(this.state, this.pointsManager);
        this.playerManager = new PlayerManager(this.state, this.scoreboard);
        this.teamManager = new TeamManager(this.state, this.scoreboard);
        this.editor = new Editor(this.state, this.board);

        // Asignar referencias faltantes
        this.board.questionModal = this.questionModal;
        this.scoreboard.playerManager = this.playerManager;
        this.scoreboard.teamManager = this.teamManager;
    }

    setupGlobalReferences() {
        // Exponer el juego globalmente para que los event handlers en HTML puedan acceder
        window.game = this;
    }

    async initialize() {
        await this.loadData();
        this.setupEventListeners();
        this.setMode('game');
    }

    async loadData() {
        // Cargar datos del juego
        const savedRoundsData = await Storage.loadGameData();
        if (savedRoundsData) {
            this.state.roundsData = savedRoundsData;

            // Asegurar estructura correcta
            if (!this.state.roundsData.individual) {
                this.state.roundsData.individual = {
                    categories: [],
                    questions: [],
                    name: "Ronda Individual",
                    finalQuestion: null
                };
            }

            if (!this.state.roundsData.grupal) {
                this.state.roundsData.grupal = {
                    categories: [],
                    questions: [],
                    name: "Ronda Grupal",
                    finalQuestion: null
                };
            }
        }

        // Cargar jugadores
        this.state.players = Storage.loadPlayers();
        this.state.players.forEach(player => {
            if (!player.color) player.color = Utils.generateColor();
        });

        // Cargar equipos
        this.state.teams = Storage.loadTeams();
    }

setupEventListeners() {
    // Botones de modo
    document.getElementById('modeGameBtn').onclick = () => this.setMode('game');
    document.getElementById('modeEditBtn').onclick = () => this.setMode('edit');

    // Menú desplegable
    const mainBtn = document.getElementById("mainActionsBtn");
    const menu = document.getElementById("mainActionsMenu");

    if (mainBtn && menu) {
        mainBtn.onclick = () => menu.classList.toggle("open");

        document.addEventListener("click", (e) => {
            const dropdown = document.getElementById("actionsDropdown");
            if (dropdown && !dropdown.contains(e.target)) {
                menu.classList.remove("open");
            }
        });
    }

    // Botón para mostrar respuesta en modal
    const showAnswerBtn = document.getElementById('showAnswerBtn');
    if (showAnswerBtn) {
        showAnswerBtn.onclick = () => this.questionModal.showAnswer();
    }

    // ⭐ CONTROL DE VOLUMEN ⭐
    const volumeSlider = document.getElementById("musicVolume");
    const audio = document.getElementById("gameMusic");

    if (volumeSlider && audio) {
        // Volumen inicial
        audio.volume = parseFloat(volumeSlider.value);

        // Cambios de volumen en tiempo real
        volumeSlider.addEventListener("input", () => {
            audio.volume = parseFloat(volumeSlider.value);
        });
    }
}


    setMode(mode) {
        this.state.setMode(mode);

        document.getElementById('gameModeContainer').style.display =
            mode === 'game' ? 'block' : 'none';
        document.getElementById('editModeContainer').style.display =
            mode === 'edit' ? 'block' : 'none';

        const actionsDropdown = document.getElementById('actionsDropdown');
        if (actionsDropdown) {
            actionsDropdown.style.display = mode === 'edit' ? 'flex' : 'none';
        }

        document.getElementById('modeGameBtn').classList.toggle('active', mode === 'game');
        document.getElementById('modeEditBtn').classList.toggle('active', mode === 'edit');

        if (mode === 'game') {
            this.scoreboard.render();
            this.board.render();
            this.board.renderFinalQuestionTile();
            this.editor.close();
        } else {
            this.renderTabs();
        }
    }

    toggleMusic() {
        this.state.toggleMusic();
    }

    renderTabs() {
        const tabsContainer = document.getElementById('tabsContainer');
        if (!tabsContainer || this.state.currentMode !== 'edit') return;

        tabsContainer.innerHTML = '';

        Object.keys(this.state.roundsData).forEach(key => {
            const round = this.state.roundsData[key];
            const button = document.createElement('button');
            button.className = `tab-btn ${key === this.state.activeRound ? 'active' : ''}`;
            button.textContent = round.name;

            button.onclick = () => {
                this.switchRound(key);
                if (document.getElementById('editorModal').classList.contains('active')) {
                    this.editor.open();
                }
            };

            tabsContainer.appendChild(button);
        });
    }

    switchRound(roundKey) {
        if (this.state.activeRound === roundKey) return;

        this.state.setActiveRound(roundKey);
        Storage.saveGameData(this.state.roundsData);

        if (this.state.currentMode === 'game') {
            this.board.render();
            this.board.renderFinalQuestionTile();
            this.scoreboard.render();
        }

        if (this.state.currentMode === 'edit') {
            this.renderTabs();
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", async () => {
    const game = new JeopardyGame();
    await game.initialize();
});
