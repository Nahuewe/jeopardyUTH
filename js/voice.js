/* ================================
   VOICE
   La presentadora lee las preguntas en voz alta (Web Speech API del navegador).
================================ */

const FEMALE = /helena|sabina|laura|elvira|dalia|elena|paulina|m[oó]nica|luc[ií]a|marisol|camila|female|mujer|google espa/i;

export const Voice = {
    supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    onSpeaking: null,   // (bool) => void

    /** Voces en español disponibles en este dispositivo. */
    list() {
        if (!this.supported) return [];
        return speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
    },

    /** Elige la voz guardada o, si no está, la mejor voz femenina en español. */
    pick(name) {
        const voices = this.list();
        if (name) {
            const exact = voices.find(v => v.name === name);
            if (exact) return exact;
        }
        const score = (v) => (FEMALE.test(v.name) ? 4 : 0) + (/natural|online/i.test(v.name) ? 3 : 0)
            + (/^es-(mx|es|ar|us)/i.test(v.lang) ? 1 : 0);
        return [...voices].sort((a, b) => score(b) - score(a))[0] || null;
    },

    speak(text, { name = '', rate = 1 } = {}) {
        this.stop();
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        if (!this.supported || !clean) return;
        const u = new SpeechSynthesisUtterance(clean);
        const voice = this.pick(name);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'es-ES';
        u.rate = Math.min(1.6, Math.max(0.6, Number(rate) || 1));
        u.pitch = 1.05;
        u.onstart = () => this.onSpeaking?.(true);
        u.onend = u.onerror = () => this.onSpeaking?.(false);
        speechSynthesis.speak(u);
    },

    stop() {
        if (!this.supported) return;
        speechSynthesis.cancel();
        this.onSpeaking?.(false);
    }
};

// Algunos navegadores cargan las voces de forma asíncrona.
if (Voice.supported) speechSynthesis.getVoices();
