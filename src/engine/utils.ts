/* Funciones puras y helpers genéricos */

const ESC_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);

export const uid = (): string =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="%237f8c8d" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3c0 16.2 13.1 29.7 30 29.7H418c16.9 0 30-13.5 30-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>`;

const PALETTE = ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#fab1a0', '#81ecec', '#fd79a8'];

export const generateColor = (): string => PALETTE[Math.floor(Math.random() * PALETTE.length)];

export const formatScore = (n: number): string => (n < 0 ? `-$${Math.abs(n)}` : `$${n}`);

export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
    let t: ReturnType<typeof setTimeout> | undefined;
    const wrapped = (...args: A) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
    wrapped.flush = (...args: A) => { clearTimeout(t); fn(...args); };
    return wrapped;
}

export function readFileAsDataURL(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Error al leer archivo'));
        reader.readAsDataURL(file);
    });
}

export const blobToDataURL = readFileAsDataURL;

export async function dataURLToBlob(dataURL: string): Promise<Blob> {
    return (await fetch(dataURL)).blob();
}

export function getMediaType(file: File): 'image' | 'audio' | 'video' {
    if (file.type.startsWith('video')) return 'video';
    if (file.type.startsWith('audio')) return 'audio';
    return 'image';
}

/** Reduce una imagen a un máximo de `max` px. Devuelve el Blob resultante (o el original). */
export async function resizeImage(file: File, max = 1600, quality = 0.86): Promise<Blob> {
    if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        if (scale === 1 && file.size < 800 * 1024) return file;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality));
        return blob && blob.size < file.size ? blob : file;
    } catch {
        return file;
    }
}

export async function fileToAvatar(file: File, size = 256): Promise<string> {
    return readFileAsDataURL(await resizeImage(file, size, 0.85));
}

export function download(filename: string, content: string | Blob, mime = 'application/json'): void {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pickFile(accept: string): Promise<File | null> {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.oncancel = () => resolve(null);
        input.click();
    });
}

/** Parser CSV (comillas dobles, separadores , o ;). */
export function parseCSV(text: string): string[][] {
    text = text.replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows: string[][] = [];
    let row: string[] = [], cell = '', inQuotes = false;

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
}

export function toCSV(rows: unknown[][]): string {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
}
