import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Points, PointsMaterial, Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * The finishing touches on a scene: a soft bloom so torches, eyes, spells and
 * slime glow, and drifting dust in the air. Phones that can't keep up render
 * plainly instead (see World.watchSpeed).
 */
export class Post {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: Camera;
  enabled = true;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, strength = 0.55) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), strength, 0.45, 0.78);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(dt: number) {
    if (this.enabled) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.composer.dispose();
    this.bloom.dispose();
  }
}

let mote: CanvasTexture | undefined;

/** Dust (or ash, or suds) hanging in the air around a point, drifting slowly. */
export class Motes {
  readonly points: Points;
  private speeds: Float32Array;
  private base: Float32Array;

  constructor(count: number, color: number, center: { x: number; y: number; z: number }, spread: [number, number, number], size = 0.12) {
    if (!mote) {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
      mote = new CanvasTexture(c);
    }
    const pos = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = center.x + (Math.random() - 0.5) * spread[0];
      pos[i * 3 + 1] = center.y + Math.random() * spread[1];
      pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * spread[2];
      this.speeds[i] = 0.5 + Math.random();
    }
    this.base = pos.slice();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    this.points = new Points(
      geo,
      new PointsMaterial({ map: mote, color, size, transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true }),
    );
    this.points.frustumCulled = false;
  }

  update(t: number) {
    const pos = this.points.geometry.attributes.position as BufferAttribute;
    for (let i = 0; i < this.speeds.length; i++) {
      const s = this.speeds[i];
      pos.setXYZ(
        i,
        this.base[i * 3] + Math.sin(t * 0.3 * s + i) * 0.4,
        this.base[i * 3 + 1] + Math.sin(t * 0.21 * s + i * 1.7) * 0.5,
        this.base[i * 3 + 2] + Math.cos(t * 0.25 * s + i * 0.6) * 0.4,
      );
    }
    pos.needsUpdate = true;
  }
}
