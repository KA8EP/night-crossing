import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three'
import { Fireball, fireRadius } from '../entities/fireball'
import { Pyrokinetic } from '../entities/pyrokinetic'
import type { Civilian } from '../entities/civilian'
import type { Soldier } from '../entities/soldier'
import type { Construction } from './construction'

const shotRange = 11
const fireInterval = 6
const tracerGeometry = new BoxGeometry(0.039, 0.039, 1)
const tracerMaterial = new MeshBasicMaterial({ color: 0xffecac })

export type Outcome = 'boss' | 'evacuation' | 'defeat'

export class Combat {
  readonly boss = new Pyrokinetic()
  private readonly firing = new Map<Soldier, number>()
  private readonly tracers: { mesh: Mesh; time: number }[] = []
  private readonly fireballs: Fireball[] = []
  private untilFire = fireInterval
  private civilianNext = false

  constructor(
    private readonly scene: Object3D,
    private readonly soldiers: readonly Soldier[],
    private readonly civilians: readonly Civilian[],
    private readonly construction: Construction,
  ) {
    scene.add(this.boss.model)
    soldiers.forEach((soldier, index) => this.firing.set(soldier, index * 0.09))
  }

  update(dt: number) {
    const living = this.soldiers.filter(soldier => soldier.alive)
    const boss = this.boss.model.position
    this.boss.update(dt)
    for (const soldier of living) {
      const remaining = Math.max(0, (this.firing.get(soldier) ?? 0) - dt)
      this.firing.set(soldier, remaining)
      if (remaining > 0 || !this.boss.alive || soldier.model.position.distanceTo(boss) > shotRange) continue
      this.firing.set(soldier, 0.43)
      this.shoot(soldier, boss)
      this.boss.damage(12)
    }
    this.untilFire = Math.max(0, this.untilFire - dt)
    if (this.boss.alive && this.untilFire === 0) {
      const target = this.chooseTarget(living)
      if (target) {
        this.untilFire = fireInterval
        this.civilianNext = !this.civilianNext
        this.boss.face(target)
        const fireball = new Fireball(boss.clone().add(new Vector3(0, 1.55, 0)), target.clone())
        this.fireballs.push(fireball)
        this.scene.add(fireball.model)
      }
    }

    let destroyed = false
    for (let index = this.fireballs.length - 1; index >= 0; index--) {
      const fireball = this.fireballs[index]
      const { impact, burning, expired } = fireball.update(dt)
      if (impact || burning > 0) {
        destroyed = this.fireDamage(fireball.target, impact, burning) || destroyed
      }
      if (expired) {
        fireball.dispose()
        this.fireballs.splice(index, 1)
      }
    }
    for (let index = this.tracers.length - 1; index >= 0; index--) {
      const tracer = this.tracers[index]
      tracer.time -= dt
      if (tracer.time <= 0) {
        tracer.mesh.removeFromParent()
        this.tracers.splice(index, 1)
      }
    }
    return destroyed
  }

  outcome(saved: number, total: number): Outcome | undefined {
    if (!this.boss.alive) return 'boss'
    if (saved === total) return 'evacuation'
    if (!this.soldiers.some(soldier => soldier.alive)) return 'defeat'
  }

  clearEffects() {
    for (const fireball of this.fireballs) fireball.dispose()
    for (const { mesh } of this.tracers) mesh.removeFromParent()
    this.fireballs.length = 0
    this.tracers.length = 0
  }

  private chooseTarget(living: readonly Soldier[]) {
    const boss = this.boss.model.position
    let nearest: Vector3 | undefined
    let distance = 19
    for (const { model: { position } } of living) {
      const range = position.distanceTo(boss)
      if (range < distance) {
        distance = range
        nearest = position
      }
    }
    if (!nearest || !this.civilianNext) return nearest
    return this.civilians.find(civilian => civilian.available
      && civilian.model.position.distanceTo(boss) < 19
      && living.some(soldier => soldier.model.position.distanceTo(civilian.model.position) < 6))?.model.position ?? nearest
  }

  private fireDamage(center: Vector3, impact: boolean, burning: number) {
    for (const soldier of this.soldiers) {
      if (!soldier.alive || soldier.model.position.distanceTo(center) > fireRadius) continue
      const protection = this.construction.providesCover(soldier.model.position) ? 0.5 : 1
      soldier.damage(((impact ? 32 : 0) + burning * 13) * protection)
    }
    for (const civilian of this.civilians) {
      if (civilian.available && civilian.model.position.distanceTo(center) <= fireRadius) {
        civilian.damage((impact ? 31 : 0) + burning * 13)
      }
    }
    return this.construction.damageArea(center, fireRadius, (impact ? 60 : 0) + burning * 16)
  }

  private shoot(soldier: Soldier, target: Vector3) {
    soldier.aimAt(target)
    const from = soldier.model.position.clone()
    const direction = target.clone().sub(from).normalize()
    from.addScaledVector(direction, 0.62).y += 1.06
    const to = target.clone()
    to.y += 1.65
    const mesh = new Mesh(tracerGeometry, tracerMaterial)
    mesh.position.copy(from).lerp(to, 0.5)
    mesh.lookAt(to)
    mesh.scale.z = from.distanceTo(to)
    this.scene.add(mesh)
    this.tracers.push({ mesh, time: 0.075 })
  }
}
