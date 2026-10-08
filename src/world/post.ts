import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  HalfFloatType,
  PMREMGenerator,
  Points,
  PointsMaterial,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type PerspectiveCamera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Cinematic grade: vignette, film grain, a whisper of chromatic aberration and
 * a gentle contrast/saturation lift. The last 10% that makes a scene read
 * rendered instead of realtime.
 */
const Cinematic = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0.32 },
    grain: { value: 0.035 },
    aberration: { value: 0.0018 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float vignette; uniform float grain; uniform float aberration;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      vec2 off = d * aberration;
      vec4 c = vec4(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b, 1.0);
      c.rgb = (c.rgb - 0.5) * 1.07 + 0.5;
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, 1.12);
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.75, length(d) * 1.25);
      c.rgb += (hash(vUv * vec2(960.0, 540.0) + time * 60.0) - 0.5) * grain;
      gl_FragColor = c;
    }`,
};

/** How much the device can take. Anything unreadable defaults up, never down. */
export type Tier = 'high' | 'mid' | 'low';
let tierCache: Tier | undefined;
export function deviceTier(): Tier {
  if (tierCache) return tierCache;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const ua = nav.userAgent || '';
  const tablet = /iPad|Tablet/i.test(ua);
  const phone = !tablet && /Android|iPhone|iPod|Windows Phone|Mobile/i.test(ua);
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  tierCache = phone ? (cores <= 4 || mem <= 2 ? 'low' : 'mid') : tablet ? 'mid' : cores >= 6 && mem >= 4 ? 'high' : 'mid';
  return tierCache;
}

let envMap: Texture | undefined;
/** Soft studio light all round, so materials pick up shape instead of looking flat. */
export function environment(renderer: WebGLRenderer) {
  if (!envMap) {
    const pmrem = new PMREMGenerator(renderer);
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  return envMap;
}

/**
 * The finishing touches on a scene: a soft bloom so torches, eyes, spells and
 * slime glow, and drifting dust in the air. Phones that can't keep up render
 * plainly instead (see World.watchSpeed).
 */
export class Post {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private ao?: GTAOPass;
  private grade: ShaderPass;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: Camera;
  enabled = true;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, strength = 0.55, tier: Tier = 'high') {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    // Multisampled, so edges stay smooth through the effects.
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: tier === 'low' ? 0 : 4 });
    const ao = tier === 'high';
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    if (ao) {
      // Contact shadows where things meet the floor and each other.
      this.ao = new GTAOPass(scene, camera as PerspectiveCamera, 256, 256);
      this.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1.2 });
      this.ao.blendIntensity = 0.85;
      // Particles are soft quads: left in, they would cast square shadows.
      const pass = this.ao;
      const draw = pass.render.bind(pass);
      pass.render = (...args: Parameters<GTAOPass['render']>) => {
        const hidden: { visible: boolean }[] = [];
        scene.traverse((o) => {
          if (o.visible && ((o as { isSprite?: boolean }).isSprite || (o as { isPoints?: boolean }).isPoints)) {
            o.visible = false;
            hidden.push(o);
          }
        });
        draw(...args);
        for (const o of hidden) o.visible = true;
      };
      this.composer.addPass(this.ao);
    }
    const res = tier === 'high' ? 512 : tier === 'mid' ? 384 : 256;
    this.bloom = new UnrealBloomPass(new Vector2(res, res), tier === 'low' ? strength * 0.6 : strength, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    // Graded after tone mapping, so the grain and vignette sit on the final image.
    this.grade = new ShaderPass(Cinematic);
    if (tier === 'low') {
      this.grade.uniforms.grain.value = 0.02;
      this.grade.uniforms.aberration.value = 0;
    }
    this.composer.addPass(this.grade);
  }

  /** Drops the expensive extras for a slow phone, keeping the glow. */
  lighten() {
    if (this.ao) this.ao.enabled = false;
  }

  setSize(w: number, h: number) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(dt: number) {
    if (this.enabled) {
      this.grade.uniforms.time.value += dt;
      this.composer.render(dt);
    } else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.composer.dispose();
    this.bloom.dispose();
    this.ao?.dispose();
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
