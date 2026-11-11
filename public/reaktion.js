// Reaktion: Feld wird nach zufälliger Wartezeit grün, so schnell wie möglich klicken.
// 5 Versuche, der Durchschnitt zählt. Zu früh geklickt = Versuch wird wiederholt.
"use strict";
import { leseRekord, speichereRekord, tonFalsch, tonRichtig, zeigeStatus, zufall } from "./gemeinsam.js";

const VERSUCHE = 5;
const SCHLUESSEL = "reaktion-rekord";

const flaeche = document.getElementById("flaeche");
const versuchText = document.getElementById("versuch");
const rekordText = document.getElementById("rekord");
const zeitenListe = document.getElementById("zeiten");
const statusText = document.getElementById("status");

// Zustände: "bereit" (Start), "warten" (rot), "jetzt" (grün), "pause" (Ergebnis eines Versuchs), "ende"
let zustand = "bereit";
let zeiten = [];
let timer = null;
let gruenSeit = 0;
let rekord = leseRekord(SCHLUESSEL);

function zeigeRekord() {
  rekordText.textContent = rekord > 0 ? `${rekord} ms` : "–";
}

function setzeFlaeche(klasse, text) {
  flaeche.className = "flaeche" + (klasse ? " " + klasse : "");
  flaeche.textContent = text;
}

function zeigeZeiten() {
  zeitenListe.replaceChildren(
    ...zeiten.map((ms, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}: ${ms} ms`;
      return li;
    })
  );
  versuchText.textContent = `${zeiten.length}/${VERSUCHE}`;
}

function starteVersuch() {
  zustand = "warten";
  setzeFlaeche("warten", "Warte auf Grün …");
  zeigeStatus(statusText, "");
  const wartezeit = 1200 + zufall(2800); // 1,2 bis 4 Sekunden
  timer = setTimeout(() => {
    zustand = "jetzt";
    gruenSeit = performance.now();
    setzeFlaeche("jetzt", "JETZT!");
  }, wartezeit);
}

function neuesSpiel() {
  zeiten = [];
  zeigeZeiten();
  starteVersuch();
}

function druck() {
  if (zustand === "bereit" || zustand === "ende") {
    neuesSpiel();
    return;
  }
  if (zustand === "warten") {
    clearTimeout(timer);
    tonFalsch();
    zustand = "pause";
    setzeFlaeche("zufrueh", "Zu früh! Klick für einen neuen Versuch.");
    return;
  }
  if (zustand === "jetzt") {
    const ms = Math.round(performance.now() - gruenSeit);
    zeiten.push(ms);
    zeigeZeiten();
    tonRichtig();
    if (zeiten.length >= VERSUCHE) {
      beende();
    } else {
      zustand = "pause";
      setzeFlaeche("", `${ms} ms – klick für den nächsten Versuch`);
    }
    return;
  }
  if (zustand === "pause") starteVersuch();
}

function beende() {
  zustand = "ende";
  const schnitt = Math.round(zeiten.reduce((a, b) => a + b, 0) / zeiten.length);
  const neuerRekord = rekord === 0 || schnitt < rekord;
  if (neuerRekord) {
    rekord = schnitt;
    speichereRekord(SCHLUESSEL, rekord);
    zeigeRekord();
  }
  setzeFlaeche("", `Durchschnitt: ${schnitt} ms\nKlick für eine neue Runde`);
  zeigeStatus(statusText, neuerRekord ? "Neuer Rekord!" : `Dein Rekord bleibt ${rekord} ms.`, neuerRekord ? "gut" : "");
}

// pointerdown reagiert schneller als click (wichtig für faire Zeiten)
flaeche.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  druck();
});
// Tastatur: Leertaste/Enter (auch wenn die Fläche nicht fokussiert ist)
document.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    druck();
  }
});

zeigeRekord();
zeigeZeiten();
