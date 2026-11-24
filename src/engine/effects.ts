/* Sonidos, animaciones y toasts.
   Si hay una vista de anunciador conectada, el audio se reproduce allí
   (es la pestaña que se comparte). */

import type { Role, Sync } from './sync.ts';
import { SOUNDBOARD, SYNTH, playTones, type SoundboardId } from './synth.ts';

interface Config { role: Role; sfxEnabled: () => boolean; sync: Sync | null }
let cfg: Config = { role: 'admin', sfxEnabled: () => true, sync: null };

const BASE = import.meta.env.BASE_URL;

/* Grabaciones reales (public/audio/sfx/<id>.mp3, Mixkit License). Si el
   archivo no carga, se usa la versión sintetizada de respaldo. */
const sfxEls: Partial<Record<SoundboardId, HTMLAudioElement>> = {};
const broken = new Set<SoundboardId>();

function playFile(id: SoundboardId): void {
    if (broken.has(id)) return SYNTH[id]();
    let el = sfxEls[id];
    if (!el) {
        el = sfxEls[id] = new Audio(`${BASE}audio/sfx/${id}.mp3`);
        el.preload = 'auto';
        el.volume = 0.8;
        el.onerror = () => { broken.add(id); SYNTH[id](); };
    }
    el.currentTime = 0;
    el.play().catch((e: DOMException) => { if (e.name !== 'NotAllowedError') SYNTH[id](); });
}

function stopSfx(): void {
    Object.values(sfxEls).forEach(el => { el?.pause(); if (el) el.currentTime = 0; });
}

let rouletteTick: HTMLAudioElement | null = null;

const FILE_SOUNDS = Object.fromEntries(SOUNDBOARD.map(s => [s.id, () => playFile(s.id)]));

const SOUNDS: Record<string, () => void> = {
    ...FILE_SOUNDS,
    stopsfx: stopSfx,
    win: () => playTones([880, 988, 1318], { step: 0.08 }),
    deduct: () => playTones([330, 294, 262], { type: 'triangle', step: 0.1, gain: 0.15 }),
    buzz: () => playTones([660, 880, 660, 880], { type: 'square', step: 0.07, gain: 0.08 }),
    timeup: () => playTones([440, 330, 247, 196], { type: 'sawtooth', step: 0.18, gain: 0.1 }),
    dd: () => playTones([392, 523, 659, 784, 1047], { step: 0.11 }),
    tada: () => playTones([523, 659, 784, 1047, 784, 1047], { step: 0.12 }),
    roulette: () => {
        rouletteTick ??= new Audio(`${BASE}audio/ruleta.mp3`);
        rouletteTick.currentTime = 0;
        rouletteTick.volume = 0.1;
        rouletteTick.play().catch(() => { });
    }
};

function emojiRain(emojis: string[], countDesktop: number, countMobile: number, maxDelay: number, sizeBase: number, sizeRange: number): void {
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

function confetti(count = 120): void {
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

const VISUALS: Record<string, () => void> = {
    win: () => emojiRain(['💸', '💵', '💰', '🤑', '✨', '🎉'], 22, 12, 0.8, 1, 1.2),
    deduct: () => emojiRain(['❌', '📉', '🤕', '💀', '😬', '🫠'], 18, 10, 0.6, 0.9, 0.9),
    tada: () => confetti()
};

export type ToastType = 'success' | 'error' | 'info';

export const Effects = {
    /** Se llama una vez al iniciar la app. */
    configure(options: Partial<Config>): void {
        cfg = { ...cfg, ...options };
    },

    playLocalSound(name: string): void {
        if (!cfg.sfxEnabled()) return;
        SOUNDS[name]?.();
    },

    /** Reproduce sonido + animación en esta pestaña. */
    fireLocal(name: string, { sound = true } = {}): void {
        VISUALS[name]?.();
        if (sound) this.playLocalSound(name);
    },

    /** Dispara un efecto. Si hay anunciador, el sonido se oye allí. */
    fire(name: string): void {
        const announcer = cfg.role === 'admin' && cfg.sync?.announcerPresent;
        if (announcer) cfg.sync!.send('fx', { name });
        this.fireLocal(name, { sound: !announcer });
    },

    /** Solo sonido (sin animación), con el mismo enrutamiento. */
    sound(name: string): void {
        const announcer = cfg.role === 'admin' && cfg.sync?.announcerPresent;
        if (announcer) cfg.sync!.send('fx', { name, soundOnly: true });
        else this.playLocalSound(name);
    },

    toast(message: string, type: ToastType = 'success'): void {
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
