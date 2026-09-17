/**
 * Chinese text-to-speech via the browser's Web Speech API.
 *
 * Cached zh voice selection with a male/female preference, promise-based
 * completion, word boundary callbacks, and a slow-reading helper. SSR-safe (no-ops without
 * `window.speechSynthesis`).
 */

export type TTSVoice = 'female' | 'male';

export interface SpeakOptions {
  /** Preferred voice gender; picks Tingting/Binbin on Apple platforms. */
  voice?: TTSVoice;
  /** Speech rate; 1.0 is normal. */
  rate?: number;
  /** Fired per spoken word with the character offset into `text`. */
  onBoundary?: (charIndex: number, charLength: number) => void;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

let voiceCache: Map<TTSVoice, SpeechSynthesisVoice | null> | null = null;

// voices load asynchronously in some browsers; invalidate the cache when they arrive
const s = synth();
if (s) {
  s.onvoiceschanged = () => {
    voiceCache = null;
  };
}

function getChineseVoice(preference: TTSVoice): SpeechSynthesisVoice | null {
  const sp = synth();
  if (!sp) return null;
  if (voiceCache?.has(preference)) return voiceCache.get(preference) ?? null;

  const zhVoices = sp.getVoices().filter(v => v.lang.startsWith('zh'));
  let picked: SpeechSynthesisVoice | null = null;
  if (zhVoices.length > 0) {
    // Prefer the exact zh-CN voice, then any zh voice
    const preferred =
      preference === 'female'
        ? zhVoices.find(v => v.name.includes('Tingting'))
        : zhVoices.find(v => v.name.includes('Binbin'));
    picked =
      preferred ??
      zhVoices.find(v => v.lang === 'zh-CN') ??
      (preference === 'male' ? zhVoices[1] || zhVoices[0] : zhVoices[0]);
  }

  voiceCache ??= new Map();
  voiceCache.set(preference, picked);
  return picked;
}

/**
 * Speak Chinese text. Resolves when speech finishes (or immediately in
 * non-browser environments). Cancels any in-flight utterance first.
 */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const sp = synth();
  if (!sp) return Promise.resolve();

  return new Promise((resolve, reject) => {
    stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = options.rate ?? 0.9;

    const selectedVoice = getChineseVoice(options.voice ?? 'female');
    if (selectedVoice) utterance.voice = selectedVoice;

    if (options.onBoundary) {
      utterance.onboundary = (event) => {
        options.onBoundary!(event.charIndex, event.charLength);
      };
    }

    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        resolve();
      } else {
        reject(new Error(event.error));
      }
    };

    sp.speak(utterance);
  });
}

/** Speak at a deliberately slow rate for learners. */
export function speakSlow(text: string): Promise<void> {
  return speak(text, { rate: 0.45 });
}

export function stop(): void {
  const sp = synth();
  if (sp && (sp.speaking || sp.pending)) sp.cancel();
}

export function isSpeaking(): boolean {
  return synth()?.speaking ?? false;
}
