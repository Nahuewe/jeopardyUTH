/* Lista de pistas de fondo. Mixkit License (uso libre, sin atribución). */

export interface Track { id: number; label: string; src: string }

const BASE = import.meta.env.BASE_URL;

export const TRACKS: Track[] = [
    { id: 0, label: '🎬 Quién quiere ser millonario', src: `${BASE}audio/Música preguntas 1 - 5 (Quien Quiere ser millonario).mp3` },
    { id: 1, label: '🎤 Karma (concurso)', src: `${BASE}audio/music/karma.mp3` },
    { id: 2, label: '🎤 Light it Up Boy (concurso)', src: `${BASE}audio/music/light-it-up-boy.mp3` },
    { id: 3, label: '🕺 Dancing Fit (animada)', src: `${BASE}audio/music/dancing-fit.mp3` },
    { id: 4, label: '🎷 Upbeat Jazz', src: `${BASE}audio/music/upbeat-jazz.mp3` },
    { id: 5, label: '💃 Latin Lovers', src: `${BASE}audio/music/latin-lovers.mp3` },
    { id: 6, label: '🎸 Funkee Monkeee', src: `${BASE}audio/music/funkee-monkeee.mp3` },
    { id: 7, label: '🥁 Epical Drums (tensión)', src: `${BASE}audio/music/epical-drums.mp3` },
    { id: 8, label: '😰 Echoes (suspenso)', src: `${BASE}audio/music/echoes.mp3` }
];

export const trackById = (id: number): Track => TRACKS.find(t => t.id === id) ?? TRACKS[0];
