// Sicherheits-Check für die Website. Kein Paket nötig, nur Node.js.
//
//   node scripts/pruefen.mjs                      -> prüft nur den Code (offline)
//   node scripts/pruefen.mjs https://deine-seite  -> prüft zusätzlich die LIVE-Seite
//   ... --json                                    -> Ergebnis als JSON (für den Claude-Wächter)
//
// Was geprüft wird:
//  1. Code: keine gefährlichen Funktionen (eval, innerHTML ...), keine fremden Skripte/Server
//  2. Header: alle Security-Header aus public/_headers kommen wirklich an
//  3. Integrität: Jede Datei auf dem Server ist Byte für Byte gleich wie im Repo
//     (merkt also, wenn jemand die Live-Seite verändert hat)
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ORDNER = fileURLToPath(new URL("../public/", import.meta.url));
const NICHT_AUSLIEFERN = new Set(["_headers", "_redirects"]);

function alleDateien(ordner = ORDNER) {
  const liste = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) liste.push(...alleDateien(pfad));
    else liste.push(relative(ORDNER, pfad).split(sep).join("/"));
  }
  return liste.filter((d) => !NICHT_AUSLIEFERN.has(d));
}

function sollHeader() {
  const header = {};
  let aktiv = false;
  for (const zeile of readFileSync(join(ORDNER, "_headers"), "utf8").split(/\r?\n/)) {
    if (!zeile.trim() || zeile.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(zeile)) { aktiv = zeile.trim() === "/*"; continue; }
    if (!aktiv) continue;
    const i = zeile.indexOf(":");
    header[zeile.slice(0, i).trim().toLowerCase()] = zeile.slice(i + 1).trim();
  }
  return header;
}

const sha256 = (daten) => createHash("sha256").update(daten).digest("hex");

// ---------- 1. Code-Prüfung ----------
export function pruefeCode() {
  const funde = [];
  const verboten = [
    [/\beval\s*\(/, "eval()"],
    [/\bnew\s+Function\s*\(/, "new Function()"],
    [/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML/, "innerHTML/outerHTML"],
    [/document\.write/, "document.write"],
    [/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/, "Netzwerkzugriff"],
    [/setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/, "setTimeout mit Text"],
  ];
  for (const datei of alleDateien()) {
    const text = readFileSync(join(ORDNER, datei), "utf8");
    if (datei.endsWith(".js")) {
      for (const [muster, name] of verboten) if (muster.test(text)) funde.push(`${datei}: ${name} gefunden`);
    }
    if (datei.endsWith(".html")) {
      if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(text)) funde.push(`${datei}: Inline-<script> gefunden`);
      if (/\son[a-z]+\s*=/i.test(text)) funde.push(`${datei}: Inline-Eventhandler (onclick= ...) gefunden`);
      if (/<(iframe|object|embed|form)\b/i.test(text)) funde.push(`${datei}: <iframe>/<object>/<embed>/<form> gefunden`);
      if (/\b(src|href)\s*=\s*["']?(https?:)?\/\//i.test(text)) funde.push(`${datei}: Verweis auf fremde Adresse gefunden`);
      if (/style\s*=/i.test(text)) funde.push(`${datei}: Inline-style= gefunden (CSP blockiert das)`);
    }
  }
  return funde;
}

// ---------- 2. + 3. Live-Prüfung ----------
async function hole(url) {
  const antwort = await fetch(url, { redirect: "manual", headers: { "Cache-Control": "no-cache" } });
  return { status: antwort.status, header: antwort.headers, daten: Buffer.from(await antwort.arrayBuffer()) };
}

export async function pruefeSeite(basis, { lokal = false, json = false } = {}) {
  basis = basis.replace(/\/+$/, "");
  const ergebnis = { zeit: new Date().toISOString(), adresse: basis, ok: true, fehler: [], hinweise: [], dateien: {} };
  const fehler = (t) => { ergebnis.ok = false; ergebnis.fehler.push(t); };

  for (const f of pruefeCode()) fehler(`Code: ${f}`);

  if (!lokal && !basis.startsWith("https://")) fehler("Adresse muss mit https:// beginnen");

  const soll = sollHeader();
  try {
    // HTTP muss auf HTTPS umleiten
    if (!lokal) {
      try {
        const http = await hole(basis.replace(/^https:/, "http:") + "/");
        const ziel = http.header.get("location") ?? "";
        if (![301, 302, 307, 308].includes(http.status) || !ziel.startsWith("https://")) {
          fehler(`http:// leitet nicht auf https:// um (Status ${http.status})`);
        }
      } catch (e) {
        ergebnis.hinweise.push(`http://-Test nicht möglich: ${e.message}`);
      }
    }

    const start = await hole(basis + "/");
    if (start.status !== 200) fehler(`Startseite antwortet mit Status ${start.status}`);
    for (const [name, wert] of Object.entries(soll)) {
      if (lokal && name === "strict-transport-security") continue;
      const ist = start.header.get(name);
      if (ist === null) fehler(`Header fehlt: ${name}`);
      else if (ist.replace(/\s+/g, " ") !== wert.replace(/\s+/g, " ")) fehler(`Header anders als erwartet: ${name}`);
    }
    const server = start.header.get("server");
    if (server && /\d/.test(server)) ergebnis.hinweise.push(`Server verrät Version: ${server}`);

    // Integrität: jede Datei vergleichen
    for (const datei of alleDateien()) {
      // Cloudflare Pages leitet /seite.html auf /seite um, daher ohne .html abfragen
      const pfad = datei === "index.html" ? "/" : "/" + datei.replace(/\.html$/, "");
      const soll256 = sha256(readFileSync(join(ORDNER, datei)));
      const live = pfad === "/" ? start : await hole(basis + pfad);
      const ist256 = sha256(live.daten);
      const gleich = live.status === 200 && ist256 === soll256;
      ergebnis.dateien[datei] = { status: live.status, gleich };
      if (!gleich) fehler(`Datei auf dem Server weicht vom Repo ab: ${datei} (Status ${live.status})`);
    }

    // Interne Dateien dürfen nicht abrufbar sein (und Unbekanntes muss 404 liefern)
    for (const geheim of ["/_headers", "/.git/config", "/.env", "/server.mjs", "/package.json", "/gibt-es-nicht-xyz"]) {
      const r = await hole(basis + geheim);
      if (r.status === 200) fehler(`Interne Datei ist öffentlich abrufbar: ${geheim}`);
    }
  } catch (e) {
    fehler(`Seite nicht erreichbar: ${e.message}`);
  }

  if (json) {
    console.log(JSON.stringify(ergebnis, null, 2));
  } else {
    console.log(`\nSicherheits-Check: ${basis}`);
    for (const [d, info] of Object.entries(ergebnis.dateien)) console.log(`  ${info.gleich ? "OK  " : "FEHL"} ${d}`);
    for (const h of ergebnis.hinweise) console.log(`  Hinweis: ${h}`);
    for (const f of ergebnis.fehler) console.log(`  FEHLER: ${f}`);
    console.log(ergebnis.ok ? "\nAlles in Ordnung.\n" : `\n${ergebnis.fehler.length} Problem(e) gefunden.\n`);
  }
  return ergebnis.ok;
}

// Direkt aufgerufen?
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const adresse = args.find((a) => /^https?:\/\//.test(a));
  if (adresse) {
    process.exit((await pruefeSeite(adresse, { json })) ? 0 : 1);
  } else {
    const funde = pruefeCode();
    if (json) console.log(JSON.stringify({ ok: funde.length === 0, fehler: funde }, null, 2));
    else {
      for (const f of funde) console.log(`FEHLER: ${f}`);
      console.log(funde.length ? `${funde.length} Problem(e) im Code.` : "Code-Prüfung: alles in Ordnung.");
    }
    process.exit(funde.length ? 1 : 0);
  }
}
