/**
 * Chinese text-to-speech for Expo / React Native via expo-speech.
 * Import from '@jqin/zhongwen/tts-expo'; requires the optional peer
 * dependency `expo-speech`.
 */
import * as Speech from 'expo-speech';

export function speak(text: string, rate = 0.9): void {
  Speech.stop();
  Speech.speak(text, { language: 'zh-CN', rate });
}

export function speakSlow(text: string): void {
  speak(text, 0.45);
}

export function stop(): void {
  Speech.stop();
}
