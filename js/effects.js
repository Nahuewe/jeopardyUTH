/* ================================
   EFFECTS
   Sonidos sintetizados, animaciones y toasts.
   Si hay una vista de anunciador conectada, el audio se
   reproduce allí (es la pestaña que se comparte).
================================ */

let audioCtx = null;
let cfg = { role: 'admin', sfxEnabled: () => true, sync: null };

function ctx() {
    try {
        audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    } catch (e) {
        console.warn('WebAudio no disponible:', e);
        return null;
    }
}

function playTones(notes, { type = 'sine', step = 0.09, gain = 0.12 } = {}) {
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

/* ---------- Bloques para efectos más elaborados ---------- */

let noiseBuf = null;
function noise(c) {
    if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
}

/** Ráfaga de ruido filtrado (palmas, redoble, golpes). */
function burst(c, t0, dur, { gain = 0.2, freq = 1800, q = 0.8, type = 'bandpass' } = {}) {
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

/** Nota con envolvente; admite barrido de frecuencia y vibrato. */
function note(c, t0, dur, freq, { type = 'sine', gain = 0.12, to = null, attack = 0.01, vibrato = 0 } = {}) {
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

const withCtx = (fn) => () => { const c = ctx(); if (c) fn(c, c.currentTime + 0.02); };

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
];

const EXTRA_SOUNDS = {
    applause: withCtx((c, t) => {
        for (let i = 0; i < 90; i++) {
            const k = i / 90;
            const env = Math.sin(Math.PI * Math.min(1, k * 1.1)) ** 0.6; // sube y baja
            burst(c, t + Math.random() * 3.2, 0.05 + Math.random() * 0.05,
                { gain: 0.05 + 0.12 * env * Math.random(), freq: 1200 + Math.random() * 2800, q: 0.6 });
        }
    }),
    drumroll: withCtx((c, t) => {
        const n = 46;
        for (let i = 0; i < n; i++) {
            const k = i / n;
            burst(c, t + i * 0.052, 0.06, { gain: 0.07 + 0.2 * k, freq: 220 + 120 * (i % 2), q: 1.2 });
        }
        burst(c, t + n * 0.052, 0.5, { gain: 0.35, freq: 140, q: 0.7 });          // golpe final
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
            note(c, t + i * 0.9, 0.45, 650, { type: 'sine', gain: 0.12, to: 1050, attack: 0.05 });
            note(c, t + i * 0.9 + 0.45, 0.45, 1050, { type: 'sine', gain: 0.12, to: 650, attack: 0.05 });
        }
    }),
    suspense: withCtx((c, t) => {
        note(c, t, 3.6, 55, { type: 'sawtooth', gain: 0.1, attack: 1.8, vibrato: 1.5 });
        note(c, t, 3.6, 58, { type: 'sawtooth', gain: 0.08, attack: 1.8 });
        for (let i = 0; i < 12; i++) {
            note(c, t + i * 0.3, 0.12, 220 + i * 18, { type: 'triangle', gain: 0.035 + i * 0.004 });
        }
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

/* Grabaciones reales (audio/sfx/<id>.mp3, Mixkit License). Si el archivo
   no carga, se usa la versión sintetizada de respaldo. */
const sfxEls = {};
function playFile(id) {
    let el = sfxEls[id];
    if (!el) {
        el = sfxEls[id] = new Audio(`./audio/sfx/${id}.mp3`);
        el.preload = 'auto';
        el.volume = 0.8;
    }
    if (el.dataset.broken) return EXTRA_SOUNDS[id]?.();
    el.onerror = () => { el.dataset.broken = '1'; EXTRA_SOUNDS[id]?.(); };
    el.currentTime = 0;
    el.play().catch((e) => { if (e.name !== 'NotAllowedError') EXTRA_SOUNDS[id]?.(); });
}
const FILE_SOUNDS = Object.fromEntries(SOUNDBOARD.map(s => [s.id, () => playFile(s.id)]));
FILE_SOUNDS.stopsfx = () => Object.values(sfxEls).forEach(el => { el.pause(); el.currentTime = 0; });

const SOUNDS = {
    ...EXTRA_SOUNDS,
    ...FILE_SOUNDS,
    win: () => playTones([880, 988, 1318], { step: 0.08 }),
    deduct: () => playTones([330, 294, 262], { type: 'triangle', step: 0.1, gain: 0.15 }),
    buzz: () => playTones([660, 880, 660, 880], { type: 'square', step: 0.07, gain: 0.08 }),
    timeup: () => playTones([440, 330, 247, 196], { type: 'sawtooth', step: 0.18, gain: 0.1 }),
    dd: () => playTones([392, 523, 659, 784, 1047], { step: 0.11 }),
    tada: () => playTones([523, 659, 784, 1047, 784, 1047], { step: 0.12 }),
    roulette: () => {
        const el = document.getElementById('rouletteTick');
        if (el) { el.currentTime = 0; el.volume = 0.1; el.play().catch(() => { }); }
    }
};

function emojiRain(emojis, countDesktop, countMobile, maxDelay, sizeBase, sizeRange) {
    const container = document.createElement('div');
    container.className = 'money-anim-container';
    const count = window.innerWidth < 600 ? countMobile : countDesktop;
    container.innerHTML = Array.from({ length: count }, () => {
        const left = Math.random() * 100;
        const delay = (Math.random() * maxDelay).toFixed(2);
        const rot = Math.random() * 360;
        const size = (sizeBase + Math.random() * sizeRange).toFixed(2);
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        return `<span class="money-anim-item" style="left:${left}%;animation-delay:${delay}s;font-size:${size}rem;transform:translateY(-10vh) rotate(${rot}deg)">${emoji}</span>`;
    }).join('');
    document.body.appendChild(container);
    setTimeout(() => {
        container.classList.add('fade-out');
        setTimeout(() => container.remove(), 600);
    }, 2500);
}

function confetti(count = 120) {
    const colors = ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#fd79a8', '#f6e58d'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    container.innerHTML = Array.from({ length: count }, () => {
        const left = Math.random() * 100;
        const delay = (Math.random() * 1.5).toFixed(2);
        const dur = (2.5 + Math.random() * 2.5).toFixed(2);
        const color = colors[Math.floor(Math.random() * colors.length)];
        const w = 6 + Math.random() * 8;
        return `<i style="left:${left}%;background:${color};width:${w}px;height:${w * 1.6}px;animation-delay:${delay}s;animation-duration:${dur}s"></i>`;
    }).join('');
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 7500);
}

const VISUALS = {
    win: () => emojiRain(['💸', '💵', '💰', '🤑', '✨', '🎉'], 22, 12, 0.8, 1, 1.2),
    deduct: () => emojiRain(['❌', '📉', '🤕', '💀', '😬', '🫠'], 18, 10, 0.6, 0.9, 0.9),
    tada: () => confetti()
};

export const Effects = {
    /** role: 'admin' | 'announcer'; sync: instancia de Sync (para enrutar audio). */
    configure(options) {
        cfg = { ...cfg, ...options };
    },

    playLocalSound(name) {
        if (!cfg.sfxEnabled()) return;
        SOUNDS[name]?.();
    },

    /** Reproduce sonido + animación en esta pestaña. */
    fireLocal(name, { sound = true } = {}) {
        VISUALS[name]?.();
        if (sound) this.playLocalSound(name);
    },

    /** Dispara un efecto. Si hay anunciador, el sonido se oye allí. */
    fire(name) {
        const announcer = cfg.role === 'admin' && cfg.sync?.announcerPresent;
        if (announcer) cfg.sync.send('fx', { name });
        this.fireLocal(name, { sound: !announcer });
    },

    /** Solo sonido (sin animación), con el mismo enrutamiento. */
    sound(name) {
        const announcer = cfg.role === 'admin' && cfg.sync?.announcerPresent;
        if (announcer) cfg.sync.send('fx', { name, soundOnly: true });
        else this.playLocalSound(name);
    },

    toast(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `uth-toast uth-toast-${type}`;
        el.setAttribute('role', 'status');
        el.textContent = message;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('uth-toast-show'));
        setTimeout(() => {
            el.classList.remove('uth-toast-show');
            setTimeout(() => el.remove(), 350);
        }, 2200);
    }
};
