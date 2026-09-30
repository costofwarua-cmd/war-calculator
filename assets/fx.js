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
  // Silhouettes drawn in a 24×14 box, facing left (towards Ukraine's side of the map, visually "retreating" right).
  const ICONS = {
    tank(c) { c.roundRect(2, 9, 20, 4, 2); c.rect(4, 6, 16, 3); c.roundRect(8, 3, 8, 3.5, 1.5); c.rect(0, 4, 9, 1.2); },
    afv(c) { c.roundRect(1, 9, 22, 4, 2); c.moveTo(3, 9); c.lineTo(5, 4); c.lineTo(21, 4); c.lineTo(22, 9); c.closePath(); c.rect(9, 2, 5, 2); c.rect(2, 2.6, 8, .9); },
    artillery(c) { c.arc(8, 11, 2.6, 0, 6.3); c.moveTo(19.6, 11); c.arc(17, 11, 2.6, 0, 6.3); c.rect(6, 7.5, 13, 2.5); c.moveTo(9, 7.5); c.lineTo(1, 1.5); c.lineTo(2, .5); c.lineTo(11, 7.5); c.closePath(); },
    mlrs(c) { c.arc(5, 12, 1.8, 0, 6.3); c.moveTo(12.8, 12); c.arc(11, 12, 1.8, 0, 6.3); c.moveTo(20.8, 12); c.arc(19, 12, 1.8, 0, 6.3); c.rect(1, 8, 22, 3); c.rect(1, 5, 5, 3); c.moveTo(8, 8); c.lineTo(21, 3); c.lineTo(23, 6); c.lineTo(10, 8); c.closePath(); },
    aa(c) { c.arc(6, 12, 1.8, 0, 6.3); c.moveTo(19.8, 12); c.arc(18, 12, 1.8, 0, 6.3); c.rect(2, 8, 20, 3); c.rect(7, 2, 3, 6); c.rect(12, 2, 3, 6); c.rect(17, 3, 2.5, 5); },
    plane(c) { c.moveTo(0, 7); c.lineTo(6, 5.6); c.lineTo(12, 0); c.lineTo(14, 0); c.lineTo(11, 5.6); c.lineTo(20, 5.6); c.lineTo(23, 2); c.lineTo(24, 2); c.lineTo(23, 7); c.lineTo(24, 12); c.lineTo(23, 12); c.lineTo(20, 8.4); c.lineTo(11, 8.4); c.lineTo(14, 14); c.lineTo(12, 14); c.lineTo(6, 8.4); c.closePath(); },
    heli(c) { c.ellipse(8, 8, 6.5, 3.5, 0, 0, 6.3); c.rect(13, 7, 9, 1.8); c.rect(21, 4.5, 2, 5); c.rect(0, 2.6, 18, 1); c.rect(7.5, 3, 1.4, 2); c.rect(3, 12, 11, .9); },
    ship(c) { c.moveTo(0, 8); c.lineTo(24, 8); c.lineTo(21, 13); c.lineTo(3, 13); c.closePath(); c.rect(7, 4.5, 9, 3.5); c.rect(10, 1, 2, 3.5); },
    drone(c) { c.moveTo(0, 7); c.lineTo(24, 1); c.lineTo(20, 7); c.lineTo(24, 13); c.closePath(); },
    missile(c) { c.moveTo(0, 7); c.lineTo(4, 5.6); c.lineTo(19, 5.6); c.lineTo(23, 2.5); c.lineTo(23, 11.5); c.lineTo(19, 8.4); c.lineTo(4, 8.4); c.closePath(); c.rect(9, 3, 3, 8); },
  };
  const WALL_ICON = {
    tanks: "tank", armoured_fighting_vehicles: "afv", artillery_systems: "artillery", mlrs: "mlrs",
    aa_warfare_systems: "aa", planes: "plane", helicopters: "heli", warships_cutters: "ship",
    cruise_missiles: "missile", uav_systems: "drone",
  };

  // Draws `count` icons, revealing them over ~1.4s. Returns a cancel function.
  function wall(canvas, kind, count, color) {
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = canvas.clientWidth || 600;
    const targetH = W < 600 ? W * 1.15 : Math.min(520, Math.max(220, W * .45));
    let cw = Math.sqrt((W * targetH) / (Math.max(1, count) * .72));
    cw = Math.max(9, Math.min(46, cw));
    const ch = cw * .72, cols = Math.max(1, Math.floor(W / cw)), rows = Math.ceil(count / cols);
    const H = Math.ceil(rows * ch);
    canvas.style.height = H + "px";
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = (cw * .8) / 24, pad = (W - cols * cw) / 2;
    const path = new Path2D();
    ICONS[WALL_ICON[kind] || "tank"](path);
    let raf, start = performance.now(), drawn = 0;
    const dur = reduced ? 0 : 1400;
    function step(now) {
      const k = dur ? Math.min(1, (now - start) / dur) : 1;
      const upto = Math.round(count * (1 - Math.pow(1 - k, 3)));
      for (let i = drawn; i < upto; i++) {
        const r = Math.floor(i / cols), col = i % cols;
        ctx.save();
        ctx.translate(pad + col * cw + cw * .1, r * ch + (ch - 14 * scale) / 2);
        ctx.scale(scale, scale);
        ctx.fillStyle = color;
        ctx.globalAlpha = .55 + ((i * 7919) % 45) / 100;
        ctx.fill(path);
        ctx.restore();
      }
      drawn = upto;
      if (k < 1) raf = requestAnimationFrame(step);
    }
    ctx.clearRect(0, 0, W, H);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }

  window.FX = { sky, wall, reduced };
})();
