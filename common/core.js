// common/core.js — client Supabase + middleware authenticate (CommonJS)

const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

// ─── Supabase ─────────────────────────────────────────────────────────────────

const NODE_ENV = process.env.NODE_ENV || "development";

const urlDev  = process.env.SUPABASE_URL_DEV;
const keyDev  = process.env.SUPABASE_KEY_DEV;
const urlProd = process.env.SUPABASE_URL_PROD;
const keyProd = process.env.SUPABASE_KEY_PROD;
const urlGen  = process.env.SUPABASE_URL;
const keyGen  = process.env.SUPABASE_KEY;

let SUPABASE_URL = "", SUPABASE_KEY = "";
if (NODE_ENV === "production" && urlProd && keyProd) {
  SUPABASE_URL = urlProd; SUPABASE_KEY = keyProd;
} else if (NODE_ENV !== "production" && urlDev && keyDev) {
  SUPABASE_URL = urlDev;  SUPABASE_KEY = keyDev;
} else if (urlGen && keyGen) {
  SUPABASE_URL = urlGen;  SUPABASE_KEY = keyGen;
} else {
  console.warn("⚠️  SUPABASE_URL/SUPABASE_KEY non définies.");
}

// fetch-compatible via axios (évite les problèmes undici/WASM)
async function axiosFetch(url, options = {}) {
  const method  = (options.method || "GET").toUpperCase();
  const headers = options.headers || {};
  const data    = options.body ?? undefined;

  let resp;
  try {
    resp = await axios({
      url, method, headers, data,
      responseType: "arraybuffer",
      timeout: Number(process.env.SUPABASE_FETCH_TIMEOUT_MS || 15000),
      validateStatus: () => true,
    });
  } catch (e) {
    const err = new Error("fetch failed");
    err.cause = e;
    throw err;
  }

  const hdrs = {};
  for (const [k, v] of Object.entries(resp.headers || {})) hdrs[k.toLowerCase()] = v;
  const headersGet = (name) => hdrs[String(name || "").toLowerCase()] ?? null;

  const buf = Buffer.from(resp.data || []);
  return {
    ok: resp.status >= 200 && resp.status < 300,
    status: resp.status,
    headers: { get: headersGet },
    json:        async () => { const t = buf.length ? buf.toString("utf8") : ""; return t ? JSON.parse(t) : null; },
    text:        async () => buf.toString("utf8"),
    arrayBuffer: async () => buf,
  };
}

const WebSocket = require("ws");

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { fetch: axiosFetch },
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket },
    })
  : null;

// ─── Auth ─────────────────────────────────────────────────────────────────────

function decodeJwtPayload(jwt) {
  try {
    const payload = jwt.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch { return null; }
}

/**
 * authenticate — 3 sources pour le token (priorité décroissante) :
 *   1) req.body.access_token | req.body.token
 *   2) Authorization: Bearer …
 *   3) req.query.access_token
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.body && (req.body.access_token || req.body.token)) {
      token = req.body.access_token || req.body.token;
    }
    if (!token) {
      const hdr = req.headers.authorization || req.headers.Authorization;
      if (hdr) {
        const m = String(hdr).match(/^Bearer\s+(.+)$/i);
        token = m ? m[1].trim() : String(hdr).trim();
      }
    }
    if (!token && req.query?.access_token) {
      token = String(req.query.access_token);
    }

    if (!token) return res.status(401).json({ error: "Authorization token is missing" });
    if (!supabase) return res.status(500).json({ error: "supabase not configured" });

    const payload = decodeJwtPayload(token);
    if (payload) {
      console.log("auth payload:", { sub: payload.sub, exp: payload.exp, now: Math.floor(Date.now() / 1000) });
    } else {
      console.warn("auth: invalid JWT format");
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      console.error("Supabase auth.getUser failed:", { msg: error?.message, url: SUPABASE_URL });
      return res.status(401).json({
        error: "Invalid or expired token",
        detail: error?.message || null,
        code: error?.name || error?.status || null,
      });
    }

    req.user  = data.user;
    req.token = token;
    next();
  } catch (e) {
    console.error("authenticate error:", e?.message || e);
    return res.status(500).json({ error: "auth", detail: e?.message || String(e) });
  }
}

module.exports = { supabase, authenticate };
