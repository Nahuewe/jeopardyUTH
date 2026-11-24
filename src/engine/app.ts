/* Crea el "motor" de la aplicación (independiente de React). */

import { BuzzerHost } from './buzzerHost.ts';
import { DataTransfer } from './dataTransfer.ts';
import { LightningController } from './lightning.ts';
import { Effects } from './effects.ts';
import { GameState } from './gameState.ts';
import { LiveState } from './liveState.ts';
import { MediaStore } from './media.ts';
import { Participants } from './participants.ts';
import { RouletteController } from './roulette.ts';
import { QuestionController } from './question.ts';
import { Scoring } from './scoring.ts';
import { Storage } from './storage.ts';
import { Sync, type Role } from './sync.ts';
import type { GameData, MediaRef } from './types.ts';

export interface Engine {
    role: Role;
    admin: boolean;
    state: GameState;
    live: LiveState;
    sync: Sync;
    scoring: Scoring;
    question: QuestionController;
    roulette: RouletteController;
    lightning: LightningController;
    participants: Participants;
    data: DataTransfer;
    /** Solo existe en el admin. */
    buzzer: BuzzerHost;
}

export const roleFromUrl = (): Role =>
    new URLSearchParams(location.search).get('view') === 'announcer' ? 'announcer' : 'admin';

export function createEngine(role: Role): Engine {
    const admin = role === 'admin';
    const state = new GameState({ readOnly: !admin });
    const live = new LiveState();
    const sync = new Sync(role);
    Effects.configure({ role, sync, sfxEnabled: () => state.settings.sfx });
    const scoring = new Scoring(state);
    const question = new QuestionController(state, live, scoring);
    return { role, admin, state, live, sync, scoring, question, buzzer: new BuzzerHost(state, live, question),
        roulette: new RouletteController(state, live, scoring), lightning: new LightningController(state, live, scoring),
        participants: new Participants(state), data: new DataTransfer(state) };
}

const allMedia = (data: Partial<GameData>): (MediaRef | null)[] => [
    ...(data.rounds ?? []).flatMap(r => r.questions.flat().flatMap(q => [q.media1, q.media2])),
    ...(data.credits?.images ?? [])
];

/** Carga la partida guardada (admin) y deja los medios listos. */
export async function bootEngine(engine: Engine): Promise<void> {
    const { state, admin, sync, live } = engine;
    if (admin) {
        const saved = await Storage.loadGame();
        if (saved) state.load(saved);
        await MediaStore.preload(allMedia(state.toData()));
        void Storage.requestPersistence();
        engine.buzzer.autoStart();
        void Storage.collectGarbage(MediaStore.collectIds(state.rounds, state.credits.images));

        // El admin empuja su estado al anunciador cuando está conectado.
        const pushState = () => { if (sync.announcerPresent) sync.send('state', state.toData()); };
        const pushLive = () => { if (sync.announcerPresent) sync.send('live', live.data); };
        state.on('change', pushState);
        live.on('change', pushLive);
        sync.on('hello', () => { pushState(); pushLive(); });
        sync.on('presence', (present) => { if (present) { pushState(); pushLive(); } });
        window.addEventListener('beforeunload', () => state.flushSave());
        window.addEventListener('storage-error', () => Effects.toast('⚠️ No se pudo guardar (¿almacenamiento lleno?)', 'error'));
    } else {
        // El anunciador recibe todo del admin, en orden.
        let queue: Promise<void> = Promise.resolve();
        const enqueue = (fn: () => void | Promise<void>) => { queue = queue.then(fn).catch(e => console.error(e)); };

        sync.on('state', (data) => enqueue(async () => {
            await MediaStore.preload(allMedia(data));
            state.load(data);
            state.commit({ persist: false });
        }));
        sync.on('live', (data) => enqueue(() => live.replace(data)));
        sync.on('fx', ({ name, soundOnly }) => {
            if (soundOnly) Effects.playLocalSound(name); else Effects.fireLocal(name);
        });
    }
}
