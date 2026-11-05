/* ================================
   MAIN
   Punto de entrada. Dos roles según la URL:
   - admin (por defecto): controla todo el juego.
   - anunciador (?view=announcer): vista pública de solo lectura,
     pensada para compartir pantalla.
================================ */

import { GameState } from './gameState.js';
import { LiveState } from './liveState.js';
import { Storage } from './storage.js';
import { MediaStore } from './media.js';
import { Sync } from './sync.js';
import { Effects } from './effects.js';
import { Dialog } from './dialog.js';
import { Scoring } from './scoring.js';
import { Board } from './board.js';
import { Scoreboard } from './scoreboard.js';
import { QuestionModal } from './questionModal.js';
import { LightningRound } from './lightningRound.js';
import { Podium } from './podium.js';
import { Roulette } from './roulette.js';
import { Participants } from './participants.js';
import { Editor } from './editor.js';
import { DataTransfer } from './dataTransfer.js';
import { Settings } from './settings.js';
import { BuzzerHost } from './buzzerHost.js';
import { esc } from './utils.js';

const ROLE = new URLSearchParams(location.search).get('view') === 'announcer' ? 'announcer' : 'admin';
const $ = (id) => document.getElementById(id);

const allMedia = (rounds) => rounds.flatMap(r => r.questions.flat().flatMap(q => [q.media1, q.media2]));

class App {
    constructor() {
        this.role = ROLE;
        this.admin = ROLE === 'admin';
        document.body.classList.add(`view-${ROLE}`);

        this.state = new GameState({ readOnly: !this.admin });
        this.live = new LiveState();
        this.sync = new Sync(ROLE);
        Effects.configure({ role: ROLE, sync: this.sync, sfxEnabled: () => this.state.settings.sfx });

        this.scoring = new Scoring(this.state);
        this.board = new Board(this.state, ROLE);
        this.scoreboard = new Scoreboard(this.state, ROLE, this.live);
        const deps = { state: this.state, live: this.live, scoring: this.scoring, sync: this.sync, role: ROLE };
        this.modal = new QuestionModal(deps);
        this.lightning = new LightningRound(deps);
        this.podium = new Podium(deps);
        this.roulette = new Roulette(deps);

        if (this.admin) {
            this.participants = new Participants(this.state);
            this.editor = new Editor(this.state);
            this.data = new DataTransfer(this.state);
            this.settings = new Settings(this.state);
            this.buzzer = new BuzzerHost({ state: this.state, live: this.live, modal: this.modal });
        }

        this.queue = Promise.resolve();
        window.game = this; // útil para depurar desde la consola
    }

    async init() {
        const saved = await Storage.loadGame();
        if (saved) this.state.load(saved);
        await MediaStore.preload(allMedia(this.state.rounds));

        this.state.on('change', () => this.renderAll());
        this.live.on('change', () => this.reconcileMusic());

        if (this.admin) this.#initAdmin();
        else this.#initAnnouncer();

        this.#initIntro();
        this.renderAll();
    }

    /* =========================================================
       ADMIN
    ========================================================= */

    #initAdmin() {
        Storage.requestPersistence();
        Storage.collectGarbage(MediaStore.collectIds(this.state.rounds));
        this.setMode('game');

        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (el && !el.disabled) this.#dispatch(el.dataset.action, el, e);
        });
        document.addEventListener('keydown', (e) => this.#onKey(e));

        $('musicVolume')?.addEventListener('input', (e) => {
            this.live.set({ music: { ...this.live.data.music, volume: parseFloat(e.target.value) } });
        });

        // Sincronización hacia el anunciador
        const pushState = () => { if (this.sync.announcerPresent) this.sync.send('state', this.state.toData()); };
        const pushLive = () => { if (this.sync.announcerPresent) this.sync.send('live', this.live.data); };
        this.state.on('change', pushState);
        this.live.on('change', pushLive);
        this.sync.on('hello', () => { pushState(); pushLive(); });
        this.sync.on('presence', (present) => {
            this.#updatePresence(present);
            if (present) { pushState(); pushLive(); }
            this.reconcileMusic();
        });
        this.#updatePresence(false);

        this.state.on('history', () => this.#updateUndo());
        window.addEventListener('storage-error', () => Effects.toast('⚠️ No se pudo guardar (¿almacenamiento lleno?)', 'error'));
        window.addEventListener('beforeunload', () => this.state.flushSave());

        setTimeout(() => {
            if (this.sync.otherAdmin) {
                Dialog.info('Hay otra pestaña de administrador abierta',
                    'Si editás en las dos a la vez, una puede pisar los cambios de la otra. Cerrá una de ellas.', 'warning');
            }
        }, 700);
    }

    #updatePresence(present) {
        const el = $('announcerStatus');
        if (!el) return;
        el.textContent = present ? '📺 Anunciador conectado' : '📺 Sin anunciador';
        el.classList.toggle('on', present);
    }

    #updateUndo() {
        const btn = $('undoBtn');
        if (btn) btn.disabled = !this.state.canUndo();
    }

    openAnnouncer() {
        const url = new URL(location.href);
        url.search = '?view=announcer';
        url.hash = '';
        window.open(url.toString(), 'jeopardy-announcer');
    }

    setMode(mode) {
        this.state.setMode(mode);
        $('gameModeContainer').style.display = mode === 'game' ? 'block' : 'none';
        $('editModeContainer').style.display = mode === 'edit' ? 'block' : 'none';
        $('actionsDropdown').style.display = mode === 'edit' ? 'flex' : 'none';
        $('modeGameBtn').classList.toggle('active', mode === 'game');
        $('modeEditBtn').classList.toggle('active', mode === 'edit');
    }

    toggleUI() {
        this.state.uiHidden = !this.state.uiHidden;
        document.body.classList.toggle('ui-hidden', this.state.uiHidden);
        $('toggleUiBtn').textContent = this.state.uiHidden ? 'Mostrar UI' : 'Ocultar UI';
        this.state.commit({ persist: false });
    }

    toggleMusic() {
        const m = this.live.data.music;
        this.live.set({ music: { ...m, playing: !m.playing } });
    }

    #responder() {
        const q = this.live.data.q;
        return q?.buzzedId ?? q?.responderId ?? null;
    }

    #dispatch(action, el, event) {
        const id = el.dataset.id;
        const m = this.modal;
        switch (action) {
            // Barra superior
            case 'mode-game': return this.setMode('game');
            case 'mode-edit': return this.setMode('edit');
            case 'toggle-music': return this.toggleMusic();
            case 'toggle-ui': return this.toggleUI();
            case 'undo': return this.scoring.undo();
            case 'open-settings': return this.settings.open();
            case 'open-podium': return this.podium.open();
            case 'podium-close': return this.podium.close();
            case 'open-announcer': return this.openAnnouncer();
            case 'show-help': return this.showHelp();

            // Tablero
            case 'open-cell': return m.open(+el.dataset.col, +el.dataset.row);
            case 'open-lightning': return this.lightning.open();
            case 'switch-round': return this.state.setActiveRound(id);

            // Pregunta
            case 'q-options': return m.toggleOptions();
            case 'q-answer': return m.showAnswer();
            case 'q-timer-toggle': return m.toggleTimer();
            case 'q-timer-reset': return m.resetTimer();
            case 'toggle-roulette': return this.roulette.toggle();
            case 'roulette-spin': return this.roulette.spin();
            case 'q-timer-set': return m.setTimerConfig();
            case 'q-timer-off': return m.disableTimer();
            case 'q-none': return m.unanswered();
            case 'q-close': return m.close();
            case 'q-correct': return m.correct(id);
            case 'q-wrong': return m.wrong(id);
            case 'q-bet-confirm': return m.confirmBet();
            case 'q-buzz-open': return m.toggleBuzzers();

            // Buzzers remotos
            case 'open-buzzer': return this.buzzer.openDialog();
            case 'bz-toggle':
            case 'bz-copy':
            case 'bz-newcode': return this.buzzer.handle(action);

            // Relámpago
            case 'lr-category': return this.lightning.selectCategory(el.dataset.cat);
            case 'lr-start': return this.lightning.start();
            case 'lr-correct': return this.lightning.correct();
            case 'lr-eliminate': return this.lightning.eliminate();
            case 'lr-change-category': return this.lightning.changeCategory();
            case 'lr-close': return this.lightning.close();
            case 'lr-open': return this.lightning.open();

            // Participantes
            case 'set-turn': return this.scoring.setTurn(id);
            case 'add-player': return this.participants.addPlayer();
            case 'edit-player': return this.participants.editPlayer(id);
            case 'remove-player': return this.participants.removePlayer(id);
            case 'create-team': return this.participants.createTeam();
            case 'edit-team': return this.participants.editTeam(id);
            case 'remove-team': return this.participants.removeTeam(id);
            case 'reset-scores': return this.scoring.resetScores();
            case 'reset-questions': return this.scoring.resetQuestions();

            // Editor y rondas
            case 'edit-questions': return this.editor.open();
            case 'ed-save': return this.editor.save();
            case 'ed-cancel': return this.editor.close();
            case 'new-round': return this.editor.addRound();
            case 'duplicate-round': return this.editor.duplicateRound();
            case 'delete-round': return this.editor.deleteRound();

            // Importar / exportar
            case 'export-json': return this.data.exportJSON();
            case 'import-json': return this.data.importJSON();
            case 'export-csv': return this.data.exportCSV();
            case 'import-csv': return this.data.importCSV();
            case 'csv-template': return this.data.downloadCSVTemplate();

            default:
                if (action.startsWith('ed-')) return this.editor.handle(action, el);
        }
        void event;
    }

    /* ---------- Atajos de teclado ---------- */

    #onKey(e) {
        const t = e.target;
        const typing = t.matches?.('input, textarea, select, [contenteditable="true"]');
        if (typing || Dialog.isOpen() || this.editor.isOpen || e.altKey) return;

        // Activar con teclado los elementos con role="button"
        if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[role="button"][data-action]')) {
            e.preventDefault();
            return t.click();
        }

        const key = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 'z') {
            e.preventDefault();
            return this.scoring.undo();
        }
        if (e.ctrlKey || e.metaKey) return;

        if (key === '?') return this.showHelp();

        if (this.modal.isOpen) {
            const m = this.modal;
            if (/^[1-9]$/.test(key)) {
                const q = this.live.data.q;
                const list = this.state.participants(this.state.roundById(q.roundId));
                const p = list[+key - 1];
                return p && m.buzz(p.id);
            }
            switch (key) {
                case 'escape': return m.close();
                case 'r': return m.showAnswer();
                case 'o': return m.toggleOptions();
                case 't': return m.toggleTimer();
                case 'b': return m.toggleBuzzers();
                case 'n': return m.unanswered();
                case 'enter':
                case 'c': {
                    const pid = this.#responder();
                    return pid ? m.correct(pid) : Effects.toast('Elegí quién responde (teclas 1-9)', 'info');
                }
                case 'backspace':
                case 'x': {
                    const pid = this.#responder();
                    return pid ? m.wrong(pid) : Effects.toast('Elegí quién responde (teclas 1-9)', 'info');
                }
            }
            return;
        }

        if (key === 'g') return this.roulette.toggle();
        if (key === 's') return this.roulette.spin();

        if (key === 'escape') {
            if (this.live.data.screen === 'lightning') this.lightning.close();
            else if (this.live.data.screen === 'podium') this.podium.close();
        }
    }

    showHelp() {
        const rows = [
            ['1 – 9', 'Buzzer: marca quién respondió primero'],
            ['Enter / C', 'Respuesta correcta del que responde'],
            ['Backspace / X', 'Respuesta incorrecta del que responde'],
            ['R', 'Mostrar la respuesta al público'],
            ['O', 'Mostrar opciones (mitad de puntos)'],
            ['T', 'Iniciar / pausar el temporizador'],
            ['B', 'Abrir / cerrar los buzzers de los celulares'],
            ['G / S', 'Mostrar/ocultar la ruleta / girarla (fuera de una pregunta)'],
            ['N', 'Terminar pregunta (usada, sin puntos)'],
            ['Esc', 'Cerrar la pregunta'],
            ['Ctrl + Z', 'Deshacer el último cambio de puntos'],
            ['?', 'Esta ayuda']
        ];
        Dialog.fire({
            title: '⌨️ Atajos de teclado',
            html: `<table class="help-table">${rows.map(([k, d]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(d)}</td></tr>`).join('')}</table>`,
            confirmButtonColor: '#5865f2'
        });
    }

    /* =========================================================
       ANUNCIADOR
    ========================================================= */

    #initAnnouncer() {
        this.state.setMode('game');
        document.title = 'Jeopardy - Vista pública';

        const enqueue = (fn) => { this.queue = this.queue.then(fn).catch(e => console.error(e)); };

        this.sync.on('state', (data) => enqueue(async () => {
            await MediaStore.preload(allMedia(data.rounds));
            this.state.load(data);
            this.state.commit({ persist: false });
        }));
        this.sync.on('live', (data) => enqueue(() => this.live.replace(data)));
        this.sync.on('fx', ({ name, soundOnly }) => {
            if (soundOnly) Effects.playLocalSound(name); else Effects.fireLocal(name);
        });
    }

    /* =========================================================
       COMUNES
    ========================================================= */

    #initIntro() {
        const intro = $('introScreen');
        if (!intro) return;

        if (this.admin) {
            intro.remove(); // el concursillo arranca directo, sin cortinas
            return;
        }
        // En el anunciador hace falta un click para habilitar el audio del navegador.
        const btn = document.createElement('button');
        btn.className = 'announcer-enter';
        btn.textContent = '▶ Entrar a la vista pública';
        btn.onclick = () => {
            this.audioUnlocked = true;
            intro.style.animation = 'hideIntro 0.8s forwards';
            this.reconcileMusic();
        };
        intro.appendChild(btn);
    }

    reconcileMusic() {
        const audio = $('gameMusic');
        if (!audio) return;
        const { playing, volume } = this.live.data.music;
        const iPlay = this.admin ? !this.sync.announcerPresent : true;
        audio.volume = volume;

        const slider = $('musicVolume');
        if (slider && slider.value !== String(volume)) slider.value = volume;
        const btn = $('musicBtn');
        if (btn) btn.textContent = playing ? '⏸️ Pausar Música' : '🎵 Reproducir Música';
        const box = $('volumeContainer');
        if (box) box.style.display = playing ? 'flex' : 'none';

        if (playing && iPlay) audio.play().catch(() => { });
        else audio.pause();
    }

    renderAll() {
        this.scoreboard.render();
        this.board.render();
        if (this.admin) {
            this.#renderTabs();
            this.#updateUndo();
        }
    }

    #renderTabs() {
        const box = $('tabsContainer');
        if (!box || this.state.mode !== 'edit') return;
        const s = this.state;
        box.innerHTML = s.rounds.map(r => `
            <button class="tab-btn ${r.id === s.activeRoundId ? 'active' : ''}" data-action="switch-round" data-id="${esc(r.id)}">
                ${esc(r.name)} <small>${r.mode === 'team' ? '👥' : '🎮'}</small>
            </button>`).join('');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.init();
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
}
