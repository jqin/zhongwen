"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/tts/expo.ts
var expo_exports = {};
__export(expo_exports, {
  speak: () => speak2,
  speakSlow: () => speakSlow,
  stop: () => stop2
});
module.exports = __toCommonJS(expo_exports);
var Speech = __toESM(require("expo-speech"), 1);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  speak,
  speakSlow,
  stop
});
