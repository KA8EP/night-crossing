import { Group, MeshBasicMaterial, MeshStandardMaterial, Vector2, type Object3D, type Vector3 } from 'three'
import { Barricade } from '../entities/barricade'
import { equipmentCover, ground, pads, policeBlocks, roofs, vehicleCover, footprint, v, type Link, type Obstacle } from '../entities/district'
import { box } from '../entities/mesh'
import type { Soldier } from '../entities/soldier'
import { lineOfSight, surfaceAt, type Navigation } from './navigation'

const turretBody = new MeshStandardMaterial({ color: 0x678a82, roughness: 0.9 })
const turretGun = new MeshStandardMaterial({ color: 0x233b40 })
const turretSensor = new MeshBasicMaterial({ color: 0x7dffd1 })
type Build = 'barricade' | 'turret' | 'zip'
type Turret = { model: Group; head: Group; obstacle: Obstacle; health: number; cooldown: number }

export class Construction {
  private readonly barricades: Barricade[] = []
  private readonly pending: { model: Group; time: number; finish: () => void }[] = []
  readonly turrets: Turret[] = []

  constructor(private readonly scene: Object3D, private readonly navigation: Navigation, private readonly showZip: (link: Link) => void) {}

  providesCover(position: Vector3) {
    const point = new Vector2(position.x, position.z)
    return [...vehicleCover, ...policeBlocks, ...equipmentCover].some(({ area, y }) => Math.abs(y - position.y) < 0.95 && area.distanceToPoint(point) <= 1.5) ||
      this.barricades.some(item => item.standing && Math.abs(item.model.position.y - position.y) < 0.95 && item.footprint.distanceToPoint(point) <= 1.5)
  }

  damageArea(position: Vector3, radius: number, amount: number) {
    const point = new Vector2(position.x, position.z)
    let changed = false
    for (const item of this.barricades) {
      if (!item.standing || Math.abs(item.model.position.y - position.y) > 1.3 || item.footprint.distanceToPoint(point) > radius) continue
      item.damage(amount)
      changed = !item.standing || changed
    }
    for (const turret of this.turrets) {
      if (turret.health <= 0 || Math.abs(turret.obstacle.y - position.y) > 1.3 || turret.obstacle.area.distanceToPoint(point) > radius) continue
      turret.health -= amount
      turret.model.visible = turret.health > 0
      changed = turret.health <= 0 || changed
    }
    if (changed) this.refresh()
    return changed
  }

  update(dt: number) {
    let changed = false
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const work = this.pending[i]
      work.time -= dt
      work.model.rotation.y += dt * 2.1
      if (work.time > 0) continue
      work.model.removeFromParent()
      work.finish()
      this.pending.splice(i, 1)
      changed = true
    }
    if (changed) this.refresh()
    return changed
  }

  place(kind: Build, point: Vector3 | undefined, soldiers: readonly Soldier[], units: readonly Vector3[]) {
    if (!point || !this.navigation.walkable(point)) return 'Выберите свободную точку на улице или крыше'
    const engineers = soldiers.filter(soldier => soldier.ready && soldier.role === 'engineer')
    if (kind === 'zip') return this.zip(point, engineers)
    const engineer = engineers.some(soldier => Math.abs(soldier.model.position.y - point.y) < 0.2 && soldier.model.position.distanceTo(point) < 8)
    if (kind === 'turret' && !engineer) return 'Подведите сапёра на расстояние до 8 м'
    const surface = surfaceAt(point)!
    const width = kind === 'turret' ? 0.82 : 1.65
    const depth = kind === 'turret' ? 0.82 : 0.75
    const { area } = footprint(point.x, point.z, width, depth)
    if (area.min.x < surface.minX + 0.25 || area.max.x > surface.maxX - 0.25 ||
      area.min.y < surface.minZ + 0.25 || area.max.y > surface.maxZ - 0.25) return 'Оставьте свободный край'
    if (this.navigation.occupied(area, point.y)) return 'Укрытие пересекается с препятствием'
    if (pads.some(pad => Math.abs(point.y - pad.point.y) < 0.1 && area.distanceToPoint(new Vector2(pad.point.x, pad.point.z)) < pad.radius)) {
      return 'Оставьте зону эвакуации свободной'
    }
    if (this.navigation.links.some(({ from, to }) => [from, to].some(end => Math.abs(end.y - point.y) < 0.1 &&
      area.distanceToPoint(new Vector2(end.x, end.z)) < 1.25))) return 'Оставьте проход свободным'
    if (units.some(unit => Math.abs(unit.y - point.y) < 0.5 && area.distanceToPoint(new Vector2(unit.x, unit.z)) < 0.65) ||
      this.pending.some(work => work.model.position.distanceTo(point) < 3.8)) return 'Эта точка занята'

    const marker = new Group()
    marker.position.copy(point)
    box(marker, turretSensor, [0.65, 0.06, 0.65], [0, 0.1, 0], false)
    this.scene.add(marker)
    const finish = () => {
      if (kind === 'turret') return this.addTurret(point)
      const barricade = new Barricade(point)
      this.barricades.push(barricade)
      this.scene.add(barricade.model)
    }
    this.pending.push({ model: marker, time: engineer ? 0.8 : 3, finish })
  }

  private zip(to: Vector3, engineers: Soldier[]) {
    if (surfaceAt(to) !== ground) return 'Выберите точку приземления на улице'
    if (pads.some(pad => pad.point.distanceTo(to) < pad.radius + 2)) return 'Оставьте зону эвакуации свободной'
    const anchors = engineers.flatMap(engineer => {
      const p = engineer.model.position
      const roof = surfaceAt(p)
      if (!roof || roof === ground || !roofs.includes(roof)) return []
      return [
        ...(to.x < roof.minX ? [v(roof.minX, roof.y, p.z)] : []),
        ...(to.x > roof.maxX ? [v(roof.maxX, roof.y, p.z)] : []),
        ...(to.z < roof.minZ ? [v(p.x, roof.y, roof.minZ)] : []),
        ...(to.z > roof.maxZ ? [v(p.x, roof.y, roof.maxZ)] : []),
      ].filter(from => from.distanceTo(p) < 5.5 && from.distanceTo(to) <= 30 &&
        Math.hypot(from.x - to.x, from.z - to.z) >= 3 &&
        lineOfSight(from.clone().add(v(0, 1.76, 0)), to.clone().add(v(0, 1.76, 0))))
    })
    anchors.sort((a, b) => a.distanceToSquared(to) - b.distanceToSquared(to))
    const from = anchors[0]
    if (!from) return 'Подведите сапёра к краю крыши и укажите улицу под ним (до 30 м)'
    if (this.navigation.links.some(link => link.kind === 'zip' && link.from.distanceTo(from) < 1.8)) return 'Здесь уже закреплён трос'
    const link: Link = { from, to: to.clone(), kind: 'zip' }
    this.navigation.addZip(link)
    this.showZip(link)
  }

  private addTurret(point: Vector3) {
    const model = new Group()
    const head = new Group()
    model.position.copy(point)
    head.position.y = 0.92
    box(model, turretBody, [1.27, 0.2, 1.25], [0, 0.1, 0])
    box(model, turretGun, [0.39, 0.74, 0.38], [0, 0.52, 0])
    box(head, turretBody, [0.75, 0.39, 0.66], [0, 0, 0])
    box(head, turretGun, [0.18, 0.15, 0.85], [0, 0.02, 0.61])
    box(head, turretSensor, [0.22, 0.09, 0.08], [0.22, 0.11, 0.35], false)
    model.add(head)
    this.scene.add(model)
    this.turrets.push({ model, head, obstacle: footprint(point.x, point.z, 0.82, 0.82, point.y), health: 115, cooldown: 0 })
  }

  private refresh() {
    this.navigation.obstacles = [
      ...this.barricades.filter(item => item.standing).map(item => ({ area: item.footprint, y: item.model.position.y })),
      ...this.turrets.filter(item => item.health > 0).map(item => item.obstacle),
    ]
  }
}
