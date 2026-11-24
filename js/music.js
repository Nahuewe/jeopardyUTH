/* ================================
   MUSIC
   Lista de pistas de fondo. Mixkit License (uso libre, sin atribución):
   https://mixkit.co/license/#sfxFree
================================ */

export const TRACKS = [
    { id: 0, label: '🎬 Quién quiere ser millonario', src: './audio/Música preguntas 1 - 5 (Quien Quiere ser millonario).mp3' },
    { id: 1, label: '🎤 Karma (concurso)', src: './audio/music/karma.mp3' },
    { id: 2, label: '🎤 Light it Up Boy (concurso)', src: './audio/music/light-it-up-boy.mp3' },
    { id: 3, label: '🕺 Dancing Fit (animada)', src: './audio/music/dancing-fit.mp3' },
    { id: 4, label: '🎷 Upbeat Jazz', src: './audio/music/upbeat-jazz.mp3' },
    { id: 5, label: '💃 Latin Lovers', src: './audio/music/latin-lovers.mp3' },
    { id: 6, label: '🎸 Funkee Monkeee', src: './audio/music/funkee-monkeee.mp3' },
    { id: 7, label: '🥁 Epical Drums (tensión)', src: './audio/music/epical-drums.mp3' },
    { id: 8, label: '😰 Echoes (suspenso)', src: './audio/music/echoes.mp3' }
];

export const trackById = (id) => TRACKS.find(t => t.id === id) ?? TRACKS[0];
export const nextTrackId = (id) => TRACKS[(TRACKS.findIndex(t => t.id === id) + 1) % TRACKS.length].id;
