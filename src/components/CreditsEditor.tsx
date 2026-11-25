import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../engine/dialog.ts';
import { Effects } from '../engine/effects.ts';
import { normalizeCredits } from '../engine/gameState.ts';
import { MediaStore } from '../engine/media.ts';
import type { Credits, MediaRef } from '../engine/types.ts';
import { useGame } from '../hooks/useEngine.ts';
import { useUi } from '../hooks/useUi.ts';

/** Editor de créditos finales (nombres, imágenes y agradecimiento). */
export function CreditsEditor() {
    const state = useGame();
    const { creditsEditorOpen, closeCreditsEditor } = useUi();
    const [draft, setDraft] = useState<Credits | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!creditsEditorOpen) { setDraft(null); return; }
        let alive = true;
        const copy = structuredClone(normalizeCredits(state.credits));
        void MediaStore.preload(copy.images).then(() => { if (alive) setDraft(copy); });
        return () => { alive = false; };
    }, [creditsEditorOpen, state]);

    useEffect(() => {
        if (!creditsEditorOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !Dialog.isOpen()) closeCreditsEditor(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [creditsEditorOpen, closeCreditsEditor]);

    if (!creditsEditorOpen) return null;

    const update = (fn: (c: Credits) => void) => setDraft(prev => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        fn(next);
        return next;
    });

    const addImages = async (files: FileList | null) => {
        if (!files?.length) return;
        try {
            const added: MediaRef[] = [];
            for (const f of files) added.push(await MediaStore.add(f));
            update(c => { c.images.push(...added); });
        } catch (e) {
            console.error(e);
            Effects.toast('No se pudo cargar la imagen', 'error');
        }
    };

    const save = () => {
        if (!draft) return;
        state.credits = { ...draft, entries: draft.entries.filter(e => e.role.trim() || e.name.trim()) };
        state.commit();
        closeCreditsEditor();
        Effects.toast('🎬 Créditos guardados', 'success');
    };

    return (
        <div className="editor-modal admin-only active" role="dialog" aria-modal="true" aria-labelledby="crEditorTitle"
            onClick={e => { if (e.target === e.currentTarget) closeCreditsEditor(); }}>
            <div className="editor-content" style={{ maxWidth: 720 }}>
                <header className="ed-head">
                    <div className="ed-head-text">
                        <span className="ed-eyebrow">Fin del concursillo</span>
                        <h2 id="crEditorTitle">🎬 Editar créditos</h2>
                    </div>
                    <button type="button" className="ed-close" onClick={closeCreditsEditor} aria-label="Cerrar" title="Cerrar (Esc)">✕</button>
                </header>

                <div className="ed-body">
                    {draft && (
                        <div className="cr-editor">
                            <label className="cr-ed-field"><span>Título</span>
                                <input type="text" maxLength={60} value={draft.title} onChange={e => update(c => { c.title = e.target.value; })} /></label>

                            <div className="cr-ed-block">
                                <div className="cr-ed-head"><span>Personas</span>
                                    <button type="button" className="cr-ed-add" onClick={() => update(c => { c.entries.push({ role: '', name: '' }); })}>＋ Agregar</button></div>
                                {draft.entries.length === 0 && <p className="cr-ed-empty">Sin nombres todavía.</p>}
                                {draft.entries.map((e, i) => (
                                    <div className="cr-ed-row" key={i}>
                                        <input type="text" value={e.role} placeholder="Rol (ej: Artista)" maxLength={40}
                                            onChange={ev => update(c => { c.entries[i].role = ev.target.value; })} />
                                        <input type="text" value={e.name} placeholder="Nombre" maxLength={60}
                                            onChange={ev => update(c => { c.entries[i].name = ev.target.value; })} />
                                        <button type="button" className="cr-ed-x" title="Quitar" aria-label="Quitar"
                                            onClick={() => update(c => { c.entries.splice(i, 1); })}>🗑</button>
                                    </div>
                                ))}
                            </div>

                            <div className="cr-ed-block">
                                <div className="cr-ed-head"><span>Imágenes <small>(se muestran al final, antes del agradecimiento)</small></span>
                                    <button type="button" className="cr-ed-add" onClick={() => fileRef.current?.click()}>＋ Imagen</button></div>
                                <input type="file" ref={fileRef} accept="image/*" multiple hidden
                                    onChange={e => { void addImages(e.target.files); e.target.value = ''; }} />
                                <div className="cr-ed-images">
                                    {draft.images.length === 0 && <p className="cr-ed-empty">Sin imágenes.</p>}
                                    {draft.images.map((m, i) => (
                                        <figure className="cr-ed-img" key={m.mediaId}>
                                            <img src={MediaStore.urlSync(m)} alt="" />
                                            <button type="button" title="Quitar" aria-label="Quitar imagen" onClick={() => update(c => { c.images.splice(i, 1); })}>✕</button>
                                        </figure>
                                    ))}
                                </div>
                            </div>

                            <label className="cr-ed-field"><span>Agradecimiento final</span>
                                <input type="text" maxLength={80} value={draft.thanks} onChange={e => update(c => { c.thanks = e.target.value; })} /></label>
                        </div>
                    )}
                </div>

                <footer className="ed-foot">
                    <span className="ed-summary" />
                    <div className="ed-foot-actions">
                        <button type="button" className="ed-btn" onClick={closeCreditsEditor}>Cancelar</button>
                        <button type="button" className="ed-btn ed-btn-save" onClick={save}>💾 Guardar</button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
