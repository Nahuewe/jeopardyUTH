/* ================================
   QUESTION MODAL
   Se renderiza desde LiveState en ambos roles.
   Los métodos de acción solo los usa el admin.
================================ */

import { Utils, esc, uid, DEFAULT_AVATAR } from './utils.js';
import { MediaStore } from './media.js';
import { Effects } from './effects.js';

const $ = (id) => document.getElementById(id);
const PRESENTER_IMAGES = ['./images/leyendo.png', './images/tirarCarta.png', './images/presentando.png'];

export class QuestionModal {
    constructor({ state, live, scoring, sync, role }) {
        this.state = state;
        this.live = live;
        this.scoring = scoring;
        this.sync = sync;
        this.role = role;
        this.admin = role === 'admin';

        this.el = $('modal');
        this.presenterImg = document.querySelector('.presenter-img');

        this.key = null;            // pregunta mostrada actualmente
        this.typedKey = null;       // pregunta cuyo texto ya se tipeó
        this.optionsKey = null;
        this.optionsToken = 0;
        this.typing = null;
        this.presenterMood = null;
        this.presenterIdx = 0;
        this.presenterTimer = null;
        this.timeouts = new Set();
        this.playersSig = '';

        live.on('change', (d) => this.render(d));
        state.on('change', () => this.render(live.data));
        setInterval(() => this.#tickTimer(), 200);

        this.#bindEvents();
        if (!this.admin) sync.on('media', (m) => this.#remoteMedia(m));
        else sync.on('presence', () => this.#applyMute());
    }

    /* =========================================================
       EVENTOS LOCALES (ambos roles)
    ========================================================= */

    #bindEvents() {
        this.el.addEventListener('click', (e) => {
            const reveal = e.target.closest('[data-action="reveal-media"]');
            if (reveal) return this.revealMedia(reveal.dataset.slot);

            if (e.target.closest('#questionText')) return this.typing?.finish();

            if (this.admin && e.target === this.el) this.close();
        });

        this.el.addEventListener('keydown', (e) => {
            const reveal = e.target.closest?.('[data-action="reveal-media"]');
            if (reveal && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.revealMedia(reveal.dataset.slot); }
        });

        // Los eventos de medios no burbujean: se capturan.
        if (this.admin) {
            for (const type of ['play', 'pause', 'seeked']) {
                this.el.addEventListener(type, (e) => {
                    const m = e.target.closest?.('[data-media-slot]');
                    if (!m || !this.sync.announcerPresent) return;
                    this.sync.send('media', { slot: m.dataset.mediaSlot, action: type, time: m.currentTime });
                }, true);
            }
        }

        this.el.addEventListener('change', (e) => {
            if (this.admin && e.target.id === 'betParticipant') this.live.patchQ({ responderId: e.target.value });
        });
    }

    #remoteMedia({ slot, action, time }) {
        const m = this.el.querySelector(`[data-media-slot="${CSS.escape(slot)}"]`);
        if (!m) return;
        if (Math.abs(m.currentTime - time) > 0.6) m.currentTime = time;
        if (action === 'play') m.play().catch(() => { });
        if (action === 'pause') m.pause();
    }

    #applyMute() {
        if (!this.admin) return;
        const mute = this.sync.announcerPresent;
        this.el.querySelectorAll('audio[data-media-slot], video[data-media-slot]').forEach(m => { m.muted = mute; });
    }

    /* =========================================================
       RENDER
    ========================================================= */

    render(l = this.live.data) {
        const q = l.q;
        const visible = l.screen === 'question' && q;
        this.el.classList.toggle('active', !!visible);
        document.body.classList.toggle('modal-open', !!visible);
        if (!visible) return this.#teardown();

        const round = this.state.roundById(q.roundId);
        const data = this.state.getQuestion(q.roundId, q.col, q.row);
        if (!round || !data) return;

        if (this.key !== q.key) this.#startQuestion(q);

        const bet = q.phase === 'bet';
        $('categoryTitle').textContent = round.categories[q.col] ?? '';
        $('pointValue').textContent = bet ? '🎲' : `$${q.points}`;
        $('ddBanner').classList.toggle('show', !!q.dd);
        this.el.classList.toggle('phase-bet', bet);

        this.#renderBet(q, round);
        if (!bet && this.typedKey !== q.key) this.#typeQuestion(q, data);
        this.#syncMedia(q);
        this.#syncOptions(q, data);
        this.#syncAnswer(q, data);
        this.#renderBanner(q, round);
        this.#renderPlayers(q, round);
        this.#renderTimer();
        this.#updatePresenter(q.mood || 'reading');
        this.#renderAdminControls(q, data);
    }

    #startQuestion(q) {
        this.#teardown();
        this.key = q.key;
        this.typedKey = null;
        this.optionsKey = null;
        this.playersSig = '';
        $('questionText').innerHTML = '';
        $('multipleChoiceText').innerHTML = '';
        $('multipleChoiceContainer').classList.remove('show');
        $('answerText').textContent = '';
        $('answerText').classList.remove('show');
        if (q.dd) Effects.sound('dd');
    }

    #teardown() {
        this.typing?.cancel();
        this.typing = null;
        this.optionsToken++;
        this.key = null;
        this.typedKey = null;
        this.#stopPresenter();
        this.presenterMood = null;
        this.el.querySelectorAll('audio, video').forEach(m => { m.pause(); });
    }

    /* ---------- Pregunta ---------- */

    #typeQuestion(q, data) {
        this.typedKey = q.key;
        const box = $('questionText');
        const attachMedia = () => {
            const html = (data.media1 ? MediaStore.spoilerHtml(data.media1, 'media1') : '')
                + (data.media2 ? MediaStore.spoilerHtml(data.media2, 'media2') : '');
            if (html) box.insertAdjacentHTML('beforeend', html);
            this.#syncMedia(this.live.data.q);
            this.#applyMute();
        };

        this.typing = Utils.typeWrite(box, data.question || '(Sin texto)', {
            onDone: () => {
                if (this.key !== q.key) return;
                attachMedia();
                const cur = this.live.data;
                // Terminó de leerse la pregunta: se habilitan los buzzers remotos.
                if (this.admin && cur.q?.key === q.key && !cur.q.buzzOpen && !cur.q.result) this.live.patchQ({ buzzOpen: true });
                if (this.admin && !cur.q?.timerOff && this.state.settings.autoTimer
                    && !cur.timer && cur.q?.key === q.key && !cur.q.result) {
                    this.startTimer();
                }
            }
        });
    }

    #syncMedia(q) {
        if (!q) return;
        this.el.querySelectorAll('.spoiler-container').forEach(c => {
            const idx = c.dataset.slot === 'media2' ? 1 : 0;
            c.classList.toggle('revealed', !!q.mediaRevealed?.[idx] || c.classList.contains('revealed'));
        });
    }

    #syncOptions(q, data) {
        const container = $('multipleChoiceContainer');
        const has = (data.multipleChoice || '').trim() !== '';
        if (q.optionsShown && has) {
            container.classList.add('show');
            if (this.optionsKey !== q.key) {
                this.optionsKey = q.key;
                const token = ++this.optionsToken;
                $('multipleChoiceText').innerHTML = '';
                this.#typeOptions(data.multipleChoice.split('/').map(o => o.trim()).filter(Boolean), token);
            }
        } else {
            container.classList.remove('show');
            this.optionsKey = null;
        }
    }

    async #typeOptions(options, token) {
        const box = $('multipleChoiceText');
        for (const text of options) {
            if (token !== this.optionsToken) return;
            const p = document.createElement('p');
            p.className = 'multiple-choice-option';
            box.appendChild(p);
            for (const ch of text) {
                if (token !== this.optionsToken) return;
                p.textContent += ch;
                await Utils.sleep(Utils.TYPING_SPEED);
            }
            await Utils.sleep(900);
        }
    }

    #syncAnswer(q, data) {
        const el = $('answerText');
        const shouldShow = !!q.answerShown;
        el.textContent = shouldShow ? (data.answer || '') : '';
        el.classList.toggle('show', shouldShow);
    }

    #renderBanner(q, round) {
        const banner = $('responderBanner');
        const name = (id) => this.state.participantById(id)?.name ?? '';
        const list = this.state.participants(round);
        let html = '';

        if (q.result?.type === 'correct') html = `<span class="rb-ok">✅ ¡Correcto, ${esc(name(q.result.pid))}!</span>`;
        else if (q.result?.type === 'wrong') html = `<span class="rb-bad">❌ ${esc(name(q.result.pid))} falló la Daily Double</span>`;
        else if (q.result?.type === 'none') html = '<span class="rb-bad">Nadie acertó esta pregunta</span>';
        else if (q.phase === 'bet') html = `<span class="rb-info">🎲 ¡DAILY DOUBLE! ${q.responderId ? esc(name(q.responderId)) + ' está apostando…' : ''}</span>`;
        else if (q.buzzedId) html = `<span class="rb-info">🔔 ${esc(name(q.buzzedId))} respondió primero</span>`;
        else if (q.lastFoul) html = `<span class="rb-bad">⚠️ ${esc(name(q.lastFoul.pid))} se adelantó</span>`;
        else if (q.buzzOpen && this.live.data.buzzerOn && this.live.data.connected.length) html = '<span class="rb-info">🔔 ¡Buzzers abiertos!</span>';
        else if (q.responderId) html = `<span class="rb-info">🎯 Le toca a ${esc(name(q.responderId))}</span>`;
        else if (list.length && q.lockedOut.length >= list.length) html = '<span class="rb-bad">😬 Todos fallaron</span>';

        banner.innerHTML = html;
        banner.classList.toggle('show', !!html);
    }

    /* ---------- Apuesta (Daily Double) ---------- */

    #renderBet(q, round) {
        const panel = $('betPanel');
        const show = q.phase === 'bet';
        panel.classList.toggle('show', show);
        if (!show) { panel.innerHTML = ''; panel.dataset.sig = ''; return; }

        const list = this.state.participants(round);
        const sig = `${this.role}|${q.responderId}|${list.map(p => `${p.id}:${p.score}`).join(',')}`;
        if (panel.dataset.sig === sig) return;
        panel.dataset.sig = sig;

        const who = this.state.participantById(q.responderId);
        if (!this.admin) {
            panel.innerHTML = `<p class="bet-wait">🎲 Daily Double — ${who ? esc(who.name) : 'alguien'} está haciendo su apuesta…</p>`;
            return;
        }
        const max = who ? this.scoring.maxBet(who.id, q.roundId) : 0;
        panel.innerHTML = `
            <label>¿Quién juega?
                <select id="betParticipant">
                    ${list.map(p => `<option value="${esc(p.id)}" ${p.id === q.responderId ? 'selected' : ''}>${esc(p.name)} (${Utils.formatScore(p.score)})</option>`).join('')}
                </select>
            </label>
            <label>Apuesta (5 – $${max}):
                <input id="betAmount" type="number" min="5" max="${max}" step="5" value="${Math.min(max, 500)}">
            </label>
            <button class="btn btn-save" data-action="q-bet-confirm">Confirmar apuesta</button>`;
    }

    confirmBet() {
        const q = this.live.data.q;
        if (!q || q.phase !== 'bet') return;
        const pid = $('betParticipant')?.value || q.responderId;
        if (!pid) return Effects.toast('No hay participantes', 'error');
        const max = this.scoring.maxBet(pid, q.roundId);
        const bet = parseInt($('betAmount')?.value, 10);
        if (!Number.isFinite(bet) || bet < 5 || bet > max) {
            return Effects.toast(`La apuesta debe estar entre $5 y $${max}`, 'error');
        }
        this.live.patchQ({ phase: 'open', points: bet, bet, responderId: pid });
    }

    /* ---------- Participantes ---------- */

    #renderPlayers(q, round) {
        const area = $('playersArea');
        let list = this.state.participants(round);
        if (q.dd && q.phase === 'open') list = list.filter(p => p.id === q.responderId);

        const sig = JSON.stringify([this.role, q.points, q.dd, q.phase, q.lockedOut, q.buzzedId, q.responderId, !!q.result,
            this.state.settings.deductOnWrong, list.map(p => [p.id, p.name, p.score, p.color, p.avatar?.length])]);
        if (sig === this.playersSig) return;
        this.playersSig = sig;

        if (!list.length) {
            const what = this.state.isTeamRound(round) ? 'equipos' : 'jugadores';
            area.innerHTML = `<div class="players-area-empty"><span>⚠️</span><p>¡No hay ${what} para asignar puntos!</p></div>`;
            return;
        }
        if (q.phase === 'bet') { area.innerHTML = ''; return; }

        const teamMode = this.state.isTeamRound(round);
        const all = this.state.participants(round);
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
        area.innerHTML = sorted.map(p => this.#playerCard(p, q, teamMode, all.findIndex(x => x.id === p.id))).join('');
    }

    #playerCard(p, q, teamMode, index) {
        const locked = q.lockedOut.includes(p.id);
        const buzzed = q.buzzedId === p.id || (!q.buzzedId && q.responderId === p.id);
        const avatarHTML = teamMode
            ? `<div class="team-avatars-row">${this.state.memberNames(p).map((name, i) => {
                const member = this.state.players.find(x => x.id === p.memberIds[i]);
                return `<img src="${esc(member?.avatar || DEFAULT_AVATAR)}" alt="${esc(name)}" title="${esc(name)}" class="player-avatar team-member-mini" style="border-color:${esc(p.color)};">`;
            }).join('')}</div>`
            : `<img src="${esc(p.avatar || DEFAULT_AVATAR)}" alt="${esc(p.name)}" class="player-avatar" style="border-color:${esc(p.color)};">`;
        const done = !!q.result;
        const deduct = this.state.settings.deductOnWrong;

        let status = '';
        if (locked) status = '<span class="pc-status bad">✖ Ya falló</span>';
        else if (buzzed) status = '<span class="pc-status ok">🔔 Respondiendo</span>';

        const buttons = this.admin ? `
            <div class="player-btn-group">
                <button class="player-add" style="background:${esc(p.color)};" data-action="q-correct" data-id="${esc(p.id)}" ${locked || done ? 'disabled' : ''}>✅ +$${q.points}</button>
                <button class="player-deduct" data-action="q-wrong" data-id="${esc(p.id)}" ${locked || done ? 'disabled' : ''}>❌ ${deduct ? `-$${q.points}` : 'Falló'}</button>
            </div>` : '';
        const key = this.admin && index >= 0 && index < 9 && !q.dd ? `<kbd class="buzz-key" title="Tecla para buzzer">${index + 1}</kbd>` : '';

        return `
            <div class="player-info ${buzzed ? 'is-responder' : ''} ${locked ? 'locked-out' : ''}" style="border-top-color:${esc(p.color)};--p-color:${esc(p.color)};">
                ${key}
                ${avatarHTML}
                <span class="player-name">${esc(p.name)}</span>
                <span class="player-score" style="color:${p.score < 0 ? 'var(--danger-red)' : 'var(--success-green)'};">${Utils.formatScore(p.score)}</span>
                ${status}
                ${buttons}
            </div>`;
    }

    #renderAdminControls(q, data) {
        if (!this.admin) return;
        const hasOptions = (data.multipleChoice || '').trim() !== '';
        const hint = $('btnShowOptions');
        hint.style.display = hasOptions && !q.dd ? 'inline-flex' : 'none';
        hint.disabled = q.optionsShown;

        const t = this.live.data.timer;
        const btn = $('btnTimerToggle');
        btn.style.display = q.timerOff ? 'none' : '';
        $('btnTimerReset').style.display = q.timerOff ? 'none' : '';
        const cfg = $('timerConfigInput');
        if (cfg && document.activeElement !== cfg && cfg.dataset.key !== q.key + q.timerSeconds) {
            cfg.value = q.timerOff ? 0 : q.timerSeconds;
            cfg.dataset.key = q.key + q.timerSeconds;
        }
        btn.textContent = !t || t.finished ? '⏱ Iniciar timer' : t.running ? '⏸ Pausar timer' : '▶ Reanudar timer';

        const adminAnswer = $('adminAnswer');
        adminAnswer.innerHTML = `<strong>🔒 Respuesta (solo vos):</strong> ${esc(data.answer || '—')}`;

        $('btnShowAnswer').disabled = !!q.answerShown;
        const bz = $('btnBuzzOpen');
        bz.style.display = this.live.data.buzzerOn && q.phase === 'open' && !q.dd ? '' : 'none';
        bz.textContent = q.buzzOpen ? '🔕 Cerrar buzzers' : '🔔 Abrir buzzers';
    }

    /* ---------- Presentadora ---------- */

    #updatePresenter(mood) {
        if (!this.presenterImg || this.presenterMood === mood) return;
        this.presenterMood = mood;
        if (mood === 'correct') { this.#stopPresenter(); this.presenterImg.src = './images/correcto.png'; }
        else if (mood === 'incorrect') { this.#stopPresenter(); this.presenterImg.src = './images/incorrecto.png'; }
        else this.#startPresenter();
    }

    #startPresenter() {
        this.#stopPresenter();
        this.presenterIdx = 0;
        this.presenterImg.src = PRESENTER_IMAGES[0];
        this.presenterTimer = setInterval(() => {
            this.presenterImg.classList.add('presenter-fade');
            setTimeout(() => {
                this.presenterIdx = (this.presenterIdx + 1) % PRESENTER_IMAGES.length;
                this.presenterImg.src = PRESENTER_IMAGES[this.presenterIdx];
                this.presenterImg.classList.remove('presenter-fade');
            }, 200);
        }, 4000);
    }

    #stopPresenter() {
        clearInterval(this.presenterTimer);
        this.presenterTimer = null;
    }

    /* ---------- Temporizador ---------- */

    #renderTimer() {
        const box = $('timerBox');
        const t = this.live.data.timer;
        box.classList.toggle('show', !!t && !this.live.data.q?.timerOff);
        this.#tickTimer();
    }

    #tickTimer() {
        const t = this.live.data.timer;
        const box = $('timerBox');
        if (!t || !box.classList.contains('show')) return;

        const ms = this.live.timerRemaining();
        const secs = Math.ceil(ms / 1000);
        $('timerText').textContent = t.finished ? '¡Tiempo!' : `⏱ ${secs}s`;
        $('timerBar').style.width = `${Math.max(0, Math.min(100, (ms / t.durationMs) * 100))}%`;
        box.classList.toggle('warn', secs <= 10 && secs > 5 && !t.finished);
        box.classList.toggle('danger', (secs <= 5 && !t.finished) || t.finished);
        box.classList.toggle('paused', !t.running && !t.finished);

        if (this.admin && t.running && ms <= 0) {
            this.live.set({ timer: { ...t, running: false, remainingMs: 0, finished: true } });
            Effects.sound('timeup');
        }
    }

    startTimer() {
        const t = this.live.data.timer;
        const dur = (this.live.data.q?.timerSeconds || this.state.settings.timerSeconds) * 1000;
        if (!t || t.finished) {
            this.live.set({ timer: { durationMs: dur, remainingMs: dur, endsAt: Date.now() + dur, running: true, finished: false } });
        } else if (!t.running) {
            this.live.set({ timer: { ...t, running: true, endsAt: Date.now() + t.remainingMs } });
        }
    }

    pauseTimer() {
        const t = this.live.data.timer;
        if (!t || !t.running) return;
        this.live.set({ timer: { ...t, running: false, remainingMs: this.live.timerRemaining() } });
    }

    toggleTimer() {
        const t = this.live.data.timer;
        if (t?.running) this.pauseTimer(); else this.startTimer();
    }

    resetTimer() {
        this.live.set({ timer: null });
    }

    /** Timer manual de esta pregunta (campo "Timer" del modal). */
    setTimerConfig() {
        const secs = parseInt($('timerConfigInput').value, 10) || 0;
        if (secs <= 0) return this.disableTimer();
        this.live.patchQ({ timerSeconds: secs, timerOff: false });
        this.resetTimer();
        if (this.typedKey === this.key) this.startTimer();
    }

    disableTimer() {
        this.live.patchQ({ timerOff: true });
        this.resetTimer();
    }

    /* =========================================================
       ACCIONES DEL ADMIN
    ========================================================= */

    #later(fn, ms) {
        const h = setTimeout(() => { this.timeouts.delete(h); fn(); }, ms);
        this.timeouts.add(h);
        return h;
    }

    #clearTimeouts() {
        this.timeouts.forEach(clearTimeout);
        this.timeouts.clear();
    }

    open(col, row) {
        const round = this.state.round;
        const data = round?.questions[col]?.[row];
        if (!data || data.used) return;

        this.#clearTimeouts();
        const list = this.state.participants(round);
        const dd = !!data.dailyDouble && this.state.settings.dailyDoubleEnabled;
        const turn = list.find(p => p.id === this.state.session.turnId) ?? list[0];

        const prev = this.live.data.roulette;
        this.live.set({
            screen: 'question',
            timer: null,
            roulette: { ...prev, visible: false, spinning: false, selectedId: null },
            q: {
                key: uid(), roundId: round.id, col, row,
                dd, phase: dd ? 'bet' : 'open',
                timerSeconds: data.timer > 0 ? data.timer : this.state.settings.timerSeconds,
                timerOff: !this.state.settings.timerEnabled,
                points: data.value, bet: null,
                optionsShown: false, answerShown: false,
                mediaRevealed: [false, false],
                responderId: dd ? (turn?.id ?? null) : null,
                buzzOpen: false, fouls: {}, lastFoul: null,
                buzzedId: null, lockedOut: [], result: null, mood: 'reading'
            }
        });
    }

    toggleOptions() {
        const q = this.live.data.q;
        if (!q || q.optionsShown || q.dd || q.phase !== 'open') return;
        this.live.patchQ({ optionsShown: true, points: Math.floor(q.points / 2) });
    }

    showAnswer() {
        this.live.patchQ({ answerShown: true });
    }

    revealMedia(slot) {
        const idx = slot === 'media2' ? 1 : 0;
        const container = this.el.querySelector(`.spoiler-container[data-slot="${CSS.escape(slot)}"]`);
        container?.classList.add('revealed');
        const q = this.live.data.q;
        if (this.admin && q) {
            const mediaRevealed = [...(q.mediaRevealed || [false, false])];
            mediaRevealed[idx] = true;
            this.live.patchQ({ mediaRevealed });
        }
    }

    toggleBuzzers() {
        const q = this.live.data.q;
        if (q && q.phase === 'open') this.live.patchQ({ buzzOpen: !q.buzzOpen });
    }

    #foul(pid) {
        const q = this.live.data.q;
        const secs = this.state.settings.buzzFoulSeconds;
        if (!secs) return;
        const fouls = { ...(q.fouls || {}), [pid]: Date.now() + secs * 1000 };
        const first = !(q.fouls?.[pid] > Date.now());
        this.live.patchQ({ fouls, lastFoul: { pid, at: Date.now() } });
        if (first) {
            Effects.sound('timeup');
            Effects.toast(`⚠️ ${this.state.participantById(pid)?.name} se adelantó (-${secs}s)`, 'error');
        }
        this.#later(() => {
            const cur = this.live.data.q;
            if (cur?.key === q.key && cur.lastFoul?.pid === pid) this.live.patchQ({ lastFoul: null });
        }, 2500);
    }

    /** remote: viene de un celular, así que solo vale con los buzzers abiertos. */
    buzz(pid, { remote = false } = {}) {
        const q = this.live.data.q;
        if (!q || q.phase !== 'open' || q.dd || q.buzzedId || q.result || q.lockedOut.includes(pid)) return;
        if (remote) {
            // Apretar antes de tiempo (o estando castigado) es una falta: el castigo se reinicia.
            if (!q.buzzOpen || (q.fouls?.[pid] ?? 0) > Date.now()) return this.#foul(pid);
        }
        const round = this.state.roundById(q.roundId);
        if (!this.state.participants(round).some(p => p.id === pid)) return;
        this.pauseTimer();
        this.live.patchQ({ buzzedId: pid, responderId: pid });
        Effects.sound('buzz');
    }

    #ctx(q) {
        const round = this.state.roundById(q.roundId);
        return {
            roundId: q.roundId, col: q.col, row: q.row,
            usedOptions: q.optionsShown, category: round?.categories[q.col]
        };
    }

    correct(pid) {
        const q = this.live.data.q;
        if (!q || q.phase !== 'open' || q.result || q.lockedOut.includes(pid)) return;
        if (q.dd && pid !== q.responderId) return;

        this.scoring.award(pid, q.points, this.#ctx(q));
        this.pauseTimer();
        this.live.patchQ({ result: { type: 'correct', pid }, mood: 'correct', answerShown: true, buzzedId: pid, responderId: pid });
        if (this.state.settings.autoCloseOnCorrect) this.#later(() => this.close(), 4000);
    }

    wrong(pid) {
        const q = this.live.data.q;
        if (!q || q.phase !== 'open' || q.result || q.lockedOut.includes(pid)) return;
        if (q.dd && pid !== q.responderId) return;
        const ctx = this.#ctx(q);

        if (q.dd) {
            this.scoring.penalize(pid, q.points, { ...ctx, consume: true });
            this.pauseTimer();
            this.live.patchQ({ result: { type: 'wrong', pid }, mood: 'incorrect', answerShown: true });
            this.#later(() => this.close(), 5000);
            return;
        }

        this.scoring.penalize(pid, q.points, ctx);
        const lockedOut = [...q.lockedOut, pid];
        this.live.patchQ({ lockedOut, buzzedId: null, responderId: null, mood: 'incorrect' });
        this.#later(() => {
            if (this.live.data.q?.key === q.key && !this.live.data.q.result) this.live.patchQ({ mood: 'reading' });
        }, 4000);

        if (!this.live.data.q.timerOff && this.live.data.timer) {
            this.resetTimer();
            if (this.state.settings.autoTimer) this.startTimer();
        }
    }

    /** Nadie acertó: se marca como usada y se muestra la respuesta. */
    unanswered() {
        const q = this.live.data.q;
        if (!q || q.phase === 'bet') return;
        if (q.result) return this.close(); // ya resuelta: "Terminar" solo cierra
        this.scoring.markUnanswered(this.#ctx(q));
        this.pauseTimer();
        this.live.patchQ({ result: { type: 'none' }, answerShown: true });
        this.#later(() => this.close(), 3500);
    }

    close() {
        this.#clearTimeouts();
        if (!this.live.data.q) return;
        const prev = this.live.data.roulette;
        this.live.set({
            screen: 'board', q: null, timer: null,
            roulette: { ...prev, visible: false, spinning: false }
        });
    }

    /** ¿Hay una pregunta abierta? (para atajos de teclado) */
    get isOpen() {
        return this.live.data.screen === 'question' && !!this.live.data.q;
    }
}
