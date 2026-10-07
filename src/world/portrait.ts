import { Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, ACESFilmicToneMapping, Box3, Vector3, WebGLRenderer } from 'three';
import { Actor } from './Actor';
import { animationClips, character, piece } from './assets';
import { enemyByKey, hero, HEROES } from './cast';

/**
 * Renders one character on a transparent background, for the menu portraits
 * in public/art/portraits. Opened as /?portrait=<key>&pose=<clip>&t=<seconds>
 * by tools/portraits.cjs; never shown to players.
 */
export async function mountPortrait(key: string, pose: string, t: number) {
  document.body.style.margin = '0';
  document.body.style.background = 'transparent';
  const size = 768;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  document.body.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.add(new HemisphereLight(0xfff4e6, 0x3a2a4a, 1.6));
  const key1 = new DirectionalLight(0xffffff, 2.6);
  key1.position.set(-3, 5, 6);
  const rim = new DirectionalLight(new Color(0xa78bfa), 2.2);
  rim.position.set(4, 3, -5);
  scene.add(key1, rim);

  const clips = await animationClips();
  const isHero = HEROES.some((h) => h.id === key);
  const enemy = enemyByKey(key);
  const model = await character(isHero ? key : enemy.model);
  const actor = new Actor(model, clips);
  if (isHero) {
    const h = hero(key);
    actor.showOnly(h.carry, h.props);
  } else {
    for (const [part, color] of enemy.tints) actor.tint(part, color);
    for (const [part, color] of enemy.glows) actor.glow(part, color, 2.5);
    if (enemy.weapon) actor.attach(await piece(enemy.weapon), 'handslot.r');
    if (enemy.offhand) actor.attach(await piece(enemy.offhand), 'handslot.l');
  }
  scene.add(actor.root);
  actor.root.rotation.y = 0.35;
  actor.loop(pose, { fade: 0 });
  actor.update(t);

  const box = new Box3().setFromObject(actor.root);
  const center = box.getCenter(new Vector3());
  const height = box.max.y - box.min.y;
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const dist = (height * 0.62) / Math.tan((15 * Math.PI) / 180);
  camera.position.set(center.x + dist * 0.18, center.y + height * 0.12, center.z + dist);
  camera.lookAt(center.x, center.y, center.z);
  renderer.render(scene, camera);
  document.body.dataset.ready = '1';
}
