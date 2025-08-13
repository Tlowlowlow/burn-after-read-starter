import express from "express";
import Redis from "ioredis";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { nanoid } from "nanoid";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "64kb" }));
app.use(morgan("tiny"));
app.use(cors({ origin: true, credentials: false }));

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ALLOW_GETDEL = process.env.ALLOW_GETDEL !== "false";

const redis = new Redis(REDIS_URL);

// Lua fallback for atomisches Get + Delete
const luaGetDel = `
  local v = redis.call('GET', KEYS[1])
  if v then redis.call('DEL', KEYS[1]) end
  return v
`;

async function getAndDelete(key) {
  try {
    if (ALLOW_GETDEL) {
      // GETDEL ab Redis 6.2
      // @ts-ignore
      return await redis.call("GETDEL", key);
    } else {
      return await redis.eval(luaGetDel, 1, key);
    }
  } catch (e) {
    // Fallback automatisch
    return await redis.eval(luaGetDel, 1, key);
  }
}

// Static frontend
app.use(express.static(path.join(__dirname, "..", "public"), { cacheControl: false, etag: false }));

// Health
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// Create message (ciphertext only)
app.post("/msg", async (req, res) => {
  try {
    const { ciphertext, ttlSeconds = 600, maxReads = 1 } = req.body || {};
    if (typeof ciphertext !== "string" || !ciphertext) {
      return res.status(400).json({ error: "ciphertext (base64) required" });
    }
    if (maxReads !== 1) {
      return res.status(400).json({ error: "only maxReads=1 supported in starter" });
    }
    const id = nanoid(22);
    const token = nanoid(16);
    const key = `msg:${id}:${token}`;
    const payload = JSON.stringify({ ciphertext, createdAt: Date.now() });
    const ttl = Math.max(1, Math.min(86400, Number(ttlSeconds) || 600));
    await redis.set(key, payload, "EX", ttl);
    return res.status(201).json({ id, token, expiresIn: ttl });
  } catch (e) {
    return res.status(500).json({ error: "internal" });
  }
});

// Read-once
app.get("/msg/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "token required" });
    const key = `msg:${id}:${token}`;
    const val = await getAndDelete(key);
    if (!val) return res.status(404).json({ error: "not_found_or_already_read" });
    res.set("Cache-Control", "no-store");
    return res.status(200).json(JSON.parse(val));
  } catch (_e) {
    return res.status(500).json({ error: "internal" });
  }
});

app.listen(PORT, () => {
  console.log(`burn-after-read server on :${PORT}`);
});
