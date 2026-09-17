// src/tts/expo.ts
import * as Speech from "expo-speech";
function speak2(text, rate = 0.9) {
  Speech.stop();
  Speech.speak(text, { language: "zh-CN", rate });
}
function speakSlow(text) {
  speak2(text, 0.45);
}
function stop2() {
  Speech.stop();
}
export {
  speak2 as speak,
  speakSlow,
  stop2 as stop
};
