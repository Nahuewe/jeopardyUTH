/* ================================
   UTILS MODULE
   Funciones de utilidad
================================ */

export const Utils = {
    TYPING_SPEED: 30,

    generateColor() {
        const colors = [
            "#ff7675", "#74b9ff", "#55efc4", "#ffeaa7",
            "#a29bfe", "#fab1a0", "#81ecec", "#fd79a8"
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    typeWriterEffect(element, text, mediaHTML = '') {
        element.innerHTML = '';
        let i = 0;

        const interval = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                element.parentElement.scrollTop = element.parentElement.scrollHeight;
            } else {
                clearInterval(interval);
                if (mediaHTML) {
                    element.innerHTML += mediaHTML;
                }
            }
        }, this.TYPING_SPEED);

        return interval;
    },

    playWinEffects() {
        this.playWinSound();
        this.showMoneyAnimation();
    },

    playDeductionEffects() {
        this.playDeductionSound();
        this.showBadAnimation();
    },

    playWinSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            const duration = 0.08;
            const frequencies = [880, 988, 1318];

            frequencies.forEach((freq, i) => {
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(freq, now + i * duration);

                gain.gain.setValueAtTime(0, now + i * duration);
                gain.gain.linearRampToValueAtTime(0.12, now + i * duration + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * duration);

                oscillator.connect(gain);
                gain.connect(ctx.destination);
                oscillator.start(now + i * duration);
                oscillator.stop(now + (i + 1) * duration);
            });
        } catch (e) {
            console.warn("WebAudio no pudo iniciarse:", e);
        }
    },

    playDeductionSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            const duration = 0.1;
            const frequencies = [330, 294, 262];

            frequencies.forEach((freq, i) => {
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();

                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(freq, now + i * duration);

                gain.gain.setValueAtTime(0, now + i * duration);
                gain.gain.linearRampToValueAtTime(0.15, now + i * duration + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * duration);

                oscillator.connect(gain);
                gain.connect(ctx.destination);
                oscillator.start(now + i * duration);
                oscillator.stop(now + (i + 1) * duration);
            });
        } catch (e) {
            console.warn("WebAudio no pudo iniciarse:", e);
        }
    },

    showMoneyAnimation() {
        const container = document.createElement('div');
        container.className = 'money-anim-container';
        const emojis = ['💸', '💵', '💰', '🤑', '✨', '🎉'];
        const count = window.innerWidth < 600 ? 12 : 22;
        const items = new Array(count).fill(0).map(() => {
            const left = Math.random() * 100;
            const delay = (Math.random() * 0.8).toFixed(2);
            const rotation = Math.random() * 360;
            const size = (1 + Math.random() * 1.2).toFixed(2);
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            return `<span class="money-anim-item" style="left:${left}%; animation-delay:${delay}s; font-size:${size}rem; transform: translateY(-10vh) rotate(${rotation}deg)">${emoji}</span>`;
        }).join('');

        container.innerHTML = items;
        document.body.appendChild(container);

        setTimeout(() => {
            container.classList.add('fade-out');
            setTimeout(() => container.remove(), 600);
        }, 2500);
    },

    showBadAnimation() {
        const container = document.createElement('div');
        container.className = 'money-anim-container';
        const emojis = ['❌', '📉', '🤕', '💀', '😬', '🫠'];
        const count = window.innerWidth < 600 ? 10 : 18;
        const items = new Array(count).fill(0).map(() => {
            const left = Math.random() * 100;
            const delay = (Math.random() * 0.6).toFixed(2);
            const rotation = Math.random() * 360;
            const size = (0.9 + Math.random() * 0.9).toFixed(2);
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            return `<span class="money-anim-item" style="left:${left}%; animation-delay:${delay}s; font-size:${size}rem; transform: translateY(-10vh) rotate(${rotation}deg)">${emoji}</span>`;
        }).join('');

        container.innerHTML = items;
        document.body.appendChild(container);

        setTimeout(() => {
            container.classList.add('fade-out');
            setTimeout(() => container.remove(), 600);
        }, 2500);
    },

    /** Toast rápido no bloqueante (sin SweetAlert) */
    toast(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `uth-toast uth-toast-${type}`;
        el.textContent = message;
        document.body.appendChild(el);
        // Forzar reflow para que la transición de entrada funcione
        requestAnimationFrame(() => el.classList.add('uth-toast-show'));
        setTimeout(() => {
            el.classList.remove('uth-toast-show');
            setTimeout(() => el.remove(), 350);
        }, 2200);
    },

    createMediaHTML(mediaData) {
        if (!mediaData) return '';

        const maxWidth = mediaData.type === 'image' ? '300px' : '320px';
        const audioStyle = 'width:20rem; height:2rem;';

        const elements = {
            image: `<img class="spoiler-content-media" src="${mediaData.url}" style="max-width:${maxWidth};">`,
            audio: `<audio class="spoiler-content-media" src="${mediaData.url}" controls style="${audioStyle}"></audio>`,
            video: `<video class="spoiler-content-media" src="${mediaData.url}" controls style="max-width:${maxWidth};"></video>`
        };

        return elements[mediaData.type] || '';
    },

    createSpoilerMediaHTML(mediaData) {
        if (!mediaData) return '';

        const mediaElement = this.createMediaHTML(mediaData);

        return `
        <div class="spoiler-container" onclick="this.classList.add('revealed')">
            <span class="spoiler-label">Click para revelar</span>
            <div class="spoiler-content">
                ${mediaElement}
            </div>
        </div>
    `;
    },

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Error al leer archivo"));
            reader.readAsDataURL(file);
        });
    },

    getMediaType(file) {
        if (file.type.startsWith("video")) return "video";
        if (file.type.startsWith("audio")) return "audio";
        return "image";
    }
};
