// Interactive 3D globe: aid "flights" from every donor to Kyiv. Needs d3-array, d3-geo, topojson-client.
(() => {
  "use strict";
  const KYIV = [30.52, 50.45];
  // Arc origins: capitals (lon, lat). EU institutions → Brussels (nudged so it doesn't sit on Belgium).
  const CAPITALS = {
    "United States": [-77.04, 38.9], "EU (Commission and Council)": [4.42, 50.8], "Germany": [13.4, 52.52],
    "United Kingdom": [-0.13, 51.51], "Canada": [-75.7, 45.42], "Japan": [139.69, 35.69], "Denmark": [12.57, 55.68],
    "Sweden": [18.07, 59.33], "Norway": [10.75, 59.91], "Netherlands": [4.9, 52.37], "France": [2.35, 48.86],
    "Poland": [21.01, 52.23], "Italy": [12.5, 41.9], "Finland": [24.94, 60.17], "Belgium": [4.35, 50.85],
    "Spain": [-3.7, 40.42], "Lithuania": [25.28, 54.69], "Switzerland": [7.45, 46.95], "Australia": [149.13, -35.28],
    "Estonia": [24.75, 59.44], "Slovakia": [17.11, 48.15], "Latvia": [24.11, 56.95], "South Korea": [126.98, 37.57],
    "Czechia": [14.42, 50.08], "Romania": [26.1, 44.43], "Ireland": [-6.26, 53.35], "Portugal": [-9.14, 38.72],
    "Luxembourg": [6.13, 49.61], "Croatia": [15.98, 45.81], "Austria": [16.37, 48.21], "Bulgaria": [23.32, 42.7],
    "Greece": [23.73, 37.98], "Slovenia": [14.51, 46.06], "Iceland": [-21.94, 64.15], "New Zealand": [174.78, -41.29],
    "Turkiye": [32.85, 39.93], "Hungary": [19.04, 47.5], "Taiwan": [121.56, 25.03], "Cyprus": [33.38, 35.19],
    "India": [77.21, 28.61], "Malta": [14.51, 35.9], "China": [116.4, 39.9],
  };
  const MAP_NAME = { "United States": "United States of America", "Turkiye": "Turkey" };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function create(canvas, donors, opts = {}) {
    const topo = await (await fetch("data/world.json")).json();
    const countries = topojson.feature(topo, topo.objects.countries).features;
    const borders = topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b);
    const byMapName = new Map(donors.map(d => [MAP_NAME[d.country] || d.country, d]));
    const maxAid = Math.max(...donors.map(d => d.total));
    const flights = donors.filter(d => CAPITALS[d.country] && d.total >= 0.05).map((d, i) => {
      const from = CAPITALS[d.country], interp = d3.geoInterpolate(from, KYIV);
      const dist = d3.geoDistance(from, KYIV);
      return { d, from, interp, lift: Math.min(.32, .05 + dist * .16), w: .6 + 3.4 * Math.sqrt(d.total / maxAid),
        speed: .22 + .18 * Math.random(), offset: (i * .137) % 1 };
    });

    const ctx = canvas.getContext("2d");
    const proj = d3.geoOrthographic().clipAngle(90).precision(.4);
    const path = d3.geoPath(proj, ctx);
    const grat = d3.geoGraticule10();
    let size = 0, dpr = 1, rot = [-12, -38, 0], hover = null, dragging = null, lastT = performance.now();
    let target = null, running = false, idleUntil = 0;

    function resize() {
      dpr = Math.min(2, devicePixelRatio || 1);
      size = canvas.clientWidth;
      canvas.style.height = size + "px";
      canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      proj.scale(size * .42).translate([size / 2, size / 2]);
    }

    // Raise a surface point towards the viewer to fake a flight arc above the globe.
    function lifted(p, h) {
      const xy = proj(p);
      if (!xy) return null;
      const c = size / 2;
      return [c + (xy[0] - c) * (1 + h), c + (xy[1] - c) * (1 + h)];
    }
    const visible = p => d3.geoDistance(p, [-rot[0], -rot[1]]) < Math.PI / 2 - .02;

    function draw(now) {
      const r = size * .42, c = size / 2;
      ctx.clearRect(0, 0, size, size);
      // atmosphere
      let g = ctx.createRadialGradient(c, c, r * .95, c, c, r * 1.22);
      g.addColorStop(0, "rgba(57,135,229,.35)"); g.addColorStop(1, "rgba(57,135,229,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, r * 1.22, 0, 6.283); ctx.fill();
      // ocean
      g = ctx.createRadialGradient(c - r * .35, c - r * .4, r * .1, c, c, r);
      g.addColorStop(0, "#15243a"); g.addColorStop(1, "#070b12");
      ctx.fillStyle = g; ctx.beginPath(); path({ type: "Sphere" }); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = .6; ctx.beginPath(); path(grat); ctx.stroke();
      // land
      for (const f of countries) {
        const name = f.properties.name, d = byMapName.get(name);
        ctx.beginPath(); path(f);
        if (name === "Ukraine") ctx.fillStyle = "#ffd500";
        else if (name === "Russia") ctx.fillStyle = "#2a1618";
        else if (d) ctx.fillStyle = `rgba(57,135,229,${(.28 + .62 * Math.sqrt(d.total / maxAid)).toFixed(3)})`;
        else ctx.fillStyle = "#1a212c";
        if (hover && hover.f === f) ctx.fillStyle = name === "Ukraine" ? "#ffe34d" : "#7fb3f5";
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(11,12,14,.9)"; ctx.lineWidth = .7; ctx.beginPath(); path(borders); ctx.stroke();

      // flights
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      const N = 48;
      for (const fl of flights) {
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, p = fl.interp(t);
          pts.push(visible(p) ? lifted(p, fl.lift * Math.sin(Math.PI * t)) : null);
        }
        const hl = hover && hover.d === fl.d;
        ctx.strokeStyle = hl ? "rgba(255,213,0,.9)" : "rgba(120,170,255,.28)";
        ctx.lineWidth = hl ? fl.w + 1 : fl.w * .6;
        ctx.beginPath();
        let pen = false;
        for (const p of pts) { if (!p) { pen = false; continue; } pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); pen = true; }
        ctx.stroke();
        // travelling pulse
        const head = reduced ? 1 : ((now / 1000) * fl.speed + fl.offset) % 1;
        for (let k = 0; k < 10; k++) {
          const t = head - k * .012; if (t < 0) break;
          const p = fl.interp(t); if (!visible(p)) continue;
          const xy = lifted(p, fl.lift * Math.sin(Math.PI * t));
          const a = 1 - k / 10;
          ctx.fillStyle = `rgba(255,${200 + 40 * a | 0},${90 + 120 * a | 0},${a})`;
          ctx.beginPath(); ctx.arc(xy[0], xy[1], (fl.w * .55 + 1) * a, 0, 6.283); ctx.fill();
        }
      }
      // Kyiv beacon
      if (visible(KYIV)) {
        const k = proj(KYIV), pulse = reduced ? .5 : (now / 1400) % 1;
        ctx.strokeStyle = `rgba(255,213,0,${1 - pulse})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(k[0], k[1], 4 + pulse * 22, 0, 6.283); ctx.stroke();
        g = ctx.createRadialGradient(k[0], k[1], 0, k[0], k[1], 14);
        g.addColorStop(0, "rgba(255,240,180,1)"); g.addColorStop(1, "rgba(255,213,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(k[0], k[1], 14, 0, 6.283); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
      if (target) {                                     // smooth focus on a donor
        const k = 1 - Math.pow(.02, dt);
        rot[0] += (target[0] - rot[0]) * k; rot[1] += (target[1] - rot[1]) * k;
        if (Math.abs(target[0] - rot[0]) < .05 && Math.abs(target[1] - rot[1]) < .05) target = null;
      } else if (!dragging && !reduced && now > idleUntil) rot[0] += dt * 7;
      proj.rotate(rot);
      draw(now);
      requestAnimationFrame(frame);
    }

    function pick(e) {
      const r = canvas.getBoundingClientRect();
      const ll = proj.invert([e.clientX - r.left, e.clientY - r.top]);
      if (!ll || d3.geoDistance(ll, [-rot[0], -rot[1]]) > Math.PI / 2) return null;
      const f = countries.find(f => d3.geoContains(f, ll));
      return f ? { f, d: byMapName.get(f.properties.name) || null } : null;
    }
    canvas.addEventListener("pointerdown", e => {
      dragging = { x: e.clientX, y: e.clientY, r: rot.slice() }; target = null;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
      if (dragging) {
        const s = 180 / (size * .42 * Math.PI);
        rot = [dragging.r[0] + (e.clientX - dragging.x) * s, Math.max(-80, Math.min(80, dragging.r[1] - (e.clientY - dragging.y) * s)), 0];
        idleUntil = performance.now() + 2500;
        return;
      }
      hover = pick(e);
      canvas.style.cursor = hover ? "pointer" : "grab";
      opts.onHover && opts.onHover(hover, e);
    });
    const end = () => { dragging = null; idleUntil = performance.now() + 2500; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("pointerleave", () => { hover = null; opts.onHover && opts.onHover(null); });

    resize();
    addEventListener("resize", resize);
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !running) { running = true; lastT = performance.now(); requestAnimationFrame(frame); }
      else if (!en.isIntersecting) running = false;
    }).observe(canvas);

    return {
      focus(country) {
        const p = CAPITALS[country]; if (!p) return;
        const mid = d3.geoInterpolate(p, KYIV)(.5);
        let lon = -mid[0];
        while (lon - rot[0] > 180) lon -= 360;
        while (rot[0] - lon > 180) lon += 360;
        target = [lon, Math.max(-52, Math.min(-18, -mid[1]))]; idleUntil = performance.now() + 5000;
      },
      highlight(country) {
        const d = donors.find(x => x.country === country) || null;
        const f = d && countries.find(f => f.properties.name === (MAP_NAME[country] || country));
        hover = d ? { f, d } : null;
      },
      setLabel() { /* this version has no on-globe labels */ },
    };
  }

  window.Globe = { create };
})();
