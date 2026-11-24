/* ================================
   CREDITS
   Créditos finales en cascada, al estilo "Star Wars".
   - El admin los abre/cierra; el anunciador los ve por LiveState.
   - El editor (solo admin) permite cambiar nombres y sumar imágenes.
================================ */

import { Dialog } from './dialog.js';
import { Effects } from './effects.js';
import { MediaStore } from './media.js';
import { normalizeCredits } from './gameState.js';
import { esc } from './utils.js';

const SPEED = 55;       // px por segundo
const MIN_SECONDS = 24;

export class Credits {
    constructor({ state, live, role }) {
        this.state = state;
        this.live = live;
        this.admin = role === 'admin';
        this.el = document.getElementById('creditsModal');
        this.sig = '';

        live.on('change', (d) => this.render(d));
        state.on('change', () => this.render(live.data));
    }

    /* ---------- Admin: abrir / cerrar ---------- */

    open() {
        if (this.live.data.screen === 'credits') return this.replay();
        this.live.set({ screen: 'credits', creditsNonce: (this.live.data.creditsNonce || 0) + 1 });
    }

    replay() {
        this.live.set({ creditsNonce: (this.live.data.creditsNonce || 0) + 1 });
    }

    close() {
        this.live.set({ screen: 'board' });
    }

    get isOpen() {
        return this.live.data.screen === 'credits';
    }

    /* ---------- Render ---------- */

    render(l = this.live.data) {
        const visible = l.screen === 'credits';
        this.el.classList.toggle('active', visible);
        document.body.classList.toggle('modal-open', visible);
        if (!visible) { this.sig = ''; this.el.innerHTML = ''; return; }

        const c = this.state.credits;
        const sig = JSON.stringify([l.creditsNonce, c]);
        if (sig === this.sig) return;
        this.sig = sig;

        this.el.innerHTML = this.#html(c);
        this.#startCrawl();
    }

    #html(c) {
        const images = (c.images || []).map(m => MediaStore.urlSync(m)).filter(Boolean);
        // Mismo rol (sin importar mayúsculas ni espacios) = un solo bloque con todos los nombres.
        const groups = new Map();
        for (const e of c.entries || []) {
            const role = e.role.trim(), name = e.name.trim();
            if (!role && !name) continue;
            const key = role.toLowerCase();
            if (!groups.has(key)) groups.set(key, { role, names: [] });
            if (name) groups.get(key).names.push(name);
        }
        const entries = [...groups.values()].map(g => ({ role: g.role, name: g.names.join(' · ') }));
        return `
            <div class="cr-stars" aria-hidden="true"></div>
            <div class="cr-stage">
                <div class="cr-plane">
                    <div class="cr-crawl" aria-label="Créditos">
                        <h2 class="cr-heading">Créditos</h2>
                        <p class="cr-title">${esc(c.title)}</p>
                        ${entries.map(e => `
                            <div class="cr-entry">
                                <div class="cr-role">${esc(e.role)}</div>
                                <div class="cr-name">${esc(e.name)}</div>
                            </div>`).join('')}
                        ${images.length ? `<div class="cr-images">${images.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div>` : ''}
                        ${c.thanks ? `<p class="cr-thanks">${esc(c.thanks)}</p>` : ''}
                    </div>
                </div>
            </div>
            ${this.admin ? `
            <div class="cr-controls admin-only">
                <button type="button" class="btn" data-action="credits-replay">↺ Repetir</button>
                <button type="button" class="btn danger" data-action="credits-close">✕ Cerrar créditos</button>
            </div>` : ''}`;
    }

    #startCrawl() {
        const crawl = this.el.querySelector('.cr-crawl');
        const stage = this.el.querySelector('.cr-stage');
        if (!crawl || !stage) return;
        const run = () => {
            const travel = crawl.offsetHeight + stage.offsetHeight * 1.1;
            crawl.style.setProperty('--cr-travel', `${travel}px`);
            crawl.style.setProperty('--cr-dur', `${Math.max(MIN_SECONDS, travel / SPEED)}s`);
            crawl.classList.add('run');
        };
        // Las imágenes cambian la altura: se espera a que carguen antes de medir.
        const imgs = [...crawl.querySelectorAll('img')];
        Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })))
            .then(() => setTimeout(run, 50));
    }

    /* =========================================================
       EDITOR DE CRÉDITOS (admin)
    ========================================================= */

    async edit() {
        const draft = structuredClone(normalizeCredits(this.state.credits));
        await MediaStore.preload(draft.images);

        const res = await Dialog.fire({
            title: '🎬 Editar créditos',
            width: 'min(720px, 96vw)',
            html: '<div class="cr-editor" id="crEditor"></div>',
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            showCloseButton: true,
            confirmButtonColor: '#27ae60',
            didOpen: () => this.#mountEditor(draft),
            preConfirm: () => draft
        });
        if (!res.isConfirmed) return;

        draft.entries = draft.entries.filter(e => e.role.trim() || e.name.trim());
        this.state.credits = draft;
        this.state.commit();
        Effects.toast('🎬 Créditos guardados', 'success');
    }

    #mountEditor(draft) {
        const root = document.getElementById('crEditor');
        const entryRow = (e, i) => `
            <div class="cr-ed-row">
                <input type="text" data-k="role" data-i="${i}" value="${esc(e.role)}" placeholder="Rol (ej: Artista)" maxlength="40">
                <input type="text" data-k="name" data-i="${i}" value="${esc(e.name)}" placeholder="Nombre" maxlength="60">
                <button type="button" class="cr-ed-x" data-do="del-entry" data-i="${i}" title="Quitar" aria-label="Quitar">🗑</button>
            </div>`;

        const draw = () => {
            root.innerHTML = `
                <label class="cr-ed-field"><span>Título</span>
                    <input type="text" data-k="title" value="${esc(draft.title)}" maxlength="60"></label>

                <div class="cr-ed-block">
                    <div class="cr-ed-head"><span>Personas</span>
                        <button type="button" class="cr-ed-add" data-do="add-entry">＋ Agregar</button></div>
                    ${draft.entries.map(entryRow).join('') || '<p class="cr-ed-empty">Sin nombres todavía.</p>'}
                </div>

                <div class="cr-ed-block">
                    <div class="cr-ed-head"><span>Imágenes <small>(se muestran al final, antes del agradecimiento)</small></span>
                        <button type="button" class="cr-ed-add" data-do="add-image">＋ Imagen</button></div>
                    <input type="file" id="crFile" accept="image/*" multiple hidden>
                    <div class="cr-ed-images">
                        ${draft.images.map((m, i) => `
                            <figure class="cr-ed-img">
                                <img src="${esc(MediaStore.urlSync(m))}" alt="">
                                <button type="button" data-do="del-image" data-i="${i}" title="Quitar" aria-label="Quitar imagen">✕</button>
                            </figure>`).join('') || '<p class="cr-ed-empty">Sin imágenes.</p>'}
                    </div>
                </div>

                <label class="cr-ed-field"><span>Agradecimiento final</span>
                    <input type="text" data-k="thanks" value="${esc(draft.thanks)}" maxlength="80"></label>`;
        };
        draw();

        root.addEventListener('input', (e) => {
            const k = e.target.dataset.k;
            if (!k) return;
            if (e.target.dataset.i !== undefined) draft.entries[+e.target.dataset.i][k] = e.target.value;
            else draft[k] = e.target.value;
        });

        root.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-do]');
            if (!btn) return;
            const i = +btn.dataset.i;
            switch (btn.dataset.do) {
                case 'add-entry': draft.entries.push({ role: '', name: '' }); draw(); break;
                case 'del-entry': draft.entries.splice(i, 1); draw(); break;
                case 'del-image': draft.images.splice(i, 1); draw(); break;
                case 'add-image': document.getElementById('crFile').click(); break;
            }
        });

        root.addEventListener('change', async (e) => {
            if (e.target.id !== 'crFile') return;
            try {
                for (const file of e.target.files) draft.images.push(await MediaStore.add(file));
                draw();
            } catch (err) {
                console.error(err);
                Effects.toast('No se pudo cargar la imagen', 'error');
            }
        });
    }
}
