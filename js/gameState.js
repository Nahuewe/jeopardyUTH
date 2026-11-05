/* ================================
   GAME STATE
   Fuente única de verdad de la partida.
   Emite "change" tras cada commit(); guarda con debounce.
================================ */

import { EventBus } from './eventBus.js';
import { Storage } from './storage.js';
import { Utils, uid } from './utils.js';

export const DEFAULT_SETTINGS = Object.freeze({
    timerEnabled: true,
    timerSeconds: 30,
    autoTimer: true,
    deductOnWrong: true,
    dailyDoubleEnabled: true,
    lightningPoints: 100,
    sfx: true,
    autoCloseOnCorrect: false, // cerrar sola la pregunta tras un acierto
    buzzerEnabled: false,   // buzzers remotos activos al abrir la app
    roomCode: '',           // código de sala del buzzer
    publicUrl: ''           // URL pública donde está publicada la app (para el link del buzzer)
});

export const makeQuestion = (value = 100) => ({
    value,
    question: '',
    answer: '',
    multipleChoice: '',
    media1: null,
    media2: null,
    dailyDouble: false,
    timer: 0,               // segundos propios de esta pregunta (0 = el de Ajustes)
    used: false,
    usedWithOptions: false
});

export const makeRound = (name, mode = 'individual') => ({
    id: uid(), name, mode, categories: [], questions: []
});

const HISTORY_LIMIT = 40;
const LOG_LIMIT = 500;

export class GameState extends EventBus {
    constructor({ readOnly = false } = {}) {
        super();
        this.readOnly = readOnly;
        this.mode = 'game';            // 'game' | 'edit' (solo UI local)
        this.uiHidden = false;         // solo UI local
        this.history = [];             // solo admin
        this.rounds = [];
        this.activeRoundId = null;
        this.players = [];
        this.teams = [];
        this.settings = { ...DEFAULT_SETTINGS };
        this.session = { turnId: null, stats: {}, log: [] };
        this.#save = Utils.debounce(() => Storage.saveGame(this.toData()), 200);
        this.#ensureRounds();
    }

    #save;

    /* ---------- Acceso ---------- */

    get round() {
        return this.rounds.find(r => r.id === this.activeRoundId) ?? this.rounds[0];
    }

    isTeamRound(round = this.round) {
        return round?.mode === 'team';
    }

    participants(round = this.round) {
        return this.isTeamRound(round) ? this.teams : this.players;
    }

    participantById(id) {
        return this.players.find(p => p.id === id) ?? this.teams.find(t => t.id === id) ?? null;
    }

    memberNames(team) {
        return (team.memberIds || []).map(id => this.players.find(p => p.id === id)?.name).filter(Boolean);
    }

    roundById(id) {
        return this.rounds.find(r => r.id === id) ?? null;
    }

    getQuestion(roundId, col, row) {
        return this.roundById(roundId)?.questions?.[col]?.[row] ?? null;
    }

    stat(pid) {
        return (this.session.stats[pid] ??= { correct: 0, wrong: 0, points: 0 });
    }

    /* ---------- Carga / serialización ---------- */

    #ensureRounds() {
        if (this.rounds.length) return;
        this.rounds = [
            { ...makeRound('Ronda Individual', 'individual'), id: 'r-individual' },
            { ...makeRound('Ronda Grupal', 'team'), id: 'r-grupal' }
        ];
        this.activeRoundId = this.rounds[0].id;
    }

    load(data) {
        if (!data) return;
        this.rounds = (data.rounds || []).map(r => ({
            id: r.id || uid(),
            name: r.name || 'Ronda',
            mode: r.mode === 'team' ? 'team' : 'individual',
            categories: r.categories || [],
            questions: (r.questions || []).map(col => col.map(q => ({ ...makeQuestion(q.value), ...q })))
        }));
        this.#ensureRounds();
        this.activeRoundId = this.rounds.some(r => r.id === data.activeRoundId) ? data.activeRoundId : this.rounds[0].id;

        this.players = (data.players || []).map(p => ({
            id: p.id || uid(), name: p.name, score: p.score || 0,
            color: p.color || Utils.generateColor(), avatar: p.avatar || ''
        }));
        this.teams = (data.teams || []).map(t => ({
            id: t.id || uid(), name: t.name, score: t.score || 0,
            color: t.color || Utils.generateColor(), memberIds: t.memberIds || []
        }));
        this.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
        this.session = {
            turnId: data.session?.turnId ?? null,
            stats: data.session?.stats ?? {},
            log: data.session?.log ?? []
        };
    }

    toData() {
        return {
            version: 2,
            rounds: this.rounds,
            activeRoundId: this.activeRoundId,
            players: this.players,
            teams: this.teams,
            settings: this.settings,
            session: this.session
        };
    }

    /** Notifica el cambio y (si no es solo lectura) persiste. */
    commit({ persist = true } = {}) {
        this.emit('change', this);
        if (persist && !this.readOnly) this.#save();
    }

    flushSave() {
        if (!this.readOnly) return Storage.saveGame(this.toData());
    }

    setMode(mode) {
        this.mode = mode;
        this.emit('mode', mode);
        this.emit('change', this);
    }

    setActiveRound(id) {
        if (!this.roundById(id) || id === this.activeRoundId) return;
        this.activeRoundId = id;
        this.commit();
    }

    /* ---------- Historial / deshacer ---------- */

    #snapshot() {
        const scores = {};
        [...this.players, ...this.teams].forEach(p => { scores[p.id] = p.score; });
        return {
            scores,
            used: this.rounds.map(r => ({
                id: r.id,
                flags: r.questions.map(col => col.map(q => [q.used, q.usedWithOptions]))
            })),
            turnId: this.session.turnId,
            stats: structuredClone(this.session.stats),
            logLen: this.session.log.length
        };
    }

    pushHistory(label) {
        this.history.push({ label, snap: this.#snapshot() });
        if (this.history.length > HISTORY_LIMIT) this.history.shift();
        this.emit('history', this.history.length);
    }

    canUndo() {
        return this.history.length > 0;
    }

    undo() {
        const entry = this.history.pop();
        if (!entry) return null;
        const { snap } = entry;
        [...this.players, ...this.teams].forEach(p => { if (p.id in snap.scores) p.score = snap.scores[p.id]; });
        for (const saved of snap.used) {
            const round = this.roundById(saved.id);
            if (!round) continue;
            saved.flags.forEach((col, c) => col.forEach(([used, withOpts], r) => {
                const q = round.questions[c]?.[r];
                if (q) { q.used = used; q.usedWithOptions = withOpts; }
            }));
        }
        this.session.turnId = snap.turnId;
        this.session.stats = snap.stats;
        this.session.log.length = Math.min(this.session.log.length, snap.logLen);
        this.emit('history', this.history.length);
        this.commit();
        return entry.label;
    }

    addLog(entry) {
        this.session.log.push({ t: Date.now(), ...entry });
        if (this.session.log.length > LOG_LIMIT) this.session.log.shift();
    }

    /** Siguiente participante en orden (para rotar turnos). */
    nextParticipantId(fromId, round = this.round) {
        const list = this.participants(round);
        if (!list.length) return null;
        const i = list.findIndex(p => p.id === fromId);
        return list[(i + 1) % list.length].id;
    }
}
