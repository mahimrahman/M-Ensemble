/**
 * Builds every launcher, splash and web icon the app ships, from two sources:
 *
 *   splash_screens/splash_screens/icon.png   the stacked lockup on cream, 512px
 *   apps/mobile/assets/logo-mark*.png        the crescent-and-people mark alone
 *
 *   node scripts/build-app-icons.js
 *
 * Re-run it if either source is replaced. No dependencies: the decode, the
 * resample and the encode are inline, the same way `build-logo-assets.js`
 * handles the master logo. Every source here is 8-bit RGBA, non-interlaced,
 * which is the only shape this decoder claims to read.
 *
 * What comes out, and why each one exists:
 *
 *   icon.png              1024²  iOS/Android launcher. The App Store rejects
 *                                anything smaller, and rejects transparency,
 *                                so this one is flattened onto its own cream.
 *   adaptive-icon.png     1024²  Android foreground layer. Android crops it to
 *                                a circle, so the mark sits at 52% and the rest
 *                                is transparent padding.
 *   splash-icon.png       1024²  The splash. Square and centred because Android
 *                                12+ masks the splash image into a circle - a
 *                                wide lockup would lose its ends.
 *   notification-icon.png   96²  Android notification tray. Android throws away
 *                                the colour and keeps the alpha, so this is a
 *                                white silhouette; anything else shows as a
 *                                grey square.
 *   favicon.png             48²  Browser tab.
 *   public/apple-touch-icon.png  180²  iOS "add to home screen".
 *   public/icon-{192,512}.png    PWA manifest icons.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'splash_screens/splash_screens');
const SRC_ICON = path.join(SRC_DIR, 'icon.png');
const SRC_README = path.join(ROOT, 'splash_screens/readme.txt');
const ASSETS = path.join(ROOT, 'apps/mobile/assets');
const PUBLIC = path.join(ROOT, 'apps/mobile/public');
const GENERATED = path.join(ROOT, 'apps/mobile/src/web/appleStartupImages.ts');

/** The cream the lockup is drawn on, sampled from the source icon. */
const CREAM = [247, 247, 239];

/**
 * Where the mark sits inside the 512px source, found by scanning for bands of
 * non-cream rows: the crescent-and-people mark, then "M'Ensemble", then
 * "RÉPONDRE PRÉSENT". Only the first is wanted here - a wordmark disappears at
 * launcher size, and Android's circular mask would cut it off anyway.
 *
 * The mark is taken from here rather than from `assets/logo-mark.png`, which is
 * cropped flush to its canvas and clips the tip of the crescent.
 */
const MARK_BOX = { x: 95, y: 49, w: 321, h: 298 };

// ─── PNG in ──────────────────────────────────────────────────────────────────

/** Decodes an 8-bit RGBA, non-interlaced PNG to a flat RGBA buffer. */
function readPNG(file) {
  const b = fs.readFileSync(file);
  let p = 8;
  let w = 0;
  let h = 0;
  const idat = [];

  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('ascii', p + 4, p + 8);
    const data = b.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error(`${path.basename(file)}: expected 8-bit RGBA, non-interlaced`);
      }
    }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = w * bpp;
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const bb = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += bb;
      else if (filter === 3) v += (a + bb) >> 1;
      else if (filter === 4) {
        const pp = a + bb - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - bb);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
      }
      cur[x] = v & 255;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }

  return { width: w, height: h, data: out };
}

// ─── PNG out ─────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let x = 0xffffffff;
  for (const v of buf) x = CRC_TABLE[(x ^ v) & 255] ^ (x >>> 8);
  return (x ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const cr = Buffer.alloc(4);
  cr.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, cr]);
}

/**
 * `opaque` writes RGB rather than RGBA. The App Store rejects a launcher icon
 * that carries an alpha channel at all, even one that is 255 everywhere.
 */
function writePNG(file, img, opaque = false) {
  const { width: w, height: h, data } = img;
  const bpp = opaque ? 3 : 4;
  const raw = Buffer.alloc(h * (w * bpp + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * bpp + 1)] = 0;
    if (opaque) {
      for (let x = 0; x < w; x++) {
        const s = (y * w + x) * 4;
        const d = y * (w * 3 + 1) + 1 + x * 3;
        raw[d] = data[s];
        raw[d + 1] = data[s + 1];
        raw[d + 2] = data[s + 2];
      }
    } else {
      data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
  console.log(
    '  ' + path.relative(ROOT, file).replace(/\\/g, '/').padEnd(42),
    `${w}x${h}`.padEnd(10),
    Math.round(fs.statSync(file).size / 1024) + 'kb',
  );
}

// ─── pixels ──────────────────────────────────────────────────────────────────

function blank(w, h, fill) {
  const data = Buffer.alloc(w * h * 4);
  if (fill) {
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = fill[0];
      data[i * 4 + 1] = fill[1];
      data[i * 4 + 2] = fill[2];
      data[i * 4 + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

/**
 * Catmull-Rom resample, done on premultiplied alpha.
 *
 * Premultiplying is the whole point: interpolating straight RGBA pulls the
 * colour of fully transparent pixels into the edge of the shape, which on a
 * transparent-ground mark shows up as a dark halo once it lands on cream.
 */
function resize(img, w, h) {
  const { width: sw, height: sh, data: src } = img;
  const pre = new Float32Array(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++) {
    const a = src[i * 4 + 3] / 255;
    pre[i * 4] = src[i * 4] * a;
    pre[i * 4 + 1] = src[i * 4 + 1] * a;
    pre[i * 4 + 2] = src[i * 4 + 2] * a;
    pre[i * 4 + 3] = src[i * 4 + 3];
  }

  const kernel = (t) => {
    const x = Math.abs(t);
    if (x < 1) return 1.5 * x * x * x - 2.5 * x * x + 1;
    if (x < 2) return -0.5 * x * x * x + 2.5 * x * x - 4 * x + 2;
    return 0;
  };

  // Downscaling needs the kernel widened to the sample spacing, or it aliases.
  const scaleX = Math.max(1, sw / w);
  const scaleY = Math.max(1, sh / h);
  const out = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    const sy = (y + 0.5) * (sh / h) - 0.5;
    for (let x = 0; x < w; x++) {
      const sx = (x + 0.5) * (sw / w) - 0.5;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let sum = 0;

      const y0 = Math.floor(sy - 2 * scaleY);
      const y1 = Math.ceil(sy + 2 * scaleY);
      const x0 = Math.floor(sx - 2 * scaleX);
      const x1 = Math.ceil(sx + 2 * scaleX);

      for (let yy = y0; yy <= y1; yy++) {
        const cy = Math.min(sh - 1, Math.max(0, yy));
        const wy = kernel((yy - sy) / scaleY);
        if (wy === 0) continue;
        for (let xx = x0; xx <= x1; xx++) {
          const cx = Math.min(sw - 1, Math.max(0, xx));
          const wx = kernel((xx - sx) / scaleX);
          if (wx === 0) continue;
          const k = wy * wx;
          const o = (cy * sw + cx) * 4;
          r += pre[o] * k;
          g += pre[o + 1] * k;
          b += pre[o + 2] * k;
          a += pre[o + 3] * k;
          sum += k;
        }
      }

      const o = (y * w + x) * 4;
      const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
      const alpha = sum > 0 ? a / sum : 0;
      // Back out of premultiplied space. Below half a level of alpha there is
      // no colour left to recover and the division only amplifies noise.
      const un = alpha > 0.5 ? 255 / alpha : 0;
      out[o] = clamp((r / sum) * un);
      out[o + 1] = clamp((g / sum) * un);
      out[o + 2] = clamp((b / sum) * un);
      out[o + 3] = clamp(alpha);
    }
  }

  return { width: w, height: h, data: out };
}

/** Draws `src` over `dst` at (dx, dy), source-over. */
function draw(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      const d = (ty * dst.width + tx) * 4;
      const a = src.data[s + 3] / 255;
      if (a === 0) continue;
      for (let c = 0; c < 3; c++) {
        dst.data[d + c] = Math.round(src.data[s + c] * a + dst.data[d + c] * (1 - a));
      }
      dst.data[d + 3] = Math.round(255 * (a + (dst.data[d + 3] / 255) * (1 - a)));
    }
  }
  return dst;
}

/** `src` centred on a `size`² canvas, scaled to `fraction` of the width. */
function centred(src, size, fraction, ground) {
  const w = Math.round(size * fraction);
  const h = Math.round((src.height / src.width) * w);
  const scaled = resize(src, w, h);
  return draw(
    blank(size, size, ground),
    scaled,
    Math.round((size - w) / 2),
    Math.round((size - h) / 2),
  );
}

function crop(img, { x, y, w, h }) {
  const out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) {
    img.data.copy(
      out,
      row * w * 4,
      ((y + row) * img.width + x) * 4,
      ((y + row) * img.width + x + w) * 4,
    );
  }
  return { width: w, height: h, data: out };
}

/**
 * Keeps the shape, throws away the colour: Android tints the notification icon
 * itself and uses only the alpha channel, so anything with colour in it shows
 * up as a grey square in the status bar.
 *
 * The source is opaque artwork on cream, so the alpha has to be recovered from
 * how far each pixel is from that cream - a soft edge rather than a hard key,
 * which is all a 24dp silhouette needs.
 */
function silhouette(img, ground) {
  const out = Buffer.alloc(img.width * img.height * 4);
  for (let i = 0; i < img.width * img.height; i++) {
    const d =
      Math.abs(img.data[i * 4] - ground[0]) +
      Math.abs(img.data[i * 4 + 1] - ground[1]) +
      Math.abs(img.data[i * 4 + 2] - ground[2]);
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = Math.min(255, Math.round((d / 90) * 255)) * (img.data[i * 4 + 3] / 255);
  }
  return { width: img.width, height: img.height, data: out };
}

// ─── build ───────────────────────────────────────────────────────────────────

const icon = readPNG(SRC_ICON);
const mark = crop(icon, MARK_BOX);

console.log(
  `source ${path.relative(ROOT, SRC_ICON).replace(/\\/g, '/')} ${icon.width}x${icon.height}`,
);

/**
 * Everything keeps the source's own cream ground rather than being keyed to
 * transparency. Recovering alpha from artwork that was flattened onto a colour
 * leaves a pale fringe on every anti-aliased edge; keeping the ground and
 * declaring the same colour either side of it leaves nothing to fringe. It also
 * satisfies the App Store, which rejects a launcher icon with an alpha channel.
 */

// The launcher icon: the full lockup, as supplied, at the 1024² the store wants.
writePNG(
  path.join(ASSETS, 'icon.png'),
  draw(blank(1024, 1024, CREAM), resize(icon, 1024, 1024), 0, 0),
  true,
);

// Android masks the foreground to a circle inscribed in the middle 66%. The
// mark gets 52% of the width so it clears that edge on every launcher shape.
writePNG(path.join(ASSETS, 'adaptive-icon.png'), centred(mark, 1024, 0.52, CREAM));

// Android 12+ masks the splash image into a circle as well, so this is the mark
// alone. On the cream splash ground the square edge is invisible.
writePNG(path.join(ASSETS, 'splash-icon.png'), centred(mark, 1024, 0.55, CREAM));

writePNG(
  path.join(ASSETS, 'notification-icon.png'),
  silhouette(centred(mark, 96, 0.88, CREAM), CREAM),
);
writePNG(path.join(ASSETS, 'favicon.png'), resize(icon, 48, 48));

// The web side. `apple-touch-icon` is what iOS puts on the home screen, and
// having one is also what makes the startup images in public/splash_screens
// apply at all.
writePNG(
  path.join(PUBLIC, 'apple-touch-icon.png'),
  draw(blank(180, 180, CREAM), resize(icon, 180, 180), 0, 0),
  true,
);
writePNG(
  path.join(PUBLIC, 'icon-192.png'),
  draw(blank(192, 192, CREAM), resize(icon, 192, 192), 0, 0),
  true,
);
writePNG(path.join(PUBLIC, 'icon-512.png'), draw(blank(512, 512, CREAM), icon, 0, 0), true);
// Maskable wants its own padding: Android shrinks it inside a safe circle.
writePNG(path.join(PUBLIC, 'icon-maskable-512.png'), centred(mark, 512, 0.52, CREAM));

// ─── iOS web-app startup images ──────────────────────────────────────────────

/**
 * iOS shows one of these while an installed home-screen web app boots, picking
 * by an exact device-size media query. There is no scaling and no fallback: a
 * device with no matching tag gets a blank white screen instead.
 *
 * The generator that produced them emits a landscape file per device too. The
 * app is portrait-only - the native config locks it and the web manifest asks
 * for the same - so those are dropped rather than shipped and never matched.
 *
 * They are re-encoded on the way through. The originals are around twice the
 * size for identical pixels, and this is a set of 22 files that every web
 * deploy carries.
 */
const readme = fs.readFileSync(SRC_README, 'utf8');
const tags = [
  ...readme.matchAll(
    /<link rel="apple-touch-startup-image" media="([^"]+)" href="splash_screens\/([^"]+)">/g,
  ),
]
  .map(([, media, file]) => ({ media, file }))
  .filter(({ media }) => media.includes('orientation: portrait'));

if (tags.length === 0) throw new Error('no portrait startup images found in the readme');

console.log(`\nstartup images (portrait only, ${tags.length} of 44)`);
let before = 0;
let after = 0;
for (const { file } of tags) {
  const src = path.join(SRC_DIR, file);
  const dst = path.join(PUBLIC, 'splash_screens', file);
  before += fs.statSync(src).size;
  writePNG(dst, readPNG(src), true);
  after += fs.statSync(dst).size;
}
console.log(`  ${(before / 1048576).toFixed(2)}MB in, ${(after / 1048576).toFixed(2)}MB out`);

fs.mkdirSync(path.dirname(GENERATED), { recursive: true });
fs.writeFileSync(
  GENERATED,
  `/**
 * The iOS startup-image tags, keyed by the device each one is cut for.
 *
 * Generated by \`node scripts/build-app-icons.js\` from
 * \`splash_screens/readme.txt\`. Do not edit by hand - re-run the script.
 *
 * Consumed by \`app/+html.tsx\`, which is web-only, so none of this reaches the
 * native bundle.
 */

export interface AppleStartupImage {
  /** The exact device metrics iOS matches against. No scaling, no fallback. */
  media: string;
  href: string;
}

export const APPLE_STARTUP_IMAGES: AppleStartupImage[] = [
${tags
  .map(
    // Emitted one field per line: a media query runs past the 100-column limit
    // in .prettierrc, and the file has to survive \`npm run format\` unchanged.
    ({ media, file }) =>
      `  {\n    media:\n      '${media}',\n    href: '/splash_screens/${file}',\n  },`,
  )
  .join('\n')}
];
`,
);
console.log(`  ${path.relative(ROOT, GENERATED).replace(/\\/g, '/')} (${tags.length} entries)`);

// ─── PWA manifest ────────────────────────────────────────────────────────────

const manifest = {
  name: 'M’Ensemble',
  short_name: 'M’Ensemble',
  description: 'Au service de votre mosquée.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  // Matches the native config, and is what makes the portrait-only startup
  // images above the complete set.
  orientation: 'portrait',
  background_color: '#F7F7EF',
  theme_color: '#061E1B',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(PUBLIC, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('  apps/mobile/public/manifest.json');

console.log(`\nground #${CREAM.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
