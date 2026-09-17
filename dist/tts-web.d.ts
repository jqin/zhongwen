/**
 * Chinese text-to-speech via the browser's Web Speech API.
 *
 * Cached zh voice selection with a male/female preference, promise-based
 * completion, word boundary callbacks, and a slow-reading helper. SSR-safe (no-ops without
 * `window.speechSynthesis`).
 */
type TTSVoice = 'female' | 'male';
interface SpeakOptions {
    /** Preferred voice gender; picks Tingting/Binbin on Apple platforms. */
    voice?: TTSVoice;
    /** Speech rate; 1.0 is normal. */
    rate?: number;
    /** Fired per spoken word with the character offset into `text`. */
    onBoundary?: (charIndex: number, charLength: number) => void;
}
/**
 * Speak Chinese text. Resolves when speech finishes (or immediately in
 * non-browser environments). Cancels any in-flight utterance first.
 */
declare function speak(text: string, options?: SpeakOptions): Promise<void>;
/** Speak at a deliberately slow rate for learners. */
declare function speakSlow(text: string): Promise<void>;
declare function stop(): void;
declare function isSpeaking(): boolean;

export { type SpeakOptions, type TTSVoice, isSpeaking, speak, speakSlow, stop };
