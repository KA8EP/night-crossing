import { Vector2, type Box2, type Object3D, type Vector3 } from 'three'
import { Barricade } from '../entities/barricade'
import { helipad, roofs } from './navigation'

export class Construction {
  private readonly barricades: Barricade[] = []

  constructor(private readonly scene: Object3D) {}

  get obstacles(): Box2[] {
    return this.barricades.filter(barricade => barricade.standing).map(barricade => barricade.footprint)
  }

  providesCover(position: Vector3) {
    const ground = new Vector2(position.x, position.z)
    return this.barricades.some(barricade => barricade.standing && barricade.footprint.distanceToPoint(ground) <= 1.45)
  }

  damageArea(position: Vector3, radius: number, amount: number) {
    const ground = new Vector2(position.x, position.z)
    let destroyed = false
    for (const barricade of this.barricades) {
      if (barricade.standing && barricade.footprint.distanceToPoint(ground) <= radius) {
        barricade.damage(amount)
        if (!barricade.standing) destroyed = true
      }
    }
    return destroyed
  }

  place(point: Vector3 | undefined, units: readonly Vector3[]) {
    if (!point || !roofs.some(roof => point.x > roof.minX + 2.1 && point.x < roof.maxX - 2.1
      && Math.abs(point.z) < roof.halfDepth - 1.2)) return 'Выберите место на крыше вдали от края'
    if (Math.abs(point.x) < 7 && Math.abs(point.z) < 2.6) return 'Оставьте вход на мост свободным'
    if (Math.hypot(point.x - helipad.x, point.z - helipad.z) < helipad.radius + 1.65) {
      return 'Оставьте вертолётную площадку свободной'
    }
    if (units.some(unit => Math.abs(unit.x - point.x) <= 1.7 && Math.abs(unit.z - point.z) <= 0.8)) {
      return 'Это место занято'
    }
    if (this.obstacles.some(obstacle =>
      point.x >= obstacle.min.x - 1.77 && point.x <= obstacle.max.x + 1.77
      && point.z >= obstacle.min.y - 0.87 && point.z <= obstacle.max.y + 0.87)) {
      return 'Оставьте зазор между баррикадами'
    }
    const barricade = new Barricade(point)
    this.barricades.push(barricade)
    this.scene.add(barricade.model)
  }
}
