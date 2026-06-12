// _nodlangue.js — Serveur NØDLANGUE (auth Patreon + fichiers statiques)
// Port : 4000

require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const express = require('express');
const cors = require('cors');
const path = require('path');
const patreonRouter = require('./routes/patreon.js');
const ogRouter = require('./routes/og.js');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── CORS ─────────────────────────────────────────────────────────────────────

const ALLOWED = [
    'http://localhost:1000',
    'http://localhost:2000',
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:5000',
    'https://cutup.news',
    'https://nodel.ai',
    'https://nodeled.com',
    'https://nodlangue.com',
    'https://nodlangue.onrender.com/',
    'https://temurah.com',
];

app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin || ALLOWED.includes(origin)) return cb(null, true);
            cb(new Error(`CORS: origin non autorisée — ${origin}`));
        },
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    })
);

// ─── Middlewares ───────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Routes auth ──────────────────────────────────────────────────────────────

app.use('/', patreonRouter);

// ─── Fichiers statiques ────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'nodlangue.html'));
});

// ─── Routes OG (meta injection + images statements) ───────────────────────────

app.use('/', ogRouter);

// ─── Démarrage ────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`✅ NØDLANGUE lancé sur http://localhost:${PORT}`);
});
