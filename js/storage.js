/* ================================
   STORAGE
   IndexedDB: partida (v2) + medios como Blobs
   Incluye migración desde el formato anterior.
================================ */

import { uid, Utils } from './utils.js';

const DB_NAME = 'JeopardyDB';
const DB_VERSION = 3;
const GAME_STORE = 'roundsDataStore';       // se reutiliza el store existente
const LEGACY_PLAYERS_STORE = 'playersAndTeams';
const MEDIA_STORE = 'media';
const GAME_KEY = 'gameV2';

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            for (const name of [GAME_STORE, LEGACY_PLAYERS_STORE]) {
                if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
        };
        req.onsuccess = (e) => {
            const db = e.target.result;
            db.onversionchange = () => { db.close(); dbPromise = null; };
            resolve(db);
        };
        req.onerror = (e) => { dbPromise = null; reject(e.target.error); };
    });
    return dbPromise;
}

async function run(store, mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const result = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(result?.result ?? result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

const getRecord = (store, key) => run(store, 'readonly', s => s.get(key));
const putRecord = (store, value) => run(store, 'readwrite', s => s.put(value));

/* ---------- Medios ---------- */

export const MediaDB = {
    async put(blob, type) {
        const id = uid();
        await putRecord(MEDIA_STORE, { id, blob, type, size: blob.size });
        return id;
    },
    async get(id) {
        const rec = await getRecord(MEDIA_STORE, id);
        return rec?.blob ?? null;
    },
    async remove(id) {
        return run(MEDIA_STORE, 'readwrite', s => s.delete(id));
    },
    async allIds() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const req = db.transaction(MEDIA_STORE, 'readonly').objectStore(MEDIA_STORE).getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
};

/* ---------- Migración del formato anterior ---------- */

const LEGACY_ROUND_IDS = { individual: 'r-individual', grupal: 'r-grupal' };

async function migrateMedia(media) {
    if (!media) return null;
    if (media.mediaId) return { type: media.type, mediaId: media.mediaId };
    if (typeof media.url === 'string' && media.url.startsWith('data:')) {
        try {
            const blob = await Utils.dataURLToBlob(media.url);
            return { type: media.type, mediaId: await MediaDB.put(blob, media.type) };
        } catch (e) {
            console.warn('No se pudo migrar un medio', e);
        }
    }
    return null;
}

async function migrateQuestion(q) {
    return {
        value: Number(q.value) || 0,
        question: q.question || '',
        answer: q.answer || '',
        multipleChoice: q.multipleChoice || '',
        media1: await migrateMedia(q.media1),
        media2: await migrateMedia(q.media2),
        dailyDouble: !!q.dailyDouble,
        used: !!q.used,
        usedWithOptions: !!q.usedWithOptions
    };
}

async function migrateLegacy() {
    const legacyRounds = (await getRecord(GAME_STORE, 'currentRoundsData'))?.data;
    const legacyPlayers = (await getRecord(LEGACY_PLAYERS_STORE, 'jeopardyPlayers'))?.data ?? [];
    const legacyTeams = (await getRecord(LEGACY_PLAYERS_STORE, 'jeopardyTeams'))?.data ?? [];
    if (!legacyRounds && !legacyPlayers.length && !legacyTeams.length) return null;

    const rounds = [];
    for (const [key, r] of Object.entries(legacyRounds || {})) {
        const questions = [];
        for (const col of (r.questions || [])) questions.push(await Promise.all(col.map(migrateQuestion)));
        rounds.push({
            id: LEGACY_ROUND_IDS[key] || uid(),
            name: r.name || key,
            mode: key === 'grupal' ? 'team' : 'individual',
            categories: r.categories || [],
            questions
        });
    }

    const players = legacyPlayers.map(p => ({
        id: uid(), name: p.name, score: p.score || 0,
        color: p.color || Utils.generateColor(), avatar: p.avatar || ''
    }));
    const byName = new Map(players.map(p => [p.name, p.id]));
    const teams = legacyTeams.map(t => ({
        id: uid(), name: t.name, score: t.score || 0, color: t.color || Utils.generateColor(),
        memberIds: (t.members || []).map(n => byName.get(n)).filter(Boolean)
    }));

    return { version: 2, rounds, activeRoundId: rounds[0]?.id ?? null, players, teams };
}

/* ---------- API pública ---------- */

export const Storage = {
    /** Devuelve la partida guardada (migrando si hace falta) o null si es la primera vez. */
    async loadGame() {
        try {
            const rec = await getRecord(GAME_STORE, GAME_KEY);
            if (rec?.data) return rec.data;
            const migrated = await migrateLegacy();
            if (migrated) await putRecord(GAME_STORE, { id: GAME_KEY, data: migrated });
            return migrated;
        } catch (e) {
            console.error('No se pudo leer IndexedDB:', e);
            return null;
        }
    },

    async saveGame(data) {
        try {
            await putRecord(GAME_STORE, { id: GAME_KEY, data });
        } catch (e) {
            console.error('Error al guardar la partida:', e);
            window.dispatchEvent(new CustomEvent('storage-error', { detail: e }));
        }
    },

    /** Elimina los medios que ya no usa ninguna pregunta. */
    async collectGarbage(referencedIds) {
        try {
            const keep = new Set(referencedIds);
            for (const id of await MediaDB.allIds()) if (!keep.has(id)) await MediaDB.remove(id);
        } catch (e) {
            console.warn('GC de medios falló', e);
        }
    },

    async requestPersistence() {
        try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
    },

    async estimate() {
        try { return await navigator.storage?.estimate?.(); } catch { return null; }
    }
};
