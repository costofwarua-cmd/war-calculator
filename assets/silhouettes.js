// Silhouettes as layered SVG path data: d = solid fill, cut = holes cut out, r = details re-filled on top.
// Vehicles face left. Coordinates live in each shape's own box (w × h).
// SIL.sprite(shape, width, color) renders a cached offscreen canvas — use drawImage for speed.
window.SIL = (() => {
  const C = (x, y, r) => `M${x + r} ${y}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;
  const track = (x0, x1, y, h) => `M${x0 + h / 2} ${y}H${x1 - h / 2}a${h / 2} ${h / 2} 0 0 1 0 ${h}H${x0 + h / 2}a${h / 2} ${h / 2} 0 0 1 0 ${-h}Z`;
  const wheelHoles = (xs, y, r) => xs.map(x => C(x, y, r)).join("");
  const hubs = (xs, y, r) => xs.map(x => C(x, y, r * .4)).join("");
  const tracked = (x0, x1, xs, r) => ({ d: track(x0, x1, 60, 20), cut: wheelHoles(xs, 70, r), r: hubs(xs, 70, r) });
  const join = (...parts) => parts.reduce((a, p) => ({ d: a.d + (p.d || ""), cut: a.cut + (p.cut || ""), r: a.r + (p.r || "") }), { d: "", cut: "", r: "" });

  const T7 = [42, 62, 82, 102, 122, 142, 162];
  const vehicles = {
    tank: { w: 200, h: 84, ...join(
      { d: "M22 58L36 45H166L186 52L188 60L178 62H26Z" +
           "M68 45C70 33 88 26 112 26L142 29C152 31 156 38 154 45Z" +
           "M2 33.5L70 34.5V39L2 38Z M34 31.5H46V41H34Z" +
           "M116 21H132V27H116Z M120 17.5L142 15.5V17.5L120 19.5Z M146 30H160V36H146Z" },
      tracked(22, 186, T7, 7.2)) },
    afv: { w: 200, h: 84, ...join(
      { d: "M12 60L30 40L64 36H150L188 46L190 60L180 62H18Z M88 36L94 25H128L136 36Z" +
           "M28 18L98 28.5V32L28 21.5Z M110 19H136V24H110Z M150 38H176V44H150Z",
        cut: "M40 44H52V50H40Z M60 44H72V50H60Z" },                                      // firing ports
      tracked(18, 190, [40, 64, 88, 112, 136, 160], 7.6)) },
    artillery: { w: 200, h: 84, ...join(
      { d: "M22 58L36 46H168L188 52L190 60L180 62H26Z M62 46L68 22H152L160 46Z" +
           "M70 27L2 6.5L4 2.5L74 22Z M22 10L34 13L32 20L20 17Z M130 15H146V22H130Z",
        cut: "M84 30H100V38H84Z" },                                                      // turret hatch
      tracked(22, 190, [42, 62, 82, 102, 122, 142, 162, 180], 7)) },
    mlrs: { w: 200, h: 84,
      d: "M8 64V44L18 32H46V64Z M44 52H190V64H44Z M66 52L168 22L180 38L78 64Z" + C(28, 70, 9) + C(96, 70, 9) + C(120, 70, 9) + C(168, 70, 9),
      cut: "M20 36H42V47H15Z M80 50L166 25L168 28L82 53Z M84 56L170 31L172 34L86 59Z" + C(28, 70, 5) + C(96, 70, 5) + C(120, 70, 5) + C(168, 70, 5),
      r: C(28, 70, 2.4) + C(96, 70, 2.4) + C(120, 70, 2.4) + C(168, 70, 2.4) },
    aa: { w: 200, h: 84, ...join(
      { d: "M14 60L30 44H170L188 50L190 60L180 62H20Z M62 44L70 34H150L156 44Z" +
           "M78 36L160 8L164 15L84 42Z M80 29L150 4L152 9L83 34Z M40 18H68V38H40Z M50 38H56V44H50Z",
        cut: "M46 23H62V33H46Z" },
      tracked(20, 190, [40, 62, 84, 106, 128, 150, 172], 7)) },
    plane: { w: 200, h: 100,
      d: "M2 50L22 45L60 43L78 41L118 10H132L112 42L158 44L176 24H188L182 46L197 48V52L182 54L188 76H176L158 56L112 58L132 90H118L78 59L60 57L22 55Z",
      cut: "M36 47.5C40 46 50 46 56 47.5V52.5C50 54 40 54 36 52.5Z" },
    helicopter: { w: 200, h: 84,
      d: "M24 50C24 38 40 30 66 30L120 33L180 42L186 34H194L192 52L120 56L100 64H56C36 62 24 58 24 50Z" +
         "M84 22H92V31H84Z M4 18H176V22H4Z M22 11H160V14H22Z M70 54H112V59H70Z" +
         "M44 62H48V72H44Z M94 62H98V72H94Z" + C(46, 72, 5) + C(96, 72, 5),
      cut: "M38 44C40 36 50 33 62 34L64 44Z" },
    ship: { w: 200, h: 84,
      d: "M2 54H198L186 74H22Z M58 54L66 34H120L128 54Z M92 34V10H96V34Z M82 16H106V19H82Z" +
         "M132 54L136 42H154L156 54Z M30 54L33 47H46L48 54Z M10 47L34 49V51L10 49Z",
      cut: "M72 40H84V47H72Z M90 40H102V47H90Z M40 62H48V66H40Z M60 62H68V66H60Z M80 62H88V66H80Z" },
    missile: { w: 200, h: 84,
      d: "M2 42C8 37 18 36 26 36H168L180 28H188L186 37L197 38V46L186 47L188 56H180L168 48H26C18 48 8 47 2 42Z" +
         "M92 36L110 20H118L108 36Z M92 48L110 64H118L108 48Z",
      cut: "M150 40H162V44H150Z" },
    drone: { w: 200, h: 100,
      d: "M4 50C4 46 10 44 18 44L150 8H162L176 40H196V60H176L162 92H150L18 56C10 56 4 54 4 50Z" +
         "M150 8L154 0H162V8Z M150 92L154 100H162V92Z",
      cut: "M178 44H192V56H178Z" },
  };

  const prop = (x, y) => ({ d: C(x, y, 15), cut: C(x, y, 11), r: C(x, y, 4) });
  const items = {
    tourniquet: { w: 100, h: 100, d: "M22 34H78A20 20 0 0 1 78 74H22A20 20 0 0 1 22 34Z", cut: "M24 43H76A11 11 0 0 1 76 65H24A11 11 0 0 1 24 43Z",
      r: "M28 18L78 84L71 89L21 23Z M40 28H60V46H40Z M8 52H24V58H8Z" },
    ifak: { w: 100, h: 100, d: "M18 30H82A8 8 0 0 1 90 38V80A8 8 0 0 1 82 88H18A8 8 0 0 1 10 80V38A8 8 0 0 1 18 30Z M38 18H62V30H56V24H44V30H38Z",
      cut: "M44 44H56V54H66V66H56V76H44V66H34V54H44Z" },
    starlink: { w: 100, h: 100, d: "M14 30L74 12L86 52L26 70Z M48 62H56V88H48Z M30 88H74V94H30Z", cut: "M22 34L70 20L72 26L24 40Z" },
    fpv: { w: 100, h: 100, ...join({ d: "M26 20L80 74L74 80L20 26Z M74 20L80 26L26 80L20 74Z M36 36H64V64H36Z" },
      prop(20, 20), prop(80, 20), prop(20, 80), prop(80, 80), { cut: C(50, 50, 6), r: C(50, 50, 3) }) },
    trench_ew: { w: 100, h: 100, d: "M22 50H78V92H22Z M34 50L20 8L25 6L39 50Z M48 50V2H53V50Z M62 50L76 6L81 8L67 50Z",
      cut: "M30 60H70V66H30Z M30 72H56V78H30Z" },
    thermal: { w: 100, h: 100, d: "M14 38H70A6 6 0 0 1 76 44V60A6 6 0 0 1 70 66H14Z M76 42H94V62H76Z M2 32L14 38V66L2 72Z M30 66H44V78H30Z",
      cut: "M24 44H40V50H24Z" },
    mavic: { w: 100, h: 100, d: "M34 36H66V64H34Z M42 64H58V74H42Z" +
      "M34 40L16 26L20 22L38 36Z M66 40L84 26L80 22L62 36Z M34 62L16 76L20 80L38 66Z M66 62L84 76L80 80L62 66Z" +
      "M2 20H34V25H2Z M66 20H98V25H66Z M2 77H34V82H2Z M66 77H98V82H66Z", cut: C(50, 69, 3.5) },
    pickup: { w: 100, h: 100, d: "M4 70V52L10 50H30L40 34H66L74 50H96V70Z" + C(24, 72, 11) + C(78, 72, 11),
      cut: "M43 38H63L69 50H37Z" + C(24, 72, 6) + C(78, 72, 6), r: C(24, 72, 2.6) + C(78, 72, 2.6) },
  };

  const paths = new Map(), sprites = new Map();
  const path = d => { if (!paths.has(d)) paths.set(d, new Path2D(d)); return paths.get(d); };
  function paint(ctx, s, color) {
    ctx.fillStyle = color;
    ctx.fill(path(s.d));
    if (s.cut) { ctx.globalCompositeOperation = "destination-out"; ctx.fill(path(s.cut)); ctx.globalCompositeOperation = "source-over"; }
    if (s.r) ctx.fill(path(s.r));
  }
  // Cached bitmap of a shape, `px` wide (device pixels).
  function sprite(s, px, color) {
    px = Math.max(4, Math.round(px));
    const key = s.d.length + ":" + s.w + ":" + px + ":" + color + ":" + s.d.slice(0, 24);
    if (sprites.has(key)) return sprites.get(key);
    const c = document.createElement("canvas"), k = px / s.w;
    c.width = px; c.height = Math.ceil(s.h * k);
    const g = c.getContext("2d"); g.scale(k, k); paint(g, s, color);
    sprites.set(key, c);
    return c;
  }
  return { vehicles, items, path, paint, sprite };
})();
