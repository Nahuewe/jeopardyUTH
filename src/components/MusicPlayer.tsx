import { useEffect, useRef } from 'react';
import { trackById } from '../engine/music.ts';
import { useAnnouncerPresent, useEngine, useLive } from '../hooks/useEngine.tsx';

/** Reproduce la pista elegida. Si hay anunciador, suena allí y no en el admin. */
export function MusicPlayer({ unlocked = true }: { unlocked?: boolean }) {
    const { admin } = useEngine();
    const live = useLive();
    const announcerPresent = useAnnouncerPresent();
    const ref = useRef<HTMLAudioElement>(null);

    const { playing, volume, track = 0 } = live.data.music;
    const iPlay = admin ? !announcerPresent : unlocked;
    const src = trackById(track).src;

    useEffect(() => {
        const audio = ref.current;
        if (!audio) return;
        audio.volume = volume;
        if (playing && iPlay) void audio.play().catch(() => { });
        else audio.pause();
    }, [playing, iPlay, volume, src]);

    return <audio ref={ref} src={src} loop preload="auto" />;
}
