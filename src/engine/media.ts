/* Medios de preguntas (Blobs en IndexedDB + object URLs) */

import type { MediaRef, Round } from './types.ts';
import { MediaDB } from './storage.ts';
import { blobToDataURL, dataURLToBlob, getMediaType, resizeImage } from './utils.ts';

const urlCache = new Map<string, string>(); // mediaId -> objectURL

export const MediaStore = {
    /** Guarda un archivo subido y devuelve la referencia. */
    async add(file: File): Promise<MediaRef> {
        const type = getMediaType(file);
        const blob = type === 'image' ? await resizeImage(file) : file;
        const mediaId = await MediaDB.put(blob, type);
        urlCache.set(mediaId, URL.createObjectURL(blob));
        return { type, mediaId };
    },

    async addFromDataURL(dataURL: string, type: MediaRef['type']): Promise<MediaRef> {
        const mediaId = await MediaDB.put(await dataURLToBlob(dataURL), type);
        return { type, mediaId };
    },

    /** Carga (si hace falta) los blobs para que urlSync() devuelva algo. */
    async preload(list: (MediaRef | null | undefined)[]): Promise<void> {
        const ids = [...new Set(list.filter((m): m is MediaRef => !!m).map(m => m.mediaId))];
        await Promise.all(ids.map(async id => {
            if (urlCache.has(id)) return;
            const blob = await MediaDB.get(id);
            if (blob) urlCache.set(id, URL.createObjectURL(blob));
        }));
    },

    urlSync(media: MediaRef | null | undefined): string {
        return media ? urlCache.get(media.mediaId) ?? '' : '';
    },

    async toDataURL(media: MediaRef): Promise<string | null> {
        const blob = await MediaDB.get(media.mediaId);
        return blob ? blobToDataURL(blob) : null;
    },

    collectIds(rounds: Round[], extra: MediaRef[] = []): string[] {
        const ids = extra.filter(Boolean).map(m => m.mediaId);
        for (const r of rounds) for (const col of r.questions) for (const q of col) {
            if (q.media1) ids.push(q.media1.mediaId);
            if (q.media2) ids.push(q.media2.mediaId);
        }
        return ids;
    }
};
