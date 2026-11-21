// Renders every SVG in <svgDir> to PNG at <pxPerMm> pixels per millimetre.
// Needs Playwright with Chromium: npm i -D playwright && npx playwright install chromium
// Usage: node scripts/vehicle-art/render-vehicle-assets.cjs assets-source/vehicles/parts/wheels out/wheels/high 0.4
// Then convert PNG to WebP (quality 90) into public/vehicles/parts/<group>/<low|medium|high>/
// (group = wheels | brakes | suspension, same as the source folder).
// Scales used by the game (see src/assets/vehicleAssets.ts): low 0.16, medium 0.27, high 0.4.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const [svgDir, outDir, scaleArg] = process.argv.slice(2); const scale = Number(scaleArg);
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage();
  for (const f of fs.readdirSync(svgDir).filter((n) => n.endsWith('.svg'))) {
    const src = fs.readFileSync(path.join(svgDir, f), 'utf8');
    const m = src.match(/width="([\d.]+)" height="([\d.]+)"/);
    const w = Math.ceil(Number(m[1]) * scale), h = Math.ceil(Number(m[2]) * scale);
    await p.setViewportSize({ width: w, height: h });
    const sized = src.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`);
    await p.setContent(`<!doctype html><html lang="en"><body style="margin:0;background:transparent">${sized}</body></html>`);
    await p.screenshot({ path: path.join(outDir, f.replace('.svg', '.png')), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }
  await b.close();
})();
