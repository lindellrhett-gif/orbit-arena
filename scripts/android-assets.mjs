// Android image assets, drawn in Chromium so the logo keeps its transparency:
//   mobile/assets/adaptive-icon.png  1024x1024 foreground layer for the adaptive launcher icon: the splash logo
//                                    (transparent background) inside Android's safe zone, the central 66% that
//                                    no launcher mask crops. The background color is in app.json.
//   screens/play/icon-512.png        512x512 Play Store icon (the app icon, full bleed: Play rounds it).
//   screens/play/feature.png         1024x500 Play Store feature graphic.
// Run: node scripts/android-assets.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`;
const logo = dataUrl('mobile/assets/splash-icon.png');
const icon = dataUrl('mobile/assets/icon.png');
const BG = '#07080e';

mkdirSync('screens/play', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

/** Draws on a canvas of the given size in the page and returns PNG bytes. */
async function render(width, height, draw) {
  const url = await page.evaluate(
    async ({ width, height, draw, images }) => {
      const load = (src) =>
        new Promise((ok) => {
          const img = new Image();
          img.onload = () => ok(img);
          img.src = src;
        });
      const imgs = {};
      for (const [k, v] of Object.entries(images)) imgs[k] = await load(v);
      await document.fonts.ready;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      new Function('ctx', 'imgs', 'W', 'H', draw)(c.getContext('2d'), imgs, width, height);
      return c.toDataURL('image/png');
    },
    { width, height, draw: draw.toString().replace(/^[^{]*{|}$/g, ''), images: { logo, icon } },
  );
  return Buffer.from(url.split(',')[1], 'base64');
}

// Adaptive icon foreground: logo at 58% of the layer, centered (inside the 66% safe zone).
writeFileSync(
  'mobile/assets/adaptive-icon.png',
  await render(1024, 1024, (ctx, imgs, W) => {
    const s = W * 0.58;
    ctx.drawImage(imgs.logo, (W - s) / 2, (W - s) / 2, s, s);
  }),
);

writeFileSync(
  'screens/play/icon-512.png',
  await render(512, 512, (ctx, imgs, W) => {
    ctx.drawImage(imgs.icon, 0, 0, W, W);
  }),
);

// Feature graphic: dark background, logo on the left, name and tagline on the right.
await page.setContent(
  '<link href="https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@600;700&display=block" rel="stylesheet"><span style="font-family:\'Saira Semi Condensed\';font-weight:700">.</span><span style="font-family:\'Saira Semi Condensed\';font-weight:600">.</span>',
);
await page.waitForTimeout(1500);
writeFileSync(
  'screens/play/feature.png',
  await render(1024, 500, (ctx, imgs, W, H) => {
    ctx.fillStyle = '#07080e';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(250, 250, 20, 250, 250, 330);
    glow.addColorStop(0, 'rgba(140, 80, 255, 0.35)');
    glow.addColorStop(1, 'rgba(7, 8, 14, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(imgs.logo, 70, 70, 360, 360);
    ctx.fillStyle = '#ffffff';
    ctx.font = "700 88px 'Saira Semi Condensed', sans-serif";
    ctx.fillText('ORBIT ARENA', 450, 225);
    ctx.fillStyle = '#b9bdd6';
    ctx.font = "600 40px 'Saira Semi Condensed', sans-serif";
    ctx.fillText('Pick the winner. Watch it go.', 454, 300);
  }),
);

await browser.close();
console.log('wrote mobile/assets/adaptive-icon.png, screens/play/icon-512.png, screens/play/feature.png');
