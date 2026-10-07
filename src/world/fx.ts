import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Scene,
} from 'three';

/**
 * Cheap effects for a phone GPU: pooled sprite particles (sparks, debris,
 * dust, heal motes) and slash arcs. No per-frame allocation.
 */

interface Particle {
  sprite: Sprite;
  vel: Vector3;
  life: number;
  max: number;
  gravity: number;
  drag: number;
  size0: number;
  size1: number;
  alpha: number;
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

function shardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(4, 6);
  g.lineTo(28, 12);
  g.lineTo(12, 28);
  g.closePath();
  g.fill();
  return new CanvasTexture(c);
}

export interface BurstOptions {
  count: number;
  speed: number;
  colors: number[];
  gravity?: number;
  life?: number;
  size?: number;
  additive?: boolean;
  shards?: boolean;
  /** Bias the burst upward (0) or keep it spherical (1). */
  spread?: number;
  drag?: number;
}

export class Fx {
  private scene: Scene;
  private dot = dotTexture();
  private shard = shardTexture();
  private pool: Sprite[] = [];
  private live: Particle[] = [];
  private arcs: { mesh: Mesh; t: number; dur: number; s0: number }[] = [];
  private arcGeo = new RingGeometry(1.0, 1.32, 32, 1, 0, Math.PI * 0.85);

  constructor(scene: Scene) {
    this.scene = scene;
  }

  private take(additive: boolean, shard: boolean): Sprite {
    const s = this.pool.pop() ?? new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false }));
    const m = s.material;
    m.map = shard ? this.shard : this.dot;
    m.blending = additive ? AdditiveBlending : NormalBlending;
    m.needsUpdate = true;
    s.visible = true;
    this.scene.add(s);
    return s;
  }

  burst(at: Vector3, o: BurstOptions) {
    for (let i = 0; i < o.count; i++) {
      if (this.live.length > 260) return;
      const s = this.take(o.additive ?? false, o.shards ?? false);
      s.material.color = new Color(o.colors[Math.floor(Math.random() * o.colors.length)]);
      s.material.rotation = Math.random() * Math.PI * 2;
      s.position.copy(at);
      const dir = new Vector3(Math.random() - 0.5, Math.random() * (o.spread ?? 0.7) + (1 - (o.spread ?? 0.7)) * 0.6, Math.random() - 0.5).normalize();
      const size = (o.size ?? 0.18) * (0.6 + Math.random() * 0.8);
      this.live.push({
        sprite: s,
        vel: dir.multiplyScalar(o.speed * (0.35 + Math.random() * 0.65)),
        life: 0,
        max: (o.life ?? 0.7) * (0.6 + Math.random() * 0.7),
        gravity: o.gravity ?? -9,
        drag: o.drag ?? 1.5,
        size0: size,
        size1: size * 0.2,
        alpha: 1,
      });
    }
  }

  /** Motes drifting upward from an area (heals, sleep, magic). */
  rise(at: Vector3, radius: number, count: number, colors: number[], speed = 1.2) {
    for (let i = 0; i < count; i++) {
      const s = this.take(true, false);
      s.material.color = new Color(colors[i % colors.length]);
      s.position.set(at.x + (Math.random() - 0.5) * radius * 2, at.y + Math.random() * radius, at.z + (Math.random() - 0.5) * radius);
      const size = 0.12 + Math.random() * 0.14;
      this.live.push({ sprite: s, vel: new Vector3(0, speed * (0.6 + Math.random()), 0), life: 0, max: 0.9 + Math.random() * 0.7, gravity: 0, drag: 0, size0: size, size1: size, alpha: 0.9 });
    }
  }

  /** A slash arc across a point, tilted to match the swing, facing the camera. */
  slash(at: Vector3, camPos: Vector3, tilt: number, color: number, scale = 1) {
    const mat = new MeshBasicMaterial({ color, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    const mesh = new Mesh(this.arcGeo, mat);
    mesh.position.copy(at);
    mesh.lookAt(camPos);
    mesh.rotateZ(tilt);
    mesh.scale.setScalar(scale);
    this.scene.add(mesh);
    this.arcs.push({ mesh, t: 0, dur: 0.26, s0: scale });
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) {
        p.sprite.visible = false;
        this.scene.remove(p.sprite);
        this.pool.push(p.sprite);
        this.live.splice(i, 1);
        continue;
      }
      p.vel.multiplyScalar(1 - p.drag * dt);
      p.vel.y += p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      if (p.sprite.position.y < 0.03 && p.gravity < 0) {
        p.sprite.position.y = 0.03;
        p.vel.set(p.vel.x * 0.4, -p.vel.y * 0.3, p.vel.z * 0.4);
      }
      p.sprite.scale.setScalar(p.size0 + (p.size1 - p.size0) * k);
      p.sprite.material.opacity = p.alpha * (1 - k * k);
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.t += dt;
      const k = a.t / a.dur;
      if (k >= 1) {
        this.scene.remove(a.mesh);
        (a.mesh.material as MeshBasicMaterial).dispose();
        this.arcs.splice(i, 1);
        continue;
      }
      a.mesh.scale.setScalar(a.s0 * (0.8 + k * 0.5));
      a.mesh.rotateZ(dt * 7);
      (a.mesh.material as MeshBasicMaterial).opacity = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    }
  }
}
