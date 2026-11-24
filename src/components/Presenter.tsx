import { useEffect, useRef, useState } from 'react';
import { Voice } from '../engine/voice.ts';

const BASE = import.meta.env.BASE_URL;
const READING = ['leyendo', 'tirarCarta', 'presentando'].map(n => `${BASE}images/${n}.png`);
const REACTIONS = { correct: `${BASE}images/correcto.png`, incorrect: `${BASE}images/incorrecto.png` };
const ALL_POSES = [...READING, ...Object.values(REACTIONS)];

// Precarga: así la reacción aparece al instante y no se ve el texto "alt".
const loaded = new Set<string>();
function preload(): void {
    for (const src of ALL_POSES) {
        if (loaded.has(src)) continue;
        const img = new Image();
        img.onload = () => loaded.add(src);
        img.src = src;
    }
}

const poseName = (src: string) => src.split('/').pop()!.replace(/\.[a-z]+$/i, '');

/** La presentadora: rota poses mientras lee y reacciona a aciertos/fallos. */
export function Presenter({ mood }: { mood: 'reading' | 'correct' | 'incorrect' }) {
    const [src, setSrc] = useState(READING[0]);
    const [fading, setFading] = useState(false);
    const [pop, setPop] = useState(0);
    const [speaking, setSpeaking] = useState(false);
    const first = useRef(true);

    useEffect(() => { preload(); Voice.setSpeakingListener(setSpeaking); return () => Voice.setSpeakingListener(null); }, []);

    useEffect(() => {
        if (mood !== 'reading') {
            setFading(false);
            setSrc(REACTIONS[mood]);
            if (!first.current) setPop(p => p + 1);
            first.current = false;
            return;
        }
        first.current = false;
        let idx = 0;
        let fade: ReturnType<typeof setTimeout>;
        setSrc(READING[0]);
        const timer = setInterval(() => {
            setFading(true);
            fade = setTimeout(() => {
                idx = (idx + 1) % READING.length;
                setSrc(READING[idx]);
                setFading(false);
            }, 200);
        }, 4000);
        return () => { clearInterval(timer); clearTimeout(fade); setFading(false); };
    }, [mood]);

    const cls = ['presenter-img', fading && 'presenter-fade', pop > 0 && mood !== 'reading' && 'presenter-pop'].filter(Boolean).join(' ');

    return (
        <div className={speaking ? 'presenter-container speaking' : 'presenter-container'} data-mood={mood}>
            <img key={mood !== 'reading' ? `pop-${pop}` : 'idle'} src={src} className={cls} data-pose={poseName(src)} alt="Presentadora" />
        </div>
    );
}
