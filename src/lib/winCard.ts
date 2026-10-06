import { unitWord } from '../game/bosses';
import { RARITY_COLOR } from '../game/loot';
import type { BossDef, LootItem, Raid } from '../game/types';
import { formatDuration } from './format';

const W = 1080;
const H = 1350;

interface CardInput {
  boss: BossDef;
  raid: Raid;
  loot?: LootItem;
  before?: Blob;
  after?: Blob;
  bossArt?: string;
}

async function loadImage(src: Blob | string): Promise<CanvasImageSource | undefined> {
  try {
    if (src instanceof Blob) return await createImageBitmap(src);
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  } catch {
    return undefined;
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Draws an image to cover the box (like CSS object-fit: cover). */
function cover(g: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const iw = (img as { width: number }).width;
  const ih = (img as { height: number }).height;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function photoPanel(g: CanvasRenderingContext2D, img: CanvasImageSource | undefined, x: number, y: number, w: number, h: number, label: string, hue: number) {
  g.save();
  roundRect(g, x, y, w, h, 28);
  g.clip();
  if (img) {
    cover(g, img, x, y, w, h);
  } else {
    g.fillStyle = `hsl(${hue} 30% 14%)`;
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(236,232,247,0.35)';
    g.font = '600 30px Inter, sans-serif';
    g.textAlign = 'center';
    g.fillText('No photo', x + w / 2, y + h / 2);
  }
  const shade = g.createLinearGradient(0, y + h - 120, 0, y + h);
  shade.addColorStop(0, 'transparent');
  shade.addColorStop(1, 'rgba(0,0,0,0.7)');
  g.fillStyle = shade;
  g.fillRect(x, y + h - 120, w, 120);
  g.restore();
  g.fillStyle = '#fff';
  g.font = '44px "Lilita One", sans-serif';
  g.textAlign = 'left';
  g.fillText(label, x + 28, y + h - 30);
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 3;
  roundRect(g, x, y, w, h, 28);
  g.stroke();
}

/** Renders the shareable proof card: before/after, the boss, the numbers and the loot. */
export async function renderWinCard({ boss, raid, loot, before, after, bossArt }: CardInput): Promise<Blob> {
  await Promise.all([document.fonts?.load('80px "Lilita One"'), document.fonts?.load('600 30px Inter')]).catch(() => {});
  const [beforeImg, afterImg, artImg] = await Promise.all([
    before ? loadImage(before) : undefined,
    after ? loadImage(after) : undefined,
    bossArt ? loadImage(bossArt) : undefined,
  ]);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const hue = boss.hue;

  const bg = g.createRadialGradient(W / 2, 320, 60, W / 2, 500, 1100);
  bg.addColorStop(0, `hsl(${hue} 50% 24%)`);
  bg.addColorStop(0.55, `hsl(${hue} 45% 10%)`);
  bg.addColorStop(1, '#07060f');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // The defeated boss looms faintly behind the header.
  if (artImg) {
    g.save();
    g.globalAlpha = 0.22;
    const ah = 520;
    const aw = (ah * (artImg as HTMLImageElement).width) / (artImg as HTMLImageElement).height;
    g.drawImage(artImg, W - aw + 60, -40, aw, ah);
    g.restore();
  }

  g.textAlign = 'left';
  g.fillStyle = '#ffc94d';
  g.font = '40px "Lilita One", sans-serif';
  g.fillText('CHORE RAID · VICTORY', 64, 100);
  g.fillStyle = '#fff';
  g.font = '86px "Lilita One", sans-serif';
  g.fillText(boss.name.replace(/^The /, ''), 64, 196, W - 128);
  g.fillStyle = `hsl(${hue} 80% 75%)`;
  g.font = '600 36px Inter, sans-serif';
  g.fillText(`${raid.maxHp} ${unitWord(boss, raid.maxHp)} conquered`, 64, 252);

  const py = 300;
  const pw = (W - 64 * 2 - 24) / 2;
  const ph = 560;
  photoPanel(g, beforeImg, 64, py, pw, ph, 'BEFORE', hue);
  photoPanel(g, afterImg, 64 + pw + 24, py, pw, ph, 'AFTER', hue);

  const stats: [string, string][] = [
    ['TIME', formatDuration((raid.endedAt ?? Date.now()) - raid.startedAt)],
    ['BEST COMBO', `×${raid.bestCombo}`],
    ['SCORE', raid.score.toLocaleString()],
  ];
  const sy = py + ph + 40;
  const sw = (W - 64 * 2 - 24 * 2) / 3;
  stats.forEach(([label, value], i) => {
    const x = 64 + i * (sw + 24);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(g, x, sy, sw, 150, 24);
    g.fill();
    g.textAlign = 'center';
    g.fillStyle = '#9a93bd';
    g.font = '700 24px Inter, sans-serif';
    g.fillText(label, x + sw / 2, sy + 52);
    g.fillStyle = '#ffc94d';
    g.font = '58px "Lilita One", sans-serif';
    g.fillText(value, x + sw / 2, sy + 118);
  });

  if (loot) {
    const ly = sy + 190;
    const color = RARITY_COLOR[loot.rarity];
    g.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(g, 64, ly, W - 128, 110, 24);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.stroke();
    g.textAlign = 'left';
    g.fillStyle = color;
    g.font = '700 24px Inter, sans-serif';
    g.fillText(`LOOT · ${loot.rarity.toUpperCase()}`, 100, ly + 44);
    g.fillStyle = '#fff';
    g.font = '44px "Lilita One", sans-serif';
    g.fillText(loot.name, 100, ly + 90, W - 200);
  }

  g.textAlign = 'center';
  g.fillStyle = 'rgba(236,232,247,0.5)';
  g.font = '600 26px Inter, sans-serif';
  const date = new Date(raid.endedAt ?? Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  g.fillText(`${date} · choreraid.netlify.app`, W / 2, H - 44);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Card encode failed'))), 'image/png'));
}
