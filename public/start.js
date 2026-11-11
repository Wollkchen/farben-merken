// Startseite: zeigt auf jeder Kachel den gespeicherten Rekord.
"use strict";
import { leseRekord } from "./gemeinsam.js";

for (const feld of document.querySelectorAll("[data-rekord]")) {
  const wert = leseRekord(feld.dataset.rekord);
  feld.textContent = wert > 0 ? `Dein Rekord: ${wert}${feld.dataset.einheit ?? ""}` : "Noch kein Rekord";
}
