/* ================================
   QUESTION MODAL COMPONENT
   Modal para mostrar preguntas
================================ */

import { Utils } from './utils.js';

export class QuestionModal {
    constructor(gameState, pointsManager) {
        this.gameState = gameState;
        this.pointsManager = pointsManager;
        this.modalElement = document.getElementById('modal');
        this.currentTypingInterval = null;
        this.currentQuestionPoints = 0;
        this.currentQuestionLocation = { col: -1, row: -1 };
        this.usedMultipleChoice = false;
        this.rouletteAngle = 0;
        this.selectedScorableIndex = null;
        this.lastTickIndex = null;
        this.tickAudio = document.getElementById("rouletteTick");

        this.setupEventListeners();

        // Imagen principal del modal
        this.presenterImg = document.querySelector('.presenter-img');

        // Imágenes que deben rotar
        this.presenterImages = [
            "./images/leyendo.png",
            "./images/tirarCarta.png",
            "./images/presentando.png"
        ];

        this.currentPresenterIndex = 0;
        this.rotationInterval = null;
    }

    toggleRoulette() {
        const wrapper = document.getElementById("rouletteWrapper");
        const btn = document.getElementById("toggleRouletteBtn");

        const isHidden = wrapper.classList.contains("hidden");

        wrapper.classList.toggle("hidden");

        btn.innerHTML = isHidden
            ? "Ocultar ruleta"
            : "Mostrar ruleta";
    }

    setupEventListeners() {
        this.modalElement.onclick = (e) => {
            if (e.target === this.modalElement) this.close();
        };

        document.getElementById('btnShowOptions').onclick = () => this.showOptions();
    }

    stopPresenterRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
        }
    }

    startPresenterRotation() {
        if (!this.presenterImg) return;

        this.stopPresenterRotation();

        this.currentPresenterIndex = 0;
        this.presenterImg.src = this.presenterImages[this.currentPresenterIndex];

        this.rotationInterval = setInterval(() => {
            this.currentPresenterIndex =
                (this.currentPresenterIndex + 1) % this.presenterImages.length;

            this.presenterImg.src = this.presenterImages[this.currentPresenterIndex];
        }, 4000);
    }

    renderRoulette() {
        const wheel = document.getElementById("rouletteWheel");
        const scorables = this.gameState.getCurrentScorables();

        if (!wheel || !scorables.length) return;

        wheel.innerHTML = "";

        const sliceAngle = 360 / scorables.length;

        const gradient = scorables.map((_, i) => {
            const start = i * sliceAngle;
            const end = start + sliceAngle;

            // alternamos tonos suaves
            const color = i % 2 === 0
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.08)";

            return `${color} ${start}deg ${end}deg`;
        }).join(",");

        wheel.style.background = `conic-gradient(${gradient})`;

        scorables.forEach((scorable, index) => {
            const label = document.createElement("div");
            label.className = "roulette-label";
            label.textContent = scorable.name;

            const angle = sliceAngle * index + sliceAngle / 2;

            label.style.transform = `
                rotate(${angle}deg)
                translate(130px)
            `;

            wheel.appendChild(label);
        });
    }

    spinRoulette() {
        const scorables = this.gameState.getCurrentScorables();
        if (!scorables.length) return;

        const wheel = document.getElementById("rouletteWheel");
        const sliceAngle = 360 / scorables.length;

        const spins = Math.floor(Math.random() * 4) + 8;
        const randomAngle = Math.random() * 360;

        this.rouletteAngle += spins * 360 + randomAngle;
        wheel.style.transform = `rotate(${this.rouletteAngle}deg)`;

        this.lastTickIndex = null;

        const tickInterval = setInterval(() => {
            const currentAngle =
                (this.rouletteAngle -
                    (wheel.getBoundingClientRect().width)) % 360;

            const normalized =
                (270 - currentAngle + 360) % 360;

            const index =
                Math.floor(normalized / sliceAngle) % scorables.length;

            if (index !== this.lastTickIndex) {
                this.lastTickIndex = index;
                this.tickAudio.currentTime = 0;
                this.tickAudio.play();
            }
        }, 60);

        setTimeout(() => {
            clearInterval(tickInterval);
            const pointer = document.querySelector(".roulette-pointer");
            pointer.classList.remove("hit");
            void pointer.offsetWidth;
            pointer.classList.add("hit");
            const finalAngle = (this.rouletteAngle % 360 + 360) % 360;
            const pointerAngle = (270 - finalAngle + 360) % 360;

            const selectedIndex =
                Math.floor(pointerAngle / sliceAngle) % scorables.length;

            const selected = scorables[selectedIndex];
            this.selectedScorableIndex = selectedIndex;

            this.highlightWinner(selectedIndex);

            Swal.fire({
                icon: "success",
                title: "¡Le toca jugar!",
                text: selected.name,
                confirmButtonColor: selected.color
            });
        }, 6000);
    }

    highlightWinner(index) {
        document
            .querySelectorAll(".roulette-label")
            .forEach((label, i) => {
                label.classList.toggle("winner", i === index);
            });
    }

    open(col, row) {
        const currentData = this.gameState.getCurrentRoundData();
        const questionData = currentData.questions[col][row];

        if (questionData.used) return;

        this.currentQuestionLocation = { col, row };
        this.currentQuestionPoints = questionData.value;
        this.usedMultipleChoice = false;

        this.displayQuestion(
            currentData.categories[col],
            questionData.value,
            questionData
        );

        this.updatePlayersArea();
        this.modalElement.classList.add('active');
        this.startPresenterRotation();
        this.renderRoulette();

        document.getElementById("spinRouletteBtn").onclick = () => {
            this.spinRoulette();
        };
    }

    openFinal() {
        const currentData = this.gameState.getCurrentRoundData();
        const questionData = currentData.finalQuestion;

        if (!questionData || questionData.used) return;

        this.currentQuestionLocation = { col: -1, row: -1 };
        this.currentQuestionPoints = questionData.value;
        this.usedMultipleChoice = false;

        this.displayQuestion(
            currentData.name + " - FINAL",
            questionData.value,
            questionData
        );

        this.updatePlayersArea();
        this.modalElement.classList.add('active');
        this.startPresenterRotation();
        this.renderRoulette();

        document.getElementById("spinRouletteBtn").onclick = () => {
            this.spinRoulette();
        };
    }

    displayQuestion(categoryTitle, pointValue, questionData) {
        document.getElementById('categoryTitle').textContent = categoryTitle;
        document.getElementById('pointValue').textContent = `$${pointValue}`;

        const questionContent = document.getElementById('questionText');
        questionContent.innerHTML = '';

        if (this.currentTypingInterval) {
            clearInterval(this.currentTypingInterval);
        }

        let mediaHTML = '';
        if (questionData.media1) {
            mediaHTML += Utils.createSpoilerMediaHTML(questionData.media1);
        }
        if (questionData.media2) {
            mediaHTML += Utils.createSpoilerMediaHTML(questionData.media2);
        }

        this.currentTypingInterval = Utils.typeWriterEffect(
            questionContent,
            questionData.question || "(Sin texto)",
            mediaHTML
        );

        document.getElementById('answerText').textContent = questionData.answer || '';
        document.getElementById('answerText').classList.remove('show');

        this.setupMultipleChoice(questionData);
    }

    setupMultipleChoice(questionData) {
        const container = document.getElementById('multipleChoiceContainer');
        const text = document.getElementById('multipleChoiceText');
        const button = document.getElementById('btnShowOptions');

        const hasOptions = questionData.multipleChoice && questionData.multipleChoice.trim() !== '';

        button.style.display = hasOptions ? 'block' : 'none';
        container.classList.remove('show');
        text.innerHTML = '';
        this.usedMultipleChoice = false;
    }

    showOptions() {
        const currentData = this.gameState.getCurrentRoundData();
        const { col, row } = this.currentQuestionLocation;

        let questionData;
        if (col === -1) {
            questionData = currentData.finalQuestion;
        } else {
            questionData = currentData.questions[col][row];
        }

        if (!questionData.multipleChoice || this.usedMultipleChoice) return;

        this.usedMultipleChoice = true;

        const container = document.getElementById('multipleChoiceContainer');
        const text = document.getElementById('multipleChoiceText');

        container.classList.add('show');
        text.innerHTML = '';

        const options = questionData.multipleChoice.split('/').map(o => o.trim());
        this.typeOptions(text, options, 0);
    }

    typeOptions(container, options, index) {
        if (index >= options.length) return;

        const paragraph = document.createElement('p');
        paragraph.className = 'multiple-choice-option';
        container.appendChild(paragraph);

        let charIndex = 0;
        const text = options[index];

        const interval = setInterval(() => {
            if (charIndex < text.length) {
                paragraph.textContent += text.charAt(charIndex);
                charIndex++;
            } else {
                clearInterval(interval);
                setTimeout(() => this.typeOptions(container, options, index + 1), 2000);
            }
        }, Utils.TYPING_SPEED);
    }

    updatePlayersArea() {
        const playersArea = document.getElementById("playersArea");
        const scorables = this.gameState.getCurrentScorables();
        const isTeamMode = this.gameState.isTeamMode();

        if (!scorables.length) {
            const entityName = isTeamMode ? 'equipos' : 'jugadores';
            playersArea.innerHTML = `<p style="color:var(--danger-red);">¡No hay ${entityName} para asignar puntos!</p>`;
            return;
        }

        playersArea.innerHTML = scorables.map((scorable, index) => {
            return this.createPlayerButtons(scorable, index, isTeamMode);
        }).join("");
    }

    createPlayerButtons(scorable, index, isTeamMode) {
        const points = this.currentQuestionPoints;
        const { col, row } = this.currentQuestionLocation;

        const awardFunction = isTeamMode
            ? `window.game.pointsManager.awardTeam(${index}, ${points}, ${col}, ${row}, false)`
            : `window.game.pointsManager.awardPlayer(${index}, ${points}, ${col}, ${row}, false)`;

        const deductFunction = isTeamMode
            ? `window.game.pointsManager.deductTeam(${index}, ${points})`
            : `window.game.pointsManager.deductPlayer(${index}, ${points})`;

        const defaultAvatar = '';
        const avatarSrc = !isTeamMode && scorable.avatar ? scorable.avatar : defaultAvatar;

        return `
            <div class="player-info" style="border-top-color: ${scorable.color};">
                <img src="${avatarSrc}" alt="Avatar de ${scorable.name}" class="player-avatar">

                <span class="player-name">${scorable.name}</span>
                <span class="player-score" style="color:limegreen;">${scorable.score}</span>

                <div class="player-btn-group">
                    <button
                        class="player-add"
                        style="background:${scorable.color}; color:white; margin-bottom:5px;"
                        onclick="${awardFunction}"
                    >
                        + ${points}
                    </button>
                    <button
                        class="player-deduct"
                        style="background:var(--danger-red); color: white;"
                        onclick="${deductFunction}"
                    >
                        - ${points}
                    </button>
                </div>
            </div>
        `;
    }

    showAnswer() {
        document.getElementById('answerText').classList.add('show');
    }

    close() {
        this.modalElement.classList.remove('active');

        if (this.currentTypingInterval) {
            clearInterval(this.currentTypingInterval);
            this.currentTypingInterval = null;
        }

        document.querySelectorAll("#modal video, #modal audio").forEach(el => {
            el.pause();
            el.currentTime = 0;
        });

        this.stopPresenterRotation();
    }

    showCorrectAnimation() {
        if (!this.presenterImg) return;
        this.stopPresenterRotation();
        this.presenterImg.src = "./images/correcto.png";

        setTimeout(() => {
            this.close();
        }, 4000);
    }

    showIncorrectAnimation() {
        if (!this.presenterImg) return;

        this.presenterImg.src = "./images/incorrecto.png";
        this.stopPresenterRotation();

        setTimeout(() => {
            this.startPresenterRotation();
        }, 5000);
    }
}
