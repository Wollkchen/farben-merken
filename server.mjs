// Lokale Vorschau ohne zusätzliche Pakete (nur Node.js).
// Start:  npm start   ->  http://localhost:8080
// Test:   npm test    ->  startet kurz, prüft Seiten und Header, beendet sich wieder
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ORDNER = fileURLToPath(new URL("./public/", import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

// Header aus public/_headers lesen (Abschnitt "/*")
export function leseHeader() {
  const header = {};
  let aktiv = false;
  for (const zeile of readFileSync(join(ORDNER, "_headers"), "utf8").split(/\r?\n/)) {
    if (!zeile.trim() || zeile.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(zeile)) { aktiv = zeile.trim() === "/*"; continue; }
    if (!aktiv) continue;
    const i = zeile.indexOf(":");
    header[zeile.slice(0, i).trim()] = zeile.slice(i + 1).trim();
  }
  // HSTS gilt nur über HTTPS; lokal (http) ignorieren Browser es ohnehin.
  return header;
}

const HEADER = leseHeader();
const NICHT_AUSLIEFERN = new Set(["_headers", "_redirects"]);

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", ...HEADER }).end();
    return;
  }
  let pfad;
  try {
    pfad = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400, HEADER).end();
    return;
  }
  if (pfad.endsWith("/")) pfad += "index.html";
  const datei = normalize(join(ORDNER, pfad));
  // Schutz gegen ../-Tricks: nur Dateien innerhalb von public/
  if (!datei.startsWith(ORDNER.endsWith(sep) ? ORDNER : ORDNER + sep) || NICHT_AUSLIEFERN.has(pfad.slice(1))) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...HEADER }).end("Nicht gefunden");
    return;
  }
  // Wie Cloudflare Pages: /404 liefert 404.html aus
  const kandidaten = extname(datei) ? [datei] : [datei, datei + ".html"];
  for (const kandidat of kandidaten) {
    try {
      const inhalt = await readFile(kandidat);
      res.writeHead(200, {
        "Content-Type": TYPEN[extname(kandidat)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
        ...HEADER,
      });
      res.end(req.method === "HEAD" ? undefined : inhalt);
      return;
    } catch {
      /* nächsten Kandidaten versuchen */
    }
  }
  const fehlerseite = await readFile(join(ORDNER, "404.html")).catch(() => "Nicht gefunden");
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", ...HEADER });
  res.end(req.method === "HEAD" ? undefined : fehlerseite);
});

const selbsttest = process.argv.includes("--selbsttest");

server.listen(selbsttest ? 0 : PORT, "127.0.0.1", async () => {
  const port = server.address().port;
  if (!selbsttest) {
    console.log(`Vorschau läuft: http://localhost:${port}  (Beenden mit Strg+C)`);
    return;
  }
  const { pruefeSeite } = await import("./scripts/pruefen.mjs");
  const ok = await pruefeSeite(`http://127.0.0.1:${port}`, { lokal: true });
  server.close();
  process.exit(ok ? 0 : 1);
});
