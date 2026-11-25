import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MediaStore } from '../engine/media.ts';
import { Effects } from '../engine/effects.ts';
import type { LiveQuestion, MediaRef, Participant, Question, Round, Team } from '../engine/types.ts';
import { DEFAULT_AVATAR, formatScore } from '../engine/utils.ts';
import { Voice } from '../engine/voice.ts';
import { useAnnouncerPresent, useEngine, useGame, useLive } from '../hooks/useEngine.ts';
import { useTypedOptions, useTypewriter } from '../hooks/useTypewriter.ts';
import { Presenter } from './Presenter.tsx';

const isTeam = (p: Participant): p is Team => 'memberIds' in p;

/* ---------- Medios con "spoiler" ---------- */

interface MediaSlotProps { media: MediaRef; slot: 'media1' | 'media2'; revealed: boolean; onReveal: () => void; muted: boolean }

function MediaSlot({ media, slot, revealed, onReveal, muted }: MediaSlotProps) {
    const { admin, sync } = useEngine();
    const url = MediaStore.urlSync(media);
    if (!url) return null;

    // El admin reenvía play/pause/seek al anunciador para que vean lo mismo.
    const relay = (action: string) => (e: React.SyntheticEvent<HTMLMediaElement>) => {
        if (admin && sync.announcerPresent) sync.send('media', { slot, action, time: e.currentTarget.currentTime });
    };
    const common = {
        className: 'spoiler-content-media', 'data-media-slot': slot, src: url, muted,
        onPlay: relay('play'), onPause: relay('pause'), onSeeked: relay('seeked')
    };

    return (
        <div className={revealed ? 'spoiler-container revealed' : 'spoiler-container'} role="button" tabIndex={0}
            data-slot={slot} onClick={onReveal}
            onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReveal(); } }}>
            <span className="spoiler-label">Click para revelar</span>
            <div className="spoiler-content">
                {media.type === 'image' && <img className="spoiler-content-media" data-media-slot={slot} src={url} style={{ maxWidth: 320 }} alt="Imagen de la pregunta" />}
                {media.type === 'audio' && <audio {...common} controls style={{ width: '20rem', height: '2rem' }} />}
                {media.type === 'video' && <video {...common} controls style={{ maxWidth: 320 }} />}
            </div>
        </div>
    );
}

/* ---------- Temporizador ---------- */

function TimerBox({ q }: { q: LiveQuestion }) {
    const { admin, question } = useEngine();
    const live = useLive();
    const [, tick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => {
            tick(n => n + 1);
            if (admin) {
                const t = live.data.timer;
                if (t?.running && live.timerRemaining() <= 0) question.timeUp();
            }
        }, 200);
        return () => clearInterval(id);
    }, [admin, live, question]);

    const t = live.data.timer;
    const show = !!t && !q.timerOff;
    if (!t || !show) return <div className="timer-box" id="timerBox" aria-live="off" />;

    const ms = live.timerRemaining();
    const secs = Math.ceil(ms / 1000);
    const cls = ['timer-box', 'show',
        secs <= 10 && secs > 5 && !t.finished && 'warn',
        ((secs <= 5 && !t.finished) || t.finished) && 'danger',
        !t.running && !t.finished && 'paused'].filter(Boolean).join(' ');

    return (
        <div className={cls} id="timerBox" aria-live="off">
            <span id="timerText">{t.finished ? '¡Tiempo!' : `⏱ ${secs}s`}</span>
            <div className="timer-track">
                <div id="timerBar" className="timer-fill" style={{ width: `${Math.max(0, Math.min(100, (ms / t.durationMs) * 100))}%` }} />
            </div>
        </div>
    );
}

/* ---------- Participantes ---------- */

function PlayersArea({ q, round }: { q: LiveQuestion; round: Round }) {
    const { admin, question } = useEngine();
    const state = useGame();
    const list = state.participants(round);
    const teamMode = state.isTeamRound(round);
    const deduct = state.settings.deductOnWrong;

    if (!list.length) {
        return (
            <div className="players-area" id="playersArea">
                <div className="players-area-empty"><span>⚠️</span><p>¡No hay {teamMode ? 'equipos' : 'jugadores'} para asignar puntos!</p></div>
            </div>
        );
    }

    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    return (
        <div className="players-area" id="playersArea">
            {sorted.map(p => {
                const locked = q.lockedOut.includes(p.id);
                const buzzed = q.buzzedId === p.id || (!q.buzzedId && q.responderId === p.id);
                const done = !!q.result;
                const index = list.findIndex(x => x.id === p.id);
                const cls = ['player-info', buzzed && 'is-responder', locked && 'locked-out'].filter(Boolean).join(' ');
                return (
                    <div key={p.id} className={cls} style={{ borderTopColor: p.color, ['--p-color' as string]: p.color }}>
                        {admin && index >= 0 && index < 9 && <kbd className="buzz-key" title="Tecla para buzzer">{index + 1}</kbd>}
                        {isTeam(p) ? (
                            <div className="team-avatars-row">
                                {state.memberNames(p).map((name, i) => {
                                    const member = state.players.find(x => x.id === p.memberIds[i]);
                                    return <img key={i} src={member?.avatar || DEFAULT_AVATAR} alt={name} title={name}
                                        className="player-avatar team-member-mini" style={{ borderColor: p.color }} />;
                                })}
                            </div>
                        ) : (
                            <img src={p.avatar || DEFAULT_AVATAR} alt={p.name} className="player-avatar" style={{ borderColor: p.color }} />
                        )}
                        <span className="player-name">{p.name}</span>
                        <span className="player-score" style={{ color: p.score < 0 ? 'var(--danger-red)' : 'var(--success-green)' }}>{formatScore(p.score)}</span>
                        {locked && <span className="pc-status bad">✖ Ya falló</span>}
                        {!locked && buzzed && <span className="pc-status ok">🔔 Respondiendo</span>}
                        {admin && (
                            <div className="player-btn-group">
                                <button className="player-add" style={{ background: p.color }} disabled={locked || done} onClick={() => question.correct(p.id)}>✅ +${q.points}</button>
                                <button className="player-deduct" disabled={locked || done} onClick={() => question.wrong(p.id)}>❌ {deduct ? `-$${q.points}` : 'Falló'}</button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ---------- Cartel de quién responde ---------- */

function ResponderBanner({ q, round }: { q: LiveQuestion; round: Round }) {
    const state = useGame();
    const live = useLive();
    const name = (id: string | null | undefined) => state.participantById(id)?.name ?? '';
    const list = state.participants(round);
    let node: React.ReactNode = null;

    if (q.result?.type === 'correct') node = <span className="rb-ok">✅ ¡Correcto, {name(q.result.pid)}!</span>;
    else if (q.result?.type === 'none') node = <span className="rb-bad">Nadie acertó esta pregunta</span>;
    else if (q.buzzedId) node = <span className="rb-info">🔔 {name(q.buzzedId)} respondió primero</span>;
    else if (q.lastFoul) node = <span className="rb-bad">⚠️ {name(q.lastFoul.pid)} se adelantó</span>;
    else if (q.buzzOpen && live.data.buzzerOn && live.data.connected.length) node = <span className="rb-info">🔔 ¡Buzzers abiertos!</span>;
    else if (q.responderId) node = <span className="rb-info">🎯 Le toca a {name(q.responderId)}</span>;
    else if (list.length && q.lockedOut.length >= list.length) node = <span className="rb-bad">😬 Todos fallaron</span>;

    return <div className={node ? 'responder-banner show' : 'responder-banner'} id="responderBanner" aria-live="polite">{node}</div>;
}

/* ---------- Botones del admin ---------- */

function TimerConfig({ q, textDone }: { q: LiveQuestion; textDone: boolean }) {
    const { question } = useEngine();
    const [secs, setSecs] = useState('0');

    // Refleja el timer actual de la pregunta salvo que se esté escribiendo.
    useEffect(() => {
        if (document.activeElement?.id !== 'timerConfigInput') setSecs(String(q.timerOff ? 0 : q.timerSeconds));
    }, [q.key, q.timerSeconds, q.timerOff]);

    return (
        <div className="timer-config-row admin-only">
            <span className="timer-config-label">Timer:</span>
            <input type="number" id="timerConfigInput" className="timer-config-input" min={0} max={600} step={5}
                placeholder="seg" value={secs} onChange={e => setSecs(e.target.value)} />
            <button className="btn btn-timer btn-timer-set" onClick={() => question.setTimerConfig(parseInt(secs, 10) || 0, textDone)}>Activar</button>
            <button className="btn btn-timer btn-timer-off" onClick={() => question.disableTimer()}>✕ Quitar</button>
        </div>
    );
}

function AdminButtons({ q, data }: { q: LiveQuestion; data: Question }) {
    const { question } = useEngine();
    const live = useLive();
    const t = live.data.timer;
    const hasOptions = data.multipleChoice.trim() !== '';

    return (
        <div className="buttons-top admin-only">
            <button className="btn btn-pistas" style={{ display: hasOptions ? 'inline-flex' : 'none' }} disabled={q.optionsShown}
                onClick={() => question.toggleOptions()}>Ver Pistas (50%)</button>
            <button className="btn" disabled={q.answerShown} onClick={() => question.showAnswer()}>Mostrar Respuesta</button>
            <button className="btn" style={{ display: q.timerOff ? 'none' : '' }} onClick={() => question.toggleTimer()}>
                {!t || t.finished ? '⏱ Iniciar timer' : t.running ? '⏸ Pausar timer' : '▶ Reanudar timer'}
            </button>
            <button className="btn" style={{ display: q.timerOff ? 'none' : '' }} title="Reiniciar timer" onClick={() => question.resetTimer()}>↺</button>
            <button className="btn" style={{ display: live.data.buzzerOn && q.phase === 'open' ? '' : 'none' }} title="Atajo: B"
                onClick={() => question.toggleBuzzers()}>{q.buzzOpen ? '🔕 Cerrar buzzers' : '🔔 Abrir buzzers'}</button>
            <button className="btn btn-finish-question" title="Marca la pregunta como usada sin dar puntos (atajo: N)"
                onClick={() => question.unanswered()}>Terminar Pregunta</button>
            <button className="btn danger" title="Atajo: Esc" onClick={() => question.close()}>Cerrar</button>
        </div>
    );
}

/* ---------- Pantalla principal ---------- */

export function QuestionModal() {
    const { admin, question, sync } = useEngine();
    const state = useGame();
    const live = useLive();
    const announcerPresent = useAnnouncerPresent();
    const rootRef = useRef<HTMLDivElement>(null);
    const [localRevealed, setLocalRevealed] = useState<[boolean, boolean]>([false, false]);

    const q = live.data.q;
    const visible = live.data.screen === 'question' && !!q;
    const round = q ? state.roundById(q.roundId) : null;
    const data = q ? state.getQuestion(q.roundId, q.col, q.row) : null;
    const key = q?.key ?? '';

    // La voz solo la usa quien muestra la pregunta (el admin cede al anunciador).
    const speak = useCallback((text: string) => {
        const s = state.settings;
        if (!s.voiceEnabled || (admin && sync.announcerPresent)) return;
        Voice.speak(text, { name: s.voiceName, rate: s.voiceRate });
    }, [state, admin, sync]);

    const typed = useTypewriter(data?.question || '(Sin texto)', key, {
        onStart: () => { if (key && data) speak(data.question); },
        onDone: () => { if (admin && key) question.onQuestionRead(key); }
    });

    const options = (data?.multipleChoice ?? '').split('/').map(o => o.trim()).filter(Boolean);
    const optionLines = useTypedOptions(options, !!q?.optionsShown && options.length > 0, key);

    // Al cambiar de pregunta se reinician los "spoilers" locales.
    useEffect(() => { setLocalRevealed([false, false]); }, [key]);

    // Cortar la voz cuando se muestra la respuesta, hay resultado o se cierra.
    useEffect(() => { if (!visible || q?.answerShown || q?.result) Voice.stop(); }, [visible, q?.answerShown, q?.result]);
    useEffect(() => { if (announcerPresent && admin) Voice.stop(); }, [announcerPresent, admin]);
    useEffect(() => {
        document.body.classList.toggle('modal-open', visible);
        return () => document.body.classList.remove('modal-open');
    }, [visible]);

    // Daily Double: sonido al abrir.
    useEffect(() => { if (admin && q?.dd) Effects.sound('dd'); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

    // El anunciador replica play/pause/seek que hace el admin.
    useEffect(() => {
        if (admin) return;
        return sync.on('media', (m) => {
            const { slot, action, time } = m as { slot: string; action: string; time: number };
            const el = rootRef.current?.querySelector<HTMLMediaElement>(`[data-media-slot="${CSS.escape(slot)}"]`);
            if (!el) return;
            if (Math.abs(el.currentTime - time) > 0.6) el.currentTime = time;
            if (action === 'play') void el.play().catch(() => { });
            if (action === 'pause') el.pause();
        });
    }, [admin, sync]);

    if (!visible || !q || !round || !data) {
        return <div className="modal" id="modal" role="dialog" aria-modal="true" aria-label="Pregunta" />;
    }

    const revealed = (i: 0 | 1) => !!q.mediaRevealed[i] || localRevealed[i];
    const reveal = (slot: 'media1' | 'media2') => {
        const i = slot === 'media2' ? 1 : 0;
        setLocalRevealed(prev => { const n: [boolean, boolean] = [...prev]; n[i] = true; return n; });
        if (admin) question.revealMedia(slot);
    };

    return (
        <div className="modal active" id="modal" role="dialog" aria-modal="true" aria-label="Pregunta" ref={rootRef}
            onClick={e => { if (admin && e.target === e.currentTarget) question.close(); }}>
            <div className="modal-content">
                <div className="modal-main">
                    <h2 id="categoryTitle">{round.categories[q.col] ?? ''}</h2>
                    <div className="value" id="pointValue">${q.points}</div>

                    <TimerBox q={q} />

                    {admin && <TimerConfig q={q} textDone={typed.done} />}

                    <div className={q.dd ? 'dd-banner show' : 'dd-banner'} id="ddBanner">🎲 DAILY DOUBLE · ¡PUNTOS x2! 🎲</div>

                    <div className="question" id="questionText" onClick={typed.finish}>
                        {typed.shown}
                        {typed.done && data.media1 && <MediaSlot media={data.media1} slot="media1" revealed={revealed(0)} onReveal={() => reveal('media1')} muted={admin && announcerPresent} />}
                        {typed.done && data.media2 && <MediaSlot media={data.media2} slot="media2" revealed={revealed(1)} onReveal={() => reveal('media2')} muted={admin && announcerPresent} />}
                    </div>

                    <ResponderBanner q={q} round={round} />

                    <div className={q.optionsShown && options.length ? 'multiple-choice-container show' : 'multiple-choice-container'} id="multipleChoiceContainer">
                        <h3 style={{ textAlign: 'center', marginBottom: 10 }}>Opciones</h3>
                        <div className="multiple-choice-grid" id="multipleChoiceText">
                            {optionLines.map((o, i) => <p key={i} className="multiple-choice-option">{o}</p>)}
                        </div>
                    </div>

                    <div className={q.answerShown ? 'answer show' : 'answer'} id="answerText">{q.answerShown ? data.answer : ''}</div>
                    {admin && <div className="admin-answer admin-only" id="adminAnswer"><strong>🔒 Respuesta (solo vos):</strong> {data.answer || '—'}</div>}

                    {admin && <AdminButtons q={q} data={data} />}

                    <PlayersArea q={q} round={round} />
                </div>

                <Presenter mood={q.mood} />
            </div>
        </div>
    );
}
