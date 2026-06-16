// og.js — meta injection SEO + OG image pour NØDLANGUE

const express  = require('express');
const axios    = require('axios');
const fs       = require('fs');
const path     = require('path');
const { generateStatementPicture, statementImageUrl, imageExists, statementImagePath } = require('../common/pictures.js');

const router = express.Router();

const NODLANGUE_HTML = path.join(__dirname, '../public/nodlangue.html');

function storageBase() {
    return process.env.SUPABASE_URL_DEV || process.env.SUPABASE_URL || '';
}
function serviceKey() {
    return process.env.SUPABASE_SERVICE_KEY || '';
}
function svcHeaders() {
    const k = serviceKey();
    return { apikey: k, Authorization: `Bearer ${k}` };
}

// ─── Fetch données statement depuis Supabase ──────────────────────────────────

async function fetchStatementData(id) {
    try {
        const rs = await axios.get(
            `${storageBase()}/rest/v1/statements?id=eq.${id}&select=id,description_fr,name,sourcenodeid,targetnodeid,predicateid,publishedat&limit=1`,
            { headers: { ...svcHeaders(), 'Content-Type': 'application/json' }, timeout: 8000, validateStatus: () => true }
        );
        if (rs.status !== 200 || !rs.data?.length) return null;
        const stmt = rs.data[0];

        const nodeIds = [stmt.sourcenodeid, stmt.targetnodeid].filter(Boolean);
        const rn = await axios.get(
            `${storageBase()}/rest/v1/nodes?id=in.(${nodeIds.join(',')})&select=id,name,type,picture`,
            { headers: { ...svcHeaders(), 'Content-Type': 'application/json' }, timeout: 8000, validateStatus: () => true }
        );
        const nodes = rn.status === 200 ? rn.data : [];
        const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

        let predLabel = stmt.name || '';
        if (stmt.predicateid) {
            const rp = await axios.get(
                `${storageBase()}/rest/v1/expressions?id=eq.${stmt.predicateid}&select=description_fr,name&limit=1`,
                { headers: { ...svcHeaders(), 'Content-Type': 'application/json' }, timeout: 8000, validateStatus: () => true }
            );
            if (rp.status === 200 && rp.data?.length) {
                predLabel = rp.data[0].description_fr || rp.data[0].name || predLabel;
            }
        }

        return {
            id:          stmt.id,
            description: stmt.description_fr || '',
            predLabel,
            publishedat: stmt.publishedat || null,
            sourceNode:  nodeMap[stmt.sourcenodeid] || null,
            targetNode:  nodeMap[stmt.targetnodeid] || null,
        };
    } catch (e) {
        console.warn('[og] fetchStatementData error:', e.message);
        return null;
    }
}

// ─── Injection meta dans le HTML ──────────────────────────────────────────────

function injectMeta(html, { title, description, imageUrl, pageUrl }) {
    const esc = s => String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const metas = `
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:site_name" content="NØDLANGUE"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(description)}"/>
  <meta property="og:url" content="${esc(pageUrl)}"/>
  <meta property="og:image" content="${esc(imageUrl)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(title)}"/>
  <meta name="twitter:description" content="${esc(description)}"/>
  <meta name="twitter:image" content="${esc(imageUrl)}"/>`;
    return html
        .replace(/<title>[^<]*<\/title>/, '')
        .replace('</head>', metas + '\n</head>');
}

// ─── Lookup slug numérique → UUID ────────────────────────────────────────────

async function fetchSlugData(shortId) {
    try {
        const r = await axios.get(
            `${storageBase()}/rest/v1/slugs?id=eq.${encodeURIComponent(shortId)}&select=id,target_type,target_id&limit=1`,
            { headers: { ...svcHeaders(), 'Content-Type': 'application/json' }, timeout: 5000, validateStatus: () => true }
        );
        if (r.status !== 200 || !r.data?.length) return null;
        return r.data[0];
    } catch (e) {
        console.warn('[og] fetchSlugData error:', e.message);
        return null;
    }
}

// ─── Redirects anciens formats ───────────────────────────────────────────────

router.get('/statement/:id',   (req, res) => res.redirect(301, `/${req.params.id}`));
router.get('/statements/:id',  (req, res) => res.redirect(301, `/${req.params.id}`));

// ─── Route : GET /explore* (graphe + nodes/folders) ─────────────────────────

router.get(['/explore', '/explore/:slug', '/explore/:pair(\\d+-\\d+)', '/explore/folders/:slug'], (req, res) => {
    const html = fs.readFileSync(NODLANGUE_HTML, 'utf8');
    const title   = 'Explorer le graphe — NØDLANGUE';
    const desc    = 'Explorez les connexions du knowledge graph NØDLANGUE';
    const pageUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    const injected = injectMeta(html, { title, description: desc, imageUrl: '', pageUrl });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(injected);
});

// ─── Route : GET /search/* (feed + nodes) ────────────────────────────────────

router.get(['/search', '/search/:slug', '/search/:pair(\\d+-\\d+)'], (_req, res) => res.sendFile(NODLANGUE_HTML));

// ─── Route : GET /folder/:slug (feed + dossier) ──────────────────────────────

router.get('/folder/:slug', (_req, res) => res.sendFile(NODLANGUE_HTML));

// ─── Route : GET /stories (liste) ────────────────────────────────────────────

router.get('/stories', (_req, res) => {
    const html = fs.readFileSync(NODLANGUE_HTML, 'utf8');
    const title   = 'Stories — NØDLANGUE';
    const desc    = 'Toutes les stories du knowledge graph NØDLANGUE';
    const pageUrl = `${_req.protocol}://${_req.get('host')}/stories`;
    const injected = injectMeta(html, { title, description: desc, imageUrl: '', pageUrl });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(injected);
});

// ─── Route : GET /stories/:id ─────────────────────────────────────────────────

router.get('/stories/:id', async (req, res) => {
    const { id } = req.params;
    const html = fs.readFileSync(NODLANGUE_HTML, 'utf8');

    try {
        const r = await axios.get(
            `${storageBase()}/rest/v1/story_covers?id=eq.${encodeURIComponent(id)}&select=id,name,description,picture,publishedat&limit=1`,
            { headers: { ...svcHeaders(), 'Content-Type': 'application/json' }, timeout: 8000, validateStatus: () => true }
        );
        const cover = r.status === 200 && r.data?.length ? r.data[0] : null;
        if (!cover) return res.send(html);

        const title   = (cover.name || 'Story') + ' — NØDLANGUE';
        const desc    = cover.description || 'Story — NØDLANGUE';
        const pageUrl = `${req.protocol}://${req.get('host')}/stories/${id}`;
        const imageUrl = cover.picture || '';

        const injected = injectMeta(html, { title, description: desc, imageUrl, pageUrl });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(injected);
    } catch (e) {
        console.warn('[og] /stories/:id error:', e.message);
        return res.send(html);
    }
});

// ─── Route : GET /:shortid(\\d+)/image ───────────────────────────────────────

router.get('/:shortid(\\d+)/image', async (req, res) => {
    const slug = await fetchSlugData(req.params.shortid);
    if (!slug || slug.target_type !== 'statement') return res.status(404).json({ error: 'Not found' });
    res.redirect(302, `/${slug.target_id}/image`);
});

// ─── Route : GET /:shortid(\\d+) (URL courte numérique) ──────────────────────

router.get('/:shortid(\\d+)', async (req, res) => {
    const { shortid } = req.params;
    const slug = await fetchSlugData(shortid);
    if (!slug) return res.sendFile(NODLANGUE_HTML);

    if (slug.target_type === 'story') {
        return res.redirect(301, `/stories/${slug.target_id}`);
    }

    if (slug.target_type === 'statement') {
        const html = fs.readFileSync(NODLANGUE_HTML, 'utf8');
        const data = await fetchStatementData(slug.target_id);
        if (!data) return res.send(html);

        const srcName  = data.sourceNode?.name || '';
        const tgtName  = data.targetNode?.name || '';
        const title    = [srcName, data.predLabel, tgtName].filter(Boolean).join(' · ') + ' — NØDLANGUE';
        const desc     = data.description || `${srcName} ${data.predLabel} ${tgtName}`.trim();
        const pageUrl  = `${req.protocol}://${req.get('host')}/${shortid}`;
        const imageUrl = statementImageUrl(slug.target_id);

        const injected = injectMeta(html, { title, description: desc, imageUrl, pageUrl });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(injected);

        imageExists(statementImagePath(slug.target_id)).then(exists => {
            if (!exists) generateStatementPicture({
                statementId: slug.target_id, sourceNode: data.sourceNode,
                targetNode: data.targetNode, predLabel: data.predLabel,
                description: data.description, publishedat: data.publishedat,
            }).catch(e => console.warn('[og] bg generate error:', e.message));
        });
        return;
    }

    // node : sert juste la page
    res.sendFile(NODLANGUE_HTML);
});

// ─── Route : GET /:id/image (image OG statement) ─────────────────────────────

router.get('/:id/image', async (req, res) => {
    const { id } = req.params;
    const force  = req.query.force === '1';

    if (!force && await imageExists(statementImagePath(id))) {
        return res.redirect(302, statementImageUrl(id));
    }

    const data = await fetchStatementData(id);
    if (!data) return res.status(404).json({ error: 'Statement introuvable' });

    const url = await generateStatementPicture({
        statementId: id,
        sourceNode:  data.sourceNode,
        targetNode:  data.targetNode,
        predLabel:   data.predLabel,
        description: data.description,
        publishedat: data.publishedat,
    }, force);

    if (!url) return res.status(500).json({ error: 'Génération image échouée' });
    res.redirect(302, url);
});

// ─── Route : GET /:id (statement UUID — catch-all, EN DERNIER) ───────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.sendFile(NODLANGUE_HTML);

    const html = fs.readFileSync(NODLANGUE_HTML, 'utf8');
    const data = await fetchStatementData(id);
    if (!data) return res.send(html);

    const srcName = data.sourceNode?.name || '';
    const tgtName = data.targetNode?.name || '';
    const title   = [srcName, data.predLabel, tgtName].filter(Boolean).join(' · ') + ' — NØDLANGUE';
    const desc    = data.description || `${srcName} ${data.predLabel} ${tgtName}`.trim();
    const pageUrl = `${req.protocol}://${req.get('host')}/${id}`;
    const imageUrl = statementImageUrl(id);

    const injected = injectMeta(html, { title, description: desc, imageUrl, pageUrl });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(injected);

    imageExists(statementImagePath(id)).then(exists => {
        if (!exists) {
            generateStatementPicture({
                statementId:  id,
                sourceNode:   data.sourceNode,
                targetNode:   data.targetNode,
                predLabel:    data.predLabel,
                description:  data.description,
                publishedat:  data.publishedat,
            }).catch(e => console.warn('[og] generateStatementPicture error:', e.message));
        }
    });
});

module.exports = router;
