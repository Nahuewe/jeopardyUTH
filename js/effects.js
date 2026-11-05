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

const SOUNDS = {
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
