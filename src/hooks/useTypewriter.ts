import { useEffect, useRef, useState } from 'react';

export const TYPING_SPEED = 30;

/** Efecto máquina de escribir. Reinicia cuando cambia `resetKey`. */
export function useTypewriter(text: string, resetKey: string, { onStart, onDone }: { onStart?: () => void; onDone?: () => void } = {}) {
    const [shown, setShown] = useState('');
    const [done, setDone] = useState(false);
    const finishRef = useRef<() => void>(() => { });
    const cbs = useRef({ onStart, onDone });
    cbs.current = { onStart, onDone };

    useEffect(() => {
        setShown('');
        setDone(false);
        let i = 0;
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            clearInterval(timer);
            setShown(text);
            setDone(true);
            cbs.current.onDone?.();
        };
        finishRef.current = finish;
        cbs.current.onStart?.();
        const timer = setInterval(() => {
            if (i < text.length) setShown(text.slice(0, ++i));
            else finish();
        }, TYPING_SPEED);
        if (!text) finish();
        return () => { finished = true; clearInterval(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reinicia con resetKey
    }, [resetKey]);

    return { shown, done, finish: () => finishRef.current() };
}

/** Escribe las opciones una por una (con pausa entre cada una). */
export function useTypedOptions(options: string[], active: boolean, resetKey: string): string[] {
    const [lines, setLines] = useState<string[]>([]);

    useEffect(() => {
        if (!active) { setLines([]); return; }
        let cancelled = false;
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        void (async () => {
            const out: string[] = [];
            for (const text of options) {
                out.push('');
                for (const ch of text) {
                    if (cancelled) return;
                    out[out.length - 1] += ch;
                    setLines([...out]);
                    await sleep(TYPING_SPEED);
                }
                await sleep(900);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reinicia con resetKey/active
    }, [active, resetKey]);

    return lines;
}
