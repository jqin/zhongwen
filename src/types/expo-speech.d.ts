// Minimal ambient declaration so the package builds without expo installed.
// Consumers get real types from their own expo-speech dependency.
declare module 'expo-speech' {
  export function speak(text: string, options?: { language?: string; rate?: number }): void;
  export function stop(): void;
}
