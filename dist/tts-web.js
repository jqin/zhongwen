// src/tts/web.ts
function synth() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}
var voiceCache = null;
var s = synth();
if (s) {
  s.onvoiceschanged = () => {
    voiceCache = null;
  };
}
function getChineseVoice(preference) {
  const sp = synth();
  if (!sp) return null;
  if (voiceCache?.has(preference)) return voiceCache.get(preference) ?? null;
  const zhVoices = sp.getVoices().filter((v) => v.lang.startsWith("zh"));
  let picked = null;
  if (zhVoices.length > 0) {
    const preferred = preference === "female" ? zhVoices.find((v) => v.name.includes("Tingting")) : zhVoices.find((v) => v.name.includes("Binbin"));
    picked = preferred ?? zhVoices.find((v) => v.lang === "zh-CN") ?? (preference === "male" ? zhVoices[1] || zhVoices[0] : zhVoices[0]);
  }
  voiceCache ??= /* @__PURE__ */ new Map();
  voiceCache.set(preference, picked);
  return picked;
}
function speak(text, options = {}) {
  const sp = synth();
  if (!sp) return Promise.resolve();
  return new Promise((resolve, reject) => {
    stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = options.rate ?? 0.9;
    const selectedVoice = getChineseVoice(options.voice ?? "female");
    if (selectedVoice) utterance.voice = selectedVoice;
    if (options.onBoundary) {
      utterance.onboundary = (event) => {
        options.onBoundary(event.charIndex, event.charLength);
      };
    }
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      if (event.error === "canceled" || event.error === "interrupted") {
        resolve();
      } else {
        reject(new Error(event.error));
      }
    };
    sp.speak(utterance);
  });
}
function speakSlow(text) {
  return speak(text, { rate: 0.45 });
}
function stop() {
  const sp = synth();
  if (sp && (sp.speaking || sp.pending)) sp.cancel();
}
function isSpeaking() {
  return synth()?.speaking ?? false;
}
export {
  isSpeaking,
  speak,
  speakSlow,
  stop
};
