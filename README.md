# Burn-After-Read Starter (Node + Redis + Static Frontend)

**Was ist das?** Ein minimales Projekt für "einmal lesen, dann weg".
- Server speichert nur Ciphertext (Base64) mit TTL.
- Erstes Lesen löscht atomar (GETDEL/Lua).
- Frontend verschlüsselt im Browser (AES-GCM). Der Schlüssel steckt **nur** im URL-Fragment `#key` und geht nie an den Server.

> Realität: Screenshots/Screenrecording kann man nicht verhindern. Kommuniziere das klar.

---

## 1) Schnellstart lokal (Docker empfohlen)
```bash
git clone <dein-repo> burn-after-read-starter
cd burn-after-read-starter
docker compose up --build
# Öffne http://localhost:3000
```

Ohne Docker:
```bash
cp .env.example .env
npm ci
npm run dev
# Separat Redis starten: docker run --rm -p 6379:6379 redis:7-alpine redis-server --save "" --appendonly no
```

---

## 2) API (kurz)
- `POST /msg` → `{ id, token, expiresIn }`
- `GET /msg/:id?token=...` → gibt `{ ciphertext }` **einmalig** zurück und löscht den Eintrag atomar.

---

## 3) Frontend-Flow
- Sender tippt Text → Browser generiert zufälligen AES-Schlüssel → verschlüsselt → postet **nur** Ciphertext.
- Backend antwortet mit `{id, token}`.
- Frontend zeigt eine **Empfangs-URL** wie:  
  `https://deinserver.xyz/read.html?id=...&token=...#<base64key>`
- Empfänger öffnet Link → Seite holt Ciphertext → entschlüsselt lokal → löscht Servereintrag ist bereits geschehen (First read).

---

## 4) Deploy (einfach)
### Railway / Render / Fly.io
- Redis-Add-on/Service verbinden → `REDIS_URL` setzen.
- Baue aus Dockerfile oder `npm ci && npm start`.
- Domain setzen, z. B. `https://burn.yourname.app`.

### Heroku (Alternativ)
- Redis-Add-on hinzufügen.
- Config Vars `REDIS_URL` setzen.
- Buildpack Node.js → `npm start`.

**HTTPS ist Pflicht** – sonst blockt der Browser WebCrypto ggf. (SubtleCrypto braucht Secure Context).

---

## 5) Sicherheit (Essenz)
- Server sieht niemals Klartext, nur Base64-Ciphertext.
- TTL kurz halten (z. B. 10 min).
- Rate-Limits + Body-Limits aktiv.
- Keine Bodies loggen.
- CSP `default-src 'self'` bei Bedarf ausrollen.
- Keine Previews/Push mit Inhalt.

---

## 6) Grenzen
- Screenshots/Abfilmen/Kopieren lässt sich nicht technisch verhindern.
- Wenn Empfänger das Tab offen lässt, kann jemand anderes den Bildschirm sehen. Kommuniziere das.

---

## 7) Lizenz
MIT
