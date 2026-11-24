/* IndexedDB: partida (v2) + medios como Blobs. Mantiene el mismo esquema
   que la versión anterior, así las partidas guardadas se siguen leyendo. */

import type { GameData, MediaType, Question, Round, Player, Team } from './types.ts';
import { dataURLToBlob, generateColor, uid } from './utils.ts';

const DB_NAME = 'JeopardyDB';
const DB_VERSION = 3;
const GAME_STORE = 'roundsDataStore';
const LEGACY_PLAYERS_STORE = 'playersAndTeams';
const MEDIA_STORE = 'media';
const GAME_KEY = 'gameV2';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            for (const name of [GAME_STORE, LEGACY_PLAYERS_STORE, MEDIA_STORE]) {
                if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => {
            const db = req.result;
            db.onversionchange = () => { db.close(); dbPromise = null; };
            resolve(db);
        };
        req.onerror = () => { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

const getRecord = <T>(store: string, key: string) => run<T | undefined>(store, 'readonly', s => s.get(key));
const putRecord = (store: string, value: unknown) => run(store, 'readwrite', s => s.put(value));

/* ---------- Medios ---------- */

interface MediaRecord { id: string; blob: Blob; type: MediaType; size: number }

export const MediaDB = {
    async put(blob: Blob, type: MediaType): Promise<string> {
        const id = uid();
        await putRecord(MEDIA_STORE, { id, blob, type, size: blob.size } satisfies MediaRecord);
        return id;
    },
    async get(id: string): Promise<Blob | null> {
        return (await getRecord<MediaRecord>(MEDIA_STORE, id))?.blob ?? null;
    },
    async remove(id: string): Promise<void> {
        await run(MEDIA_STORE, 'readwrite', s => s.delete(id));
    },
    async allIds(): Promise<string[]> {
        return (await run(MEDIA_STORE, 'readonly', s => s.getAllKeys())) as string[];
    }
};

/* ---------- Migración del formato antiguo (pre-v2) ---------- */

interface LegacyMedia { type: MediaType; mediaId?: string; url?: string }
type LegacyQuestion = Partial<Question> & { media1?: LegacyMedia | null; media2?: LegacyMedia | null };
interface LegacyRound { name?: string; categories?: string[]; questions?: LegacyQuestion[][] }
interface LegacyPlayer { name: string; score?: number; color?: string; avatar?: string }
interface LegacyTeam { name: string; score?: number; color?: string; members?: string[] }

const LEGACY_ROUND_IDS: Record<string, string> = { individual: 'r-individual', grupal: 'r-grupal' };

async function migrateMedia(media?: LegacyMedia | null) {
    if (!media) return null;
    if (media.mediaId) return { type: media.type, mediaId: media.mediaId };
    if (typeof media.url === 'string' && media.url.startsWith('data:')) {
        try {
            return { type: media.type, mediaId: await MediaDB.put(await dataURLToBlob(media.url), media.type) };
        } catch (e) {
            console.warn('No se pudo migrar un medio', e);
        }
    }
    return null;
}

async function migrateQuestion(q: LegacyQuestion): Promise<Question> {
    return {
        value: Number(q.value) || 0,
        question: q.question || '',
        answer: q.answer || '',
        multipleChoice: q.multipleChoice || '',
        media1: await migrateMedia(q.media1),
        media2: await migrateMedia(q.media2),
        dailyDouble: !!q.dailyDouble,
        timer: Number(q.timer) || 0,
        used: !!q.used,
        usedWithOptions: !!q.usedWithOptions
    };
}

async function migrateLegacy(): Promise<Partial<GameData> | null> {
    const legacyRounds = (await getRecord<{ data: Record<string, LegacyRound> }>(GAME_STORE, 'currentRoundsData'))?.data;
    const legacyPlayers = (await getRecord<{ data: LegacyPlayer[] }>(LEGACY_PLAYERS_STORE, 'jeopardyPlayers'))?.data ?? [];
    const legacyTeams = (await getRecord<{ data: LegacyTeam[] }>(LEGACY_PLAYERS_STORE, 'jeopardyTeams'))?.data ?? [];
    if (!legacyRounds && !legacyPlayers.length && !legacyTeams.length) return null;

    const rounds: Round[] = [];
    for (const [key, r] of Object.entries(legacyRounds || {})) {
        const questions: Question[][] = [];
        for (const col of r.questions || []) questions.push(await Promise.all(col.map(migrateQuestion)));
        rounds.push({
            id: LEGACY_ROUND_IDS[key] || uid(),
            name: r.name || key,
            mode: key === 'grupal' ? 'team' : 'individual',
            categories: r.categories || [],
            questions
        });
    }

    const players: Player[] = legacyPlayers.map(p => ({
        id: uid(), name: p.name, score: p.score || 0, color: p.color || generateColor(), avatar: p.avatar || ''
    }));
    const byName = new Map(players.map(p => [p.name, p.id]));
    const teams: Team[] = legacyTeams.map(t => ({
        id: uid(), name: t.name, score: t.score || 0, color: t.color || generateColor(),
        memberIds: (t.members || []).map(n => byName.get(n)).filter((id): id is string => !!id)
    }));

    return { version: 2, rounds, activeRoundId: rounds[0]?.id ?? null, players, teams };
}

/* ---------- API pública ---------- */

export const Storage = {
    /** Devuelve la partida guardada (migrando si hace falta) o null si es la primera vez. */
    async loadGame(): Promise<Partial<GameData> | null> {
        try {
            const rec = await getRecord<{ data: GameData }>(GAME_STORE, GAME_KEY);
            if (rec?.data) return rec.data;
            const migrated = await migrateLegacy();
            if (migrated) await putRecord(GAME_STORE, { id: GAME_KEY, data: migrated });
            return migrated;
        } catch (e) {
            console.error('No se pudo leer IndexedDB:', e);
            return null;
        }
    },

    async saveGame(data: GameData): Promise<void> {
        try {
            await putRecord(GAME_STORE, { id: GAME_KEY, data });
        } catch (e) {
            console.error('Error al guardar la partida:', e);
            window.dispatchEvent(new CustomEvent('storage-error', { detail: e }));
        }
    },

    /** Elimina los medios que ya no usa ninguna pregunta. */
    async collectGarbage(referencedIds: string[]): Promise<void> {
        try {
            const keep = new Set(referencedIds);
            for (const id of await MediaDB.allIds()) if (!keep.has(id)) await MediaDB.remove(id);
        } catch (e) {
            console.warn('GC de medios falló', e);
        }
    },

    async requestPersistence(): Promise<void> {
        try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
    }
};
