import { Group, MathUtils, MeshBasicMaterial, Vector3, type Object3D } from 'three'
import { beam } from '../entities/city'
import { Helicopter } from '../entities/helicopter'
import { Soldier, type Role } from '../entities/soldier'
import { v } from '../entities/district'
import { type Navigation } from './navigation'
import { fire, smokeColors, type Particles } from './particles'

const cable = new MeshBasicMaterial({ color: 0xc2ddcb })
const rocket = new MeshBasicMaterial({ color: 0xffbf64 })
const reinforcementTime = 17
const strikeTime = 26

type Drop = { point: Vector3; member: Soldier; rope: Group; age: number; entry: Vector3; launched: boolean }
type Strike = { point: Vector3; entry: Vector3; exit: Vector3; age: number; fired: number }
type Missile = { point: Vector3; start: Vector3; age: number; model: Group }

export class AirSupport {
  private readonly transport = new Helicopter('transport')
  private readonly gunship = new Helicopter('gunship')
  private readonly missiles: Missile[] = []
  private drop?: Drop
  private strike?: Strike
  private dropCooldown = 0
  private strikeCooldown = 0
  private reserve = 6

  constructor(private readonly scene: Object3D, private readonly squad: Soldier[],
    private readonly navigation: Navigation, private readonly effects: Particles,
    private readonly onImpact: (point: Vector3) => void) {
    scene.add(this.transport.model, this.gunship.model)
  }

  get status() {
    return { drop: this.drop ? -1 : Math.ceil(this.dropCooldown), strike: this.strike ? -1 : Math.ceil(this.strikeCooldown), reserve: this.reserve }
  }

  get pending() { return Boolean(this.drop && !this.drop.launched) }

  reinforce(point: Vector3 | undefined, role: Role) {
    if (this.drop || this.dropCooldown > 0 || !this.reserve) return 'Десант пока недоступен'
    if (!point || !this.navigation.walkable(point)) return 'Выберите свободную точку высадки'
    const member = new Soldier(point.x, point.z, role, point.y)
    member.deploying = true
    const rope = new Group()
    const top = point.clone().add(v(0, 6.2, 0))
    beam(rope, cable, point.clone().add(v(0, 0.3, 0)), top, 0.046)
    rope.visible = false
    this.scene.add(rope)
    this.drop = { point: point.clone(), member, rope, age: 0, entry: v(point.x - 68, 28, point.z - 26), launched: false }
    this.transport.model.position.copy(this.drop.entry)
    this.transport.model.visible = true
    this.reserve--
  }

  attack(point: Vector3 | undefined) {
    if (this.strike || this.strikeCooldown > 0) return 'Огневая поддержка пока недоступна'
    if (!point) return 'Укажите цель на карте'
    this.strike = {
      point: point.clone(), age: 0, fired: 0,
      entry: v(point.x - 76, 20, point.z - 17), exit: v(point.x + 76, 20, point.z + 17),
    }
    this.gunship.model.position.copy(this.strike.entry)
    this.gunship.model.visible = true
  }

  update(dt: number) {
    this.dropCooldown = Math.max(0, this.dropCooldown - dt)
    this.strikeCooldown = Math.max(0, this.strikeCooldown - dt)
    if (this.drop) this.updateDrop(dt, this.drop)
    if (this.strike) this.updateStrike(dt, this.strike)
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const missile = this.missiles[i]
      missile.age += dt
      const progress = Math.min(1, missile.age / 0.62)
      missile.model.position.lerpVectors(missile.start, missile.point, progress)
      if (Math.random() < dt * 42) this.effects.burst(missile.model.position, smokeColors, 2, 0.6, 0.8, 0.6, 0.32)
      if (progress < 1) continue
      this.effects.burst(missile.point, fire, 32, 8, 5, 0.72, 0.37, 8)
      this.effects.burst(missile.point, smokeColors, 13, 3, 2.1, 1.4, 0.6)
      this.onImpact(missile.point)
      missile.model.removeFromParent()
      this.missiles.splice(i, 1)
    }
  }

  private updateDrop(dt: number, drop: Drop) {
    const { point, entry, member, rope } = drop
    const model = this.transport.model
    const hover = point.clone().add(v(0, 7.2, 0))
    drop.age += dt
    this.transport.spin(dt)
    if (drop.age < 3.4) {
      approach(model, entry, hover, drop.age / 3.4)
    } else if (drop.age < 6.05) {
      model.position.copy(hover)
      rope.visible = true
      if (!drop.launched) {
        drop.launched = true
        this.squad.push(member)
        this.scene.add(member.model)
      }
      member.model.position.copy(point).y += 5.9 * (1 - MathUtils.clamp((drop.age - 3.4) / 2.6, 0, 1))
    } else {
      member.deploying = false
      // Snap once, so the departing helicopter cannot reset new orders.
      if (rope.visible) {
        member.model.position.copy(point)
        rope.visible = false
      }
      approach(model, hover, v(point.x + 72, 28, point.z + 22), (drop.age - 6.05) / 3.55)
      if (drop.age >= 9.6) {
        model.visible = false
        rope.removeFromParent()
        this.drop = undefined
        this.dropCooldown = reinforcementTime
      }
    }
  }

  private updateStrike(dt: number, strike: Strike) {
    strike.age += dt
    const model = this.gunship.model
    this.gunship.spin(dt)
    const t = Math.min(1, strike.age / 5.9)
    model.position.lerpVectors(strike.entry, strike.exit, t)
    model.rotation.y = Math.atan2(strike.exit.x - strike.entry.x, strike.exit.z - strike.entry.z)
    model.rotation.z = -0.12
    if (strike.fired < 3 && strike.age >= 2.15 + 0.29 * strike.fired) {
      const target = strike.point.clone()
      target.x += (strike.fired - 1) * 1.65
      target.z += (strike.fired % 2) * 0.85
      const origin = model.position.clone()
      const trail = new Group()
      beam(trail, rocket, v(0, 0, -0.6), v(0, 0, 0.25), 0.16)
      trail.position.copy(origin)
      trail.lookAt(target)
      this.scene.add(trail)
      this.missiles.push({ point: target, start: origin, age: 0, model: trail })
      strike.fired++
    }
    if (t === 1) {
      model.visible = false
      this.strike = undefined
      this.strikeCooldown = strikeTime
    }
  }
}

export function approach(model: Object3D, from: Vector3, to: Vector3, progress: number) {
  const t = MathUtils.clamp(progress, 0, 1)
  model.position.lerpVectors(from, to, MathUtils.smoothstep(t, 0, 1))
  model.position.y += Math.sin(t * Math.PI) * 6.5
  model.rotation.y = Math.atan2(to.x - from.x, to.z - from.z)
  model.rotation.x = Math.sin(t * Math.PI) * 0.11
}
