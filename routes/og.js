// og.js — meta injection SEO + OG image pour /statement/:id

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
        // Statement
        const rs = await axios.get(
            `${storageBase()}/rest/v1/statements?id=eq.${id}&select=id,description_fr,name,sourcenodeid,targetnodeid,predicateid,publishedat&limit=1`,
            { headers: { ...svcHeaders(), 'Content-Type': 'application/json' }, timeout: 8000, validateStatus: () => true }
        );
        if (rs.status !== 200 || !rs.data?.length) return null;
        const stmt = rs.data[0];

        // Nodes source + cible
        const nodeIds = [stmt.sourcenodeid, stmt.targetnodeid].filter(Boolean);
        const rn = await axios.get(
            `${storageBase()}/rest/v1/nodes?id=in.(${nodeIds.join(',')})&select=id,name,type,picture`,
            { headers: { ...svcHeaders(), 'Content-Type': 'application/json' }, timeout: 8000, validateStatus: () => true }
        );
        const nodes = rn.status === 200 ? rn.data : [];
        const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

        // Prédicat (description_fr = label du prédicat)
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
    // Remplace le <title> existant et injecte après
    return html
        .replace(/<title>[^<]*<\/title>/, '')
        .replace('</head>', metas + '\n</head>');
}

// ─── Route : GET /statement/:id ───────────────────────────────────────────────

router.get('/statement/:id', async (req, res) => {
    const { id } = req.params;
    const html = fs.readFileSync(NODLANGUE_HTML, 'utf8');

    const data = await fetchStatementData(id);
    if (!data) return res.send(html);  // fallback : page normale sans metas

    const srcName = data.sourceNode?.name || '';
    const tgtName = data.targetNode?.name || '';
    const title   = [srcName, data.predLabel, tgtName].filter(Boolean).join(' · ') + ' — NØDLANGUE';
    const desc    = data.description || `${srcName} ${data.predLabel} ${tgtName}`.trim();
    const pageUrl = `${req.protocol}://${req.get('host')}/statement/${id}`;
    const imageUrl = statementImageUrl(id);

    const injected = injectMeta(html, { title, description: desc, imageUrl, pageUrl });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(injected);

    // Génère l'image en arrière-plan si elle n'existe pas encore
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

// ─── Route : GET /statement/:id/image ────────────────────────────────────────

router.get('/statement/:id/image', async (req, res) => {
    const { id } = req.params;
    const force  = req.query.force === '1';

    // Si déjà en cache → redirect vers Supabase Storage
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

module.exports = router;
