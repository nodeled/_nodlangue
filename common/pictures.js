// pictures.js — génération des OG images pour les statements
// Bucket : node-pictures / statements/statement_{id}.png / 1200×630

const axios = require('axios');
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const BUCKET  = 'node-pictures';
const OG_W    = 1200;
const OG_H    = 630;
const PAPER   = '#f6f4ef';
const INK     = '#1a1814';
const RED     = '#c8302e';

// ─── Supabase helpers ──────────────────────────────────────────────────────────

function storageBase() {
    return process.env.SUPABASE_URL_DEV || process.env.SUPABASE_URL || '';
}
function serviceKey() {
    return process.env.SUPABASE_SERVICE_KEY || '';
}
function svcHeaders(ct = 'application/json') {
    const k = serviceKey();
    return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': ct };
}

function statementImagePath(id) { return `statements/statement_${id}.png`; }
function nodeImagePath(id)      { return `nodes/node_${id}.png`; }

function statementImageUrl(id) {
    return `${storageBase()}/storage/v1/object/public/${BUCKET}/${statementImagePath(id)}`;
}
function nodeImageUrl(id) {
    return `${storageBase()}/storage/v1/object/public/${BUCKET}/${nodeImagePath(id)}`;
}

async function imageExists(storagePath) {
    try {
        const r = await axios.head(
            `${storageBase()}/storage/v1/object/${BUCKET}/${storagePath}`,
            { headers: svcHeaders(), validateStatus: () => true, timeout: 8000 }
        );
        return r.status === 200;
    } catch { return false; }
}

async function uploadPng(storagePath, pngBuffer) {
    await axios({
        method: 'post',
        url: `${storageBase()}/storage/v1/object/${BUCKET}/${storagePath}`,
        data: pngBuffer,
        headers: { ...svcHeaders('image/png'), 'x-upsert': 'true' },
        timeout: 30000,
        validateStatus: s => s < 300,
    });
}

// ─── Font Bangers (téléchargée une fois, mise en cache) ───────────────────────

let _bangersB64 = null;
const BANGERS_CACHE = path.join(__dirname, '../assets/Bangers.woff2');

async function getBangersB64() {
    if (_bangersB64) return _bangersB64;
    // Cache disque
    if (fs.existsSync(BANGERS_CACHE)) {
        _bangersB64 = fs.readFileSync(BANGERS_CACHE).toString('base64');
        return _bangersB64;
    }
    // Téléchargement depuis Google Fonts
    try {
        const r = await axios.get(
            'https://fonts.gstatic.com/s/bangers/v25/FeVQS0BTqb0h60ACH55Q2A.woff2',
            { responseType: 'arraybuffer', timeout: 15000 }
        );
        fs.mkdirSync(path.dirname(BANGERS_CACHE), { recursive: true });
        fs.writeFileSync(BANGERS_CACHE, Buffer.from(r.data));
        _bangersB64 = Buffer.from(r.data).toString('base64');
    } catch (e) {
        console.warn('[pictures] Bangers download failed:', e.message);
        _bangersB64 = '';
    }
    return _bangersB64;
}

// ─── Helpers image ────────────────────────────────────────────────────────────

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(s, max) {
    s = String(s || '');
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// Découpe le texte en lignes de max `width` chars (approx.)
function wrapText(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
        if ((cur + ' ' + w).trim().length > maxChars) {
            if (cur) lines.push(cur.trim());
            cur = w;
        } else {
            cur = (cur + ' ' + w).trim();
        }
    }
    if (cur) lines.push(cur.trim());
    return lines;
}

// Télécharge une image distante → Buffer PNG 200×200 (pour embed SVG)
async function fetchImageB64(url) {
    if (!url) return null;
    try {
        let buf;
        if (url.startsWith('data:')) {
            buf = Buffer.from(url.split(',')[1], 'base64');
        } else {
            const r = await axios.get(url, {
                responseType: 'arraybuffer', timeout: 12000,
                headers: { 'User-Agent': 'NodelBot/1.0' },
                validateStatus: () => true,
            });
            if (r.status !== 200) return null;
            buf = Buffer.from(r.data);
        }
        const png = await sharp(buf).resize(200, 200, { fit: 'cover' }).png().toBuffer();
        return 'data:image/png;base64,' + png.toString('base64');
    } catch { return null; }
}

// Essaie plusieurs URLs dans l'ordre, retourne la première qui marche
async function fetchImageB64FirstOf(urls) {
    for (const url of urls.filter(Boolean)) {
        const result = await fetchImageB64(url);
        if (result) return result;
    }
    return null;
}

// ─── Formatage date ───────────────────────────────────────────────────────────

function formatDateBadge(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const months = ['JANV.','FÉVR.','MARS','AVR.','MAI','JUIN','JUIL.','AOÛT','SEPT.','OCT.','NOV.','DÉC.'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateLong(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
}

// ─── Construction du SVG ──────────────────────────────────────────────────────

async function buildStatementSvg({ sourceNode, targetNode, predLabel, description, publishedat }) {
    const bangersB64 = await getBangersB64();
    const fontFace = bangersB64
        ? `@font-face { font-family: 'Bangers'; src: url('data:font/woff2;base64,${bangersB64}') format('woff2'); }`
        : '';

    // Essayer le bucket en priorité, fallback sur l'URL originale
    const srcPic = await fetchImageB64FirstOf([
        sourceNode?.id ? nodeImageUrl(sourceNode.id) : null,
        sourceNode?.picture,
    ]);
    const tgtPic = await fetchImageB64FirstOf([
        targetNode?.id ? nodeImageUrl(targetNode.id) : null,
        targetNode?.picture,
    ]);

    const srcName  = (sourceNode?.name || '?').toUpperCase();
    const tgtName  = (targetNode?.name || '?').toUpperCase();
    const pred     = truncate((predLabel || '').toUpperCase(), 24);
    const desc     = description || '';
    const dateBadge = formatDateBadge(publishedat);
    const dateLong  = formatDateLong(publishedat);

    // Layout
    const cy  = 195, r = 105;
    const lcx = 215, rcx = 985;
    const lineL1 = lcx + r + 6, lineR2 = rcx - r - 6;
    const badgeX = 415, badgeW = 370, badgeH = 76, badgeY = cy - badgeH / 2;
    const lineY   = cy;
    const FONT    = "Bangers,Impact,sans-serif";

    function nodeBlock(cx, clipId, picB64, name) {
        const lines  = wrapText(name, 13);
        const nameY0 = cy + r + 34;
        return `
    <defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
    <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="${INK}"/>
    ${picB64
        ? `<image href="${picB64}" x="${cx-r}" y="${cy-r}" width="${r*2}" height="${r*2}" clip-path="url(#${clipId})"/>`
        : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#777"/>
           <text x="${cx}" y="${cy+14}" font-family="${FONT}" font-size="72" fill="#fff" text-anchor="middle">?</text>`
    }
    <text font-family="${FONT}" font-size="24" fill="${INK}" text-anchor="middle" letter-spacing="1.8">
      ${lines.map((l, i) => `<tspan x="${cx}" y="${nameY0 + i * 28}">${esc(l)}</tspan>`).join('')}
    </text>`;
    }

    // Description : bande de fond en bas
    const BAND_Y = 370;
    const descLines = wrapText(desc, 78);
    const descBlock = descLines.length ? `
    <rect x="0" y="${BAND_Y}" width="${OG_W}" height="${630 - BAND_Y}" fill="#e8e4da"/>
    <line x1="0" y1="${BAND_Y}" x2="${OG_W}" y2="${BAND_Y}" stroke="${INK}" stroke-width="1.5" opacity="0.2"/>
    ${descLines.slice(0, 3).map((l, i) =>
        `<text x="600" y="${BAND_Y + 46 + i * 32}" font-family="${FONT}" font-size="24" fill="${INK}" text-anchor="middle" letter-spacing="0.5" font-style="italic">${esc(l)}</text>`
    ).join('')}
    ${dateLong ? `<text x="52" y="612" font-family="${FONT}" font-size="19" fill="#6b6560" letter-spacing="0.5">${esc(dateLong)}</text>` : ''}
    <text x="600" y="612" font-family="${FONT}" font-size="22" fill="#9b9690" text-anchor="middle" letter-spacing="7">CUTUP</text>
    <circle cx="659" cy="606" r="5" fill="${RED}"/>
    <text x="670" y="612" font-family="${FONT}" font-size="22" fill="#9b9690" letter-spacing="7">NEWS</text>` : `
    <text x="600" y="590" font-family="${FONT}" font-size="22" fill="#9b9690" text-anchor="middle" letter-spacing="7">CUTUP</text>
    <circle cx="659" cy="584" r="5" fill="${RED}"/>
    <text x="670" y="590" font-family="${FONT}" font-size="22" fill="#9b9690" letter-spacing="7">NEWS</text>`;

    // Badge date MAI 2026
    const dateBadgeSvg = dateBadge ? (() => {
        const bw = dateBadge.length * 14 + 28;
        const bx = OG_W - bw - 28;
        return `<rect x="${bx}" y="22" width="${bw}" height="38" rx="4" fill="${RED}"/>
    <text x="${bx + bw/2}" y="48" font-family="${FONT}" font-size="22" fill="#fff" text-anchor="middle" letter-spacing="1.5">${esc(dateBadge)}</text>`;
    })() : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs><style>${fontFace}</style></defs>

  <rect width="${OG_W}" height="${OG_H}" fill="${PAPER}"/>

  <!-- Badge date -->
  ${dateBadgeSvg}

  <!-- Node source -->
  ${nodeBlock(lcx, 'clipSrc', srcPic, srcName)}

  <!-- Node cible -->
  ${nodeBlock(rcx, 'clipTgt', tgtPic, tgtName)}

  <!-- Ligne gauche -->
  <line x1="${lineL1}" y1="${lineY}" x2="${badgeX}" y2="${lineY}" stroke="${INK}" stroke-width="2"/>
  <!-- Badge prédicat (comics) -->
  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="5" fill="${RED}"/>
  <rect x="${badgeX+4}" y="${badgeY+4}" width="${badgeW}" height="${badgeH}" rx="5" fill="rgba(0,0,0,0.18)"/>
  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="5" fill="${RED}"/>
  <text x="${badgeX + badgeW/2}" y="${badgeY + badgeH/2 + 13}" font-family="${FONT}" font-size="30" fill="#fff" text-anchor="middle" letter-spacing="2">${esc(pred)}</text>
  <!-- Ligne droite + flèche -->
  <line x1="${badgeX + badgeW}" y1="${lineY}" x2="${lineR2}" y2="${lineY}" stroke="${INK}" stroke-width="2"/>
  <polygon points="${lineR2},${lineY-7} ${lineR2+12},${lineY} ${lineR2},${lineY+7}" fill="${INK}"/>

  <!-- Description + footer -->
  ${descBlock}
</svg>`;
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Génère et uploade l'OG image d'un statement.
 * @param {object} opts  { statementId, sourceNode, targetNode, predLabel, description }
 * @param {boolean} force  Regénère même si déjà en cache
 * @returns {string|null}  URL publique ou null
 */
async function generateStatementPicture(opts, force = false) {
    const { statementId } = opts;
    if (!statementId || !storageBase() || !serviceKey()) return null;

    const storagePath = statementImagePath(statementId);

    if (!force && await imageExists(storagePath)) {
        return statementImageUrl(statementId);
    }

    let svg;
    try {
        svg = await buildStatementSvg(opts);
    } catch (e) { console.warn('[pictures] SVG build failed:', e.message); return null; }

    let pngBuffer;
    try {
        pngBuffer = await sharp(Buffer.from(svg))
            .png({ compressionLevel: 8 })
            .toBuffer();
    } catch (e) { console.warn('[pictures] sharp failed:', e.message); return null; }

    try {
        await uploadPng(storagePath, pngBuffer);
    } catch (e) { console.warn('[pictures] upload failed:', e?.response?.data?.message || e.message); return null; }

    return statementImageUrl(statementId);
}

module.exports = {
    generateStatementPicture,
    statementImageUrl,
    statementImagePath,
    nodeImageUrl,
    imageExists,
    BUCKET,
};
