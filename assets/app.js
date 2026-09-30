(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const LIVE_API = "https://russianwarship.rip/api/v2/statistics/latest";
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const PAGE = document.body.dataset.page || "home";
  // Sections in reading order: [id, nav key, chapter number].
  const PAGES = [["russia", "nav.russia", "01"], ["ukraine", "nav.ukraine", "02"], ["spending", "nav.spending", "03"],
    ["partners", "nav.partners", "04"], ["contribute", "nav.funds", "05"], ["contact", "nav.contact", "06"]];
  const href = id => (PAGE === "home" ? "#" : "index.html#") + id;
  // What the short chapter intro shows when you jump to a section from the menu.
  const CHAPTER = {
    russia: ["ru.title", "pi.russia"], ukraine: ["ua.title", "pi.ukraine"], spending: ["sp.title", "pi.spending"],
    partners: ["pa.title", "pi.partners"], contribute: ["co.title", "pi.contribute"], contact: ["ct.title", "pi.contact"],
  };
  const COST_ORDER = ["tanks", "armoured_fighting_vehicles", "artillery_systems", "mlrs", "aa_warfare_systems",
    "planes", "helicopters", "cruise_missiles", "uav_systems", "warships_cutters", "submarines",
    "vehicles_fuel_tanks", "special_military_equip", "atgm_srbm_systems"];
  const TM_KEYS = ["personnel_units", "tanks", "armoured_fighting_vehicles", "artillery_systems", "planes", "uav_systems"];
  // Wall categories: key -> units per icon.
  const WALL = { tanks: 10, armoured_fighting_vehicles: 20, artillery_systems: 40, mlrs: 2, aa_warfare_systems: 2,
    planes: 1, helicopters: 1, warships_cutters: 1, cruise_missiles: 5, uav_systems: 500 };

  const state = { lang: "uk", spMode: "usd", paMode: "eur", data: null, sort: { key: "total", dir: -1 },
    wallKind: "tanks", tmIndex: 0, openedAt: performance.now() };

  /* ---------- storage (may be unavailable) ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  /* ---------- shared layout: header, mobile menu, footer ---------- */
  function initLayout() {
    const links = PAGES.map(([p, key]) => `<a href="${href(p)}" data-i18n="${key}"></a>`).join("");
    document.body.insertAdjacentHTML("afterbegin", `
      <header class="top" id="top">
        <div class="wrap">
          <a class="brand" href="${PAGE === "home" ? "#" : "index.html"}"><span class="flag" aria-hidden="true"></span><span data-i18n="brand"></span></a>
          <nav class="nav" aria-label="Main">${links}<a href="methodology.html" id="nav-method"${PAGE === "method" ? ' class="on" aria-current="page"' : ""} data-i18n="nav.method"></a></nav>
          <div class="tools">
            <button class="btn-ghost" id="lang-btn" type="button">EN</button>
            <button class="btn-ghost menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="mnav"><span class="burger" aria-hidden="true"></span><span class="sr-only" data-i18n="menu"></span></button>
          </div>
        </div>
        <div class="progress" id="progress"></div>
      </header>
      <nav class="mnav" id="mnav" aria-label="Main" hidden>
        <a href="${PAGE === "home" ? "#" : "index.html"}"><i>00</i><span data-i18n="nav.home"></span></a>
        ${PAGES.map(([p, key, no]) => `<a href="${href(p)}"><i>${no}</i><span data-i18n="${key}"></span></a>`).join("")}
        <a href="methodology.html"><i>··</i><span data-i18n="nav.method"></span></a>
      </nav>`);
    document.querySelector("main").insertAdjacentHTML("afterend", `
      <footer>
        <div class="wrap">
          <nav class="foot-nav" aria-label="Footer"><a href="${PAGE === "home" ? "#" : "index.html"}" data-i18n="nav.home"></a>${links}<a href="methodology.html" data-i18n="nav.method"></a></nav>
          <p data-i18n="foot.note"></p>
          <p data-i18n="foot.updated"></p>
          <p data-i18n="foot.credits"></p>
        </div>
      </footer>`);
    const btn = $("#menu-btn"), menu = $("#mnav");
    const setMenu = open => {
      document.body.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", open);
      if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add("on")); }
      else { menu.classList.remove("on"); setTimeout(() => { if (!document.body.classList.contains("menu-open")) menu.hidden = true; }, 400); }
    };
    btn.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
    addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
    menu.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });
  }

  /* ---------- i18n ---------- */
  function t(key, vars) {
    let s = (I18N[state.lang] && I18N[state.lang][key]) ?? I18N.uk[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s.replace(/р\.\./g, "р.");                          // uk dates end in "р." — avoid "р.." at sentence end
  }
  function applyI18n() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-attr]").forEach(el => {
      el.dataset.i18nAttr.split(";").forEach(pair => {
        const [attr, key] = pair.split(":");
        el.setAttribute(attr, t(key));
      });
    });
    document.title = PAGE === "home" ? t("meta.title") : t("title." + PAGE);
    $("#lang-btn").textContent = state.lang === "uk" ? "EN" : "UA";
    $("#lang-btn").setAttribute("aria-label", state.lang === "uk" ? "English" : "Українська");
    $$("#nav-method, #foot-method").forEach(a => { a.href = "methodology.html?lang=" + state.lang; });
    $$(".chapter h2, .contrib h2, .teaser h2").forEach(h => {
      h.classList.add("words");
      h.innerHTML = h.textContent.split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`).join(" ");
    });
  }
  function initLang() {
    const q = new URLSearchParams(location.search).get("lang");
    const saved = store.get("lang");
    const nav = (navigator.language || "").toLowerCase();
    state.lang = q === "en" || q === "uk" ? q : saved || (nav.startsWith("uk") || nav.startsWith("ru") ? "uk" : "en");
    $("#lang-btn").addEventListener("click", () => {
      state.lang = state.lang === "uk" ? "en" : "uk";
      store.set("lang", state.lang);
      const u = new URL(location.href); u.searchParams.set("lang", state.lang); history.replaceState(null, "", u);
      applyI18n();
      if (state.data) renderAll(false);
    });
  }

  /* ---------- formatting ---------- */
  const loc = () => (state.lang === "uk" ? "uk-UA" : "en-US");
  const fmtInt = n => new Intl.NumberFormat(loc()).format(Math.round(n));
  const fmtDec = (n, d = 1) => new Intl.NumberFormat(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  function fmtMoney(v, cur = "$", digits) {
    const uk = state.lang === "uk";
    const abs = Math.abs(v);
    let n, unit;
    if (abs >= 1e9) { n = v / 1e9; unit = uk ? " млрд" : "B"; }
    else if (abs >= 1e6) { n = v / 1e6; unit = uk ? " млн" : "M"; }
    else if (abs >= 1e4) { n = v / 1e3; unit = uk ? " тис." : "K"; }
    else return cur + fmtInt(v);
    const d = digits ?? (Math.abs(n) >= 100 ? 0 : 1);
    return cur + fmtDec(n, d) + unit;
  }
  const fmtBn = (bn, cur = "$", d) => fmtMoney(bn * 1e9, cur, d);
  function fmtDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat(loc(), { day: "numeric", month: "long", year: "numeric" }).format(new Date(y, m - 1, d));
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- war day (calendar, Kyiv time; 24 Feb 2022 = day 1) ---------- */
  function kyivToday() {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return p;                                                      // YYYY-MM-DD
  }
  const dayOf = iso => Math.round((Date.UTC(...iso.split("-").map((v, i) => i === 1 ? v - 1 : +v)) - Date.UTC(2022, 1, 24)) / 864e5) + 1;

  /* ---------- odometer (rolling digits) ---------- */
  const DIGITS = Array.from({ length: 20 }, (_, i) => `<span>${i % 10}</span>`).join("");
  function odometer(el, text, { intro = false } = {}) {
    const shape = text.replace(/\d/g, "d");
    if (el.dataset.shape !== shape) {
      el.dataset.shape = shape;
      el.innerHTML = [...text].map(ch => /\d/.test(ch) ? `<span class="od"><span class="od-strip">${DIGITS}</span></span>`
        : `<span class="od-sep${ch === "$" ? " cur" : ""}">${ch === " " || ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("");
      el.setAttribute("aria-label", text);
    }
    el.setAttribute("aria-label", text);
    const strips = $$(".od-strip", el), digits = text.replace(/\D/g, "");
    strips.forEach((st, i) => {
      const d = +digits[i], cur = +(st.dataset.pos || 0);
      let pos = d;
      if (intro) { pos = 10 + d; st.style.transitionDuration = (1.4 + i * .09) + "s"; }
      else { st.style.transitionDuration = ""; if (d < cur % 10) pos = 10 + d; }   // roll forward through 9→0
      if (pos === cur) return;
      st.dataset.pos = pos;
      st.style.transform = `translateY(${-pos * 1.04}em)`;
      if (pos >= 10) {
        const reset = () => { st.style.transition = "none"; st.style.transform = `translateY(${-d * 1.04}em)`; st.dataset.pos = d; st.offsetHeight; st.style.transition = ""; };
        st.addEventListener("transitionend", reset, { once: true });
      }
    });
  }

  /* ---------- cinematic intro (once per session) ---------- */
  function playIntro() {
    const intro = $("#intro");
    if (!intro) return Promise.resolve();
    let seen = false;
    try { seen = sessionStorage.getItem("introSeen") === "1"; } catch { /* ignore */ }
    if (seen || REDUCED || new URLSearchParams(location.search).has("nointro")) return Promise.resolve();
    try { sessionStorage.setItem("introSeen", "1"); } catch { /* ignore */ }
    intro.hidden = false;
    $("#intro-line").textContent = t("intro.line");
    $("#intro-label").textContent = t("intro.day");
    $("#intro-skip").textContent = t("intro.skip");
    const target = dayOf(kyivToday()), dayEl = $("#intro-day");
    document.documentElement.style.overflow = "hidden";
    return new Promise(resolve => {
      let done = false, raf;
      const finish = () => {
        if (done) return; done = true;
        cancelAnimationFrame(raf);
        dayEl.textContent = fmtInt(target);
        intro.classList.add("out");
        document.documentElement.style.overflow = "";
        ["wheel", "touchstart", "keydown"].forEach(ev => removeEventListener(ev, finish));
        setTimeout(() => { intro.hidden = true; }, 1000);
        resolve();
      };
      const start = performance.now() + 1900;
      const tick = now => {
        const k = Math.max(0, Math.min(1, (now - start) / 1300)), e = 1 - Math.pow(1 - k, 3);
        dayEl.textContent = fmtInt(1 + (target - 1) * e);
        if (now < start + 2300) raf = requestAnimationFrame(tick); else finish();
      };
      raf = requestAnimationFrame(tick);
      $("#intro-skip").addEventListener("click", finish);
      ["wheel", "touchstart", "keydown"].forEach(ev => addEventListener(ev, finish, { passive: true }));
    });
  }

  /* ---------- inner-page cinematic intro (~5 s, once per page per session) ---------- */
  function playPageIntro() {
    const cover = $(".page-cover, .page-contrib");
    const key = "pintro:" + PAGE;
    let seen = false;
    try { seen = sessionStorage.getItem(key) === "1"; } catch { /* ignore */ }
    if (!cover || seen || REDUCED || new URLSearchParams(location.search).has("nointro")) return Promise.resolve();
    try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
    const media = cover.querySelector(".media");
    const img = cover.dataset.cover || (media && media.style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, ""));
    const no = (PAGES.find(p => p[0] === PAGE) || [])[2] || "";
    const title = t({ russia: "ru.title", ukraine: "ua.title", spending: "sp.title", partners: "pa.title", contribute: "co.title" }[PAGE]);
    document.body.insertAdjacentHTML("afterbegin", `
      <div class="pintro" id="pintro" role="dialog" aria-label="${esc(title)}">
        <div class="pintro-bg" style="background-image:url('${esc(img)}')"></div>
        <div class="pintro-big" aria-hidden="true">${esc(no)}</div>
        <div class="pintro-inner">
          <div class="pintro-no">${esc(t("ch." + (+no)))}</div>
          <h1 class="pintro-title">${title.split(/\s+/).map((w, i) => `<span style="--i:${i}">${esc(w)}</span>`).join(" ")}</h1>
          <p class="pintro-desc">${esc(t("pi." + PAGE))}</p>
        </div>
        <div class="pintro-bar"><i></i></div>
        <button class="intro-skip" type="button">${esc(t("pi.skip"))} →</button>
      </div>`);
    const el = $("#pintro");
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
    return new Promise(resolve => {
      let done = false, timer = 0;
      const finish = () => {
        if (done) return; done = true;
        clearTimeout(timer);
        el.classList.add("out");
        document.documentElement.style.overflow = "";
        ["wheel", "keydown", "touchmove"].forEach(ev => removeEventListener(ev, finish));
        setTimeout(() => el.remove(), 1000);
        resolve();
      };
      timer = setTimeout(finish, 5400);
      el.addEventListener("click", finish);
      ["wheel", "keydown", "touchmove"].forEach(ev => addEventListener(ev, finish, { passive: true }));
    });
  }

  /* ---------- short chapter intro when jumping to a section from the menu (~2.5 s) ---------- */
  function initChapterJumps() {
    if (PAGE !== "home") return;
    document.addEventListener("click", e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey) return;
      const id = a.getAttribute("href").slice(1), sec = id && document.getElementById(id);
      if (!sec || !CHAPTER[id]) return;
      e.preventDefault();
      history.replaceState(null, "", "#" + id);
      if (REDUCED || $("#pintro")) { sec.scrollIntoView(); return; }
      const media = sec.querySelector(".media");
      const img = sec.dataset.cover || (media && media.style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, "")) || "assets/media/flag-poster.jpg";
      const no = PAGES.find(p => p[0] === id)[2];
      const title = t(CHAPTER[id][0]);
      document.body.insertAdjacentHTML("afterbegin", `
        <div class="pintro quick" id="pintro" role="dialog" aria-label="${esc(title)}">
          <div class="pintro-bg" style="background-image:url('${esc(img)}')"></div>
          <div class="pintro-big" aria-hidden="true">${esc(no)}</div>
          <div class="pintro-inner">
            <div class="pintro-no">${esc(t("ch." + (+no)))}</div>
            <h2 class="pintro-title">${title.split(/\s+/).map((w, i) => `<span style="--i:${i}">${esc(w)}</span>`).join(" ")}</h2>
            <p class="pintro-desc">${esc(t(CHAPTER[id][1]))}</p>
          </div>
          <div class="pintro-bar"><i></i></div>
        </div>`);
      const el = $("#pintro");
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
      // Jump underneath the curtain, then lift it.
      setTimeout(() => { document.documentElement.style.scrollBehavior = "auto"; sec.scrollIntoView(); document.documentElement.style.scrollBehavior = ""; }, 450);
      let done = false;
      const finish = () => { if (done) return; done = true; el.classList.add("out"); setTimeout(() => el.remove(), 900); };
      setTimeout(finish, 2600);
      el.addEventListener("click", finish);
    });
  }

  /* ---------- count-up ---------- */
  function countUp(el, to, fmt, dur = 1600) {
    if (REDUCED || el.dataset.done) { el.textContent = fmt(to); return; }
    el.dataset.done = "1";
    const start = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(to * e);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // Animate when the element first scrolls into view; later calls (e.g. language switch) just set the text.
  const counters = new Map();
  const counterIO = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    counterIO.unobserve(en.target);
    const c = counters.get(en.target); if (c) countUp(en.target, c.to, c.fmt);
  }), { threshold: .4 });
  function setCount(el, to, fmt) {
    if (el.dataset.done || REDUCED) { el.textContent = fmt(to); return; }
    counters.set(el, { to, fmt });
    el.textContent = fmt(0);
    counterIO.observe(el);
  }

  /* ---------- data ---------- */
  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }
  async function loadData() {
    const [losses, stat, aid, fx, hist] = await Promise.all(
      ["data/losses.json", "data/static.json", "data/aid.json", "data/fx.json", "data/history.json"].map(getJSON));
    try {
      const live = (await getJSON(LIVE_API)).data;
      const monotonic = Object.keys(losses.stats).every(k => (live.stats[k] ?? -1) >= losses.stats[k]);
      if (live.date > losses.date && monotonic) Object.assign(losses, { date: live.date, day: live.day, stats: live.stats, increase: live.increase });
    } catch { /* offline or API down: keep committed snapshot */ }
    if (hist.rows[hist.rows.length - 1][0] < losses.date) hist.rows.push([losses.date, ...hist.keys.map(k => losses.stats[k] || 0)]);
    // Mid-estimate cost for every day of the history.
    const items = stat.unit_costs.items;
    hist.cost = hist.rows.map(r => hist.keys.reduce((a, k, i) => a + (items[k] ? r[i + 1] * items[k].mid : 0), 0));
    const [funds, site] = await Promise.all(["data/fundraisers.json", "data/site.json"].map(u => getJSON(u).catch(() => null)));
    return { losses, stat, aid, fx, hist, funds, site };
  }

  function lossCosts() {
    const { losses, stat } = state.data;
    const items = stat.unit_costs.items;
    const out = { lo: 0, mid: 0, hi: 0, today: 0, byCat: {} };
    for (const [k, c] of Object.entries(items)) {
      const n = losses.stats[k] || 0;
      out.lo += n * c.low; out.mid += n * c.mid; out.hi += n * c.high;
      out.today += (losses.increase[k] || 0) * c.mid;
      out.byCat[k] = n * c.mid;
    }
    return out;
  }

  /* ---------- tooltip ---------- */
  function initTip() {
    const tip = $("#tip");
    const show = (el, x, y) => {
      tip.innerHTML = el.dataset.tip;
      tip.classList.add("on");
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.min(Math.max(8, x + 12), innerWidth - w - 8) + "px";
      tip.style.top = (y - h - 12 < 8 ? y + 16 : y - h - 12) + "px";
    };
    document.addEventListener("pointermove", e => {
      const el = e.target.closest("[data-tip]");
      if (el) show(el, e.clientX, e.clientY); else tip.classList.remove("on");
    });
    document.addEventListener("pointerdown", e => {
      const el = e.target.closest("[data-tip]");
      if (el && e.pointerType !== "mouse") show(el, e.clientX, e.clientY);
    });
    addEventListener("scroll", () => tip.classList.remove("on"), { passive: true });
  }

  /* ---------- scroll effects: header, progress, reveal, parallax, video ---------- */
  function initScrollFx() {
    const top = $("#top"), prog = $("#progress"), media = $$("[data-parallax]"), hero = $(".hero");
    let ticking = false;
    function onScroll() {
      ticking = false;
      const y = scrollY, vh = innerHeight, max = document.documentElement.scrollHeight - vh;
      top.classList.toggle("solid", y > 40);
      if (hero && !REDUCED && y < vh * 1.2) hero.style.setProperty("--hs", Math.min(1, y / vh).toFixed(3));
      prog.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      if (PAGE === "home") {
        let cur = null;
        for (const [id] of PAGES) { const sec = document.getElementById(id); if (sec && sec.getBoundingClientRect().top < vh * .4) cur = id; }
        $$(".nav a, .mnav a").forEach(a => a.classList.toggle("on", !!cur && a.getAttribute("href") === "#" + cur));
      }
      if (!REDUCED) for (const m of media) {
        const r = m.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        m.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * -0.12).toFixed(1)}px, 0)`;
      }
    }
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { threshold: .15, rootMargin: "0px 0px -8% 0px" });
    // Reveal-on-scroll starts only once the intro has gone, so nothing animates hidden underneath it.
    state.observeReveals = () => $$(".reveal, .hbars, #sp-chart, .chapter, .contrib h2, .stagger, .teaser")
      .forEach(el => { if (!el.classList.contains("in")) io.observe(el); });

    const video = $("#flag-video");
    if (video && !REDUCED) {
      new IntersectionObserver(([en]) => {
        if (en.isIntersecting) { video.preload = "auto"; video.play().catch(() => {}); } else video.pause();
      }, { threshold: .15 }).observe(video.closest("section"));
    }
  }

  /* ---------- interactive motion: tilt, glowing borders, cursor light, parallax ---------- */
  function initMotion() {
    if (!FINE || REDUCED) return;
    // Soft light that trails the cursor across the whole page.
    document.body.insertAdjacentHTML("beforeend", '<div class="cursor-light" aria-hidden="true"></div>');
    const light = $(".cursor-light");
    let lx = innerWidth / 2, ly = innerHeight / 2, tx = lx, ty = ly, raf = 0;
    const follow = () => {
      lx += (tx - lx) * .12; ly += (ty - ly) * .12;
      light.style.transform = `translate3d(${(lx - 300).toFixed(1)}px, ${(ly - 300).toFixed(1)}px, 0)`;
      raf = Math.abs(tx - lx) + Math.abs(ty - ly) > .5 ? requestAnimationFrame(follow) : 0;
    };
    // Every card near the cursor lights up its border where the pointer is; small blocks tilt towards it.
    const TILT = ".stat, .loss, .tm-grid > div, .buys li, .globe-list button";
    let tilted = null;
    document.addEventListener("pointermove", e => {
      tx = e.clientX; ty = e.clientY; light.classList.add("on");
      if (!raf) raf = requestAnimationFrame(follow);
      for (const c of document.querySelectorAll(".card, .keynums a")) {
        const r = c.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) continue;
        c.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
        c.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      }
      const tl = e.target.closest(TILT);
      if (tilted && tilted !== tl) { tilted.style.transform = ""; tilted.classList.remove("tilting"); }
      tilted = tl;
      if (tl) {
        const r = tl.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        const k = Math.min(1, 260 / Math.max(r.width, r.height));        // wide blocks tilt less
        tl.classList.add("tilting");
        tl.style.transform = `perspective(900px) rotateX(${(-py * 10 * k).toFixed(2)}deg) rotateY(${(px * 12 * k).toFixed(2)}deg) scale(1.02)`;
      }
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => light.classList.remove("on"));
    // Photo teasers: the image drifts against the cursor and a light follows it.
    $$(".teaser").forEach(el => {
      const m = el.querySelector(".teaser-media");
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        m.style.translate = `${(-px * 36).toFixed(1)}px ${(-py * 26).toFixed(1)}px`;
        el.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px"); el.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      });
      el.addEventListener("pointerleave", () => { m.style.translate = ""; });
    });
    // Magnetic call-to-action buttons.
    $$(".cta").forEach(b => {
      b.addEventListener("pointermove", e => { const r = b.getBoundingClientRect(); b.style.translate = `${(e.clientX - r.left - r.width / 2) * .18}px ${(e.clientY - r.top - r.height / 2) * .3}px`; });
      b.addEventListener("pointerleave", () => { b.style.translate = ""; });
    });
    // Bars: hovering one dims the others in the same chart.
    document.addEventListener("pointerover", e => {
      const bar = e.target.closest(".hbar");
      $$(".hbars.focus").forEach(h => { if (!bar || !h.contains(bar)) h.classList.remove("focus"); });
      $$(".hbar.hot").forEach(b => { if (b !== bar) b.classList.remove("hot"); });
      if (bar) { bar.classList.add("hot"); bar.parentElement.classList.add("focus"); }
    });
  }
  // Index children so grids can cascade in (CSS reads --si).
  const stagger = el => { if (el) [...el.children].forEach((c, i) => c.style.setProperty("--si", i)); };

  /* ---------- horizontal bars ---------- */
  function hbars(el, rows, max) {
    el.innerHTML = rows.map((r, i) => {
      const total = r.segs.reduce((a, s) => a + s.v, 0);
      const pct = max > 0 ? (total / max) * 100 : 0;
      const segs = r.segs.filter(s => s.v > 0).map(s =>
        `<span class="seg" style="flex:${s.v} 0 0;background:${s.color}"></span>`).join("");
      return `<div class="hbar" data-tip="${esc(r.tip)}">
        <span class="lab" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="track"><span class="fill" style="width:calc((100% - 96px) * ${(pct / 100).toFixed(4)});transition-delay:${i * 40}ms">${segs}</span><span class="val">${esc(r.value)}</span></span>
      </div>`;
    }).join("");
  }

  /* ---------- hero ---------- */
  function heroLive() {
    const { hist, losses } = state.data;
    const n = hist.cost.length, base = lossCosts().mid;
    const back = Math.min(30, n - 1);
    const perSec = (hist.cost[n - 1] - hist.cost[n - 1 - back]) / (back * 86400);
    const [y, m, d] = losses.date.split("-").map(Number);
    const t0 = Date.UTC(y, m - 1, d, 5, 0);                     // ≈08:00 Kyiv, when the report is published
    return { base, perSec, t0 };
  }
  function renderHero() {
    if (!$("#hero-total")) return;
    const { losses } = state.data;
    const c = lossCosts();
    $("#hero-day").textContent = t("hero.day", { n: fmtInt(dayOf(kyivToday())) });
    $("#newsline").innerHTML = (() => {
      const items = [`<span><b>+${esc(fmtMoney(c.today))}</b> ${esc(t("hero.today", { v: "" }).trim())}</span>`]
        .concat(["personnel_units", ...COST_ORDER].filter(k => (losses.increase[k] || 0) > 0).map(k =>
          `<span><b>+${fmtInt(losses.increase[k])}</b> ${esc(k === "personnel_units" ? t("ru.personnel") : t("cat." + k))}</span>`)).join("");
      return items + items;                                        // doubled for a seamless loop
    })();
    if ($("#hero-range")) $("#hero-range").textContent = t("hero.range", { lo: fmtMoney(c.lo, "$", 0), hi: fmtMoney(c.hi, "$", 0) });
    $("#hero-today").innerHTML = ` · <strong>+${esc(fmtMoney(c.today))}</strong> ` + esc(t("hero.today", { v: "" }).trim());
    if ($("#hero-live")) $("#hero-live").textContent = "≈ " + t("hero.live");
    if (state.ktRefresh && state.introDone) state.ktRefresh();
    const live = heroLive(), el = $("#hero-total");
    const value = () => live.base + live.perSec * Math.min(2 * 86400, Math.max(0, (Date.now() - live.t0) / 1000));
    const text = v => "$" + fmtInt(v);
    clearInterval(state.heroTimer); clearTimeout(state.heroDelay);
    el.dataset.shape = "";
    if (REDUCED) { odometer(el, text(value())); }
    else {
      // First show: all digits roll from zero once the hero is revealed, then tick every 400 ms.
      odometer(el, text(value()).replace(/\d/g, "0"));
      const startTicking = () => {
        odometer(el, text(value()), { intro: !state.heroIntroDone });
        const delay = state.heroIntroDone ? 0 : 2600;
        state.heroIntroDone = true;
        state.heroDelay = setTimeout(() => { state.heroTimer = setInterval(() => odometer(el, text(value())), 400); }, delay);
      };
      state.heroReady.then(() => requestAnimationFrame(() => requestAnimationFrame(startTicking)));
    }

    const s = state.data.stat, aid = state.data.aid.donors.reduce((a, d) => a + d.total, 0);
    const ms = s.military_spending, spSum = ms.years.reduce((a, y, i) => a + (y >= 2022 ? ms.russia[i] : 0), 0);
    stagger($(".keynums"));
    setCount($("[data-count=ru]"), c.mid / 1e9, v => fmtBn(v, "$", 0));
    setCount($("[data-count=ua]"), s.ukraine_damage.damage_usd_bn, v => fmtBn(v, "$", 0));
    setCount($("[data-count=sp]"), spSum, v => fmtBn(v, "$", 0));
    setCount($("[data-count=pa]"), aid, v => fmtBn(v, "€", 0));
  }

  /* ---------- hero: war footage + kinetic typography ---------- */
  // "*text*" in a phrase marks the highlighted (gold) part.
  const charSpans = (text, base = 0) => {
    let i = base, hot = false;
    return text.split(/(\*)/).map(part => {
      if (part === "*") { hot = !hot; return ""; }
      return part.split(/(\s+)/).map(w => w.trim() === "" ? w
        : `<span class="kw${hot ? " hot" : ""}">${[...w].map(ch => `<span class="kc" style="--c:${i++}">${esc(ch)}</span>`).join("")}</span>`).join("");
    }).join("");
  };
  function kineticTitle() {
    const h = $(".kt-title"); if (!h) return;
    h.innerHTML = charSpans(h.textContent.trim());
    h.setAttribute("aria-label", t("kt.title"));
  }
  function initHeroShow() {
    const rot = $("#kt-rot"); if (!rot) return;
    kineticTitle();
    const video = $("#hero-video");
    if (video && REDUCED) { video.removeAttribute("autoplay"); video.pause(); }
    // Video drifts slightly against the cursor for depth.
    const hero = $(".hero");
    if (video && FINE && !REDUCED) hero.addEventListener("pointermove", e => {
      const px = e.clientX / innerWidth - .5, py = e.clientY / innerHeight - .5;
      video.style.transform = `scale(1.08) translate(${(-px * 18).toFixed(1)}px, ${(-py * 12).toFixed(1)}px)`;
    });
    let k = 0;
    const phrases = () => {
      const pers = state.data ? fmtInt(state.data.losses.stats.personnel_units) : "";
      return ["kt.1", "kt.2", "kt.3", "kt.4", "kt.5"].filter(x => x !== "kt.2" || pers)
        .map(x => t(x, { days: fmtInt(dayOf(kyivToday())), pers }));
    };
    const show = () => {
      const list = phrases(), text = list[k % list.length];
      const old = rot.querySelector(".kt-line:not(.out)");
      if (old) { old.classList.add("out"); setTimeout(() => old.remove(), 900); }
      rot.insertAdjacentHTML("beforeend", `<div class="kt-line">${charSpans(text)}</div>`);
      const line = rot.lastElementChild;
      rot.setAttribute("aria-label", text.replace(/\*/g, ""));
      requestAnimationFrame(() => requestAnimationFrame(() => line.classList.add("in")));
    };
    state.ktRefresh = () => { rot.innerHTML = ""; show(); kineticTitle(); };
    state.heroReady.then(() => {
      show();
      if (!REDUCED) setInterval(() => { k++; show(); }, 3600);
    });
  }

  /* ---------- fundraisers + cooperation contacts ---------- */
  function renderFundraisers() {
    const grid = $("#fr-grid"); if (!grid || !state.data.funds) return;
    const L = state.lang, today = kyivToday();
    grid.innerHTML = state.data.funds.items.map(f => {
      const pct = Math.min(100, f.raised / f.goal * 100), sym = { UAH: "₴", USD: "$", EUR: "€" }[f.currency] || "";
      const money = v => sym + fmtInt(v);
      let when = "";
      if (f.ends) { const left = dayOf(f.ends) - dayOf(today); when = left >= 0 ? t("fr.days", { n: fmtInt(left) }) : t("fr.ended"); }
      const btn = f.url ? `<a class="cta fr-btn" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(t("fr.donate"))} ↗</a>`
        : `<span class="btn-ghost fr-btn off">${esc(t("fr.soon"))}</span>`;
      return `<article class="card fr-card">
        <div class="fr-img" style="background-image:url('${esc(f.img)}')">${f.demo ? `<span class="fr-badge">${esc(t("fr.demo"))}</span>` : ""}</div>
        <div class="fr-body">
          <div class="fr-org">${esc(f.org[L] || f.org.uk)}</div>
          <h3>${esc(f.title[L] || f.title.uk)}</h3>
          <p class="fr-desc">${esc(f.desc[L] || f.desc.uk)}</p>
          <div class="fr-bar" role="progressbar" aria-valuenow="${pct.toFixed(0)}" aria-valuemin="0" aria-valuemax="100"><i style="--p:${pct.toFixed(1)}%"></i></div>
          <div class="fr-nums"><span><b>${esc(money(f.raised))}</b> ${esc(t("fr.raised"))} · ${pct.toFixed(0)}%</span><span>${esc(t("fr.goal", { v: money(f.goal) }))}</span></div>
          <div class="fr-foot">${btn}<span class="muted">${esc(when)}</span></div>
        </div>
      </article>`;
    }).join("");
    stagger(grid);
  }
  function renderContact() {
    const c = state.data.site && state.data.site.contact; if (!c || !$("#ct-email")) return;
    const mail = $("#ct-email"), tg = $("#ct-tg");
    mail.hidden = !c.email; mail.href = "mailto:" + c.email;
    tg.hidden = !c.telegram; tg.href = c.telegram || "#";
  }

  /* ---------- home + "next" teasers: one big number each ---------- */
  function renderTeasers() {
    const els = $$("[data-teaser]"); if (!els.length) return;
    const s = state.data.stat, aidTotal = state.data.aid.donors.reduce((a, d) => a + d.total, 0);
    const ms = s.military_spending, perSec = ms.russia[ms.years.length - 1] * 1e9 / (365 * 24 * 3600);
    const V = {
      ru: [lossCosts().mid / 1e9, v => fmtBn(v, "$", 0)],
      ua: [s.ukraine_damage.needs_usd_bn, v => fmtBn(v, "$", 0)],
      sp: [perSec, v => "$" + fmtInt(v)],
      pa: [aidTotal, v => fmtBn(v, "€", 0)],
    };
    els.forEach(el => { const v = V[el.dataset.teaser]; if (v) setCount(el, v[0], v[1]); });
  }

  /* ---------- time machine ---------- */
  function renderTimeMachine() {
    if (!$("#tm")) return;
    const { hist } = state.data;
    const range = $("#tm-range");
    range.max = hist.rows.length - 1;
    if (!state.tmTouched) state.tmIndex = hist.rows.length - 1;
    range.value = state.tmIndex;
    drawTmChart();
    updateTm();
  }
  function tmGeom() {
    const W = Math.max(280, $("#tm-chart").clientWidth || 800), H = W < 500 ? 160 : 220;
    return { W, H, L: 8, R: 8, T: 10, B: 24 };
  }
  function drawTmChart() {
    const { hist } = state.data, n = hist.cost.length;
    const { W, H, L, R, T, B } = tmGeom();
    const max = hist.cost[n - 1] * 1.05;
    const x = i => L + (W - L - R) * i / (n - 1), y = v => T + (H - T - B) * (1 - v / max);
    const step = Math.max(1, Math.floor(n / 400));
    let d = "";
    for (let i = 0; i < n; i += step) d += (d ? "L" : "M") + x(i).toFixed(1) + "," + y(hist.cost[i]).toFixed(1);
    d += "L" + x(n - 1).toFixed(1) + "," + y(hist.cost[n - 1]).toFixed(1);
    const area = d + `L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`;
    let ticks = "";
    hist.rows.forEach((r, i) => {
      if (r[0].endsWith("-01-01") || (i === 0)) ticks += `<line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}" stroke="var(--grid)"/><text x="${x(i) + 4}" y="${H - 6}">${r[0].slice(0, 4)}</text>`;
    });
    $("#tm-chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" id="tm-svg" style="touch-action:pan-y">
      <defs><linearGradient id="tmg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e66767" stop-opacity=".35"/><stop offset="1" stop-color="#e66767" stop-opacity="0"/></linearGradient>
      <clipPath id="tmclip"><rect id="tm-clip" x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
      ${ticks}
      <path d="${area}" fill="rgba(255,255,255,.04)"/>
      <path d="${d}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
      <g clip-path="url(#tmclip)"><path d="${area}" fill="url(#tmg)"/><path d="${d}" fill="none" stroke="#e66767" stroke-width="2" stroke-linejoin="round"/></g>
      <line id="tm-cross" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
      <circle id="tm-dot" r="6" fill="#e66767" stroke="#0b0c0e" stroke-width="2"/>
    </svg>`;
    state.tmScale = { x, y, L, R, W, n };
    const svg = $("#tm-svg");
    const scrub = e => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * (W / r.width);
      setTmIndex(Math.round((px - L) / (W - L - R) * (n - 1)));
    };
    svg.addEventListener("pointerdown", e => { stopPlay(); scrub(e); svg.setPointerCapture(e.pointerId); });
    svg.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "mouse") scrub(e); });
  }
  function setTmIndex(i) {
    const n = state.data.hist.rows.length;
    state.tmIndex = Math.max(0, Math.min(n - 1, i));
    state.tmTouched = true;
    $("#tm-range").value = state.tmIndex;
    updateTm();
  }
  function updateTm() {
    const { hist } = state.data, i = state.tmIndex, row = hist.rows[i];
    const dayNo = dayOf(row[0]);
    $("#tm-day").textContent = t("tm.day", { n: fmtInt(dayNo) });
    $("#tm-date").textContent = fmtDate(row[0]);
    $("#tm-cost").textContent = "≈ " + fmtMoney(hist.cost[i], "$", 1);
    $("#tm-grid").innerHTML = TM_KEYS.map(k => {
      const v = row[hist.keys.indexOf(k) + 1];
      return `<div><div class="v">${fmtInt(v)}</div><div class="l">${esc(k === "personnel_units" ? t("ru.personnel") : t("cat." + k))}</div></div>`;
    }).join("");
    const range = $("#tm-range");
    range.style.setProperty("--p", (i / (hist.rows.length - 1) * 100).toFixed(2) + "%");
    const s = state.tmScale;
    if (s) {
      const cx = s.x(i), cy = s.y(hist.cost[i]);
      $("#tm-clip").setAttribute("width", cx);
      $("#tm-cross").setAttribute("x1", cx); $("#tm-cross").setAttribute("x2", cx);
      $("#tm-dot").setAttribute("cx", cx); $("#tm-dot").setAttribute("cy", cy);
    }
  }
  function stopPlay() { cancelAnimationFrame(state.playRaf); state.playing = false; $("#tm-play").textContent = "▶"; }
  function initTimeMachine() {
    if (!$("#tm")) return;
    $("#tm-range").addEventListener("input", e => { stopPlay(); setTmIndex(+e.target.value); });
    $("#tm-play").addEventListener("click", () => {
      if (state.playing) { stopPlay(); return; }
      const n = state.data.hist.rows.length;
      if (state.tmIndex >= n - 1) setTmIndex(0);
      state.playing = true; $("#tm-play").textContent = "❚❚";
      const from = state.tmIndex, start = performance.now(), dur = 9000 * (1 - from / n);
      const step = now => {
        const k = Math.min(1, (now - start) / dur);
        setTmIndex(Math.round(from + (n - 1 - from) * k));
        if (k < 1 && state.playing) state.playRaf = requestAnimationFrame(step); else stopPlay();
      };
      state.playRaf = requestAnimationFrame(step);
    });
    // Autoplay once when the time machine first comes into view.
    if (!REDUCED) new IntersectionObserver(([en], obs) => {
      if (en.isIntersecting && state.data && state.introDone && !state.tmTouched) { obs.disconnect(); setTmIndex(0); $("#tm-play").click(); }
    }, { threshold: .5 }).observe($("#tm"));
  }

  /* ---------- wall of losses ---------- */
  function renderWall(animate = true) {
    if (!$("#wall") || !window.FX) return;
    const { losses, stat } = state.data;
    const k = state.wallKind, n = losses.stats[k] || 0;
    // On phones, halve the number of figures for big categories so each one stays recognisable.
    const per = WALL[k] * (innerWidth < 600 && n / WALL[k] > 600 ? 2 : 1);
    $("#wall-chips").innerHTML = Object.keys(WALL).map(key =>
      `<button type="button" data-k="${key}" aria-pressed="${key === k}">${esc(t("cat." + key))}</button>`).join("");
    $("#wall-sub").textContent = t("wall.sub", { k: fmtInt(per) });
    $("#wall-total").innerHTML = `<strong>${esc(fmtInt(n))}</strong> ${esc(t("wall.total", { n: "" }).trim())}`;
    const cost = stat.unit_costs.items[k];
    $("#wall-cost").textContent = cost ? t("wall.cost", { v: fmtMoney(n * cost.mid) }) : "";
    const canvas = $("#wall");
    canvas.setAttribute("aria-label", `${t("cat." + k)}: ${fmtInt(n)}`);
    if (state.wallCancel) state.wallCancel();
    if (animate || !state.wallDrawn) { state.wallCancel = FX.wall(canvas, k, Math.ceil(n / per), "#e66767"); state.wallDrawn = true; }
  }
  function initWall() {
    if (!$("#wall")) return;
    $("#wall-chips").addEventListener("click", e => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      state.wallKind = b.dataset.k; renderWall(true);
    });
    new IntersectionObserver(([en], obs) => {
      if (en.isIntersecting && state.data && state.introDone) { obs.disconnect(); renderWall(true); }
    }, { threshold: .25 }).observe($("#wall"));
  }

  /* ---------- sections ---------- */
  function renderRussia() {
    if (!$("#losses")) return;
    const { losses, stat } = state.data;
    const costs = stat.unit_costs.items;
    const pers = `<div class="card loss personnel">
      <div><div class="name">${esc(t("ru.personnel"))}</div><div class="count num" id="pers-count">${fmtInt(losses.stats.personnel_units)}</div>
      <div class="row"><span class="inc">${esc(t("ru.today", { n: fmtInt(losses.increase.personnel_units) }))}</span></div></div>
      <p class="note">${esc(t("ru.personnel.note"))}</p></div>`;
    const tiles = COST_ORDER.filter(k => k in losses.stats).map(k => {
      const n = losses.stats[k], inc = losses.increase[k] || 0;
      const cost = costs[k] ? t("ru.cost", { v: fmtMoney(n * costs[k].mid) }) : t("ru.nocost");
      return `<div class="card loss"><div class="name">${esc(t("cat." + k))}</div>
        <div class="count num">${fmtInt(n)}</div>
        <div class="meta"><span class="${inc ? "inc" : ""}">${inc ? esc(t("ru.today", { n: fmtInt(inc) })) : "&nbsp;"}</span><span>${esc(cost)}</span></div></div>`;
    }).join("");
    $("#losses").innerHTML = pers + tiles;
    stagger($("#losses"));

    const c = lossCosts();
    const rows = Object.entries(c.byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
      label: t("cat." + k), value: fmtMoney(v), segs: [{ v, color: "var(--russia)" }],
      tip: `<b>${esc(t("cat." + k))}</b><br>${fmtInt(losses.stats[k])} × ≈${esc(fmtMoney(costs[k].mid))}<br>= ≈${esc(fmtMoney(v))} (${fmtDec(v / c.mid * 100)}%)`,
    }));
    hbars($("#ru-chart"), rows, rows[0].segs[0].v);
  }

  function renderUkraine() {
    if (!$("#ua-damage")) return;
    const { ukraine_damage: d, civilians: cv } = state.data.stat;
    setCount($("#ua-damage"), d.damage_usd_bn, v => fmtBn(v));
    setCount($("#ua-needs"), d.needs_usd_bn, v => fmtBn(v, "$", 0));
    setCount($("#ua-housing"), d.housing_damaged_share * 100, v => fmtInt(v) + "%");
    const rows = Object.entries(d.needs_by_sector_usd_bn).map(([k, v]) => ({
      label: t("sector." + k), value: fmtBn(v), segs: [{ v, color: "var(--bar)" }],
      tip: `<b>${esc(t("sector." + k))}</b><br>${esc(fmtBn(v))} (${fmtDec(v / d.needs_usd_bn * 100)}% ${state.lang === "uk" ? "від потреб" : "of needs"})`,
    }));
    hbars($("#ua-chart"), rows, Math.max(...rows.map(r => r.segs[0].v)));
    $("#civ-killed").textContent = fmtInt(cv.killed);
    $("#civ-injured").textContent = fmtInt(cv.injured);
    $("#civ-note").textContent = t("ua.civ.note", { d: fmtDate(cv.as_of) });
  }

  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  function renderSpending() {
    if (!$("#sp-chart")) return;
    const s = state.data.stat.military_spending;
    const idx = s.years.map((y, i) => i).filter(i => s.years[i] >= 2022);
    const sum = arr => idx.reduce((a, i) => a + arr[i], 0);
    setCount($("#sp-ru"), sum(s.russia), v => fmtBn(v));
    setCount($("#sp-ua"), sum(s.ukraine), v => fmtBn(v));
    state.perSec = s.russia[s.years.length - 1] * 1e9 / (365 * 24 * 3600);
    setCount($("#sp-sec"), state.perSec, v => "$" + fmtInt(v));

    const mode = state.spMode;
    const series = {
      usd: [s.russia, s.ukraine], gdp: [s.russia_pct_gdp, s.ukraine_pct_gdp], gov: [s.russia_pct_gov, s.ukraine_pct_gov],
    }[mode];
    const fmtV = v => (mode === "usd" ? fmtBn(v) : fmtDec(v) + "%");
    $("#sp-chart-title").textContent = t("sp.chart.title." + mode);
    $$("#sp-mode button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === mode));

    const W = Math.max(280, $("#sp-chart").clientWidth || 640), H = W < 500 ? 240 : 300, L = 44, R = 8, T = 22, B = 28;
    const max = niceMax(Math.max(...series.flat()));
    const y = v => T + (H - T - B) * (1 - v / max);
    const band = (W - L - R) / s.years.length;
    const bw = Math.min(24, band / 3.2), gap = 2;
    const colors = ["var(--russia)", "var(--ukraine)"], names = [t("sp.russia"), t("sp.ukraine")];
    let svg = "";
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4, yy = y(v);
      svg += `<line class="gridline" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>`;
      svg += `<text x="${L - 8}" y="${yy + 4}" text-anchor="end">${mode === "usd" ? fmtInt(v) : fmtInt(v) + "%"}</text>`;
    }
    s.years.forEach((yr, i) => {
      const cx = L + band * i + band / 2;
      series.forEach((arr, si) => {
        const x = cx + (si === 0 ? -bw - gap / 2 : gap / 2), top = y(arr[i]), base = y(0), r = Math.min(4, base - top);
        svg += `<path class="col" style="transition-delay:${i * 90 + si * 40}ms" fill="${colors[si]}" d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z"/>`;
        // Label only the latest russia column; Ukraine's label would collide with it (value is in tooltip + stat tiles).
        if (i === s.years.length - 1 && si === 0) svg += `<text class="lbl" x="${x + bw}" y="${top - 6}" text-anchor="end">${esc(fmtV(arr[i]))}</text>`;
      });
      svg += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${yr}</text>`;
      const tip = `<b>${yr}</b><br>${names.map((n, si) => `${esc(n)}: ${esc(fmtV(series[si][i]))}`).join("<br>")}`;
      svg += `<rect class="hit" x="${cx - band / 2}" y="${T}" width="${band}" height="${H - T - B}" data-tip="${esc(tip)}"/>`;
    });
    $("#sp-chart").innerHTML = `<svg class="colchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("sp.chart.title." + mode))}">${svg}</svg>`;
  }
  function initSpendTicker() {
    const el = $("#sp-live");
    if (!el) return;
    let last = 0;
    const loop = now => {
      if (state.perSec && now - last > 80) {
        el.textContent = "$" + fmtInt(state.perSec * (now - state.openedAt) / 1000);
        last = now;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  const countryName = c => (state.lang === "uk" ? COUNTRY_UK[c] || c : c);

  function renderPartners() {
    if (!$("#pa-chart")) return;
    const aid = state.data.aid, donors = aid.donors;
    const sum = k => donors.reduce((a, d) => a + d[k], 0);
    const cutoff = fmtDate(aid.cutoff);
    $("#pa-lead").textContent = t("pa.lead", { d: cutoff });
    setCount($("#pa-total"), sum("total"), v => fmtBn(v, "€"));
    setCount($("#pa-mil"), sum("military"), v => fmtBn(v, "€"));
    setCount($("#pa-fin"), sum("financial"), v => fmtBn(v, "€"));
    setCount($("#pa-hum"), sum("humanitarian"), v => fmtBn(v, "€"));
    $("#pa-source").textContent = t("pa.source", { r: aid.release, d: cutoff });

    const mode = state.paMode;
    $$("#pa-mode button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === mode));
    $("#pa-sub").textContent = t(mode === "eur" ? "pa.chart.sub.eur" : "pa.chart.sub.gdp");
    $("#pa-legend").hidden = mode !== "eur";
    const detailTip = donorTip;
    let rows;
    if (mode === "eur") {
      rows = [...donors].sort((a, b) => b.total - a.total).slice(0, 15).map(d => ({
        label: countryName(d.country), value: fmtBn(d.total, "€"), tip: detailTip(d),
        segs: [{ v: d.military, color: "var(--s1)" }, { v: d.financial, color: "var(--s2)" }, { v: d.humanitarian, color: "var(--s3)" }],
      }));
    } else {
      rows = donors.filter(d => d.total_pct_gdp > 0 && !d.country.startsWith("EU"))
        .sort((a, b) => b.total_pct_gdp - a.total_pct_gdp).slice(0, 15).map(d => ({
          label: countryName(d.country), value: fmtDec(d.total_pct_gdp, 2) + "%", tip: detailTip(d),
          segs: [{ v: d.total_pct_gdp, color: "var(--bar)" }],
        }));
    }
    hbars($("#pa-chart"), rows, Math.max(...rows.map(r => r.segs.reduce((a, s) => a + s.v, 0))));
    $("#pa-table-toggle").textContent = t("pa.table.show", { n: donors.length });
    renderTable();
  }

  function donorTip(d) {
    return `<b>${esc(countryName(d.country))}</b><br>` +
      `${esc(t("pa.military"))}: ${esc(fmtBn(d.military, "€"))}<br>${esc(t("pa.financial"))}: ${esc(fmtBn(d.financial, "€"))}<br>` +
      `${esc(t("pa.humanitarian"))}: ${esc(fmtBn(d.humanitarian, "€"))}<br>${esc(t("pa.col.total"))}: ${esc(fmtBn(d.total, "€"))} · ${fmtDec(d.total_pct_gdp, 2)}% ${state.lang === "uk" ? "ВВП" : "GDP"}`;
  }

  /* ---------- aid globe ---------- */
  function renderGlobeSide() {
    if (!$("#globe")) return;
    if (state.globe) state.globe.setLabel(t("kyiv"));
    const donors = [...state.data.aid.donors].sort((a, b) => b.total - a.total);
    const total = donors.reduce((a, d) => a + d.total, 0);
    $("#globe-lead").textContent = t("globe.lead", { n: donors.length, total: fmtBn(total, "€", 0) });
    $("#globe-list").innerHTML = donors.slice(0, 8).map((d, i) =>
      `<li><button type="button" data-c="${esc(d.country)}"><span class="rk">${String(i + 1).padStart(2, "0")}</span><span>${esc(countryName(d.country))}</span><span class="am">${esc(fmtBn(d.total, "€"))}</span></button></li>`).join("");
  }
  async function initGlobe() {
    if (!$("#globe") || !window.Globe) return;
    const tip = $("#tip");
    try {
      state.globe = await Globe.create($("#globe"), state.data.aid.donors, {
        kyivLabel: t("kyiv"),
        onHover(h, e) {
          if (!h || !h.d || !e) { tip.classList.remove("on"); return; }
          tip.innerHTML = donorTip(h.d); tip.classList.add("on");
          tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + "px";
          tip.style.top = Math.max(8, e.clientY - tip.offsetHeight - 12) + "px";
        },
      });
    } catch (err) { console.error("globe", err); return; }
    const list = $("#globe-list");
    const act = e => {
      const b = e.target.closest("button[data-c]"); if (!b) return;
      state.globe.focus(b.dataset.c); state.globe.highlight(b.dataset.c);
    };
    list.addEventListener("pointerover", act);
    list.addEventListener("focusin", act);
    list.addEventListener("click", act);
    list.addEventListener("pointerleave", () => state.globe.highlight(null));
  }

  function renderTable() {
    const cols = [
      ["country", "pa.col.country"], ["military", "pa.col.military"], ["financial", "pa.col.financial"],
      ["humanitarian", "pa.col.humanitarian"], ["total", "pa.col.total"], ["total_pct_gdp", "pa.col.gdp"],
      ["total_incl_eu", "pa.col.withEu"], ["committed", "pa.col.committed"],
    ];
    const { key, dir } = state.sort;
    const rows = [...state.data.aid.donors].sort((a, b) =>
      key === "country" ? dir * countryName(a.country).localeCompare(countryName(b.country), loc()) : dir * (a[key] - b[key]));
    const head = cols.map(([k, l]) => `<th data-k="${k}" ${k === key ? `aria-sort="${dir > 0 ? "ascending" : "descending"}"` : ""}>${esc(t(l))}${k === key ? (dir > 0 ? " ↑" : " ↓") : ""}</th>`).join("");
    const body = rows.map(d => `<tr>${cols.map(([k]) => {
      if (k === "country") return `<td>${esc(countryName(d.country))}</td>`;
      if (k === "total_pct_gdp") return `<td>${fmtDec(d[k], 2)}%</td>`;
      return `<td>${fmtDec(d[k], 2)}</td>`;
    }).join("")}</tr>`).join("");
    $("#pa-table").innerHTML = `<caption class="sr-only">${esc(t("pa.table.title"))}, ${esc(t("pa.unit"))}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  }

  /* ---------- contribution calculator ---------- */
  const PRESETS = { UAH: [1500, 5000, 20000, 100000, 500000], USD: [50, 100, 500, 2000, 10000], EUR: [50, 100, 500, 2000, 10000] };
  const SYM = { UAH: "₴", USD: "$", EUR: "€" };

  function renderFunds() {
    const el = $("#co-funds"); if (!el) return;
    el.innerHTML = state.data.stat.donate.funds.map((f, i) =>
      `<a class="${i === 0 ? "primary" : ""}" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(t("fund." + f.id))} ↗</a>`).join("");
  }
  function renderContribute() {
    if (!$("#co-amount")) return;
    const { stat, fx } = state.data;
    const amount = Math.max(0, parseFloat($("#co-amount").value) || 0);
    const cur = $("#co-cur").value;
    const uah = cur === "UAH" ? amount : amount * fx[cur];
    const prev = state.prevQ || {};
    const items = stat.donate.items.map(it => {
      const price = it.usd * fx.USD;
      return { ...it, price, q: Math.floor(uah / price) };
    });
    const best = [...items].reverse().find(i => i.q > 0);
    $("#co-buys").innerHTML = items.map(it => `<li class="${it.q ? "" : "off"}${best && it.id === best.id ? " hit" : ""}${prev[it.id] !== undefined && prev[it.id] !== it.q ? " pop" : ""}">
      <span>${esc(t("item." + it.id))}<span class="muted price">≈${esc(fmtInt(it.price))} ₴</span></span>
      <span class="q">${esc(t("co.pieces", { n: fmtInt(it.q) }))}</span></li>`).join("");
    state.prevQ = Object.fromEntries(items.map(i => [i.id, i.q]));
    stagger($("#co-buys"));
    $("#co-none").hidden = items.some(i => i.q > 0);
    $("#co-presets").innerHTML = PRESETS[cur].map(v =>
      `<button type="button" data-v="${v}">${SYM[cur]}${fmtInt(v)}</button>`).join("");
    $("#co-fx").textContent = t("co.fx", { d: fx.date, usd: fmtDec(fx.USD, 2), eur: fmtDec(fx.EUR, 2) });
    state.shareBest = best || null;
    state.shareWhat = best ? `${fmtInt(best.q)} × ${t("item." + best.id)}` : t("item.tourniquet");
    state.shareAmount = SYM[cur] + fmtInt(amount);
  }

  // 1080×1350 PNG for Instagram/Telegram.
  async function makeShareImage() {
    const W = 1080, H = 1350, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const img = new Image();
    img.src = "assets/media/sunset.webp";
    await img.decode().catch(() => {});
    try { await Promise.all([document.fonts.load("800 90px Unbounded"), document.fonts.load("600 40px Inter")]); } catch { /* fallback fonts */ }
    if (img.naturalWidth) {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight), iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      g.drawImage(img, (W - iw) / 2 - 80, (H - ih) / 2, iw, ih);
    } else { g.fillStyle = "#1a1208"; g.fillRect(0, 0, W, H); }
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(11,12,14,.55)"); gr.addColorStop(.45, "rgba(11,12,14,.25)"); gr.addColorStop(1, "rgba(11,12,14,.95)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // flag + brand
    g.fillStyle = "#0057b8"; g.fillRect(80, 84, 56, 20); g.fillStyle = "#ffd500"; g.fillRect(80, 104, 56, 20);
    g.fillStyle = "#fff"; g.font = "700 38px Unbounded, Inter, sans-serif"; g.textBaseline = "middle";
    g.fillText(t("brand"), 156, 106);
    // headline
    const fit = (text, font, maxW, size) => { let s = size; do { g.font = font.replace("{s}", s); s -= 4; } while (g.measureText(text).width > maxW && s > 20); };
    g.textBaseline = "alphabetic";
    g.fillStyle = "#ffd500"; g.font = "600 40px Inter, sans-serif";
    g.fillText(t("img.title"), 80, 820);
    fit(state.shareAmount, "800 {s}px Unbounded, Inter, sans-serif", W - 160, 130);
    g.fillStyle = "#fff"; g.fillText(state.shareAmount, 80, 960);
    g.font = "600 44px Inter, sans-serif"; g.fillStyle = "rgba(255,255,255,.8)";
    g.fillText("= " + (state.shareBest ? `${fmtInt(state.shareBest.q)} ×` : ""), 80, 1050);
    fit(state.shareBest ? t("item." + state.shareBest.id) : t("co.none"), "800 {s}px Unbounded, Inter, sans-serif", W - 160, 72);
    g.fillStyle = "#fff"; g.fillText(state.shareBest ? t("item." + state.shareBest.id) : "", 80, 1140);
    g.font = "600 32px Inter, sans-serif"; g.fillStyle = "rgba(255,255,255,.7)";
    g.fillText(t("img.foot") + " → " + location.host, 80, 1260);
    g.font = "400 20px Inter, sans-serif"; g.fillStyle = "rgba(255,255,255,.45)";
    g.fillText("Photo: General Staff of the Armed Forces of Ukraine, CC BY 4.0", 80, 1305);
    return new Promise(res => c.toBlob(res, "image/png"));
  }

  function initContribute() {
    if (!$("#co-amount")) return;
    $("#co-amount").addEventListener("input", renderContribute);
    $("#co-cur").addEventListener("change", () => {
      $("#co-amount").value = PRESETS[$("#co-cur").value][2];
      renderContribute();
    });
    $("#co-presets").addEventListener("click", e => {
      const b = e.target.closest("button[data-v]");
      if (b) { $("#co-amount").value = b.dataset.v; renderContribute(); }
    });
    $("#co-share").addEventListener("click", async () => {
      const text = t("co.share.text", { a: state.shareAmount, what: state.shareWhat });
      const url = location.origin + location.pathname.replace(/[^/]*$/, "") + "?lang=" + state.lang;
      try {
        if (navigator.share) { await navigator.share({ text, url }); return; }
        await navigator.clipboard.writeText(text + " " + url);
        const b = $("#co-share"); b.textContent = t("co.copied");
        setTimeout(() => { b.textContent = t("co.share"); }, 1800);
      } catch { /* user cancelled */ }
    });
    $("#co-image").addEventListener("click", async () => {
      const blob = await makeShareImage();
      if (!blob) return;
      const file = new File([blob], "my-contribution.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ files: [file], text: t("co.share.text", { a: state.shareAmount, what: state.shareWhat }) }); return; } catch { /* fall back to preview */ }
      }
      if (state.shareUrl) URL.revokeObjectURL(state.shareUrl);
      state.shareUrl = URL.createObjectURL(blob);
      $("#co-preview-img").src = state.shareUrl;
      $("#co-preview-img").alt = t("co.share.text", { a: state.shareAmount, what: state.shareWhat });
      $("#co-download").href = state.shareUrl;
      $("#co-preview").classList.add("on");
    });
  }

  function renderAll(first = true) {
    renderHero(); renderTeasers(); renderTimeMachine(); renderRussia(); renderUkraine(); renderSpending(); renderPartners(); renderGlobeSide(); renderFunds(); renderFundraisers(); renderContact(); renderContribute();
    renderWall(!first);
  }

  function initControls() {
    if ($("#sp-mode")) $("#sp-mode").addEventListener("click", e => {
      const b = e.target.closest("button[data-mode]"); if (!b) return;
      state.spMode = b.dataset.mode; renderSpending(); $("#sp-chart").classList.add("in");
    });
    if ($("#pa-mode")) $("#pa-mode").addEventListener("click", e => {
      const b = e.target.closest("button[data-mode]"); if (!b) return;
      state.paMode = b.dataset.mode; renderPartners();
    });
    let rz, lastW = innerWidth;
    addEventListener("resize", () => {
      clearTimeout(rz);
      rz = setTimeout(() => {
        if (!state.data || innerWidth === lastW) return;
        lastW = innerWidth;
        renderSpending(); if ($("#sp-chart")) $("#sp-chart").classList.add("in");
        if ($("#tm")) { drawTmChart(); updateTm(); }
        renderWall(false);
      }, 200);
    });
    if ($("#pa-table")) $("#pa-table").addEventListener("click", e => {
      const th = e.target.closest("th[data-k]"); if (!th) return;
      const k = th.dataset.k;
      state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : (k === "country" ? 1 : -1) };
      renderTable();
    });
  }

  async function main() {
    initLayout(); initLang(); applyI18n(); initTip(); initScrollFx(); initControls(); initContribute(); initTimeMachine(); initWall(); initSpendTicker(); initMotion(); initChapterJumps();
    if (window.FX && $("#sky")) FX.sky($("#sky"));
    state.heroReady = (PAGE === "home" ? playIntro() : playPageIntro()).then(() => {
      state.introDone = true;
      const hero = $(".hero"); if (hero) hero.classList.add("on");
      state.observeReveals();
      if (state.data) renderWall(true);                          // it may already be in view under the intro
      const tm = $("#tm");                                       // same for the time machine autoplay
      if (tm && state.data && !state.tmTouched && tm.getBoundingClientRect().top < innerHeight * .6) { setTmIndex(0); $("#tm-play").click(); }
    });
    initHeroShow();
    try {
      state.data = await loadData();
      renderAll(true);
      if (state.introDone) state.observeReveals();                 // pick up freshly rendered grids
      // Reload on "#section": the browser jumped before data filled the page, so land there again.
      const target = location.hash && document.getElementById(location.hash.slice(1));
      if (target) requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = "auto"; target.scrollIntoView(); document.documentElement.style.scrollBehavior = ""; });
      initGlobe();
    } catch (err) {
      console.error(err);
      if ($("#hero-total")) { $("#hero-total").textContent = "—"; $("#hero-day").textContent = t("error"); }
    }
  }
  main();
})();
