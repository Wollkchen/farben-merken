// Zahlen-Blitz: Zahl kurz zeigen, ausblenden, nachtippen. Jede Runde eine Ziffer mehr.
"use strict";
import { leseRekord, speichereRekord, tonFalsch, tonRichtig, warte, zeigeStatus, zufall } from "./gemeinsam.js";

const SCHLUESSEL = "zahlen-blitz-rekord";
const START_LAENGE = 3;

const anzeige = document.getElementById("anzeige");
const balken = document.getElementById("balken");
const antwort = document.getElementById("antwort");
const okKnopf = document.getElementById("ok");
const startKnopf = document.getElementById("start");
const statusText = document.getElementById("status");
const laengeText = document.getElementById("laenge");
const rekordText = document.getElementById("rekord");

let laenge = START_LAENGE;
let zahl = "";
let eingabeAktiv = false;
let rekord = leseRekord(SCHLUESSEL);
rekordText.textContent = String(rekord);

function neueZahl(n) {
  let s = String(1 + zufall(9)); // keine führende Null
  while (s.length < n) s += String(zufall(10));
  return s;
}

// Lange Zahlen in 3er-Gruppen zeigen, damit man sie lesen kann
const gruppiert = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function eingabe(an) {
  eingabeAktiv = an;
  antwort.disabled = !an;
  okKnopf.disabled = !an;
  if (an) {
    antwort.value = "";
    antwort.focus();
  }
}

async function runde() {
  eingabe(false);
  zahl = neueZahl(laenge);
  laengeText.textContent = String(laenge);
  zeigeStatus(statusText, "Merk dir die Zahl …");
  await warte(400);
  anzeige.textContent = gruppiert(zahl);
  const dauer = 900 + laenge * 350; // je länger, desto mehr Zeit
  balken.style.transition = "none";
  balken.style.transform = "scaleX(1)";
  balken.getBoundingClientRect(); // Neustart der Animation erzwingen
  balken.style.transition = `transform ${dauer}ms linear`;
  balken.style.transform = "scaleX(0)";
  await warte(dauer);
  anzeige.textContent = "?";
  zeigeStatus(statusText, `Wie war die Zahl? (${laenge} Ziffern)`);
  eingabe(true);
}

async function pruefe() {
  if (!eingabeAktiv) return;
  const getippt = antwort.value.replace(/\D/g, "");
  if (!getippt) return;
  eingabe(false);
  if (getippt === zahl) {
    tonRichtig();
    zeigeStatus(statusText, `Richtig! ${laenge} Ziffern geschafft.`, "gut");
    if (laenge > rekord) {
      rekord = laenge;
      rekordText.textContent = String(rekord);
      speichereRekord(SCHLUESSEL, rekord);
    }
    laenge += 1;
    await warte(700);
    await runde();
  } else {
    tonFalsch();
    anzeige.textContent = gruppiert(zahl);
    const geschafft = laenge - 1;
    zeigeStatus(
      statusText,
      `Leider falsch. Du hattest ${gruppiert(getippt)}. Geschafft: ${geschafft >= START_LAENGE ? geschafft + " Ziffern" : "noch keine Runde"}.`,
      "fehler"
    );
    startKnopf.disabled = false;
    startKnopf.textContent = "Nochmal";
    startKnopf.focus();
  }
}

startKnopf.addEventListener("click", async () => {
  startKnopf.disabled = true;
  startKnopf.textContent = "Läuft …";
  laenge = START_LAENGE;
  await runde();
});
okKnopf.addEventListener("click", pruefe);
antwort.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    pruefe();
  }
});
