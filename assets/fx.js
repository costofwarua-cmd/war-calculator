// Visual effects: animated hero sky (embers + air-defence interceptions) and the "wall of losses" icons.
(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ================= hero sky ================= */
  function sky(canvas) {
    if (reduced || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = 1, running = true, last = performance.now(), nextEvent = 1.2;
    const embers = [], targets = [], interceptors = [], blasts = [], sparks = [];

    function resize() {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const want = Math.round(Math.min(90, w / 14));
      while (embers.length < want) embers.push(newEmber(true));
      embers.length = want;
    }
    function newEmber(anywhere) {
      return { x: rand(0, w), y: anywhere ? rand(0, h) : h + 10, r: rand(.6, 2.2), vy: rand(12, 38), sway: rand(.3, 1.2),
        ph: rand(0, 6.28), a: rand(.35, .9), hue: rand(28, 48) };
    }

    // One interception: a target crosses the sky, an interceptor rises and meets it.
    function spawnInterception() {
      const fromRight = Math.random() < .6;
      const sx = fromRight ? rand(w * .7, w * 1.05) : rand(-w * .05, w * .3);
      const sy = rand(-30, h * .08);
      const ang = fromRight ? rand(2.55, 2.85) : rand(.3, .6);          // heading, radians
      const speed = rand(70, 120);
      const tMeet = rand(2.6, 4.2);
      const px = sx + Math.cos(ang) * speed * tMeet, py = sy + Math.sin(ang) * speed * tMeet;
      if (px < w * .08 || px > w * .92 || py > h * .5) return;           // keep it high in the sky
      const target = { sx, sy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: 0, tMeet, trail: [] };
      targets.push(target);
      const lx = px + rand(-w * .25, w * .25), ly = h + 10, dur = rand(1.1, 1.6);
      interceptors.push({ lx, ly, px, py, cx: (lx + px) / 2 + rand(-80, 80), cy: py + (ly - py) * rand(.1, .35),
        start: tMeet - dur, dur, t: 0, trail: [], target });
    }
    function burst(x, y) {
      blasts.push({ x, y, t: 0 });
      for (let i = 0; i < 28; i++) {
        const a = rand(0, 6.28), s = rand(30, 170);
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: rand(.8, 1.6), t: 0 });
      }
    }

    function drawTrail(trail, rgb, width) {
      for (let i = 1; i < trail.length; i++) {
        const a = i / trail.length;
        ctx.strokeStyle = `rgba(${rgb},${a * .55})`;
        ctx.lineWidth = width * a;
        ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke();
      }
    }
    function glow(x, y, r, rgb, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      // embers
      for (const e of embers) {
        e.y -= e.vy * dt; e.ph += dt * e.sway; e.x += Math.sin(e.ph) * .35;
        if (e.y < -10) Object.assign(e, newEmber(false));
        const fade = Math.min(1, e.y / (h * .6));
        const flick = .65 + .35 * Math.sin(now / 180 + e.ph * 3);
        ctx.fillStyle = `hsla(${e.hue},100%,62%,${e.a * fade * flick})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill();
      }

      // schedule interceptions
      nextEvent -= dt;
      if (nextEvent <= 0) { spawnInterception(); nextEvent = rand(2.2, 4.8); }

      // targets
      for (let i = targets.length - 1; i >= 0; i--) {
        const tg = targets[i]; tg.t += dt;
        const x = tg.sx + tg.vx * tg.t, y = tg.sy + tg.vy * tg.t;
        tg.trail.push([x, y]); if (tg.trail.length > 26) tg.trail.shift();
        if (tg.dead) { targets.splice(i, 1); continue; }
        drawTrail(tg.trail, "255,120,80", 2);
        glow(x, y, 7, "255,110,70", .9);
      }
      // interceptors
      for (let i = interceptors.length - 1; i >= 0; i--) {
        const it = interceptors[i]; it.t += dt;
        const k = (it.t - it.start) / it.dur;
        if (k < 0) continue;
        if (k >= 1) { burst(it.px, it.py); it.target.dead = true; interceptors.splice(i, 1); continue; }
        const e = k * k * (3 - 2 * k) * .35 + k * .65;                   // slight acceleration
        const x = (1 - e) * (1 - e) * it.lx + 2 * (1 - e) * e * it.cx + e * e * it.px;
        const y = (1 - e) * (1 - e) * it.ly + 2 * (1 - e) * e * it.cy + e * e * it.py;
        it.trail.push([x, y]); if (it.trail.length > 34) it.trail.shift();
        drawTrail(it.trail, "255,230,170", 2.4);
        glow(x, y, 9, "255,245,210", 1);
      }
      // blasts + sparks
      for (let i = blasts.length - 1; i >= 0; i--) {
        const b = blasts[i]; b.t += dt;
        if (b.t > .7) { blasts.splice(i, 1); continue; }
        const k = b.t / .7;
        glow(b.x, b.y, 10 + 70 * k, "255,200,120", .9 * (1 - k));
        glow(b.x, b.y, 6 + 18 * k, "255,255,240", 1 - k);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.t += dt;
        if (s.t > s.life) { sparks.splice(i, 1); continue; }
        s.vy += 60 * dt; s.vx *= .985; s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.fillStyle = `rgba(255,${180 + Math.random() * 60 | 0},110,${1 - s.t / s.life})`;
        ctx.fillRect(s.x, s.y, 1.8, 1.8);
      }
      ctx.globalCompositeOperation = "source-over";
      requestAnimationFrame(frame);
    }

    resize();
    addEventListener("resize", resize);
    const io = new IntersectionObserver(([en]) => {
      const vis = en.isIntersecting && !document.hidden;
      if (vis && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      else if (!vis) running = false;
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) running = false;
      else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    });
    requestAnimationFrame(frame);
  }

  /* ================= wall of losses ================= */
  // Small silhouettes fill the canvas one by one, then fly together into one big silhouette of the same
  // category. Clicking toggles between the wall and the big shape. Returns { cancel, toggle }.
  const WALL_SHAPE = {
    tanks: "tank", armoured_fighting_vehicles: "afv", artillery_systems: "artillery", mlrs: "mlrs",
    aa_warfare_systems: "aa", planes: "plane", helicopters: "helicopter", warships_cutters: "ship",
    cruise_missiles: "missile", uav_systems: "drone",
  };
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function wall(canvas, kind, count, color, { onMorph } = {}) {
    const shape = window.SIL.vehicles[WALL_SHAPE[kind] || "tank"];
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = canvas.clientWidth || 600;
    const H = Math.round(W < 600 ? W * 1.05 : Math.min(560, Math.max(300, W * .5)));
    canvas.style.height = H + "px";
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ratio = shape.h / shape.w;

    // Grid: largest cell that fits `count` icons.
    let cw = Math.sqrt((W * H) / (Math.max(1, count) * ratio * 1.25));
    let cols, rows;
    for (;;) { cols = Math.max(1, Math.floor(W / cw)); rows = Math.ceil(count / cols); if (rows * cw * ratio * 1.25 <= H || cw < 4) break; cw *= .96; }
    const ch = cw * ratio * 1.25, gx = (W - cols * cw) / 2, gy = (H - rows * ch) / 2;
    const iconW = cw * .86;

    // Big shape: sample the silhouette on a grid so we get at least `count` target points.
    const box = Math.min(W * .94, (H * .86) / ratio), bx = (W - box) / 2, by = (H - box * ratio) / 2;
    const off = document.createElement("canvas"); off.width = Math.ceil(W); off.height = Math.ceil(H);
    const o = off.getContext("2d", { willReadFrequently: true });
    o.save(); o.translate(bx, by); o.scale(box / shape.w, box / shape.w); window.SIL.paint(o, shape, "#000"); o.restore();
    const px = o.getImageData(0, 0, off.width, off.height).data;
    const inside = (x, y) => px[((y | 0) * off.width + (x | 0)) * 4 + 3] > 128;
    const sampleAt = g => { const pts = []; for (let y = g / 2; y < H; y += g * ratio * 1.1) for (let x = g / 2; x < W; x += g) if (inside(x, y)) pts.push([x, y]); return pts; };
    let lo = 2, hi = 60, pts = sampleAt(lo);
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2, p = sampleAt(mid); if (p.length >= count) { lo = mid; pts = p; } else hi = mid; }
    const g = lo;
    if (pts.length > count) { const step = pts.length / count; pts = Array.from({ length: count }, (_, i) => pts[Math.floor(i * step)]); }
    while (pts.length < count) pts.push(pts[pts.length % Math.max(1, pts.length)] || [W / 2, H / 2]);
    const smallW = g * 1.05;

    // Icons sorted left→right in both layouts so they sweep across rather than criss-cross.
    const icons = Array.from({ length: count }, (_, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      return { gx: gx + col * cw + (cw - iconW) / 2, gy: gy + row * ch, a: .55 + ((i * 7919) % 45) / 100, i };
    });
    const byX = [...icons].sort((a, b) => a.gx - b.gx || a.gy - b.gy);
    const tp = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    byX.forEach((ic, k) => { ic.tx = tp[k][0] - smallW / 2; ic.ty = tp[k][1] - smallW * ratio / 2; ic.delay = (tp[k][0] / W) * .35 + Math.random() * .12; });

    const sprite = window.SIL.sprite(shape, Math.max(iconW, smallW) * dpr * 1.2, color);
    let raf = 0, t0 = performance.now(), mode = "fill", from = 0, to = 1, done = false;
    const FILL = reduced ? 0 : 1300, HOLD = reduced ? 0 : 700, MORPH = reduced ? 0 : 1700;

    function drawAt(m, filled) {                          // m: 0 = wall, 1 = big shape
      ctx.clearRect(0, 0, W, H);
      for (let n = 0; n < filled; n++) {
        const ic = icons[n];
        const k = MORPH ? ease(Math.min(1, Math.max(0, m * 1.5 - ic.delay)) ) : m;
        const w = iconW + (smallW - iconW) * k;
        const x = ic.gx + (ic.tx - ic.gx) * k, y = ic.gy + (ic.ty - ic.gy) * k;
        ctx.globalAlpha = ic.a + (1 - ic.a) * k;
        ctx.drawImage(sprite, x, y, w, w * ratio);
      }
      ctx.globalAlpha = 1;
    }
    function frame(now) {
      const t = now - t0;
      if (mode === "fill") {
        const k = FILL ? Math.min(1, t / FILL) : 1;
        drawAt(0, Math.round(count * (1 - Math.pow(1 - k, 3))));
        if (t >= FILL + HOLD) { mode = "morph"; t0 = now; from = 0; to = 1; }
      } else {
        const k = MORPH ? Math.min(1, (now - t0) / MORPH) : 1, m = from + (to - from) * k;
        drawAt(m, count);
        if (k >= 1) { done = true; onMorph && onMorph(to === 1); raf = 0; return; }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return {
      cancel() { cancelAnimationFrame(raf); raf = 0; },
      toggle() {
        if (!done) return;
        done = false; mode = "morph"; from = to; to = 1 - to; t0 = performance.now();
        raf = requestAnimationFrame(frame);
      },
    };
  }

  window.FX = { sky, wall, reduced };
})();
