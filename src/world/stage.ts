import { enemyByKey } from './cast';
import { Town, type TownRegion } from './Town';
import { World } from './World';

/**
 * Tooling only (headless checks): opens a fight or the lair walk on its own.
 *   /?stage=fight&enemy=king&spot=0   /?stage=walk&region=throne
 * The scene is exposed as window.stage so a script can drive it.
 */
export async function mountStage(params: URLSearchParams) {
  document.body.style.margin = '0';
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;background:#000';
  document.body.appendChild(host);
  const w = window as unknown as { stage: unknown };
  if (params.get('stage') === 'walk') {
    const town = new Town();
    w.stage = town;
    await town.play(host, { hero: params.get('hero') ?? 'Knight', region: (params.get('region') ?? 'laundry') as TownRegion });
    document.body.dataset.done = '1';
    return;
  }
  const world = new World();
  w.stage = world;
  await world.init(host, { enemy: enemyByKey(params.get('enemy') ?? 'king'), hero: params.get('hero') ?? 'Knight', spot: Number(params.get('spot') ?? 0), trail: 0xffffff });
  document.body.dataset.ready = '1';
}
