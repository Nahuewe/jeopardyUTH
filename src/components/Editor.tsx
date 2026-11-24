import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '../engine/dialog.ts';
import { Effects } from '../engine/effects.ts';
import { makeQuestion } from '../engine/gameState.ts';
import { MediaStore } from '../engine/media.ts';
import type { MediaRef, Question, Round, RoundMode } from '../engine/types.ts';
import { useGame } from '../hooks/useEngine.tsx';
import { useUi } from '../hooks/useUi.tsx';

const TF_OPTIONS = 'Verdadero / Falso';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function swap<T>(arr: T[], i: number, j: number): void { [arr[i], arr[j]] = [arr[j], arr[i]]; }

/** Vista previa de un medio ya cargado. */
function MediaPreview({ media }: { media: MediaRef }) {
    const url = MediaStore.urlSync(media);
    if (!url) return null;
    if (media.type === 'image') return <img className="spoiler-content-media" src={url} style={{ maxWidth: 320 }} alt="Imagen de la pregunta" />;
    if (media.type === 'audio') return <audio className="spoiler-content-media" src={url} controls style={{ width: '20rem', height: '2rem' }} />;
    return <video className="spoiler-content-media" src={url} controls style={{ maxWidth: 320 }} />;
}

interface QuestionEditorProps {
    q: Question; c: number; i: number;
    update: (fn: (q: Question) => void, rerender?: boolean) => void;
    move: (dir: number) => void;
    remove: () => void;
    upload: (slot: 'media1' | 'media2', file: File) => void;
}

function QuestionEditor({ q, c, i, update, move, remove, upload }: QuestionEditorProps) {
    const mediaSlot = (slot: 'media1' | 'media2', n: number) => {
        const media = q[slot];
        return (
            <div className="ed-media">
                <span className="ed-label">Multimedia {n} <small>imagen · audio · video</small></span>
                <input type="file" accept="image/*,video/*,audio/*"
                    onChange={e => { const f = e.target.files?.[0]; if (f) upload(slot, f); e.target.value = ''; }} />
                {media && (
                    <div className="ed-media-preview">
                        <MediaPreview media={media} />
                        <button type="button" className="ed-chip ed-chip-danger" onClick={() => update(x => { x[slot] = null; })}>Quitar</button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <article className={q.dailyDouble ? 'ed-q is-dd' : 'ed-q'}>
            <div className="ed-q-head">
                <span className="ed-q-num">{i + 1}</span>
                <span className="ed-q-points">${q.value}{q.dailyDouble && <em> → ${q.value * 2}</em>}</span>
                {q.dailyDouble && <span className="ed-badge">🎲 Daily Double x2</span>}
                <div className="ed-tools">
                    <button type="button" className="ed-icon" onClick={() => move(-1)} title="Subir pregunta" aria-label="Subir pregunta">⬆</button>
                    <button type="button" className="ed-icon" onClick={() => move(1)} title="Bajar pregunta" aria-label="Bajar pregunta">⬇</button>
                    <button type="button" className="ed-icon ed-icon-danger" onClick={remove} title="Eliminar pregunta" aria-label="Eliminar pregunta">🗑</button>
                </div>
            </div>

            <div className="ed-row">
                <label className="ed-field ed-field-sm">
                    <span className="ed-label">Puntos</span>
                    <input type="number" value={q.value} min={0} step={100}
                        onChange={e => update(x => { x.value = parseInt(e.target.value, 10) || 0; })} />
                </label>
                <label className="ed-field ed-field-sm">
                    <span className="ed-label">⏱ Timer propio (seg)</span>
                    <input type="number" value={q.timer || 0} min={0} max={600} step={5} title="0 = usa el de Ajustes"
                        onChange={e => update(x => { x.timer = Math.max(0, parseInt(e.target.value, 10) || 0); })} />
                </label>
                <label className="ed-switch" title="La pregunta vale el doble de puntos">
                    <input type="checkbox" checked={q.dailyDouble} onChange={e => update(x => { x.dailyDouble = e.target.checked; })} />
                    <span className="ed-switch-ui" aria-hidden="true" />
                    <span>🎲 Daily Double <small>vale el doble</small></span>
                </label>
            </div>

            <div className="ed-row ed-row-2">
                <label className="ed-field">
                    <span className="ed-label">Pregunta</span>
                    <textarea rows={3} placeholder="Escribí la pregunta…" value={q.question} onChange={e => update(x => { x.question = e.target.value; })} />
                </label>
                <label className="ed-field">
                    <span className="ed-label">Respuesta</span>
                    <textarea rows={3} placeholder="Respuesta correcta…" value={q.answer} onChange={e => update(x => { x.answer = e.target.value; })} />
                </label>
            </div>

            <div className="ed-field">
                <span className="ed-label">Opciones múltiples (pistas)
                    <button type="button" className="ed-chip" onClick={() => update(x => { x.multipleChoice = TF_OPTIONS; })}>Verdadero / Falso</button>
                </span>
                <textarea rows={2} aria-label="Opciones múltiples" value={q.multipleChoice}
                    placeholder="Ej: a) Opción 1 / b) Opción 2 / c) Opción 3 (separar con '/')"
                    onChange={e => update(x => { x.multipleChoice = e.target.value; })} />
            </div>

            <div className="ed-row ed-row-2 ed-media-row">{mediaSlot('media1', 1)}{mediaSlot('media2', 2)}</div>
            <span hidden>{c}</span>
        </article>
    );
}

/** Editor de la ronda activa. Trabaja sobre una copia y solo escribe al guardar. */
export function Editor() {
    const state = useGame();
    const { editorOpen, closeEditor } = useUi();
    const [draft, setDraft] = useState<Round | null>(null);
    const [, force] = useState(0);
    const snapshot = useRef('');
    const bodyRef = useRef<HTMLDivElement>(null);
    const backdropDown = useRef(false);

    // Al abrir: copia de la ronda activa + medios cargados.
    useEffect(() => {
        if (!editorOpen) { setDraft(null); return; }
        let alive = true;
        const copy = structuredClone(state.round);
        void MediaStore.preload(copy.questions.flat().flatMap(q => [q.media1, q.media2])).then(() => {
            if (!alive) return;
            snapshot.current = JSON.stringify(copy);
            setDraft(copy);
        });
        return () => { alive = false; };
    }, [editorOpen, state]);

    useEffect(() => {
        document.body.classList.toggle('modal-open', editorOpen);
        return () => document.body.classList.remove('modal-open');
    }, [editorOpen]);

    // El draft se muta in situ; force() vuelve a dibujar.
    const rerender = () => force(n => n + 1);
    const dirty = !!draft && JSON.stringify(draft) !== snapshot.current;

    const requestClose = async () => {
        if (dirty) {
            const ok = await Dialog.confirm({
                icon: 'warning', title: '¿Descartar los cambios?', text: 'Tenés cambios sin guardar en esta ronda.',
                confirmText: 'Descartar', cancelText: 'Seguir editando'
            });
            if (!ok) return;
        }
        closeEditor();
    };

    // Esc: se pospone para que SweetAlert no consuma la misma pulsación.
    const requestCloseRef = useRef(requestClose);
    requestCloseRef.current = requestClose;
    useEffect(() => {
        if (!editorOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !Dialog.isOpen()) { e.preventDefault(); setTimeout(() => void requestCloseRef.current(), 0); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [editorOpen]);

    const summary = useMemo(() => {
        if (!draft) return '';
        const qs = draft.questions.flat();
        const dd = qs.filter(q => q.dailyDouble).length;
        return `${plural(draft.categories.length, 'categoría', 'categorías')} · ${plural(qs.length, 'pregunta', 'preguntas')}`
            + (dd ? ` · ${plural(dd, 'Daily Double', 'Daily Doubles')}` : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el draft se muta in situ
    }, [draft, JSON.stringify(draft)]);

    if (!editorOpen) return <div className="editor-modal admin-only" id="editorModal" />;
    const d = draft;

    const removeCategory = async (c: number) => {
        const ok = await Dialog.confirm({ icon: 'warning', title: `¿Eliminar la categoría "${d!.categories[c]}"?`, confirmText: 'Eliminar' });
        if (!ok) return;
        d!.categories.splice(c, 1);
        d!.questions.splice(c, 1);
        rerender();
    };

    const removeQuestion = async (c: number, i: number) => {
        if (d!.questions[c].length <= 1) { await Dialog.info('No permitido', 'Cada categoría necesita al menos una pregunta.'); return; }
        if (!await Dialog.confirm({ title: '¿Eliminar esta pregunta?', confirmText: 'Eliminar' })) return;
        d!.questions[c].splice(i, 1);
        rerender();
    };

    const randomDailyDouble = () => {
        const all = d!.questions.flatMap(col => col);
        if (!all.length) return;
        all.forEach(q => { q.dailyDouble = false; });
        // Preferir las preguntas de mayor valor, como en el juego original.
        const maxValue = Math.max(...all.map(q => q.value));
        const pool = all.filter(q => q.value >= maxValue * 0.6);
        pool[Math.floor(Math.random() * pool.length)].dailyDouble = true;
        Effects.toast('🎲 Daily Double asignada al azar', 'info');
        rerender();
    };

    const upload = async (c: number, i: number, slot: 'media1' | 'media2', file: File) => {
        try {
            d!.questions[c][i][slot] = await MediaStore.add(file);
            rerender();
        } catch (e) {
            console.error(e);
            void Dialog.info('Error', 'No se pudo cargar el archivo multimedia.', 'error');
        }
    };

    const save = () => {
        if (!d) return;
        if (!d.name.trim()) { void Dialog.info('Falta el nombre', 'La ronda necesita un nombre.', 'warning'); return; }
        if (d.categories.some(c => !c.trim())) { void Dialog.info('Categoría sin nombre', 'Todas las categorías deben tener nombre.', 'warning'); return; }

        const round = state.round;
        round.name = d.name.trim();
        round.mode = d.mode;
        round.categories = d.categories.map(c => c.trim());
        round.questions = d.questions;

        const list = state.participants(round);
        if (!list.some(p => p.id === state.session.turnId)) state.session.turnId = list[0]?.id ?? null;

        closeEditor();
        state.commit();
        Effects.toast(`✅ Ronda "${round.name}" guardada`, 'success');
    };

    return (
        <div className="editor-modal admin-only active" id="editorModal" role="dialog" aria-modal="true" aria-labelledby="editorTitle"
            onMouseDown={e => { backdropDown.current = e.target === e.currentTarget; }}
            onClick={e => { if (e.target === e.currentTarget && backdropDown.current) void requestClose(); }}>
            <div className="editor-content">
                <header className="ed-head">
                    <div className="ed-head-text">
                        <span className="ed-eyebrow">Editor de ronda</span>
                        <h2 id="editorTitle">{state.round.name}</h2>
                    </div>
                    <button type="button" className="ed-close" onClick={() => void requestClose()} aria-label="Cerrar editor" title="Cerrar (Esc)">✕</button>
                </header>

                <div className="ed-body" id="editorBody" ref={bodyRef}>
                    {d && (
                        <>
                            <section className="ed-meta">
                                <label className="ed-field">
                                    <span className="ed-label">Nombre de la ronda</span>
                                    <input type="text" maxLength={60} value={d.name} onChange={e => { d.name = e.target.value; rerender(); }} />
                                </label>
                                <label className="ed-field">
                                    <span className="ed-label">Modo</span>
                                    <select value={d.mode} onChange={e => { d.mode = e.target.value as RoundMode; rerender(); }}>
                                        <option value="individual">Individual (jugadores)</option>
                                        <option value="team">Grupal (equipos)</option>
                                    </select>
                                </label>
                                <div className="ed-toolbar">
                                    <button type="button" className="ed-btn ed-btn-primary"
                                        onClick={() => { d.categories.push('Nueva Categoría'); d.questions.push([makeQuestion(100)]); rerender(); }}>＋ Categoría</button>
                                    <button type="button" className="ed-btn" onClick={randomDailyDouble}>🎲 Daily Double al azar</button>
                                </div>
                            </section>

                            <div id="categoriesEditor">
                                {d.categories.length === 0 && <p className="ed-empty">Esta ronda no tiene categorías todavía. Agregá una con "＋ Categoría".</p>}
                                {d.categories.map((category, c) => (
                                    <section className="ed-cat" key={c}>
                                        <div className="ed-cat-head">
                                            <span className="ed-cat-num">{c + 1}</span>
                                            <input type="text" className="ed-cat-name" value={category} aria-label="Nombre de la categoría" placeholder="Nombre de la categoría"
                                                onChange={e => { d.categories[c] = e.target.value; rerender(); }} />
                                            <div className="ed-tools">
                                                <button type="button" className="ed-icon" title="Subir categoría" aria-label="Subir categoría"
                                                    onClick={() => { if (c > 0) { swap(d.categories, c, c - 1); swap(d.questions, c, c - 1); rerender(); } }}>⬆</button>
                                                <button type="button" className="ed-icon" title="Bajar categoría" aria-label="Bajar categoría"
                                                    onClick={() => { if (c < d.categories.length - 1) { swap(d.categories, c, c + 1); swap(d.questions, c, c + 1); rerender(); } }}>⬇</button>
                                                <button type="button" className="ed-icon ed-icon-text" title="Ordenar preguntas por puntos"
                                                    onClick={() => { d.questions[c].sort((a, b) => a.value - b.value); rerender(); }}>↕ Ordenar</button>
                                                <button type="button" className="ed-icon ed-icon-danger" title="Eliminar categoría" aria-label="Eliminar categoría"
                                                    onClick={() => void removeCategory(c)}>🗑</button>
                                            </div>
                                        </div>
                                        <div className="ed-qlist">
                                            {(d.questions[c] || []).map((q, i) => (
                                                <QuestionEditor key={i} q={q} c={c} i={i}
                                                    update={fn => { fn(q); rerender(); }}
                                                    move={dir => { const j = i + dir; if (j >= 0 && j < d.questions[c].length) { swap(d.questions[c], i, j); rerender(); } }}
                                                    remove={() => void removeQuestion(c, i)}
                                                    upload={(slot, file) => void upload(c, i, slot, file)} />
                                            ))}
                                        </div>
                                        <button type="button" className="ed-add-q" onClick={() => {
                                            const list = (d.questions[c] ??= []);
                                            list.push(makeQuestion(list.length ? list[list.length - 1].value + 100 : 100));
                                            rerender();
                                        }}>＋ Agregar pregunta</button>
                                    </section>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <footer className="ed-foot">
                    <span className="ed-summary" id="editorSummary" aria-live="polite">{summary}</span>
                    <div className="ed-foot-actions">
                        <button type="button" className="ed-btn" onClick={() => void requestClose()}>Cancelar</button>
                        <button type="button" className="ed-btn ed-btn-save" onClick={save}>💾 Guardar cambios</button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
