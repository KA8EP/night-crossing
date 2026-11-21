import { CircleGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, Vector3 } from 'three'

export const fireRadius = 2.85
export const burnDuration = 3.6
const flightDuration = 1.24
const orb = new SphereGeometry(0.46, 9, 6)
const particle = new SphereGeometry(0.16, 5, 4)
const core = new MeshBasicMaterial({ color: 0xffdc73 })
const flame = new MeshBasicMaterial({ color: 0xff4b19 })
const ground = new CircleGeometry(fireRadius, 36)
const border = new RingGeometry(fireRadius - 0.14, fireRadius, 36)

export class Fireball {
  readonly model = new Group()
  private readonly projectile = new Group()
  private readonly sparks = new Group()
  private readonly warning = new MeshBasicMaterial({ color: 0xff7136, opacity: 0.17, transparent: true, depthWrite: false })
  private age = 0

  constructor(private readonly origin: Vector3, readonly target: Vector3) {
    const disc = new Mesh(ground, this.warning)
    disc.rotation.x = -Math.PI / 2
    disc.position.copy(target).y += 0.043
    const outline = new Mesh(border, flame)
    outline.rotation.x = -Math.PI / 2
    outline.position.copy(target).y += 0.048
    this.projectile.position.copy(origin)
    this.projectile.add(new Mesh(orb, flame))
    for (let i = 0; i < 10; i++) {
      this.projectile.add(new Mesh(particle, i % 3 ? flame : core))
    }
    for (let i = 0; i < 22; i++) {
      const spark = new Mesh(particle, i % 3 ? flame : core)
      const angle = i * 2.39996
      const radius = fireRadius * Math.sqrt((i + 1) / 23) * 0.91
      spark.position.set(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius)
      this.sparks.add(spark)
    }
    this.sparks.position.copy(target)
    this.sparks.visible = false
    this.model.add(disc, outline, this.projectile, this.sparks)
  }

  update(dt: number) {
    const previous = this.age
    const wasFlying = this.age < flightDuration
    this.age += dt
    if (this.age < flightDuration) {
      const progress = this.age / flightDuration
      this.projectile.position.lerpVectors(this.origin, this.target, progress)
      this.projectile.position.y += 0.35 + Math.sin(progress * Math.PI) * 3.1
      this.projectile.children.slice(1).forEach((spark, index) => {
        const angle = index * 2.4 + this.age * 13
        const spread = 0.29 + (index % 5) * 0.14
        spark.position.set(Math.cos(angle) * spread, Math.sin(angle) * spread, Math.sin(angle * 0.7) * spread)
      })
      this.warning.opacity = 0.1 + 0.09 * (1 + Math.sin(this.age * 14))
      return { impact: false, burning: 0, expired: false }
    }

    this.projectile.visible = false
    this.sparks.visible = true
    const burningAge = this.age - flightDuration
    this.warning.opacity = Math.max(0.1, 0.38 * (1 - burningAge / burnDuration))
    this.sparks.children.forEach((spark, index) => {
      const lift = (burningAge * (1.2 + index % 4 * 0.27) + index * 0.29) % 1
      spark.position.y = 0.08 + lift * 1.35
      spark.scale.setScalar(1.4 - lift)
    })
    const burning = Math.max(0, Math.min(this.age, flightDuration + burnDuration) - Math.max(previous, flightDuration))
    return { impact: wasFlying, burning, expired: burningAge >= burnDuration }
  }

  dispose() {
    this.model.removeFromParent()
    this.warning.dispose()
  }
}
