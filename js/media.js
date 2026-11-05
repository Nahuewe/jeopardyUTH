/* ================================
   MEDIA
   Medios de preguntas (Blobs en IndexedDB + object URLs)
================================ */

import { MediaDB } from './storage.js';
import { Utils, esc } from './utils.js';

const urlCache = new Map(); // mediaId -> objectURL

export const MediaStore = {
    /** Guarda un archivo subido y devuelve { type, mediaId }. */
    async add(file) {
        const type = Utils.getMediaType(file);
        const blob = type === 'image' ? await Utils.resizeImage(file) : file;
        const mediaId = await MediaDB.put(blob, type);
        urlCache.set(mediaId, URL.createObjectURL(blob));
        return { type, mediaId };
    },

    async addFromDataURL(dataURL, type) {
        const blob = await Utils.dataURLToBlob(dataURL);
        const mediaId = await MediaDB.put(blob, type);
        return { type, mediaId };
    },

    /** Carga (si hace falta) el blob y lo deja listo para urlSync(). */
    async preload(list) {
        const ids = [...new Set(list.filter(Boolean).map(m => m.mediaId))];
        await Promise.all(ids.map(async id => {
            if (urlCache.has(id)) return;
            const blob = await MediaDB.get(id);
            if (blob) urlCache.set(id, URL.createObjectURL(blob));
        }));
    },

    urlSync(media) {
        return media ? urlCache.get(media.mediaId) ?? '' : '';
    },

    async toDataURL(media) {
        const blob = await MediaDB.get(media.mediaId);
        return blob ? Utils.blobToDataURL(blob) : null;
    },

    /** HTML del elemento multimedia. */
    html(media, slot) {
        const url = this.urlSync(media);
        if (!media || !url) return '';
        const attrs = `class="spoiler-content-media" data-media-slot="${esc(slot)}" src="${esc(url)}"`;
        switch (media.type) {
            case 'image': return `<img ${attrs} alt="Imagen de la pregunta">`;
            case 'audio': return `<audio ${attrs} controls style="width:20rem;height:2rem;"></audio>`;
            case 'video': return `<video ${attrs} controls style="max-width:320px;"></video>`;
            default: return '';
        }
    },

    /** Medio oculto tras un "spoiler" que se revela con click. */
    spoilerHtml(media, slot, revealed = false) {
        const inner = this.html(media, slot);
        if (!inner) return '';
        return `
            <div class="spoiler-container ${revealed ? 'revealed' : ''}" data-action="reveal-media" data-slot="${esc(slot)}" role="button" tabindex="0">
                <span class="spoiler-label">Click para revelar</span>
                <div class="spoiler-content">${inner}</div>
            </div>`;
    },

    /** Vista previa simple para el editor. */
    previewHtml(media, slot) {
        return this.html(media, slot);
    },

    collectIds(rounds) {
        const ids = [];
        for (const r of rounds) for (const col of r.questions) for (const q of col) {
            if (q.media1) ids.push(q.media1.mediaId);
            if (q.media2) ids.push(q.media2.mediaId);
        }
        return ids;
    }
};
