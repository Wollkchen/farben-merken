// Gemeinsame Helfer für alle Spiele. Keine Netzwerkzugriffe, kein innerHTML.
"use strict";

export function warte(ms) {
  return new Promise((fertig) => setTimeout(fertig, ms));
}

// Echter Zufall aus dem Browser (crypto): ganze Zahl von 0 bis max-1
export function zufall(max) {
  const zahl = new Uint32Array(1);
  crypto.getRandomValues(zahl);
  return zahl[0] % max;
}

export function leseRekord(schluessel) {
  try {
    const wert = Number.parseInt(localStorage.getItem(schluessel) ?? "0", 10);
    return Number.isFinite(wert) && wert > 0 ? wert : 0;
  } catch {
    return 0; // z. B. privater Modus
  }
}

export function speichereRekord(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, String(wert));
  } catch {
    /* dann eben ohne gespeicherten Rekord */
  }
}

let audio = null;
// Kurzer Ton. Nur wenn der Ton-Schalter (falls vorhanden) an ist.
export function ton(frequenz, dauerMs, art = "triangle") {
  const schalter = document.getElementById("ton");
  if (schalter && !schalter.checked) return;
  try {
    audio ??= new AudioContext();
    const osz = audio.createOscillator();
    const laut = audio.createGain();
    osz.type = art;
    osz.frequency.value = frequenz;
    const jetzt = audio.currentTime;
    laut.gain.setValueAtTime(0.0001, jetzt);
    laut.gain.exponentialRampToValueAtTime(0.2, jetzt + 0.02);
    laut.gain.exponentialRampToValueAtTime(0.0001, jetzt + dauerMs / 1000);
    osz.connect(laut).connect(audio.destination);
    osz.start(jetzt);
    osz.stop(jetzt + dauerMs / 1000 + 0.05);
  } catch {
    /* kein Ton möglich, Spiel läuft trotzdem */
  }
}

export const tonRichtig = () => ton(660, 120);
export const tonFalsch = () => ton(110, 450, "sawtooth");

export function zeigeStatus(element, text, art = "") {
  element.textContent = text;
  element.className = "status" + (art ? " " + art : "");
}
