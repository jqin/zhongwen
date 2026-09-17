import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'tts-web': 'src/tts/web.ts',
    'tts-expo': 'src/tts/expo.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  clean: true,
  external: ['expo-speech'],
});
