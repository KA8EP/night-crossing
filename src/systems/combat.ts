import { Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3, type Object3D } from 'three'
import { Ember } from '../entities/ember'
import { beam } from '../entities/city'
import { Fireball, fireRadius } from '../entities/fireball'
import { Pyrokinetic } from '../entities/pyrokinetic'
import { v } from '../entities/district'
import type { Civilian } from '../entities/civilian'
import type { Soldier } from '../entities/soldier'
import type { Construction } from './construction'
import { lineOfSight, surfaceAt, type Navigation, type Travel } from './navigation'
import { fire, smokeColors, sparks, type Particles } from './particles'

export type Outcome = 'boss' | 'evacuation' | 'defeat'
type Enemy = Pyrokinetic | Ember
type Jump = { from: Vector3; to: Vector3; age: number }
type Wave = { point: Vector3; model: Mesh; age: number; hit: Set<Object3D> }

const tracer = new MeshBasicMaterial({ color: 0xffdf94 })
const laser = new MeshBasicMaterial({ color: 0xff4e58, transparent: true, opacity: 0.64, depthWrite: false })
const waveMaterial = new MeshBasicMaterial({ color: 0xff7546, transparent: true, opacity: 0.8, depthWrite: false })
const waveGeometry = new RingGeometry(0.91, 1, 24)
const waves = [
  { at: 14, points: [v(29, 0, -4), v(26, 0, 3)] },
  { at: 49, points: [v(17, 11, -19), v(24, 9.5, 20), v(2, 0, -26)] },
  { at: 88, points: [v(-1, 0, -29), v(1, 0, 29), v(18, 0, 5), v(22, 11, -22)] },
]

export class Combat {
  readonly boss = new Pyrokinetic()
  private readonly embers: Ember[] = []
  private readonly paths = new Map<Enemy, Travel[]>()
  private readonly firing = new Map<Soldier, number>()
  private readonly shots: { model: Object3D; time: number }[] = []
  private readonly fireballs: Fireball[] = []
  private readonly shockwaves: Wave[] = []
  private jump?: Jump
  private markedBy?: Soldier
  private time = 0
  private nextWave = 0
  private nextPath = 0
  private untilFire = 6
  private untilWave = 9
  private untilMelee = 0
  private untilJump = 0
  private destroyed = false

  constructor(
    private readonly scene: Object3D,
    private readonly soldiers: readonly Soldier[],
    private readonly civilians: readonly Civilian[],
    private readonly construction: Construction,
    private readonly navigation: Navigation,
    private readonly effects: Particles,
  ) {
    scene.add(this.boss.model)
    soldiers.forEach((soldier, i) => this.firing.set(soldier, i * 0.12))
  }

  get wavesLeft() { return this.boss.alive ? waves.length - this.nextWave : 0 }

  airImpact(point: Vector3) {
    this.enemies().forEach(enemy => {
      const p = enemy.model.position
      if (Math.abs(p.y - point.y) < 3 && p.distanceTo(point) <= 5.4) enemy.damage(120)
    })
    this.destroyed = this.construction.damageArea(point, 4.8, 48) || this.destroyed
  }

  update(dt: number) {
    this.time += dt
    const living = this.soldiers.filter(soldier => soldier.ready)
    this.boss.update(dt)
    if (this.boss.alive && this.time >= (waves[this.nextWave]?.at ?? Infinity)) {
      for (const point of waves[this.nextWave].points) {
        const enemy = new Ember(point)
        this.embers.push(enemy)
        this.scene.add(enemy.model)
        this.effects.burst(point, fire, 20, 3.5, 3, 0.75, 0.31, 3)
      }
      this.nextWave++
    }
    this.autoFire(dt, living)
    this.nextPath -= dt
    if (this.boss.alive) this.bossAI(dt, living)
    for (const ember of this.embers) {
      if (ember.health <= 0) continue
      const target = nearest(ember.model.position, living.map(soldier => soldier.model))
      if (!target) continue
      const position = ember.model.position
      ember.swing -= dt
      if (position.distanceTo(target.position) <= 1.45) {
        if (ember.swing <= 0) {
          this.hurt(target, 14)
          ember.swing = 0.85
          this.effects.burst(position.clone().add(v(0, 0.6, 0)), fire, 7, 3, 1.6, 0.45, 0.19)
        }
      } else {
        if (this.nextPath <= 0) this.paths.set(ember, this.navigation.route(position, target.position))
        this.follow(ember, dt, 4)
      }
    }
    if (this.nextPath <= 0) this.nextPath = 0.56
    this.updateFire(dt)
    for (let i = this.shots.length - 1; i >= 0; i--) {
      this.shots[i].time -= dt
      if (this.shots[i].time > 0) continue
      this.shots[i].model.removeFromParent()
      this.shots.splice(i, 1)
    }
    if (!this.boss.alive && this.jump) this.jump = undefined
    const changed = this.destroyed
    this.destroyed = false
    return changed
  }

  outcome(saved: number, total: number, pending: boolean): Outcome | undefined {
    if (!this.boss.alive) return 'boss'
    if (saved === total) return 'evacuation'
    if (!pending && !this.soldiers.some(soldier => soldier.alive)) return 'defeat'
  }

  private enemies() {
    return [this.boss, ...this.embers].filter(enemy => enemy.health > 0)
  }

  private autoFire(dt: number, living: readonly Soldier[]) {
    const enemies = this.enemies()
    for (const soldier of living) {
      const remaining = Math.max(0, (this.firing.get(soldier) ?? 0) - dt)
      this.firing.set(soldier, remaining)
      const from = soldier.model.position.clone().add(v(0, 1.13, 0))
      if (remaining > (soldier.role === 'sniper' ? 0.36 : 0)) continue
      const target = this.target(from, soldier.stats.range, enemies, soldier.role === 'sniper')
      if (!target) continue
      soldier.aimAt(target.enemy.model.position)
      if (soldier.role === 'sniper') this.drawShot(from, target.point, laser, 0.026, 0.055)
      if (remaining > 0) continue
      this.firing.set(soldier, soldier.stats.interval)
      this.drawShot(from, target.point, tracer, 0.055, 0.09)
      const highGround = soldier.role === 'sniper' && soldier.model.position.y > 4
      target.enemy.damage(soldier.stats.damage * (highGround ? 1.42 : 1))
      if (soldier.role === 'sniper' && target.enemy === this.boss) this.markedBy = soldier
    }
    for (const turret of this.construction.turrets) {
      if (turret.health <= 0) continue
      turret.cooldown -= dt
      if (turret.cooldown > 0) continue
      const from = turret.model.position.clone().add(v(0, 1, 0))
      const target = this.target(from, 17, enemies)
      if (!target) continue
      turret.head.rotation.y = Math.atan2(target.point.x - from.x, target.point.z - from.z)
      turret.cooldown = 0.31
      this.drawShot(from, target.point, tracer, 0.05, 0.08)
      target.enemy.damage(12)
    }
  }

  private target(from: Vector3, range: number, enemies: Enemy[], preferBoss = false) {
    let best: { enemy: Enemy; point: Vector3 } | undefined
    let distance = range
    for (const enemy of enemies) {
      if (enemy.health <= 0) continue
      const point = enemy.model.position.clone().add(v(0, enemy === this.boss ? 1.65 : 0.97, 0))
      const length = from.distanceTo(point)
      if (length > distance || !lineOfSight(from, point)) continue
      best = { enemy, point }
      distance = length
      if (preferBoss && enemy === this.boss) break
    }
    return best
  }

  private bossAI(dt: number, living: readonly Soldier[]) {
    const position = this.boss.model.position
    this.untilFire -= dt
    this.untilWave -= dt
    this.untilMelee -= dt
    this.untilJump -= dt
    if (this.jump) {
      const { from, to } = this.jump
      this.jump.age += dt
      const t = Math.min(1, this.jump.age / 1.35)
      position.lerpVectors(from, to, t).y += Math.sin(t * Math.PI) * 14
      this.boss.face(to)
      if (t === 1) {
        this.jump = undefined
        this.effects.burst(position, fire, 26, 5, 3.5, 0.8, 0.34, 5)
        this.areaDamage(position, 2.8, 29, 32)
      }
      return
    }
    const targets = living.map(soldier => soldier.model)
    const civilians = this.civilians.filter(civilian => civilian.available).map(civilian => civilian.model)
    const nearestSoldier = nearest(position, targets)
    const nearbyCivilian = nearest(position, civilians.filter(model => model.position.distanceTo(position) <= 12))
    const target = nearest(position, [...targets, ...(nearbyCivilian && (this.time > 12 || this.boss.health < Pyrokinetic.maxHealth) ? [nearbyCivilian] : [])])
    if (!target) return

    const sniper = this.markedBy
    const roof = sniper?.ready && surfaceAt(sniper.model.position)
    if (sniper && roof && roof.y > position.y + 2 && this.untilJump <= 0 && this.navigation.walkable(sniper.model.position)) {
      this.startJump(sniper.model.position)
      this.markedBy = undefined
      return
    }

    const distance = position.distanceTo(target.position)
    this.boss.face(target.position)
    if (distance <= 2.15 && this.untilMelee <= 0) {
      this.hurt(target, 29)
      this.effects.burst(target.position.clone().add(v(0, 0.7, 0)), sparks, 10, 3, 2, 0.42, 0.24, 4)
      this.untilMelee = 1.05
    }
    if (distance < 8 && surfaceAt(position) && this.untilWave <= 0) {
      this.startWave(position)
      this.untilWave = 9
    }
    const fireTarget = nearest(position, [nearestSoldier, nearbyCivilian].filter((unit): unit is Object3D =>
      Boolean(unit && surfaceAt(unit.position) && unit.position.distanceTo(position) <= 29)))
    if (fireTarget && this.untilFire <= 0) {
      const ball = new Fireball(position.clone().add(v(0, 1.65, 0)), fireTarget.position.clone())
      this.scene.add(ball.model)
      this.fireballs.push(ball)
      this.untilFire = 6
    }

    if (distance > 1.85 && (this.time > 11 || this.boss.health < Pyrokinetic.maxHealth)) {
      if (this.nextPath <= 0) {
        const path = this.navigation.route(position, target.position)
        this.paths.set(this.boss, path)
        const level = surfaceAt(target.position)
        if (level && level.y > position.y + 1 && this.untilJump <= 0 && distance < 21 && this.navigation.walkable(target.position)) {
          this.startJump(target.position)
          return
        }
      }
      this.follow(this.boss, dt, 4.1)
    }
  }

  private startJump(target: Vector3) {
    const position = this.boss.model.position
    this.jump = { from: position.clone(), to: target.clone(), age: 0 }
    this.untilJump = 12
    this.effects.burst(position, fire, 18, 4, 3, 0.64, 0.32, 5)
  }

  private startWave(point: Vector3) {
    const model = new Mesh(waveGeometry, waveMaterial)
    model.rotation.x = -Math.PI / 2
    model.position.copy(point).y += 0.09
    model.scale.setScalar(0.4)
    this.scene.add(model)
    this.shockwaves.push({ point: point.clone(), model, age: 0, hit: new Set() })
  }

  private updateFire(dt: number) {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const ball = this.fireballs[i]
      const { impact, burning, expired } = ball.update(dt)
      if (impact) {
        this.effects.burst(ball.target, fire, 31, 5.5, 4, 0.78, 0.34, 6)
        this.effects.burst(ball.target, smokeColors, 10, 2, 2, 1.6, 0.55)
      }
      if (impact || burning > 0) this.areaDamage(ball.target, fireRadius, (impact ? 32 : 0) + burning * 13, (impact ? 60 : 0) + burning * 16)
      if (expired) {
        ball.dispose()
        this.fireballs.splice(i, 1)
      }
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i]
      wave.age += dt
      const radius = 0.6 + wave.age * 8
      wave.model.scale.setScalar(radius)
      if (Math.random() < dt * 29) {
        const angle = Math.random() * Math.PI * 2
        this.effects.burst(wave.point.clone().add(v(Math.sin(angle) * radius, 0.28, Math.cos(angle) * radius)), fire, 3, 1.8, 2.1, 0.52, 0.25, 5)
      }
      for (const unit of this.units()) {
        const p = unit.position
        if (Math.abs(p.y - wave.point.y) > 1.2 || p.distanceTo(wave.point) > radius || wave.hit.has(unit)) continue
        wave.hit.add(unit)
        this.hurt(unit, 37)
      }
      this.destroyed = this.construction.damageArea(wave.point, radius, dt * 25) || this.destroyed
      if (radius > 8) {
        wave.model.removeFromParent()
        this.shockwaves.splice(i, 1)
      }
    }
  }

  private units() {
    return [
      ...this.soldiers.filter(unit => unit.ready).map(unit => unit.model),
      ...this.civilians.filter(unit => unit.available).map(unit => unit.model),
    ]
  }

  private hurt(model: Object3D, amount: number) {
    const soldier = this.soldiers.find(unit => unit.model === model && unit.ready)
    if (soldier) soldier.damage(amount * (this.construction.providesCover(model.position) ? 0.5 : 1))
    else this.civilians.find(unit => unit.model === model)?.damage(amount)
  }

  private areaDamage(center: Vector3, radius: number, amount: number, structural: number) {
    for (const model of this.units()) {
      if (Math.abs(model.position.y - center.y) <= 1.2 && model.position.distanceTo(center) <= radius) this.hurt(model, amount)
    }
    this.destroyed = this.construction.damageArea(center, radius, structural) || this.destroyed
  }

  private follow(enemy: Enemy, dt: number, walkingSpeed: number) {
    const path = this.paths.get(enemy)
    const step = path?.[0]
    if (!step) return
    const position = enemy.model.position
    const distance = position.distanceTo(step)
    const speed = step.speed === 5 || !step.speed ? walkingSpeed : step.speed
    if (distance <= speed * dt) {
      position.copy(step)
      path.shift()
    } else {
      enemy.model.rotation.y = Math.atan2(step.x - position.x, step.z - position.z)
      position.lerp(step, speed * dt / distance)
    }
  }

  private drawShot(from: Vector3, to: Vector3, material: MeshBasicMaterial, width: number, time: number) {
    const group = new Group()
    beam(group, material, from, to, width)
    this.scene.add(group)
    this.shots.push({ model: group, time })
    if (material === tracer) {
      this.effects.burst(from, sparks, 5, 3.2, 1.8, 0.28, 0.13, 5)
      this.effects.burst(to, sparks, 4, 2.8, 1.5, 0.24, 0.16, 5)
    }
  }
}

function nearest(origin: Vector3, models: readonly Object3D[]) {
  return models.reduce<Object3D | undefined>((best, model) =>
    !best || origin.distanceToSquared(model.position) < origin.distanceToSquared(best.position) ? model : best, undefined)
}
