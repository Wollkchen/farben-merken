// Farben merken – kleines Gedächtnisspiel mit 8 Farben.
// Bewusst ohne Bibliotheken, ohne Netzwerkzugriffe und ohne innerHTML:
// Der Code verändert die Seite nur über textContent und CSS-Klassen.
"use strict";

(() => {
  const ANZAHL_FARBEN = 8;
  const FARBNAMEN = ["Rot", "Orange", "Gelb", "Grün", "Türkis", "Blau", "Lila", "Pink"];
  // Ein Ton pro Farbe (Tonleiter C-Dur, Hz)
  const TOENE = [262, 294, 330, 349, 392, 440, 494, 523];
  const REKORD_SCHLUESSEL = "farben-merken-rekord";

  const felder = Array.from(document.querySelectorAll(".feld"));
  const startKnopf = document.getElementById("start");
  const statusText = document.getElementById("status");
  const rundeText = document.getElementById("runde");
  const rekordText = document.getElementById("rekord");
  const tonSchalter = document.getElementById("ton");

  let folge = [];        // die Farben, die nacheinander aufleuchten
  let position = 0;      // welche Farbe der Spieler als Nächstes klicken muss
  let spielerDran = false;
  let laeuft = false;
  let rekord = leseRekord();
  let audio = null;

  rekordText.textContent = String(rekord);

  // ---------- Hilfsfunktionen ----------

  function warte(ms) {
    return new Promise((fertig) => setTimeout(fertig, ms));
  }

  // Echter Zufall aus dem Browser (crypto), nicht vorhersagbar
  function zufallsFarbe() {
    const zahl = new Uint32Array(1);
    crypto.getRandomValues(zahl);
    return zahl[0] % ANZAHL_FARBEN;
  }

  function leseRekord() {
    try {
      const wert = Number.parseInt(localStorage.getItem(REKORD_SCHLUESSEL) ?? "0", 10);
      return Number.isFinite(wert) && wert > 0 ? wert : 0;
    } catch {
      return 0; // z. B. privater Modus
    }
  }

  function speichereRekord(wert) {
    try {
      localStorage.setItem(REKORD_SCHLUESSEL, String(wert));
    } catch {
      /* egal, dann gibt es eben keinen gespeicherten Rekord */
    }
  }

  function zeigeStatus(text, art = "") {
    statusText.textContent = text;
    statusText.className = "status" + (art ? " " + art : "");
  }

  function felderAktiv(aktiv) {
    spielerDran = aktiv;
    for (const feld of felder) feld.disabled = !aktiv;
  }

  function spieleTon(farbe, dauerMs, fehler = false) {
    if (!tonSchalter.checked) return;
    try {
      audio ??= new AudioContext();
      const osz = audio.createOscillator();
      const laut = audio.createGain();
      osz.type = fehler ? "sawtooth" : "triangle";
      osz.frequency.value = fehler ? 110 : TOENE[farbe];
      const jetzt = audio.currentTime;
      laut.gain.setValueAtTime(0.0001, jetzt);
      laut.gain.exponentialRampToValueAtTime(0.25, jetzt + 0.02);
      laut.gain.exponentialRampToValueAtTime(0.0001, jetzt + dauerMs / 1000);
      osz.connect(laut).connect(audio.destination);
      osz.start(jetzt);
      osz.stop(jetzt + dauerMs / 1000 + 0.05);
    } catch {
      /* kein Ton möglich, Spiel läuft trotzdem */
    }
  }

  async function leuchte(farbe, dauerMs) {
    const feld = felder[farbe];
    feld.classList.add("leuchtet");
    spieleTon(farbe, dauerMs);
    await warte(dauerMs);
    feld.classList.remove("leuchtet");
  }

  // ---------- Spielablauf ----------

  async function zeigeFolge() {
    felderAktiv(false);
    zeigeStatus("Schau genau hin …");
    // Je länger die Folge, desto etwas schneller (aber nie zu hektisch)
    const an = Math.max(280, 600 - folge.length * 20);
    const pause = Math.max(120, 250 - folge.length * 8);
    await warte(600);
    for (const farbe of folge) {
      if (!laeuft) return;
      await leuchte(farbe, an);
      await warte(pause);
    }
    if (!laeuft) return;
    position = 0;
    felderAktiv(true);
    zeigeStatus(folge.length === 1 ? "Jetzt du: klick die Farbe!" : `Jetzt du: ${folge.length} Farben in der richtigen Reihenfolge!`);
  }

  async function naechsteRunde() {
    folge.push(zufallsFarbe());
    rundeText.textContent = String(folge.length);
    await zeigeFolge();
  }

  async function starteSpiel() {
    folge = [];
    laeuft = true;
    startKnopf.disabled = true;
    startKnopf.textContent = "Läuft …";
    await naechsteRunde();
  }

  async function spielVorbei(falscheFarbe) {
    laeuft = false;
    felderAktiv(false);
    spieleTon(0, 500, true);
    const geschafft = folge.length - 1;
    const richtig = FARBNAMEN[folge[position]];
    const neuerRekord = geschafft > rekord;
    if (neuerRekord) {
      rekord = geschafft;
      rekordText.textContent = String(rekord);
      speichereRekord(rekord);
    }
    zeigeStatus(
      `Falsch! Richtig wäre ${richtig} gewesen, nicht ${FARBNAMEN[falscheFarbe]}. ` +
        `Geschafft: ${geschafft}` + (neuerRekord ? " – neuer Rekord!" : ""),
      "fehler"
    );
    // Die richtige Farbe kurz zeigen
    await leuchte(folge[position], 700);
    startKnopf.disabled = false;
    startKnopf.textContent = "Nochmal";
    startKnopf.focus();
  }

  async function geklickt(farbe) {
    if (!spielerDran || !laeuft) return;

    if (farbe !== folge[position]) {
      await spielVorbei(farbe);
      return;
    }

    // Richtig: kurz aufleuchten lassen
    felderAktiv(false);
    await leuchte(farbe, 220);
    position += 1;

    if (position < folge.length) {
      felderAktiv(true);
      return;
    }

    // Ganze Folge geschafft -> nächste Runde mit einer Farbe mehr
    zeigeStatus(`Richtig! Runde ${folge.length} geschafft.`, "gut");
    await warte(500);
    await naechsteRunde();
  }

  // ---------- Eingaben ----------

  for (const feld of felder) {
    feld.addEventListener("click", () => geklickt(Number(feld.dataset.farbe)));
  }

  startKnopf.addEventListener("click", starteSpiel);

  // Tasten 1–8 als Abkürzung, Leertaste/Enter startet
  document.addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const zahl = Number.parseInt(e.key, 10);
    if (zahl >= 1 && zahl <= ANZAHL_FARBEN) {
      e.preventDefault();
      geklickt(zahl - 1);
    }
  });
})();
