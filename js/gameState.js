/* ================================
   GAME STATE MODULE
   Estado global del juego
================================ */

export class GameState {
    constructor() {
        this.roundsData = {
            individual: { categories: [], questions: [], name: "Ronda Individual", finalQuestion: null },
            grupal: { categories: [], questions: [], name: "Ronda Grupal", finalQuestion: null }
        };
        this.activeRound = 'individual';
        this.currentMode = 'game';
        this.teams = [];
        this.players = [];
        this.usedCells = new Set();
        this.editingGameData = null;
        this.uiHidden = false;
    }

    getCurrentRoundData() {
        return this.roundsData[this.activeRound];
    }

    setActiveRound(roundKey) {
        this.activeRound = roundKey;
        this.usedCells.clear();

        if (!this.roundsData[roundKey] || !this.roundsData[roundKey].categories) {
            this.roundsData[roundKey] = {
                categories: [],
                questions: [],
                name: this.roundsData[roundKey]?.name ||
                    (roundKey === 'individual' ? "Ronda Individual" : "Ronda Grupal"),
                finalQuestion: null
            };
        }
    }

    setMode(mode) {
        this.currentMode = mode;
    }

    startEditingRound() {
        this.editingGameData = JSON.parse(JSON.stringify(this.roundsData[this.activeRound]));
    }

    cancelEditing() {
        this.editingGameData = null;
    }

    saveEditing() {
        this.roundsData[this.activeRound] = JSON.parse(JSON.stringify(this.editingGameData));
        this.editingGameData = null;
    }

    getCurrentScorables() {
        return this.activeRound === 'individual' ? this.players : this.teams;
    }

    isTeamMode() {
        return this.activeRound === 'grupal';
    }

    toggleMusic() {
        const audio = document.getElementById("gameMusic");
        const btn = document.getElementById("musicBtn");
        const volumeContainer = document.getElementById("volumeContainer");

        if (!audio) return;

        if (audio.paused) {
            audio.volume = 0.35;
            audio.play();
            btn.textContent = "⏸️ Pausar Música";
            if (volumeContainer) {
                volumeContainer.style.display = "flex";
            }

        } else {
            audio.pause();
            btn.textContent = "🎵 Reproducir Música";

            if (volumeContainer) {
                volumeContainer.style.display = "none";
            }
        }
    }

    toggleUI() {
        this.uiHidden = !this.uiHidden;

        const btn = document.getElementById("toggleUiBtn");
        if (btn) {
            btn.textContent = this.uiHidden ? "Mostrar UI" : "Ocultar UI";
        }

        const panel = document.querySelector('.mode-controls-panel');
        if (panel) {
            panel.querySelectorAll('#modeGameBtn, #modeEditBtn').forEach(b => {
                b.style.display = this.uiHidden ? 'none' : 'inline-block';
            });
            panel.style.marginBottom = this.uiHidden ? '0' : '';
        }

        const header = document.querySelector('.header');
        if (header) {
            header.style.display = this.uiHidden ? 'none' : 'block';
        }
    }
}
