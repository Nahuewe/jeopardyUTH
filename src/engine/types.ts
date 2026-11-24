/* Tipos compartidos del juego */

export type MediaType = 'image' | 'audio' | 'video';
export interface MediaRef { type: MediaType; mediaId: string }

export interface Question {
    value: number;
    question: string;
    answer: string;
    multipleChoice: string;
    media1: MediaRef | null;
    media2: MediaRef | null;
    dailyDouble: boolean;
    timer: number;
    used: boolean;
    usedWithOptions: boolean;
}

export type RoundMode = 'individual' | 'team';

export interface Round {
    id: string;
    name: string;
    mode: RoundMode;
    categories: string[];
    questions: Question[][];
}

export interface Player { id: string; name: string; score: number; color: string; avatar: string }
export interface Team { id: string; name: string; score: number; color: string; memberIds: string[] }
export type Participant = Player | Team;

export interface PlayerStat { correct: number; wrong: number; points: number }
export interface LogEntry { t: number; [key: string]: unknown }
export interface Session {
    turnId: string | null;
    stats: Record<string, PlayerStat>;
    log: LogEntry[];
}

export interface Settings {
    timerEnabled: boolean;
    timerSeconds: number;
    autoTimer: boolean;
    deductOnWrong: boolean;
    dailyDoubleEnabled: boolean;
    lightningPoints: number;
    sfx: boolean;
    buzzFoulSeconds: number;
    autoCloseOnCorrect: boolean;
    voiceEnabled: boolean;
    voiceName: string;
    voiceRate: number;
    buzzerEnabled: boolean;
    roomCode: string;
    publicUrl: string;
}

export interface CreditEntry { role: string; name: string }
export interface Credits {
    title: string;
    entries: CreditEntry[];
    images: MediaRef[];
    thanks: string;
}

export interface GameData {
    version: number;
    rounds: Round[];
    activeRoundId: string | null;
    players: Player[];
    teams: Team[];
    settings: Settings;
    credits: Credits;
    session: Session;
}

/* ---------- Estado 'en vivo' (admin -> anunciador) ---------- */

export type Screen = 'board' | 'question' | 'lightning' | 'podium' | 'credits';

export interface TimerState {
    running: boolean;
    endsAt: number;
    remainingMs: number;
    durationMs: number;
    finished: boolean;
}

export interface RouletteState {
    visible: boolean;
    angle: number;
    spinning: boolean;
    durationMs: number;
    selectedId: string | null;
    nonce: number;
}

export interface MusicState { playing: boolean; volume: number; track: number }

export type QuestionResult = { type: 'correct'; pid: string } | { type: 'none' };

/** Pregunta abierta en pantalla. */
export interface LiveQuestion {
    key: string;
    roundId: string;
    col: number;
    row: number;
    dd: boolean;
    phase: 'open';
    timerSeconds: number;
    timerOff: boolean;
    points: number;
    optionsShown: boolean;
    answerShown: boolean;
    mediaRevealed: [boolean, boolean];
    responderId: string | null;
    buzzOpen: boolean;
    fouls: Record<string, number>;
    lastFoul: { pid: string; at: number } | null;
    buzzedId: string | null;
    lockedOut: string[];
    result: QuestionResult | null;
    mood: 'reading' | 'correct' | 'incorrect';
}

export interface LightningState {
    phase: 'setup' | 'play' | 'winner';
    category: string;
    order: string[];
    idx: number;
    eliminated: string[];
    points: number;
}

export interface LiveData {
    screen: Screen;
    q: LiveQuestion | null;
    timer: TimerState | null;
    roulette: RouletteState;
    lightning: LightningState | null;
    creditsNonce: number;
    buzzerOn: boolean;
    connected: string[];
    music: MusicState;
}
