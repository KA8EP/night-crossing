import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, SphereGeometry, Vector3 } from 'three'
import type { Travel } from '../systems/navigation'
import { box } from './mesh'
import { HealthBar } from './health-bar'

const blue = new MeshStandardMaterial({ color: 0x5895dc, emissive: 0x0d253b, roughness: 0.85 })
const navy = new MeshStandardMaterial({ color: 0x182e4b })
const graphite = new MeshStandardMaterial({ color: 0x101820 })
const visor = new MeshStandardMaterial({ color: 0x76d5eb, emissive: 0x1a5469 })
const helmetGeometry = new SphereGeometry(0.24, 8, 5)
const teamMark = new MeshBasicMaterial({ color: 0x6cb7f3 })
const ringGeometry = new RingGeometry(0.46, 0.51, 32)
const ringMaterial = new MeshBasicMaterial({ color: 0x70eeff })

export const classes = {
  assault: { label: 'Штурмовик', icon: '◆', health: 140, range: 14, damage: 17, interval: 0.55 },
  sniper: { label: 'Снайпер', icon: '◎', health: 86, range: 33, damage: 86, interval: 2.4 },
  engineer: { label: 'Сапёр', icon: '✚', health: 112, range: 11, damage: 10, interval: 0.69 },
} as const
export type Role = keyof typeof classes
const roleDetails = {
  assault: new MeshStandardMaterial({ color: 0x74a6f3 }),
  sniper: new MeshStandardMaterial({ color: 0x72dad7 }),
  engineer: new MeshStandardMaterial({ color: 0xe4bf72 }),
}

export class Soldier {
  readonly stats
  readonly model = new Group()
  readonly hitbox: Mesh
  private readonly bar = new HealthBar(0.9, 2, 0x69d8f8)
  private readonly ring = new Mesh(ringGeometry, ringMaterial)
  private readonly legs = [new Group(), new Group()]
  private waypoints: Travel[] = []
  private phase = 0
  private stride = 0
  health: number
  deploying = false
  get ready() { return this.alive && !this.deploying }

  constructor(x: number, z: number, readonly role: Role = 'assault', y = 0) {
    this.stats = classes[role]
    this.health = this.stats.health
    this.model.position.set(x, y, z)
    this.model.rotation.y = Math.PI / 2
    box(this.model, blue, [0.55, 0.53, 0.37], [0, 1.02, 0])
    box(this.model, roleDetails[role], [0.43, 0.16, 0.12], [0, 1.13, 0.2])
    box(this.model, graphite, [0.48, 0.15, 0.34], [0, 0.72, 0])
    box(this.model, navy, [0.35, 0.4, 0.14], [0, 1.03, -0.24])

    const helmet = new Mesh(helmetGeometry, navy)
    helmet.position.y = 1.49
    helmet.castShadow = true
    this.model.add(helmet)
    box(this.model, visor, [0.33, 0.1, 0.13], [0, 1.47, 0.18])

    for (const side of [-1, 1]) {
      box(this.model, blue, [0.18, 0.31, 0.19], [side * 0.34, 1.04, 0.02]).rotation.x = -0.45
      box(this.model, navy, [0.18, 0.16, 0.34], [side * 0.24, 0.96, 0.22]).rotation.y = -side * 0.38
      const leg = this.legs[(side + 1) / 2]
      leg.position.set(side * 0.15, 0.73, 0)
      box(leg, navy, [0.21, 0.59, 0.22], [0, -0.3, 0])
      box(leg, graphite, [0.23, 0.15, 0.33], [0, -0.65, 0.055])
      this.model.add(leg)
    }
    box(this.model, graphite, [0.12, 0.12, 0.68], [0.07, 1.04, 0.39])
    box(this.model, graphite, [0.065, 0.062, 0.21], [0.07, 1.06, 0.81])
    box(this.model, graphite, [0.09, 0.17, 0.1], [0.07, 0.93, 0.42])

    if (role === 'sniper') box(this.model, graphite, [0.055, 0.06, 0.51], [0.07, 1.05, 0.96])
    if (role === 'engineer') box(this.model, roleDetails[role], [0.43, 0.43, 0.29], [0, 1.05, -0.3])

    box(this.model, teamMark, [0.38, 0.04, 0.39], [0, 0.053, 0], false)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.035
    this.ring.visible = false
    this.model.add(this.ring)
    this.hitbox = box(this.model, new MeshBasicMaterial({ visible: false }), [0.9, 1.79, 0.92], [0, 0.89, 0.08], false)
    this.bar.model.visible = false
    this.model.add(this.bar.model)
  }

  get alive() {
    return this.health > 0
  }

  damage(amount: number) {
    this.health = Math.max(0, this.health - amount)
    this.bar.model.visible = true
    this.bar.update(this.health / this.stats.health)
    if (!this.alive) {
      this.model.visible = false
      this.waypoints = []
    }
  }

  select(selected: boolean) {
    this.ring.visible = selected
  }

  move(waypoints: Travel[]) {
    this.waypoints = waypoints
  }

  aimAt(target: Vector3) {
    if (!this.waypoints.length) {
      this.model.rotation.y = Math.atan2(target.x - this.model.position.x, target.z - this.model.position.z)
    }
  }

  update(dt: number) {
    if (!this.ready) return
    let remaining = dt
    let traveled = 0
    const position = this.model.position
    while (this.waypoints.length && remaining > 0) {
      const next = this.waypoints[0]
      const dx = next.x - position.x
      const dz = next.z - position.z
      const distance = position.distanceTo(next)
      if (Math.hypot(dx, dz) > 0.00001) this.model.rotation.y = Math.atan2(dx, dz)
      const speed = next.speed ?? 5
      if (distance <= remaining * speed) {
        position.copy(next)
        this.waypoints.shift()
      } else {
        position.lerp(next, remaining * speed / distance)
      }
      const step = Math.min(distance, remaining * speed)
      traveled += step
      remaining -= step / speed
    }
    this.phase += traveled * 2.7
    this.stride += ((traveled > 0 ? 0.54 : 0) - this.stride) * (1 - Math.exp(-18 * dt))
    const swing = Math.sin(this.phase) * this.stride
    this.legs[0].rotation.x = swing
    this.legs[1].rotation.x = -swing
  }
}
