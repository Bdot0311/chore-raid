// Renders menu portraits of every hero and enemy into public/art/portraits.
// Needs `npm run build && npx vite preview --port 4173` running.
//   node tools/portraits.cjs
const { execSync } = require('child_process');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'public', 'art', 'portraits');
const SHOTS = [
  ['Knight', 'Idle_Combat'], ['Barbarian', 'Idle_Combat'], ['Mage', 'Idle_Combat'], ['Rogue', 'Idle_Combat'], ['Rogue_Hooded', 'Idle_Combat'],
  ['sock-goblin', 'Idle'], ['grease-gremlin', 'Idle'], ['dust-bunny', 'Idle'], ['scum-slug', 'Idle'], ['pillow-imp', 'Idle'], ['crumb-crawler', 'Idle'], ['bin-rat', 'Idle'],
  ['laundry', 'Idle'], ['dishes', 'Idle'], ['clutter', 'Idle'], ['bathroom', 'Idle'], ['bedroom', 'Idle'], ['floors', 'Idle'], ['trash', 'Idle'], ['king', 'Idle'], ['custom', 'Idle'],
];
(async () => {
  execSync(`mkdir -p ${OUT}`);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 768, height: 768 } });
  for (const [key, pose, t = 0.5] of SHOTS) {
    await page.goto(`http://localhost:4173/?portrait=${key}&pose=${pose}&t=${t}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
    const png = path.join(OUT, `${key}.png`);
    await page.locator('canvas').screenshot({ path: png, omitBackground: true });
    execSync(`python3 -c "from PIL import Image; im=Image.open('${png}'); im=im.crop(im.getbbox()); im.thumbnail((512,512)); im.save('${png.replace('.png', '.webp')}', quality=85)"`);
    execSync(`rm ${png}`);
    console.log('portrait', key);
  }
  await browser.close();
})();
