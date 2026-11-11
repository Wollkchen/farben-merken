// Schnell-Rechnen: 60 Sekunden Kopfrechnen, wird mit jedem Treffer schwerer.
// Die Antwort zählt, sobald sie stimmt (kein Enter nötig).
"use strict";
import { leseRekord, speichereRekord, ton, tonFalsch, tonRichtig, zeigeStatus, zufall } from "./gemeinsam.js";

const SCHLUESSEL = "schnell-rechnen-rekord";
const DAUER = 60;

const aufgabeText = document.getElementById("aufgabe");
const antwort = document.getElementById("antwort");
const weiterKnopf = document.getElementById("weiter");
const startKnopf = document.getElementById("start");
const statusText = document.getElementById("status");
const zeitText = document.getElementById("zeit");
const punkteText = document.getElementById("punkte");
const rekordText = document.getElementById("rekord");
const balken = document.getElementById("balken");

let punkte = 0;
let loesung = 0;
let ende = 0;
let ticker = null;
let rekord = leseRekord(SCHLUESSEL);
rekordText.textContent = String(rekord);

const zwischen = (a, b) => a + zufall(b - a + 1);

// Stufe steigt alle 5 richtigen Antworten
function neueAufgabe() {
  const stufe = Math.floor(punkte / 5);
  const arten = stufe < 1 ? ["+", "-"] : stufe < 3 ? ["+", "-", "×"] : ["+", "-", "×", "÷"];
  const art = arten[zufall(arten.length)];
  const gross = 10 + stufe * 15;
  let a, b;
  if (art === "+") {
    a = zwischen(2, gross);
    b = zwischen(2, gross);
    loesung = a + b;
  } else if (art === "-") {
    a = zwischen(5, gross + 10);
    b = zwischen(1, a); // nie negativ
    loesung = a - b;
  } else if (art === "×") {
    a = zwischen(2, Math.min(5 + stufe, 15));
    b = zwischen(2, 10);
    loesung = a * b;
  } else {
    b = zwischen(2, Math.min(4 + stufe, 12));
    loesung = zwischen(2, 10);
    a = b * loesung; // geht immer glatt auf
  }
  aufgabeText.textContent = `${a} ${art === "-" ? "−" : art} ${b}`;
  antwort.value = "";
}

function tick() {
  const rest = Math.max(0, (ende - performance.now()) / 1000);
  zeitText.textContent = String(Math.ceil(rest));
  balken.style.transform = `scaleX(${rest / DAUER})`;
  if (rest <= 0) stopp();
}

function start() {
  punkte = 0;
  punkteText.textContent = "0";
  startKnopf.disabled = true;
  startKnopf.textContent = "Läuft …";
  antwort.disabled = false;
  weiterKnopf.disabled = false;
  zeigeStatus(statusText, "Los geht's!");
  neueAufgabe();
  antwort.focus();
  ende = performance.now() + DAUER * 1000;
  ticker = setInterval(tick, 100);
  tick();
}

function stopp() {
  clearInterval(ticker);
  antwort.disabled = true;
  weiterKnopf.disabled = true;
  aufgabeText.textContent = "Zeit um!";
  ton(330, 500);
  const neuerRekord = punkte > rekord;
  if (neuerRekord) {
    rekord = punkte;
    rekordText.textContent = String(rekord);
    speichereRekord(SCHLUESSEL, rekord);
  }
  zeigeStatus(statusText, `${punkte} richtig` + (neuerRekord ? " – neuer Rekord!" : `. Dein Rekord: ${rekord}.`), neuerRekord ? "gut" : "");
  startKnopf.disabled = false;
  startKnopf.textContent = "Nochmal";
  startKnopf.focus();
}

antwort.addEventListener("input", () => {
  antwort.value = antwort.value.replace(/\D/g, "");
  if (antwort.disabled || antwort.value === "") return;
  if (Number(antwort.value) === loesung) {
    punkte += 1;
    punkteText.textContent = String(punkte);
    tonRichtig();
    zeigeStatus(statusText, "");
    neueAufgabe();
  } else if (antwort.value.length >= String(loesung).length) {
    // so viele Ziffern wie die Lösung, aber falsch -> kurz markieren
    zeigeStatus(statusText, "Nicht ganz – korrigier oder überspring.", "fehler");
  }
});
antwort.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !antwort.disabled && antwort.value !== "" && Number(antwort.value) !== loesung) tonFalsch();
});
weiterKnopf.addEventListener("click", () => {
  zeigeStatus(statusText, `Die Lösung war ${loesung}.`);
  neueAufgabe();
  antwort.focus();
});
startKnopf.addEventListener("click", start);
