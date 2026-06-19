(function () {
  const CSS_ID = 'nodlangue-header-css';
  const CSS = `
    nodlangue-header { display: contents; }

    .nlh-bar {
      background: #0c0b09;
      height: 60px;
      padding: 0 28px;
      display: flex;
      align-items: center;
      border-bottom: 2px solid #c8302e;
      top: 0; left: 0; right: 0;
      z-index: 100;
    }
    .nlh-bar--fixed  { position: fixed; }
    .nlh-bar--sticky { position: sticky; }

    .nlh-left { display: flex; align-items: center; flex-shrink: 0; }

    .nlh-brand {
      font-family: "Bangers", sans-serif;
      font-size: 28px;
      font-weight: 400;
      letter-spacing: .08em;
      color: #f5f2ea;
      line-height: 1;
      text-shadow: 1px 1px 0 rgba(200,48,46,.4);
      text-decoration: none;
    }
    a.nlh-brand:hover { opacity: .8; }

    .nlh-sub {
      font-family: "JetBrains Mono", "DM Mono", monospace;
      font-size: 10.5px;
      letter-spacing: .14em;
      color: #a7a194;
      margin-left: 16px;
      padding-left: 16px;
      border-left: 1px solid rgba(255,255,255,.18);
      text-transform: uppercase;
      white-space: nowrap;
    }

    .nlh-right { display: flex; align-items: center; gap: 6px; margin-left: auto; }

    .nlh-tag {
      font-family: "JetBrains Mono", "DM Mono", monospace;
      font-size: 10px;
      letter-spacing: .14em;
      color: #a7a194;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .nlh-cta {
      font-family: "JetBrains Mono", "DM Mono", monospace;
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: #c8302e;
      text-decoration: none;
      border: 1px solid #c8302e;
      padding: 6px 14px;
      white-space: nowrap;
      transition: background .15s, color .15s;
    }
    .nlh-cta:hover { background: #c8302e; color: #f5f2ea; }

    .nlh-nav { display: flex; gap: 6px; align-items: center; }

    .nlh-nav-btn {
      width: 34px; height: 34px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent;
      border: 1px solid rgba(255,255,255,.14);
      color: #e8e3d6;
      border-radius: 50%;
      cursor: pointer;
      padding: 0;
      text-decoration: none;
      transition: background .15s;
    }
    .nlh-nav-btn:hover { background: rgba(255,255,255,.08); }
    .nlh-nav-btn svg { width: 16px; height: 16px; }
    .nlh-nav-btn.active,
    .nlh-nav-btn.cn-active {
      background: rgba(200,48,46,.18);
      border-color: rgba(200,48,46,.5);
    }
    .nlh-nav-btn:disabled {
      opacity: 0.25;
      cursor: not-allowed;
      pointer-events: none;
    }

    @media (max-width: 600px) {
      .nlh-bar { padding: 0 16px; }
      .nlh-brand { font-size: 22px; }
      .nlh-sub { display: none; }
      .nlh-cta { display: none; }
      .nlh-tag { display: none; }
    }
  `;

  const SVG = {
    graph: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="8" cy="2.5" r="1.5"/><circle cx="2" cy="13" r="1.5"/><circle cx="14" cy="13" r="1.5"/>
      <line x1="8" y1="4" x2="2.8" y2="11.5"/><line x1="8" y1="4" x2="13.2" y2="11.5"/>
      <line x1="3.5" y1="13" x2="12.5" y2="13"/></svg>`,

    statements: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/>
      <line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="8" y1="5.5" x2="8" y2="14.5"/></svg>`,

    stories: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2" y="3.5" width="9" height="11" rx="1"/>
      <path d="M5 3.5V2h8.5v10.5H12"/></svg>`,

    search: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="6.5" cy="6.5" r="4"/><line x1="9.5" y1="9.5" x2="14" y2="14"/></svg>`,

    offers: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M8 2l1.5 3.5 3.8.5-2.7 2.8.6 3.7L8 10.8l-3.2 1.7.6-3.7L2.7 6l3.8-.5z"/></svg>`,

    profile: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="8" cy="5.5" r="2.5"/>
      <path d="M3 13.5c.6-2.4 2.6-3.5 5-3.5s4.4 1.1 5 3.5"/></svg>`,

    theme: `<svg id="nlhThemeIcon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"/></svg>`,
  };

  const ACTIVE = { statements: 'cnPageBtn', stories: 'cnStoriesBtn', offers: 'cnOffersBtn', login: 'cnProfileBtn' };

  class NodlangueHeader extends HTMLElement {
    static get observedAttributes() { return ['context']; }

    connectedCallback() {
      if (!document.getElementById(CSS_ID)) {
        const s = document.createElement('style');
        s.id = CSS_ID;
        s.textContent = CSS;
        document.head.appendChild(s);
      }
      this._render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this._render();
    }

    _render() {
      const ctx      = this.getAttribute('context') || 'statements';
      const isOffers = ctx === 'offers';
      const isFixed  = !['offers', 'pricing'].includes(ctx);
      const pos      = isFixed ? 'fixed' : 'sticky';

      const brandHtml = `<a class="nlh-brand" href="/">NØDLANGUE</a>`;
      const sub = ctx === 'login' ? '<span class="nlh-sub">Connexion</span>' : '';

      const navLink = (id, title, svg, href, isActive = false) =>
        `<a id="${id}" class="nlh-nav-btn${isActive ? ' active' : ''}" href="${href}" title="${title}">${svg}</a>`;
      const navBtn = (id, title, svg, isActive = false, disabled = false) =>
        `<button id="${id}" class="nlh-nav-btn${isActive ? ' active' : ''}" title="${title}"${disabled ? ' disabled' : ''}>${svg}</button>`;

      let right = '';
      if (ctx === 'pricing') {
        right = `<span class="nlh-tag">Dossier investisseur — Modèle économique</span>`;
      } else if (['statements', 'stories', 'offers', 'login'].includes(ctx)) {
        const active = ACTIVE[ctx] || '';
        const isLink = isOffers || ctx === 'login';
        right = `<nav class="nlh-nav">
          ${isLink ? navLink('cnGraphBtn',   'Graphe',           SVG.graph,      '/')        : navBtn('cnGraphBtn',   'Graphe',           SVG.graph,      false)}
          ${isLink ? navLink('cnPageBtn',    'Statements',       SVG.statements, '/')        : navBtn('cnPageBtn',    'Statements',       SVG.statements, false)}
          ${isLink ? navLink('cnStoriesBtn', 'Stories',          SVG.stories,    '/stories') : navBtn('cnStoriesBtn', 'Stories',          SVG.stories,    false)}
          ${navBtn('cnSearchBtn', 'Recherche', SVG.search, false, isLink || ctx === 'stories')}
          ${navLink('cnOffersBtn', 'Rejoindre', SVG.offers, '/nodlangue-offres.html', active === 'cnOffersBtn')}
          ${isLink ? navLink('cnProfileBtn', 'Profil / Patreon', SVG.profile,    '/login.html', active === 'cnProfileBtn') : navBtn('cnProfileBtn', 'Profil / Patreon', SVG.profile, false)}
          ${navBtn('cnThemeBtn', 'Thème', SVG.theme, false, isLink)}
        </nav>`;
      }

      this.innerHTML = `
        <div class="nlh-bar nlh-bar--${pos}">
          <div class="nlh-left">
            ${brandHtml}
            ${sub}
          </div>
          ${right ? `<div class="nlh-right">${right}</div>` : ''}
        </div>`;
    }
  }

  customElements.define('nodlangue-header', NodlangueHeader);
})();
