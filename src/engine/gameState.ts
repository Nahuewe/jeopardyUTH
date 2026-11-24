/* Fuente única de verdad de la partida.
   Emite "change" tras cada commit(); guarda con debounce.
   Es una clase independiente de React: los componentes la leen con useGame(). */

import { EventBus } from './eventBus.ts';
import { Storage } from './storage.ts';
import type { Credits, GameData, Participant, Player, PlayerStat, Question, Round, RoundMode, Session, Settings, Team } from './types.ts';
import { debounce, generateColor, uid } from './utils.ts';

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
    timerEnabled: true,
    timerSeconds: 30,
    autoTimer: true,
    deductOnWrong: true,
    dailyDoubleEnabled: true,
    lightningPoints: 100,
    sfx: true,
    buzzFoulSeconds: 3,        // castigo por apretar el buzzer antes de que abra (0 = solo se ignora)
    autoCloseOnCorrect: false,
    voiceEnabled: false,
    voiceName: '',
    voiceRate: 1,
    buzzerEnabled: false,
    roomCode: '',
    publicUrl: ''
});

export const DEFAULT_CREDITS: Readonly<Credits> = Object.freeze({
    title: 'Concursillo · UTH Edition',
    entries: [
        { role: 'Desarrollador', name: 'Nahuel Soria Parodi (y Claude)' },
        { role: 'Artista', name: 'Zonoro' },
        { role: 'Anunciador', name: 'Canon' }
    ],
    images: [],
    thanks: '¡Gracias por jugar!'
});

export const normalizeCredits = (c?: Partial<Credits> | null): Credits => ({
    title: String(c?.title ?? DEFAULT_CREDITS.title),
    entries: Array.isArray(c?.entries)
        ? c.entries.map(e => ({ role: String(e.role ?? ''), name: String(e.name ?? '') }))
        : DEFAULT_CREDITS.entries.map(e => ({ ...e })),
    images: Array.isArray(c?.images) ? c.images.filter(m => m?.mediaId) : [],
    thanks: String(c?.thanks ?? DEFAULT_CREDITS.thanks)
});

export const makeQuestion = (value = 100): Question => ({
    value, question: '', answer: '', multipleChoice: '',
    media1: null, media2: null, dailyDouble: false, timer: 0, used: false, usedWithOptions: false
});

export const makeRound = (name: string, mode: RoundMode = 'individual'): Round => ({
    id: uid(), name, mode, categories: [], questions: []
});

const HISTORY_LIMIT = 40;
const LOG_LIMIT = 500;

interface HistoryEntry {
    label: string;
    snap: {
        scores: Record<string, number>;
        used: { id: string; flags: [boolean, boolean][][] }[];
        turnId: string | null;
        stats: Record<string, PlayerStat>;
        logLen: number;
    };
}

type Events = { change: GameState; mode: 'game' | 'edit'; history: number };

export class GameState extends EventBus<Events> {
    readOnly: boolean;
    mode: 'game' | 'edit' = 'game';  // solo UI local
    uiHidden = false;                // solo UI local
    history: HistoryEntry[] = [];    // solo admin
    rounds: Round[] = [];
    activeRoundId: string | null = null;
    players: Player[] = [];
    teams: Team[] = [];
    settings: Settings = { ...DEFAULT_SETTINGS };
    credits: Credits = normalizeCredits();
    session: Session = { turnId: null, stats: {}, log: [] };
    /** Se incrementa en cada cambio: sirve como "versión" para React. */
    version = 0;
    #save = debounce(() => { void Storage.saveGame(this.toData()); }, 200);

    constructor({ readOnly = false } = {}) {
        super();
        this.readOnly = readOnly;
        this.#ensureRounds();
    }

    /* ---------- Acceso ---------- */

    get round(): Round {
        return this.rounds.find(r => r.id === this.activeRoundId) ?? this.rounds[0];
    }

    isTeamRound(round: Round | undefined = this.round): boolean {
        return round?.mode === 'team';
    }

    participants(round: Round | undefined = this.round): Participant[] {
        return this.isTeamRound(round) ? this.teams : this.players;
    }

    participantById(id: string | null | undefined): Participant | null {
        if (!id) return null;
        return this.players.find(p => p.id === id) ?? this.teams.find(t => t.id === id) ?? null;
    }

    memberNames(team: Team): string[] {
        return (team.memberIds || []).map(id => this.players.find(p => p.id === id)?.name).filter((n): n is string => !!n);
    }

    roundById(id: string | null | undefined): Round | null {
        return this.rounds.find(r => r.id === id) ?? null;
    }

    getQuestion(roundId: string, col: number, row: number): Question | null {
        return this.roundById(roundId)?.questions?.[col]?.[row] ?? null;
    }

    stat(pid: string): PlayerStat {
        return (this.session.stats[pid] ??= { correct: 0, wrong: 0, points: 0 });
    }

    /* ---------- Carga / serialización ---------- */

    #ensureRounds(): void {
        if (this.rounds.length) return;
        this.rounds = [
            { ...makeRound('Ronda Individual', 'individual'), id: 'r-individual' },
            { ...makeRound('Ronda Grupal', 'team'), id: 'r-grupal' }
        ];
        this.activeRoundId = this.rounds[0].id;
    }

    load(data?: Partial<GameData> | null): void {
        if (!data) return;
        this.rounds = (data.rounds || []).map(r => ({
            id: r.id || uid(),
            name: r.name || 'Ronda',
            mode: r.mode === 'team' ? 'team' : 'individual',
            categories: r.categories || [],
            questions: (r.questions || []).map(col => col.map(q => ({ ...makeQuestion(q.value), ...q })))
        }));
        this.#ensureRounds();
        this.activeRoundId = this.rounds.some(r => r.id === data.activeRoundId) ? data.activeRoundId! : this.rounds[0].id;

        this.players = (data.players || []).map(p => ({
            id: p.id || uid(), name: p.name, score: p.score || 0, color: p.color || generateColor(), avatar: p.avatar || ''
        }));
        this.teams = (data.teams || []).map(t => ({
            id: t.id || uid(), name: t.name, score: t.score || 0, color: t.color || generateColor(), memberIds: t.memberIds || []
        }));
        this.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
        this.credits = normalizeCredits(data.credits ?? this.credits);
        this.session = {
            turnId: data.session?.turnId ?? null,
            stats: data.session?.stats ?? {},
            log: data.session?.log ?? []
        };
    }

    toData(): GameData {
        return {
            version: 2,
            rounds: this.rounds,
            activeRoundId: this.activeRoundId,
            players: this.players,
            teams: this.teams,
            settings: this.settings,
            credits: this.credits,
            session: this.session
        };
    }

    /** Notifica el cambio y (si no es solo lectura) persiste. */
    commit({ persist = true } = {}): void {
        this.version++;
        this.emit('change', this);
        if (persist && !this.readOnly) this.#save();
    }

    flushSave(): void {
        if (!this.readOnly) void Storage.saveGame(this.toData());
    }

    setMode(mode: 'game' | 'edit'): void {
        this.mode = mode;
        this.emit('mode', mode);
        this.version++;
        this.emit('change', this);
    }

    setActiveRound(id: string): void {
        if (!this.roundById(id) || id === this.activeRoundId) return;
        this.activeRoundId = id;
        this.commit();
    }

    /* ---------- Historial / deshacer ---------- */

    #snapshot(): HistoryEntry['snap'] {
        const scores: Record<string, number> = {};
        [...this.players, ...this.teams].forEach(p => { scores[p.id] = p.score; });
        return {
            scores,
            used: this.rounds.map(r => ({
                id: r.id,
                flags: r.questions.map(col => col.map(q => [q.used, q.usedWithOptions] as [boolean, boolean]))
            })),
            turnId: this.session.turnId,
            stats: structuredClone(this.session.stats),
            logLen: this.session.log.length
        };
    }

    pushHistory(label: string): void {
        this.history.push({ label, snap: this.#snapshot() });
        if (this.history.length > HISTORY_LIMIT) this.history.shift();
        this.emit('history', this.history.length);
    }

    canUndo(): boolean {
        return this.history.length > 0;
    }

    undo(): string | null {
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

    addLog(entry: Record<string, unknown>): void {
        this.session.log.push({ t: Date.now(), ...entry });
        if (this.session.log.length > LOG_LIMIT) this.session.log.shift();
    }

    /** Siguiente participante en orden (para rotar turnos). */
    nextParticipantId(fromId: string | null, round: Round | undefined = this.round): string | null {
        const list = this.participants(round);
        if (!list.length) return null;
        const i = list.findIndex(p => p.id === fromId);
        return list[(i + 1) % list.length].id;
    }
}
