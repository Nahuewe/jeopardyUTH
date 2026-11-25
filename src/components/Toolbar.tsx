import { useEffect, useState, useSyncExternalStore } from 'react';
import { openBuzzerDialog } from './BuzzerPanel.tsx';
import { Effects } from '../engine/effects.ts';
import { openSettings } from '../engine/settingsDialog.ts';
import { TRACKS } from '../engine/music.ts';
import { SOUNDBOARD } from '../engine/synth.ts';
import { useAnnouncerPresent, useEngine, useGame, useLive } from '../hooks/useEngine.ts';

/** Panel de efectos de sonido para lanzar sobre la música. */
function SfxBoard() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <div className="sfx-wrap">
            <button className="mode-btn" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="sfxBoard">
                🔊 Efectos
            </button>
            <div id="sfxBoard" className="sfx-board" hidden={!open} role="group" aria-label="Efectos de sonido">
                {SOUNDBOARD.map(s => (
                    <button key={s.id} type="button" className="mode-btn" onClick={() => Effects.sound(s.id)}>{s.label}</button>
                ))}
                <button type="button" className="mode-btn sfx-stop" onClick={() => Effects.sound('stopsfx')}>⏹ Detener efectos</button>
            </div>
        </div>
    );
}

function MusicControls() {
    const live = useLive();
    const { playing, volume, track = 0 } = live.data.music;
    const setMusic = (patch: Partial<typeof live.data.music>) => live.set({ music: { ...live.data.music, ...patch } });

    return (
        <>
            <button id="musicBtn" className="mode-btn" onClick={() => setMusic({ playing: !playing })}>
                {playing ? '⏸️ Pausar Música' : '🎵 Reproducir Música'}
            </button>
            <select id="musicTrack" className="mode-btn music-track" aria-label="Pista de música" title="Pista de música"
                value={track} onChange={e => setMusic({ track: Number(e.target.value) })}>
                {TRACKS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <div id="volumeContainer" style={{ display: playing ? 'flex' : 'none', alignItems: 'center', gap: 8 }}>
                <label htmlFor="musicVolume" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>🔊</label>
                <input type="range" id="musicVolume" min={0} max={1} step={0.01} value={volume}
                    onChange={e => setMusic({ volume: parseFloat(e.target.value) })}
                    style={{ width: 90, cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
            </div>
        </>
    );
}

export function Toolbar() {
    const engine = useEngine();
    const { scoring, roulette, buzzer } = engine;
    const state = useGame();
    const live = useLive();
    useSyncExternalStore((cb) => buzzer.on('change', cb), () => buzzer.version);
    const present = useAnnouncerPresent();

    const openAnnouncer = () => {
        const url = new URL(location.href);
        url.search = '?view=announcer';
        url.hash = '';
        window.open(url.toString(), 'jeopardy-announcer');
    };

    const toggleUI = () => {
        state.uiHidden = !state.uiHidden;
        document.body.classList.toggle('ui-hidden', state.uiHidden);
        state.commit({ persist: false });
    };

    const openCredits = () => live.set({ screen: 'credits', creditsNonce: live.data.creditsNonce + 1 });

    return (
        <div className="mode-controls-panel admin-only" role="toolbar" aria-label="Controles del juego">
            <button className={state.mode === 'game' ? 'mode-btn active' : 'mode-btn'} onClick={() => state.setMode('game')}>Modo Juego</button>
            <button className={state.mode === 'edit' ? 'mode-btn active' : 'mode-btn'} onClick={() => state.setMode('edit')}>Modo Edición</button>
            <MusicControls />
            <SfxBoard />
            <button className={live.data.roulette.visible ? 'mode-btn active-roulette' : 'mode-btn'} onClick={() => roulette.toggle()}>🎰 Ruleta</button>
            <button className="mode-btn" disabled={!state.canUndo()} onClick={() => scoring.undo()} title="Ctrl+Z">↩️ Deshacer</button>
            <button className="mode-btn" onClick={() => void openSettings(state)}>⚙️ Ajustes</button>
            <button className="mode-btn" onClick={() => { live.set({ screen: 'podium' }); Effects.fire('tada'); }}>🏆 Finalizar</button>
            <button className="mode-btn" onClick={openCredits}>🎬 Créditos</button>
            <button className="mode-btn" onClick={openAnnouncer}>📺 Abrir anunciador</button>
            <button className={buzzer.status === 'on' ? 'mode-btn on' : 'mode-btn'} onClick={() => openBuzzerDialog(engine)}>📱 Buzzers</button>
            <span className={present ? 'announcer-status on' : 'announcer-status'}>
                {present ? '📺 Anunciador conectado' : '📺 Sin anunciador'}
            </span>
            <button id="toggleUiBtn" className="mode-btn" onClick={toggleUI}>{state.uiHidden ? 'Mostrar UI' : 'Ocultar UI'}</button>
        </div>
    );
}
