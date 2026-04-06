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

        this.presenterImg = document.querySelector('.presenter-img');

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
        if (!wrapper || !btn) return;
        const isHidden = wrapper.classList.contains("hidden");
        wrapper.classList.toggle("hidden");
        btn.textContent = isHidden ? "🎯 Ocultar Ruleta" : "🎯 Mostrar Ruleta";
    }

    setupEventListeners() {
        this.modalElement.onclick = (e) => {
            if (e.target === this.modalElement) this.close();
        };
        const btnOptions = document.getElementById('btnShowOptions');
        if (btnOptions) btnOptions.onclick = () => this.showOptions();
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
            this.presenterImg.classList.add('presenter-fade');
            setTimeout(() => {
                this.currentPresenterIndex = (this.currentPresenterIndex + 1) % this.presenterImages.length;
                this.presenterImg.src = this.presenterImages[this.currentPresenterIndex];
                this.presenterImg.classList.remove('presenter-fade');
            }, 200);
        }, 4000);
    }

    renderRoulette() {
        const wheel = document.getElementById("rouletteWheel");
        const scorables = this.gameState.getCurrentScorables();
        if (!wheel || !scorables.length) return;

        wheel.innerHTML = "";

        const sliceAngle = 360 / scorables.length;

        // Colores por sector usando el color de cada jugador
        const gradient = scorables.map((scorable, i) => {
            const start = i * sliceAngle;
            const end = start + sliceAngle;
            const hex = scorable.color || '#5865f2';
            return `${hex}55 ${start}deg ${end}deg`;
        }).join(",");

        wheel.style.background = `conic-gradient(${gradient})`;

        scorables.forEach((scorable, index) => {
            const label = document.createElement("div");
            label.className = "roulette-label";
            label.textContent = scorable.name;

            const angleDeg = sliceAngle * index + sliceAngle / 2;
            const angleRad = (angleDeg - 90) * (Math.PI / 180);

            const r = 140 * 0.55;
            const x = 50 + (r / 140) * 50 * Math.cos(angleRad);
            const y = 50 + (r / 140) * 50 * Math.sin(angleRad);

            label.style.position = 'absolute';
            label.style.left = `${x}%`;
            label.style.top = `${y}%`;
            label.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
            label.style.setProperty('--label-color', scorable.color || '#fff');
            wheel.appendChild(label);
        });
    }

    spinRoulette() {
        const scorables = this.gameState.getCurrentScorables();
        if (!scorables.length) return;

        const wheel = document.getElementById("rouletteWheel");
        const spinBtn = document.getElementById("spinRouletteBtn");
        const sliceAngle = 360 / scorables.length;

        spinBtn.disabled = true;
        spinBtn.textContent = "⏳ Girando...";

        const spins = Math.floor(Math.random() * 4) + 8;
        const randomAngle = Math.random() * 360;
        this.rouletteAngle += spins * 360 + randomAngle;

        if (this.tickAudio) {
            this.tickAudio.currentTime = 0;
            this.tickAudio.play().catch(() => { });
        }

        const DURATION = 8500;
        wheel.style.transition = `transform ${DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 1)`;
        wheel.style.transform = `rotate(${this.rouletteAngle}deg)`;

        this.lastTickIndex = null;

        const tickInterval = setInterval(() => {
            const normalized = (360 - (this.rouletteAngle % 360) + 360) % 360;
            const index = Math.floor(normalized / sliceAngle) % scorables.length;
            if (index !== this.lastTickIndex) {
                this.lastTickIndex = index;
                const pointer = document.querySelector(".roulette-pointer");
                if (pointer) {
                    pointer.classList.remove("hit");
                    void pointer.offsetWidth;
                    pointer.classList.add("hit");
                }
            }
        }, 100);

        setTimeout(() => {
            clearInterval(tickInterval);
            spinBtn.disabled = false;
            spinBtn.textContent = "🔀 Girar de nuevo";

            const finalAngle = (this.rouletteAngle % 360 + 360) % 360;
            const pointerAngle = (360 - finalAngle + 360) % 360;
            const selectedIndex = Math.floor(pointerAngle / sliceAngle) % scorables.length;

            this.selectedScorableIndex = selectedIndex;
            this.highlightWinner(selectedIndex);

            const selected = scorables[selectedIndex];
            Swal.fire({
                icon: "success",
                title: "¡Le toca jugar!",
                html: `<span style="font-size:1.4rem; font-weight:900; color:${selected.color}">${selected.name}</span>`,
                confirmButtonColor: selected.color,
                background: '#2f3136',
                color: '#dcddde'
            });
        }, DURATION);
    }

    highlightWinner(index) {
        document.querySelectorAll(".roulette-label").forEach((label, i) => {
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

        this.displayQuestion(currentData.categories[col], questionData.value, questionData);
        this.updatePlayersArea();
        this.modalElement.classList.add('active');
        this.startPresenterRotation();
        this.renderRoulette();

        // Reset roulette button text
        const spinBtn = document.getElementById("spinRouletteBtn");
        if (spinBtn) {
            spinBtn.textContent = "🎰 Elegir quién juega";
            spinBtn.disabled = false;
            spinBtn.onclick = () => this.spinRoulette();
        }
        // Reset toggle button
        const toggleBtn = document.getElementById("toggleRouletteBtn");
        if (toggleBtn) toggleBtn.textContent = "🎯 Mostrar Ruleta";

        // Ensure roulette is hidden on open
        const wrapper = document.getElementById("rouletteWrapper");
        if (wrapper) wrapper.classList.add("hidden");
    }

    openFinal() {
        const currentData = this.gameState.getCurrentRoundData();
        const questionData = currentData.finalQuestion;
        if (!questionData || questionData.used) return;

        this.currentQuestionLocation = { col: -1, row: -1 };
        this.currentQuestionPoints = questionData.value;
        this.usedMultipleChoice = false;

        this.displayQuestion(currentData.name + " — FINAL", questionData.value, questionData);
        this.updatePlayersArea();
        this.modalElement.classList.add('active');
        this.startPresenterRotation();
        this.renderRoulette();

        const spinBtn = document.getElementById("spinRouletteBtn");
        if (spinBtn) {
            spinBtn.textContent = "🎰 Elegir quién juega";
            spinBtn.disabled = false;
            spinBtn.onclick = () => this.spinRoulette();
        }
        const toggleBtn = document.getElementById("toggleRouletteBtn");
        if (toggleBtn) toggleBtn.textContent = "🎯 Mostrar Ruleta";

        const wrapper = document.getElementById("rouletteWrapper");
        if (wrapper) wrapper.classList.add("hidden");
    }

    displayQuestion(categoryTitle, pointValue, questionData) {
        document.getElementById('categoryTitle').textContent = categoryTitle;
        document.getElementById('pointValue').textContent = `$${pointValue}`;

        const questionContent = document.getElementById('questionText');
        questionContent.innerHTML = '';

        if (this.currentTypingInterval) clearInterval(this.currentTypingInterval);

        let mediaHTML = '';
        if (questionData.media1) mediaHTML += Utils.createSpoilerMediaHTML(questionData.media1);
        if (questionData.media2) mediaHTML += Utils.createSpoilerMediaHTML(questionData.media2);

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
        button.style.display = hasOptions ? 'inline-flex' : 'none';
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

        // Restar 50% de puntos al usar pistas
        this.currentQuestionPoints = Math.floor(this.currentQuestionPoints / 2);
        document.getElementById('pointValue').textContent = `$${this.currentQuestionPoints}`;
        this.updatePlayersArea();

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
            playersArea.innerHTML = `
                <div class="players-area-empty">
                    <span>⚠️</span>
                    <p>¡No hay ${entityName} para asignar puntos!</p>
                </div>`;
            return;
        }

        // Ordenar por score desc — líderes primero
        const sorted = [...scorables]
            .map((s, i) => ({ ...s, _original: i }))
            .sort((a, b) => b.score - a.score);

        playersArea.innerHTML = sorted.map(s =>
            this.createPlayerButtons(s, s._original, isTeamMode)
        ).join("");
    }

    createPlayerButtons(scorable, index, isTeamMode) {
        const points = this.currentQuestionPoints;
        const { col, row } = this.currentQuestionLocation;

        const awardFn = isTeamMode
            ? `window.game.pointsManager.awardTeam(${index}, ${points}, ${col}, ${row}, false)`
            : `window.game.pointsManager.awardPlayer(${index}, ${points}, ${col}, ${row}, false)`;

        const deductFn = isTeamMode
            ? `window.game.pointsManager.deductTeam(${index}, ${points})`
            : `window.game.pointsManager.deductPlayer(${index}, ${points})`;

        const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="%237f8c8d" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3c0 16.2 13.1 29.7 30 29.7H418c16.9 0 30-13.5 30-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>`;
        const avatarSrc = (!isTeamMode && scorable.avatar) ? scorable.avatar : defaultAvatar;

        const scoreDisplay = scorable.score < 0
            ? `-$${Math.abs(scorable.score)}`
            : `$${scorable.score}`;

        return `
            <div class="player-info" style="border-top-color: ${scorable.color}; --p-color: ${scorable.color};">
                <img src="${avatarSrc}" alt="${scorable.name}" class="player-avatar" style="border-color:${scorable.color};">
                <span class="player-name">${scorable.name}</span>
                <span class="player-score" style="color: ${scorable.score < 0 ? 'var(--danger-red)' : 'var(--success-green)'};">${scoreDisplay}</span>
                <div class="player-btn-group">
                    <button class="player-add" style="background:${scorable.color};" onclick="${awardFn}">
                        ✅ +$${points}
                    </button>
                    <button class="player-deduct" onclick="${deductFn}">
                        ❌ -$${points}
                    </button>
                </div>
            </div>
        `;
    }

    showAnswer() {
        const el = document.getElementById('answerText');
        el.classList.add('show');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        setTimeout(() => this.close(), 4000);
    }

    showIncorrectAnimation() {
        if (!this.presenterImg) return;
        this.presenterImg.src = "./images/incorrecto.png";
        this.stopPresenterRotation();
        setTimeout(() => this.startPresenterRotation(), 5000);
    }
}
