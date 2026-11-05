/* ================================
   UTILS
   Funciones puras y helpers genéricos
================================ */

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para insertarlo de forma segura en innerHTML / atributos. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);

export const uid = () =>
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

export const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="%237f8c8d" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3c0 16.2 13.1 29.7 30 29.7H418c16.9 0 30-13.5 30-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>`;

const PALETTE = ["#ff7675", "#74b9ff", "#55efc4", "#ffeaa7", "#a29bfe", "#fab1a0", "#81ecec", "#fd79a8"];

export const Utils = {
    TYPING_SPEED: 30,

    generateColor() {
        return PALETTE[Math.floor(Math.random() * PALETTE.length)];
    },

    formatScore(n) {
        return n < 0 ? `-$${Math.abs(n)}` : `$${n}`;
    },

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[data-lib="${src}"]`)) return resolve();
            const s = document.createElement('script');
            s.src = src;
            s.dataset.lib = src;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error(`No se pudo cargar ${src}. ¿Hay conexión a internet?`));
            document.head.appendChild(s);
        });
    },

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    },

    debounce(fn, ms) {
        let t;
        const wrapped = (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
        wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
        return wrapped;
    },

    /**
     * Efecto máquina de escribir. Devuelve un controlador { cancel, finish }.
     * No usa innerHTML con el texto: es seguro frente a HTML inyectado.
     */
    typeWrite(element, text, { speed = Utils.TYPING_SPEED, onDone } = {}) {
        element.textContent = '';
        let i = 0;
        let done = false;
        let timer = null;

        const finish = () => {
            if (done) return;
            done = true;
            clearInterval(timer);
            element.textContent = text;
            onDone?.();
        };

        if (!text) {
            finish();
            return { cancel() { }, finish() { } };
        }

        timer = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i++);
                if (element.parentElement) element.parentElement.scrollTop = element.parentElement.scrollHeight;
            } else {
                finish();
            }
        }, speed);

        return {
            cancel() { done = true; clearInterval(timer); },
            finish
        };
    },

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Error al leer archivo'));
            reader.readAsDataURL(file);
        });
    },

    blobToDataURL(blob) {
        return Utils.readFileAsDataURL(blob);
    },

    async dataURLToBlob(dataURL) {
        const res = await fetch(dataURL);
        return res.blob();
    },

    getMediaType(file) {
        if (file.type.startsWith('video')) return 'video';
        if (file.type.startsWith('audio')) return 'audio';
        return 'image';
    },

    /** Reduce una imagen a un máximo de `max` px. Devuelve Blob (o el original si no hace falta). */
    async resizeImage(file, max = 1600, quality = 0.86) {
        if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
            if (scale === 1 && file.size < 800 * 1024) return file;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
            return blob && blob.size < file.size ? blob : file;
        } catch {
            return file;
        }
    },

    async fileToAvatar(file, size = 256) {
        const blob = await Utils.resizeImage(file, size, 0.85);
        return Utils.readFileAsDataURL(blob);
    },

    download(filename, content, mime = 'application/json') {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    },

    pickFile(accept) {
        return new Promise(resolve => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.onchange = () => resolve(input.files?.[0] ?? null);
            input.oncancel = () => resolve(null);
            input.click();
        });
    },

    /** Parser CSV (comillas dobles, separadores , o ;). Devuelve array de filas. */
    parseCSV(text) {
        text = text.replace(/^﻿/, '');
        const firstLine = text.split(/\r?\n/, 1)[0] || '';
        const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
        const rows = [];
        let row = [], cell = '', inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
                else if (c === '"') inQuotes = false;
                else cell += c;
            } else if (c === '"') inQuotes = true;
            else if (c === delim) { row.push(cell); cell = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(cell); cell = '';
                if (row.some(v => v.trim() !== '')) rows.push(row);
                row = [];
            } else cell += c;
        }
        row.push(cell);
        if (row.some(v => v.trim() !== '')) rows.push(row);
        return rows;
    },

    toCSV(rows) {
        const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
    }
};
