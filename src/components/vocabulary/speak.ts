/**
 * 33.4: so'zni ovoz chiqarib o'qish — brauzerning o'z nutq sintezi (Web Speech API), tashqi xizmatsiz.
 * Til taxmini: kirill harflari — rus, qolgani — ingliz (maqolalar asosan shu tillarda; o'zbek ovozi brauzerlarda deyarli yo'q).
 */
export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

export function speak(text: string): void {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.trim());
  u.lang = /[Ѐ-ӿ]/.test(text) ? "ru-RU" : "en-US";
  u.rate = 0.9;
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
  if (voice) u.voice = voice;
  synth.speak(u);
}
