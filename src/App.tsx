import { useEffect, useRef, useState } from 'react';
import { Board } from './components/Board.tsx';
import { CreditsView } from './components/CreditsView.tsx';
import { ActionsPanel, RoundTabs } from './components/EditMode.tsx';
import { CreditsEditor } from './components/CreditsEditor.tsx';
import { Editor } from './components/Editor.tsx';
import { LightningView } from './components/LightningView.tsx';
import { PodiumView } from './components/PodiumView.tsx';
import { RouletteView } from './components/RouletteView.tsx';
import { QuestionModal } from './components/QuestionModal.tsx';
import { MusicPlayer } from './components/MusicPlayer.tsx';
import { Scoreboard } from './components/Scoreboard.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { Dialog } from './engine/dialog.ts';
import { Effects } from './engine/effects.ts';
import { esc } from './engine/utils.ts';
import { useEngine, useGame, useLive } from './hooks/useEngine.tsx';
import { useUi } from './hooks/useUi.tsx';

const BASE = import.meta.env.BASE_URL;

function showHelp(): void {
    const rows = [
        ['1 – 9', 'Buzzer: marca quién respondió primero'],
        ['Enter / C', 'Respuesta correcta del que responde'],
        ['Backspace / X', 'Respuesta incorrecta del que responde'],
        ['R', 'Mostrar la respuesta al público'],
        ['O', 'Mostrar opciones (mitad de puntos)'],
        ['T', 'Iniciar / pausar el temporizador'],
        ['B', 'Abrir / cerrar los buzzers de los celulares'],
        ['G / S', 'Mostrar/ocultar la ruleta / girarla (fuera de una pregunta)'],
        ['N', 'Terminar pregunta (usada, sin puntos)'],
        ['Esc', 'Cerrar la pregunta'],
        ['Ctrl + Z', 'Deshacer el último cambio de puntos'],
        ['?', 'Esta ayuda']
    ];
    void Dialog.fire({
        title: '⌨️ Atajos de teclado',
        html: `<table class="help-table">${rows.map(([k, d]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(d)}</td></tr>`).join('')}</table>`,
        confirmButtonColor: '#5865f2'
    });
}

function Header() {
    return (
        <div className="header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <img src={`${BASE}images/señalando.png`} style={{ height: '10em', transform: 'scaleX(-1)' }} alt="" />
                <h1>Concursillo - UTH Edition</h1>
                <img src={`${BASE}images/señalando.png`} style={{ height: '10em' }} alt="" />
            </div>
            <p className="header-credits">
                Desarrollado por <span className="credits-name">Nahuel Soria Parodi</span>{' '}
                <span className="credits-joke">(y <span className="credits-claude">Claude</span>)</span>
            </p>
        </div>
    );
}

/** El anunciador necesita un click para que el navegador permita el audio. */
function AnnouncerIntro({ onEnter }: { onEnter: () => void }) {
    const [hidden, setHidden] = useState(false);
    if (hidden) return null;
    return (
        <div id="introScreen" style={{ animation: undefined }}>
            <div className="curtain curtain-left" />
            <div className="curtain curtain-right" />
            <h1 className="intro-title">¡Bienvenidos a Jeopardy UTH!</h1>
            <button className="announcer-enter" onClick={() => { setHidden(true); onEnter(); }}>▶ Entrar a la vista pública</button>
        </div>
    );
}

export default function App() {
    const { admin, scoring, question, roulette, lightning, state: engineState } = useEngine();
    const state = useGame();
    const live = useLive();
    const ui = useUi();
    const [unlocked, setUnlocked] = useState(admin);

    useEffect(() => {
        document.title = admin ? 'Concursillo - UTH Edition' : 'Concursillo - Vista pública';
    }, [admin]);

    // Atajos de teclado (solo admin); se ignoran con un editor abierto.
    const uiOpen = useRef(false);
    uiOpen.current = ui.editorOpen || ui.creditsEditorOpen;
    useEffect(() => {
        if (!admin) return;
        const responder = () => live.data.q?.buzzedId ?? live.data.q?.responderId ?? null;
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement;
            if (t.matches?.('input, textarea, select, [contenteditable="true"]') || Dialog.isOpen() || e.altKey || uiOpen.current) return;

            // Activar con teclado los elementos con role="button"
            if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[role="button"]')) return;

            const key = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); scoring.undo(); return; }
            if (e.ctrlKey || e.metaKey) return;
            if (key === '?') { showHelp(); return; }

            if (question.isOpen) {
                const q = live.data.q!;
                if (/^[1-9]$/.test(key)) {
                    const p = state.participants(state.roundById(q.roundId) ?? undefined)[+key - 1];
                    if (p) question.buzz(p.id);
                    return;
                }
                const ask = () => Effects.toast('Elegí quién responde (teclas 1-9)', 'info');
                switch (key) {
                    case 'escape': question.close(); break;
                    case 'r': question.showAnswer(); break;
                    case 'o': question.toggleOptions(); break;
                    case 't': question.toggleTimer(); break;
                    case 'b': question.toggleBuzzers(); break;
                    case 'n': question.unanswered(); break;
                    case 'enter': case 'c': { const pid = responder(); if (pid) question.correct(pid); else ask(); break; }
                    case 'backspace': case 'x': { const pid = responder(); if (pid) question.wrong(pid); else ask(); break; }
                }
                return;
            }
            if (key === 'g') { roulette.toggle(); return; }
            if (key === 's') { roulette.spin(); return; }
            if (key === 'escape') {
                const s = live.data.screen;
                if (s === 'lightning') lightning.close();
                else if (s === 'podium' || s === 'credits') live.set({ screen: 'board' });
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [admin, scoring, question, roulette, lightning, live, state]);

    useEffect(() => { if (!admin) engineState.setMode('game'); }, [admin, engineState]);

    return (
        <>
            {!admin && <AnnouncerIntro onEnter={() => setUnlocked(true)} />}
            <div className="container">
                {admin && <Toolbar />}
                <RouletteView />
                <Header />
                {admin && <ActionsPanel />}
                {state.mode === 'game' ? (
                    <div id="gameModeContainer" className="mode-content" style={{ display: 'block' }}>
                        <Scoreboard />
                        <Board onOpenCell={(c, r) => question.open(c, r)} onOpenLightning={() => lightning.open()} />
                    </div>
                ) : <RoundTabs />}
            </div>
            <QuestionModal />
            <LightningView />
            <PodiumView />
            {admin && <Editor />}
            {admin && <CreditsEditor />}
            <CreditsView />
            <MusicPlayer unlocked={unlocked} />
        </>
    );
}
