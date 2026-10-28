/*
 * Countdown Card (FR)
 * Carte Home Assistant de compte à rebours (jours, heures, minutes, secondes) pour Noël (sapin illuminé, guirlande, neige)
 * ou les anniversaires (gâteau, ballons, fanions, confettis), avec photo perso. Se cache hors saison. Style verre, thème clair/sombre automatique,
 * éditeur visuel, textes en français.
 */
const CARD_VERSION = "1.0.0";

/* === NUANCE COMMUNE v2 (cartes Johan854) ===
 * Bloc identique dans toutes les cartes. Options : nuance, nuance_perso, intensite.
 * nuance "theme" (par défaut) : suit la variable carte-nuance du thème Home Assistant ;
 * si elle n'existe pas, la carte garde ses couleurs d'origine. Intensité : 0 = neutre, 1 = normal, 2 = très coloré. */
const GV_NUANCES = [["braise", "Braise (rouge)", "#e0524f"], ["ocean", "Océan (bleu)", "#2f8fd8"], ["lagon", "Lagon (turquoise)", "#1fb5a8"], ["foret", "Forêt (vert)", "#3fae5a"], ["lavande", "Lavande (violet)", "#8a63d8"], ["framboise", "Framboise (rose)", "#e05597"], ["ambre", "Ambre (orange)", "#e8902c"], ["ardoise", "Ardoise (neutre)", "#7d8595"]];
const GV_DEFAULTS = { nuance: "theme", intensite: 1 };
const gvAccent = (c) => {
  const p = c && c.nuance_perso;
  if (c && c.nuance === "perso") {
    if (Array.isArray(p) && p.length === 3) return "#" + p.map((v) => Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, "0")).join("");
    if (typeof p === "string" && /^#?[0-9a-f]{6}$/i.test(p.trim())) return "#" + p.trim().replace("#", "");
  }
  const n = GV_NUANCES.find((x) => x[0] === (c && c.nuance));
  return n ? n[2] : "var(--carte-nuance)";
};
/* Variables posées sur <ha-card> : --g-bg-x (fond dégradé teinté) et --acc-ui-x (couleur d'accent).
 * Sans nuance (thème sans carte-nuance), elles sont invalides : chaque carte retombe alors sur ses couleurs d'origine. */
const gvStyle = (c, dark) => {
  const i = Number(c && c.intensite), ai = Number.isFinite(i) ? Math.max(0, Math.min(2, i)) : 1;
  const m = (pct, base) => `color-mix(in srgb,var(--acc-ui) ${+(pct * ai).toFixed(1)}%,${base})`;
  const bg = dark ? `linear-gradient(160deg,${m(5, "#1b1e32")} 0%,${m(11, "#1f1b2c")} 55%,${m(22, "#1c1620")} 100%)`
    : `linear-gradient(160deg,${m(2, "#f8f9fd")} 0%,${m(5, "#eef1f8")} 55%,${m(11, "#f8f8fa")} 100%)`;
  return `--acc-ui:${gvAccent(c)};--g-bg-x:${bg};--acc-ui-x:color-mix(in srgb,var(--acc-ui) ${dark ? "80%,#fff" : "82%,#000"})`;
};
const GV_FIELDS = [
  { name: "nuance", selector: { select: { mode: "dropdown", options: [{ value: "theme", label: "Selon le thème (couleurs d'origine)" }, ...GV_NUANCES.map((n) => ({ value: n[0], label: n[1] })), { value: "perso", label: "Personnalisée" }] } } },
  { name: "nuance_perso", selector: { color_rgb: {} } },
  { name: "intensite", selector: { number: { min: 0, max: 2, step: 0.1, mode: "slider" } } }];
const GV_LABELS = { nuance: "Nuance de couleur", nuance_perso: "Couleur personnalisée (nuance « Personnalisée »)", intensite: "Intensité de la nuance" };
/* === FIN NUANCE COMMUNE === */
const DEFAULTS = { style: "christmas", title: "", name: "", birth_year: "", lead: "", theme: "auto", ...GV_DEFAULTS, message: undefined, date: "", show_from_days: "", show_seconds: true, snow: true, show_tree: true, image: "", image_mode: "", image_opacity: 0.55 };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const BULBS = ["#ff5a5f", "#ffc857", "#3ddc84", "#4aa8ff", "#e05597"];
const PARTY = ["#ff4f9a", "#ffd23f", "#3ddc97", "#4aa8ff", "#a06cff", "#ff8a3d"];
const isNum = (v) => v !== undefined && v !== null && v !== "" && !isNaN(Number(v));

/* prochaine échéance : "MM-JJ" (chaque année) ou "AAAA-MM-JJ" */
function nextTarget(spec, now) {
  const s = String(spec || "12-25").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0);
  m = s.match(/^(\d{1,2})-(\d{1,2})$/);
  const mo = m ? +m[1] : 12, d = m ? +m[2] : 25;
  let t = new Date(now.getFullYear(), mo - 1, d, 0, 0, 0);
  // le jour J entier (jusqu'à minuit) reste « aujourd'hui »
  if (now >= new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) t = new Date(now.getFullYear() + 1, mo - 1, d, 0, 0, 0);
  return t;
}

class CountdownCard extends HTMLElement {
  static getConfigElement() { return document.createElement("countdown-card-editor"); }
  static getStubConfig() { return { ...DEFAULTS }; }

  constructor() { super(); this.attachShadow({ mode: "open" }); this._sig = ""; }

  setConfig(config) {
    if (!config) throw new Error("Configuration invalide");
    this._config = { ...DEFAULTS, ...config };
    this._sig = "";
    if (this._hass || this._standalone) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const sig = (this._isDark() ? "d" : "l") + (this._config.entity && hass.states[this._config.entity] ? hass.states[this._config.entity].state : "");
    if (sig !== this._sig) { this._sig = sig; this._render(); }
  }

  connectedCallback() { this._timer = setInterval(() => this._tick(), 1000); if (this._config && !this._hass) { this._standalone = true; this._render(); } }
  disconnectedCallback() { clearInterval(this._timer); }
  getCardSize() { return 4; }

  _birthday() { return this._config && this._config.style === "birthday"; }
  _from() { const c = this._config; return isNum(c.show_from_days) ? Number(c.show_from_days) : this._birthday() ? 1 : 90; }

  _isDark() {
    const t = this._config && this._config.theme;
    if (t === "dark") return true;
    if (t === "light") return false;
    const dm = this._hass && this._hass.themes && this._hass.themes.darkMode;
    return typeof dm === "boolean" ? dm : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  _left() {
    const now = new Date(), c = this._config;
    const target = nextTarget(c.date || (this._birthday() ? "01-01" : "12-25"), now);
    const ms = target - now;
    const isDay = now.getMonth() === target.getMonth() && now.getDate() === target.getDate() && ms <= 0 || (ms <= 0 && ms > -86400000);
    return { ms, isDay, target };
  }

  _tick() {
    if (!this._config || !this.shadowRoot.querySelector("[data-d]")) return;
    const L = this._left();
    if (L.isDay || this._wasDay !== L.isDay) { if (this._wasDay !== L.isDay) { this._wasDay = L.isDay; this._render(); } return; }
    const t = Math.max(0, Math.floor(L.ms / 1000));
    const d = Math.floor(t / 86400), hh = Math.floor((t % 86400) / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
    const set = (k, v) => { const el = this.shadowRoot.querySelector(`[data-${k}]`); if (el && el.textContent !== v) el.textContent = v; };
    set("d", String(d)); set("h", pad(hh)); set("m", pad(mm)); set("s", pad(ss));
  }

  _tree() {
    const bulbs = [[60, 54], [44, 78], [76, 80], [30, 104], [60, 100], [90, 106], [22, 128], [50, 126], [74, 128], [98, 130]];
    return `<svg class="tree" viewBox="0 0 120 150" aria-hidden="true">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fa35a"/><stop offset="1" stop-color="#14663a"/></linearGradient>
        <radialGradient id="cstar"><stop offset="0" stop-color="#fff6c2"/><stop offset="1" stop-color="#ffc857" stop-opacity="0"/></radialGradient></defs>
      <circle class="starglow" cx="60" cy="14" r="16" fill="url(#cstar)"/>
      <path class="star" d="M60 4l3.2 6.6 7.2 1-5.2 5.1 1.2 7.2L60 20.4l-6.4 3.5 1.2-7.2-5.2-5.1 7.2-1z" fill="#ffd95a" stroke="#ffb300" stroke-width=".6"/>
      <path d="M60 22L84 62H36z" fill="url(#cg)"/><path d="M60 46L92 94H28z" fill="url(#cg)"/><path d="M60 72L100 128H20z" fill="url(#cg)"/>
      <path d="M60 22L84 62H36zM60 46L92 94H28zM60 72L100 128H20z" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
      <rect x="53" y="128" width="14" height="14" rx="2" fill="#7a4a24"/>
      <path d="M26 134q34-9 68 0q-4 8-34 9q-30-1-34-9z" fill="#f4f8ff" opacity=".95"/>
      ${bulbs.map((b, i) => `<circle class="bulb" cx="${b[0]}" cy="${b[1]}" r="3.2" fill="${BULBS[i % BULBS.length]}" style="animation-delay:${(i * 0.37).toFixed(2)}s"/>`).join("")}
    </svg>`;
  }

  _cake() {
    const flame = (x, d) => `<ellipse class="flame" cx="${x}" cy="62" rx="2.6" ry="4.4" fill="#ffb347" style="animation-delay:${d}s"/><ellipse class="flame" cx="${x}" cy="63" rx="1.2" ry="2.4" fill="#fff3b0" style="animation-delay:${d}s"/>`;
    return `<svg class="tree cake" viewBox="0 0 140 160" aria-hidden="true">
      <g class="balloon b1"><ellipse cx="22" cy="42" rx="14" ry="17" fill="#ff4f9a"/><path d="M22 59q-3 10 2 24" stroke="rgba(255,255,255,.5)" fill="none" stroke-width="1"/><ellipse cx="17" cy="35" rx="3.5" ry="5.5" fill="rgba(255,255,255,.35)"/></g>
      <g class="balloon b2"><ellipse cx="118" cy="50" rx="13" ry="16" fill="#4aa8ff"/><path d="M118 66q3 10-2 24" stroke="rgba(255,255,255,.5)" fill="none" stroke-width="1"/><ellipse cx="113" cy="43" rx="3.2" ry="5" fill="rgba(255,255,255,.35)"/></g>
      <g class="balloon b3"><ellipse cx="100" cy="22" rx="10" ry="12.5" fill="#ffd23f"/><path d="M100 34.5q-2 8 2 16" stroke="rgba(255,255,255,.5)" fill="none" stroke-width="1"/></g>
      <ellipse cx="70" cy="150" rx="52" ry="6" fill="rgba(0,0,0,.25)"/>
      <rect x="22" y="104" width="96" height="42" rx="8" fill="#ff7eb6"/><path d="M22 112q8 10 16 0t16 0t16 0t16 0t16 0t16 0V104H22z" fill="#fff4f8"/>
      <rect x="40" y="72" width="60" height="34" rx="7" fill="#ffd23f"/><path d="M40 80q7 9 15 0t15 0t15 0t15 0V72H40z" fill="#fff4f8"/>
      <circle cx="40" cy="128" r="3" fill="#fff"/><circle cx="62" cy="134" r="3" fill="#4aa8ff"/><circle cx="84" cy="128" r="3" fill="#fff"/><circle cx="104" cy="134" r="3" fill="#ffd23f"/>
      <rect x="56" y="64" width="3.4" height="10" rx="1" fill="#4aa8ff"/><rect x="68.3" y="64" width="3.4" height="10" rx="1" fill="#ff4f9a"/><rect x="81" y="64" width="3.4" height="10" rx="1" fill="#3ddc97"/>
      ${flame(57.7, 0)}${flame(70, 0.3)}${flame(82.7, 0.6)}
    </svg>`;
  }

  _bunting() {
    const n = 12;
    return `<div class="garland bunting" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="left:${((i + 0.5) / n * 100).toFixed(2)}%;--c:${PARTY[i % PARTY.length]};animation-delay:${(i * 0.23 % 2).toFixed(2)}s"></i>`).join("")}</div>`;
  }

  _confetti() {
    const out = [];
    for (let i = 0; i < 34; i++) {
      const r = (k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
      out.push(`<i style="left:${(r(1) * 100).toFixed(1)}%;width:${(5 + r(2) * 5).toFixed(1)}px;height:${(8 + r(2) * 7).toFixed(1)}px;background:${PARTY[Math.floor(r(7) * PARTY.length)]};animation-duration:${(5 + r(3) * 6).toFixed(1)}s;animation-delay:-${(r(4) * 11).toFixed(1)}s;--dx:${((r(6) - 0.5) * 90).toFixed(0)}px;--rot:${Math.round(360 + r(8) * 720)}deg;border-radius:${r(9) > 0.7 ? "50%" : "1px"}"></i>`);
    }
    return `<div class="snow confetti" aria-hidden="true">${out.join("")}</div>`;
  }

  _garland() {
    const n = 14;
    return `<div class="garland" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="left:${((i + 0.5) / n * 100).toFixed(2)}%;--c:${BULBS[i % BULBS.length]};animation-delay:${(i * 0.29 % 2).toFixed(2)}s"></i>`).join("")}</div>`;
  }

  _snow() {
    if (!this._config.snow) return "";
    const flakes = [];
    for (let i = 0; i < 26; i++) {
      const r = (k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
      flakes.push(`<i style="left:${(r(1) * 100).toFixed(1)}%;width:${(2 + r(2) * 4).toFixed(1)}px;height:${(2 + r(2) * 4).toFixed(1)}px;animation-duration:${(7 + r(3) * 9).toFixed(1)}s;animation-delay:-${(r(4) * 14).toFixed(1)}s;opacity:${(0.45 + r(5) * 0.5).toFixed(2)};--dx:${((r(6) - 0.5) * 60).toFixed(0)}px"></i>`);
    }
    return `<div class="snow" aria-hidden="true">${flakes.join("")}</div>`;
  }

  _render() {
    const c = this._config;
    if (!c) return;
    const L = this._left();
    const days = Math.floor(Math.max(0, L.ms) / 86400000);
    this._wasDay = L.isDay;
    const bd = this._birthday();
    const from = this._from();
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const calDays = Math.round((new Date(L.target.getFullYear(), L.target.getMonth(), L.target.getDate()) - today0) / 86400000);
    if (!L.isDay && from > 0 && calDays > from) { this.style.display = "none"; this.shadowRoot.innerHTML = ""; return; }
    this.style.display = "";
    const dark = this._isDark();
    const t = Math.max(0, Math.floor(L.ms / 1000));
    const d = Math.floor(t / 86400), hh = Math.floor((t % 86400) / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
    const nm = String(c.name || "").trim();
    const age = isNum(c.birth_year) ? L.target.getFullYear() - Number(c.birth_year) : null;
    const dayTxt = bd ? `Joyeux anniversaire${nm ? " " + esc(nm) : ""} !${age && age > 0 ? `<span class="age">${age} ans</span>` : ""}` : "Joyeux Noël !";
    const leadTxt = esc(c.lead || (bd ? (nm ? `Anniversaire de ${nm} dans` : "Anniversaire dans") : "Noël dans"));
    const message = c.message === undefined ? (bd ? (L.isDay ? "Que la fête commence !" : "On prépare la fête !") : "Ho Ho Ho !") : c.message;
    const head = L.isDay ? `<div class="big day">${dayTxt}</div>` : `<div class="lead">${leadTxt}</div><div class="big"><b data-d>${d}</b><small>jour${d > 1 ? "s" : ""}</small></div>
      <div class="hms"><span><b data-h>${pad(hh)}</b>h</span><span><b data-m>${pad(mm)}</b>min</span>${c.show_seconds ? `<span><b data-s>${pad(ss)}</b>s</span>` : ""}</div>`;
    const mode = c.image_mode || (bd ? "replace" : "background");
    const imgOk = c.image && !/^\s*(javascript|vbscript|data:text)/i.test(String(c.image)) && this._imgFailed !== c.image;
    const op = Math.max(0, Math.min(1, isNaN(Number(c.image_opacity)) ? 0.55 : Number(c.image_opacity)));
    const bgImg = imgOk && mode !== "replace" ? `<img class="bgimg" src="${esc(c.image)}" alt="" style="opacity:${op}"><div class="veil"></div>` : "";
    const art = imgOk && mode === "replace" ? `<div class="photo"><img src="${esc(c.image)}" alt=""></div>` : c.show_tree !== false ? (bd ? this._cake() : this._tree()) : "";
    this.shadowRoot.innerHTML = `<style>
      * { box-sizing:border-box; }
      ha-card.dark { --xc-text:#f4f6fb; --xc-muted:#b9c4dc; --xc-bg:var(--g-bg-x,linear-gradient(165deg,#0f1e3a 0%,#132a3a 50%,#10301f 100%)); --xc-border:rgba(255,255,255,.16); --xc-shadow:0 .6em 2em rgba(0,0,0,.4); --xc-glass:rgba(255,255,255,.08); --xc-glass-b:rgba(255,255,255,.15); --xc-snow:#fff; --xc-accent:#ffd95a; --xc-veil:#0f1e3a; }
      ha-card.light { --xc-text:#16324a; --xc-muted:#4d6b85; --xc-bg:var(--g-bg-x,linear-gradient(165deg,#e9f3ff 0%,#dcecf7 50%,#e6f4ea 100%)); --xc-border:rgba(20,50,80,.14); --xc-shadow:0 .4em 1.4em rgba(20,50,80,.14); --xc-glass:rgba(255,255,255,.65); --xc-glass-b:rgba(20,50,80,.1); --xc-snow:#9cc4e8; --xc-accent:#c2183b; --xc-veil:#eaf3ff; }
      ha-card.party.dark { --xc-bg:var(--g-bg-x,linear-gradient(165deg,#2a1240 0%,#3a1450 45%,#44123a 100%)); --xc-accent:#ffd23f; --xc-veil:#2a1240; --xc-snow:#fff; }
      ha-card.party.light { --xc-bg:var(--g-bg-x,linear-gradient(165deg,#fff1f8 0%,#f3ecff 50%,#fff6e6 100%)); --xc-accent:#d6246e; --xc-veil:#fff1f8; --xc-text:#3a1d4a; --xc-muted:#6d5382; }
      ha-card { position:relative; container-type:inline-size; display:flex; flex-direction:column; padding:0; color:var(--xc-text); border-radius:24px; border:1px solid var(--xc-border); background:var(--xc-bg); box-shadow:var(--xc-shadow); overflow:hidden; }
      .bgimg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; pointer-events:none; z-index:0; }
      .veil { position:absolute; inset:0; z-index:0; pointer-events:none; background:linear-gradient(90deg, color-mix(in srgb, var(--xc-veil) 80%, transparent) 0%, color-mix(in srgb, var(--xc-veil) 35%, transparent) 70%, transparent 100%); }
      .photo { width:100%; max-width:11em; aspect-ratio:1; margin:0 auto; border-radius:20px; overflow:hidden; border:2px solid var(--xc-glass-b); box-shadow:0 0 22px rgba(255,200,90,.28); } .photo img { width:100%; height:100%; object-fit:cover; display:block; }
      .garland { position:relative; z-index:1; height:26px; flex:none; background:linear-gradient(transparent 12px, rgba(0,0,0,.25) 13px, transparent 14px); }
      .garland::before { content:""; position:absolute; left:0; right:0; top:9px; height:10px; border-top:2px solid rgba(255,255,255,.28); border-radius:50% 50% 0 0 / 100% 100% 0 0; }
      .garland i { position:absolute; top:12px; width:9px; height:12px; margin-left:-4.5px; border-radius:50% 50% 55% 55%; background:var(--c); box-shadow:0 0 10px 2px var(--c); animation:xc-tw 2s ease-in-out infinite; }
      .body { position:relative; z-index:1; display:grid; grid-template-columns:${art ? "minmax(0,.8fr) minmax(0,1.2fr)" : "1fr"}; align-items:center; gap:8px; padding:8px 18px 18px; }
      @container (max-width:300px) { .body { grid-template-columns:1fr; justify-items:center; text-align:center; } }
      .tree { width:100%; max-width:9.5em; height:auto; display:block; margin:0 auto; filter:drop-shadow(0 0 14px rgba(60,200,110,.25)); }
      .bulb { animation:xc-tw 1.8s ease-in-out infinite; filter:drop-shadow(0 0 3px currentColor); } .star { animation:xc-st 3s ease-in-out infinite; transform-origin:60px 14px; transform-box:view-box; } .starglow { animation:xc-tw 2.4s ease-in-out infinite; }
      .txt { display:flex; flex-direction:column; gap:.35em; min-width:0; }
      .title { font-size:.8em; letter-spacing:.14em; text-transform:uppercase; color:var(--xc-muted); font-weight:700; }
      .lead { font-size:.95em; color:var(--xc-muted); font-weight:600; }
      .big { display:flex; align-items:baseline; gap:.3em; line-height:1; } .big b { font-size:3.6em; font-weight:800; color:var(--xc-accent); font-variant-numeric:tabular-nums; text-shadow:0 0 18px color-mix(in srgb, var(--xc-accent) 45%, transparent); } .big small { font-size:1.2em; font-weight:700; }
      .big.day { display:block; font-size:1.9em; font-weight:800; color:var(--xc-accent); line-height:1.15; } @container (max-width:300px) { .big { justify-content:center; } }
      .hms { display:flex; gap:.5em; flex-wrap:wrap; font-size:.8em; color:var(--xc-muted); } @container (max-width:300px) { .hms { justify-content:center; } }
      .hms span { display:inline-flex; align-items:baseline; gap:.25em; padding:.3em .7em; border-radius:2em; background:var(--xc-glass); border:1px solid var(--xc-glass-b); -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); } .hms b { color:var(--xc-text); font-size:1.25em; font-variant-numeric:tabular-nums; }
      .msg { font-size:1.05em; font-weight:700; margin-top:.2em; color:var(--xc-text); }
      .bunting { background:none; } .bunting::before { top:3px; border-top-color:rgba(255,255,255,.35); height:14px; }
      .bunting i { top:8px; width:14px; height:16px; margin-left:-7px; border-radius:0; background:var(--c); box-shadow:none; clip-path:polygon(0 0,100% 0,50% 100%); animation:xc-sway 2.4s ease-in-out infinite; transform-origin:50% 0; }
      .age { display:block; font-size:.55em; font-weight:700; color:var(--xc-text); margin-top:.3em; }
      .cake { filter:drop-shadow(0 0 14px rgba(255,120,190,.25)); } .flame { animation:xc-flame .5s ease-in-out infinite alternate; transform-box:fill-box; transform-origin:50% 100%; }
      .balloon { animation:xc-bob 3.6s ease-in-out infinite; } .b2 { animation-delay:-1.2s; animation-duration:4.2s; } .b3 { animation-delay:-2.2s; animation-duration:3.2s; }
      .confetti i { border-radius:1px; animation-name:xc-conf; animation-timing-function:linear; animation-iteration-count:infinite; opacity:.9; }
      @keyframes xc-conf { to { transform:translate(var(--dx), 340px) rotate(var(--rot)); } } @keyframes xc-sway { 50% { transform:rotate(7deg); } }
      @keyframes xc-flame { from { transform:scale(1,.85) skewX(-4deg); } to { transform:scale(.9,1.12) skewX(4deg); } } @keyframes xc-bob { 50% { transform:translateY(-6px); } }
      .snow { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:2; }
      .snow i { position:absolute; top:-10px; border-radius:50%; background:var(--xc-snow); animation:xc-fall linear infinite; }
      @keyframes xc-fall { to { transform:translate(var(--dx), 340px); } }
      @keyframes xc-tw { 0%,100% { opacity:1; } 50% { opacity:.3; } } @keyframes xc-st { 50% { transform:scale(1.18) rotate(8deg); } }
      @media (prefers-reduced-motion: reduce) { .snow i, .bulb, .garland i, .star, .starglow, .flame, .balloon { animation:none; } }
    </style>
    <ha-card class="${dark ? "dark" : "light"} ${bd ? "party" : "xmas"}" style="${gvStyle(c, dark)}">
      ${bgImg}${bd ? this._bunting() : this._garland()}
      <div class="body">${art}
        <div class="txt">${c.title ? `<div class="title">${esc(c.title)}</div>` : ""}${head}${message ? `<div class="msg">${esc(message)}</div>` : ""}</div></div>
      ${bd ? (c.snow !== false ? this._confetti() : "") : this._snow()}
    </ha-card>`;
    this.shadowRoot.querySelectorAll(".bgimg, .photo img").forEach((im) => im.addEventListener("error", () => { this._imgFailed = c.image; this._render(); }));
  }
}

/* ---------- Éditeur visuel ---------- */
const LABELS = { ...GV_LABELS, style: "Type de carte", name: "Prénom (anniversaire)", birth_year: "Année de naissance (affiche l'âge, facultatif)", lead: "Texte avant le compte à rebours (facultatif)", title: "Titre (facultatif)", theme: "Thème", message: "Message", date: "Date (MM-JJ chaque année, ou AAAA-MM-JJ)", show_from_days: "Afficher dans les N derniers jours (vide = 90 pour Noël, 1 pour un anniversaire, 0 = toujours)", show_seconds: "Afficher les secondes", snow: "Animation (neige / confettis)", show_tree: "Afficher l'illustration (sapin / gâteau)", image: "Photo perso (URL, ex. /local/noel.jpg)", image_mode: "Affichage de la photo", image_opacity: "Opacité de la photo de fond" };
const SCHEMA = [
  { name: "style", selector: { select: { mode: "dropdown", options: [{ value: "christmas", label: "Noël (sapin, neige)" }, { value: "birthday", label: "Anniversaire (gâteau, confettis)" }] } } },
  { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "birth_year", selector: { number: { min: 1900, max: 2100, mode: "box" } } }] },
  { name: "lead", selector: { text: {} } },
  { type: "grid", name: "", schema: [{ name: "title", selector: { text: {} } },
    { name: "theme", selector: { select: { mode: "dropdown", options: [{ value: "auto", label: "Automatique" }, { value: "light", label: "Clair" }, { value: "dark", label: "Sombre" }] } } }] },
  { name: "message", selector: { text: {} } },
  { type: "grid", name: "", schema: [{ name: "date", selector: { text: {} } }, { name: "show_from_days", selector: { number: { min: 0, max: 365, mode: "box" } } }] },
  { type: "grid", name: "", schema: [{ name: "show_seconds", selector: { boolean: {} } }, { name: "snow", selector: { boolean: {} } }] },
  { name: "show_tree", selector: { boolean: {} } },
  { name: "image", selector: { text: {} } },
  { type: "grid", name: "", schema: [
    { name: "image_mode", selector: { select: { mode: "dropdown", options: [{ value: "background", label: "En fond de la carte" }, { value: "replace", label: "Dans un cadre (à la place de l'illustration)" }] } } },
    { name: "image_opacity", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } } ] },
  { type: "expandable", name: "", title: "Nuance de couleur", schema: GV_FIELDS },
];

class CountdownCardEditor extends HTMLElement {
  setConfig(config) { this._config = { ...DEFAULTS, ...config }; if (!this._form) this._build(); else this._form.data = this._config; }
  set hass(h) { this._hass = h; if (this._form) this._form.hass = h; }
  _build() {
    const el = document.createElement("ha-form");
    el.hass = this._hass; el.data = this._config; el.schema = SCHEMA; el.computeLabel = (s) => LABELS[s.name] || s.name;
    el.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const cfg = { ...ev.detail.value };
      ["title", "message", "image", "name", "lead", "date", "show_from_days", "birth_year", "image_mode"].forEach((k) => { if (cfg[k] === "" || cfg[k] == null) delete cfg[k]; });
      this._config = cfg;
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
    });
    this._form = el; this.appendChild(el);
  }
}

customElements.define("countdown-card", CountdownCard);
customElements.define("countdown-card-editor", CountdownCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: "countdown-card", name: "Countdown Card (FR)", description: "Compte à rebours (Noël, anniversaires) : sapin et neige, ou gâteau et confettis, avec photo perso.", preview: true });
console.info(`%c COUNTDOWN-CARD %c v${CARD_VERSION} `, "color:#fff;background:#c2183b;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px", "color:#c2183b;background:#fff;font-weight:700;border-radius:0 3px 3px 0;padding:2px 4px");
