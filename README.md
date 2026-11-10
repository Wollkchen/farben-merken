# Farben merken

Eine kleine, sichere Website mit einem Gedächtnisspiel:
8 Farbfelder, eine zufällige Farbe leuchtet auf, du klickst sie nach. Danach leuchtet die Folge
noch mal auf, plus eine neue Farbe, und du klickst beide in der richtigen Reihenfolge. Dann 3, 4, 5 …
Der Rekord wird nur im eigenen Browser gespeichert.

- Nur HTML, CSS und JavaScript. **Keine Pakete, kein Server-Code, keine Datenbank, kein Login.**
- Zum Spielen auch Tasten `1` bis `8`.
- Wie die Seite geschützt ist: [SICHERHEIT.md](SICHERHEIT.md)

## Ordner

| Ordner/Datei | Wozu |
|---|---|
| `public/` | **Die Website.** Nur dieser Ordner wird veröffentlicht. |
| `public/_headers` | Security-Header (CSP, HSTS …) für Cloudflare Pages |
| `server.mjs` | Lokale Vorschau, schickt dieselben Header mit |
| `scripts/pruefen.mjs` | Sicherheits-Check (Code, Header, Live-Seite == Repo) |
| `waechter/` | Claude-Wächter (tägliche Prüfung + ntfy-Alarm) |
| `.github/` | Automatische Prüfungen und Updates auf GitHub |

## Lokal ansehen

```bash
npm start
```

Dann im Browser http://localhost:8080 öffnen. Beenden mit `Strg+C`.

Test (prüft Code-Regeln, Header und Dateien, beendet sich selbst):

```bash
npm test
```

## Veröffentlichen (kostenlos, mit HTTPS)

Empfehlung: **GitHub + Cloudflare Pages**. Der Code gehört dir (auf GitHub und auf deinem Laptop).
Cloudflare liefert nur die Dateien aus und kann jederzeit gegen einen anderen Anbieter getauscht werden,
denn es ist nur ein Ordner mit Dateien.

### 1. Repo auf GitHub hochladen (einmalig)

Im Ordner `C:\Users\kiese\Projekte\farben-merken`:

```bash
gh repo create farben-merken --public --source . --push
```

(`--private` geht auch. Ein öffentliches Repo bekommt aber CodeQL und Secret-Scanning von GitHub kostenlos.)

Danach auf GitHub unter **Settings → Code security** einschalten:
*Dependabot alerts*, *Dependabot security updates*, *Secret scanning* und *Push protection*.

Unter **Settings → Branches** für `main` eine Regel anlegen: *Require status checks to pass* (Workflow „Sicherheit“).
Unter **Settings → Actions → General**: *Workflow permissions* auf **Read repository contents** stellen.

### 2. Cloudflare Pages verbinden (einmalig)

1. Kostenloses Konto auf https://dash.cloudflare.com anlegen, mit Zwei-Faktor-Anmeldung (2FA).
2. **Workers & Pages → Create → Pages → Connect to Git** → Repo `farben-merken` auswählen.
3. Einstellungen:
   - Framework preset: **None**
   - Build command: *(leer lassen)*
   - Build output directory: **`public`**
4. **Save and Deploy**. Nach ca. 1 Minute läuft die Seite unter `https://farben-merken.pages.dev`
   (bzw. einem ähnlichen Namen).

Ab jetzt gilt: Jeder `git push` auf `main` veröffentlicht automatisch die neue Version.
Es liegen keine Passwörter oder Tokens im Repo. Cloudflare holt sich den Code selbst über die GitHub-Verbindung.

### 3. Prüfen, ob alles ankommt

```bash
npm run pruefen -- https://farben-merken.pages.dev
```

Die Adresse auch in `waechter/config.json` bei `"seite"` eintragen.
Auf GitHub unter **Settings → Secrets and variables → Actions → Variables** eine Variable `SITE_URL` mit
derselben Adresse anlegen. Sie ist nicht geheim. Dann prüft GitHub die Live-Seite jeden Montag mit.

### 4. Später: eigene Domain (optional, ca. 5–15 €/Jahr)

Domain kaufen (z. B. bei Cloudflare Registrar, INWX oder IONOS), dann in Cloudflare Pages unter
**Custom domains** hinzufügen. HTTPS-Zertifikate macht Cloudflare automatisch.
In Cloudflare dann unter **SSL/TLS** „Always Use HTTPS“ und „HSTS“ einschalten, Mindest-TLS **1.2**, und
**DNSSEC** aktivieren. „Email Obfuscation“ und „Web Analytics/Rocket Loader“ **aus** lassen, sonst verändert
Cloudflare die Seite und der Integritäts-Check schlägt (zu Recht) Alarm.

> Hinweis Deutschland: Ist die Seite rein privat (kein Geld, keine Werbung), braucht sie meist kein Impressum.
> Kommt Werbung, Verkauf oder ein Kanal-Bezug mit Einnahmen dazu, braucht sie ein Impressum.
> Eine Datenschutzerklärung ist trotzdem sinnvoll, auch wenn die Seite selbst nichts speichert außer dem Rekord im Browser.

## Andere Anbieter

Weil es nur statische Dateien sind, geht genauso: Netlify (gleiche `_headers`-Datei funktioniert),
ein eigener Server mit Caddy/nginx (dann die Header aus `public/_headers` in die Server-Konfiguration übernehmen)
oder GitHub Pages (dort lassen sich aber **keine eigenen Header** setzen, daher nicht empfohlen).

## Claude-Wächter

```bash
npm run waechter
```

Einmal täglich automatisch (06:00, holt verpasste Läufe nach):

```bash
powershell -ExecutionPolicy Bypass -File waechter\zeitplan-einrichten.ps1
```

Was der Wächter kann und was nicht: siehe [SICHERHEIT.md](SICHERHEIT.md#claude-wächter).
