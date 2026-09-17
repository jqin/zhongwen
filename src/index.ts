export * from './hanzi';
export * from './pinyin';
export * from './dictionary';
export * from './hsk';
export * from './segment';
export * from './srs/sm2';
export * from './srs/anki';
// TTS lives on subpath exports so the main entry stays platform-neutral:
//   '@jqin/zhongwen/tts-web'  (browsers)
//   '@jqin/zhongwen/tts-expo' (Expo / React Native, needs expo-speech)
