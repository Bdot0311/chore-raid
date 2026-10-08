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

/** A gentle grade: a touch more colour and contrast, darker corners. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.32 }, saturation: { value: 1.12 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb = (c.rgb - 0.5) * 1.06 + 0.5;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.75, length(d) * 1.25);
      gl_FragColor = c;
    }`,
};

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
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: Camera;
  enabled = true;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, strength = 0.55, ao = true) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    // Multisampled, so edges stay smooth through the effects.
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    if (ao) {
      // Contact shadows where things meet the floor and each other.
      this.ao = new GTAOPass(scene, camera as PerspectiveCamera, 256, 256);
      this.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1.2 });
      this.ao.blendIntensity = 0.85;
      this.composer.addPass(this.ao);
    }
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), strength, 0.45, 0.78);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new ShaderPass(GradeShader));
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
    if (this.enabled) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
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
