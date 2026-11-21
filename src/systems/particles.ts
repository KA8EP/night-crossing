import { BoxGeometry, Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, type Object3D, Vector3 } from 'three'

type Particle = { point: Vector3; velocity: Vector3; life: number; total: number; size: number; gravity: number; color: number }

export class Particles {
  private readonly mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 950)
  private readonly items: Particle[] = []
  private readonly matrix = new Matrix4()
  private readonly color = new Color()

  constructor(scene: Object3D) {
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    scene.add(this.mesh)
  }

  burst(point: Vector3, colors: readonly number[], count: number, spread: number, lift: number, life: number, size: number, gravity = 0) {
    for (let i = 0; i < count; i++) {
      if (this.items.length === 950) break
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * spread
      const total = life * (0.65 + Math.random() * 0.55)
      this.items.push({
        point: point.clone(), velocity: new Vector3(Math.cos(angle) * speed, lift * (0.5 + Math.random()), Math.sin(angle) * speed),
        life: total, total, size: size * (0.6 + Math.random() * 0.8), gravity, color: colors[i % colors.length],
      })
    }
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i]
      p.life -= dt
      if (p.life <= 0) {
        this.items[i] = this.items[this.items.length - 1]
        this.items.pop()
      }
    }
    this.items.forEach((p, i) => {
      const age = 1 - p.life / p.total
      const scale = p.size * (p.gravity ? Math.max(0.15, 1 - age) : 0.62 + age * 1.12)
      p.point.addScaledVector(p.velocity, dt)
      p.velocity.y -= p.gravity * dt
      this.mesh.setMatrixAt(i, this.matrix.makeScale(scale, scale, scale).setPosition(p.point))
      this.mesh.setColorAt(i, this.color.setHex(p.color).multiplyScalar(1 - age * 0.55))
    })
    this.mesh.count = this.items.length
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
}

export const sparks = [0xffe5a2, 0xffab47, 0xff6535]
export const fire = [0xff782a, 0xffb53e, 0xf64436, 0x76374a]
export const smokeColors = [0x5d687a, 0x425062, 0x303744]
