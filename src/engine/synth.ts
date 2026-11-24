/* Sonidos sintetizados con WebAudio (respaldo de las grabaciones y efectos del juego). */

let audioCtx: AudioContext | null = null;

export function ctx(): AudioContext | null {
    try {
        audioCtx ??= new AudioContext();
        if (audioCtx.state === 'suspended') void audioCtx.resume();
        return audioCtx;
    } catch (e) {
        console.warn('WebAudio no disponible:', e);
        return null;
    }
}

export function playTones(notes: number[], { type = 'sine', step = 0.09, gain = 0.12 }: { type?: OscillatorType; step?: number; gain?: number } = {}): void {
    const c = ctx();
    if (!c) return;
    const now = c.currentTime;
    notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        const t0 = now + i * step;
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + step);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + step);
    });
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
    if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
}

interface BurstOpts { gain?: number; freq?: number; q?: number; type?: BiquadFilterType }

/** Ráfaga de ruido filtrado (palmas, redoble, golpes). */
function burst(c: AudioContext, t0: number, dur: number, { gain = 0.2, freq = 1800, q = 0.8, type = 'bandpass' }: BurstOpts = {}): void {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.02);
}

interface NoteOpts { type?: OscillatorType; gain?: number; to?: number | null; attack?: number; vibrato?: number }

/** Nota con envolvente; admite barrido de frecuencia y vibrato. */
function note(c: AudioContext, t0: number, dur: number, freq: number, { type = 'sine', gain = 0.12, to = null, attack = 0.01, vibrato = 0 }: NoteOpts = {}): void {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    if (vibrato) {
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = 6; lg.gain.value = vibrato;
        lfo.connect(lg); lg.connect(osc.frequency);
        lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
}

const withCtx = (fn: (c: AudioContext, t: number) => void) => () => {
    const c = ctx();
    if (c) fn(c, c.currentTime + 0.02);
};

/** Efectos que el admin puede lanzar a mano sobre la música. */
export const SOUNDBOARD = [
    { id: 'applause', label: '👏 Aplausos' },
    { id: 'drumroll', label: '🥁 Redoble' },
    { id: 'fanfare', label: '🎺 Fanfarria' },
    { id: 'bell', label: '🔔 Campana' },
    { id: 'wrong', label: '❌ Error' },
    { id: 'sadtrombone', label: '😢 Trombón triste' },
    { id: 'siren', label: '🚨 Sirena' },
    { id: 'suspense', label: '😰 Suspenso' },
    { id: 'coin', label: '🪙 Moneda' },
    { id: 'airhorn', label: '📯 Corneta' }
] as const;

export type SoundboardId = (typeof SOUNDBOARD)[number]['id'];

export const SYNTH: Record<SoundboardId, () => void> = {
    applause: withCtx((c, t) => {
        for (let i = 0; i < 90; i++) {
            const k = i / 90;
            const env = Math.sin(Math.PI * Math.min(1, k * 1.1)) ** 0.6;
            burst(c, t + Math.random() * 3.2, 0.05 + Math.random() * 0.05,
                { gain: 0.05 + 0.12 * env * Math.random(), freq: 1200 + Math.random() * 2800, q: 0.6 });
        }
    }),
    drumroll: withCtx((c, t) => {
        const n = 46;
        for (let i = 0; i < n; i++) {
            burst(c, t + i * 0.052, 0.06, { gain: 0.07 + 0.2 * (i / n), freq: 220 + 120 * (i % 2), q: 1.2 });
        }
        burst(c, t + n * 0.052, 0.5, { gain: 0.35, freq: 140, q: 0.7 });
        note(c, t + n * 0.052, 0.6, 90, { type: 'triangle', gain: 0.3, to: 45 });
    }),
    fanfare: withCtx((c, t) => {
        const seq = [[392, 0.14], [392, 0.14], [392, 0.14], [523, 0.5], [415, 0.5], [466, 0.5], [523, 0.22], [466, 0.12], [523, 0.9]];
        let at = t;
        for (const [f, d] of seq) {
            note(c, at, d + 0.08, f, { type: 'sawtooth', gain: 0.07, attack: 0.02, vibrato: 3 });
            note(c, at, d + 0.08, f * 1.5, { type: 'square', gain: 0.025, attack: 0.02 });
            at += d;
        }
    }),
    bell: withCtx((c, t) => {
        [[880, 0.28], [1760, 0.12], [2640, 0.07], [3520, 0.04]].forEach(([f, g], i) =>
            note(c, t, 1.8 - i * 0.3, f, { gain: g, attack: 0.003 }));
    }),
    wrong: withCtx((c, t) => {
        note(c, t, 0.7, 150, { type: 'sawtooth', gain: 0.16, to: 110, attack: 0.005 });
        note(c, t, 0.7, 156, { type: 'square', gain: 0.08, to: 116, attack: 0.005 });
    }),
    sadtrombone: withCtx((c, t) => {
        [[311, 0.45], [294, 0.45], [277, 0.45]].forEach(([f, d], i) =>
            note(c, t + i * 0.5, d, f, { type: 'sawtooth', gain: 0.1, attack: 0.04, vibrato: 2 }));
        note(c, t + 1.5, 1.4, 262, { type: 'sawtooth', gain: 0.12, to: 196, attack: 0.05, vibrato: 6 });
    }),
    siren: withCtx((c, t) => {
        for (let i = 0; i < 3; i++) {
            note(c, t + i * 0.9, 0.45, 650, { gain: 0.12, to: 1050, attack: 0.05 });
            note(c, t + i * 0.9 + 0.45, 0.45, 1050, { gain: 0.12, to: 650, attack: 0.05 });
        }
    }),
    suspense: withCtx((c, t) => {
        note(c, t, 3.6, 55, { type: 'sawtooth', gain: 0.1, attack: 1.8, vibrato: 1.5 });
        note(c, t, 3.6, 58, { type: 'sawtooth', gain: 0.08, attack: 1.8 });
        for (let i = 0; i < 12; i++) note(c, t + i * 0.3, 0.12, 220 + i * 18, { type: 'triangle', gain: 0.035 + i * 0.004 });
    }),
    coin: withCtx((c, t) => {
        note(c, t, 0.08, 988, { type: 'square', gain: 0.07, attack: 0.002 });
        note(c, t + 0.08, 0.5, 1319, { type: 'square', gain: 0.07, attack: 0.002 });
    }),
    airhorn: withCtx((c, t) => {
        for (let i = 0; i < 3; i++) {
            const s = t + i * 0.42;
            [440, 554, 659].forEach(f => note(c, s, 0.34, f * 1.003, { type: 'sawtooth', gain: 0.06, attack: 0.015 }));
        }
    })
};
