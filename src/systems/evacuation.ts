import { MathUtils, Vector3, type Box2, type Camera, type Object3D } from 'three'
import { Civilian } from '../entities/civilian'
import { Helicopter } from '../entities/helicopter'
import { helipad, route, surfaceAt } from './navigation'

type Flight = 'ready' | 'incoming' | 'hovering' | 'departing' | 'cooldown'
const duration = { incoming: 4, hovering: 10, departing: 4, cooldown: 12 }
const hoverPoint = new Vector3(helipad.x, 3.2, helipad.z)

export class Evacuation {
  readonly civilians = [new Civilian(7, -5.8), new Civilian(19.7, -5.8), new Civilian(20.7, 5.2)]
  private readonly helicopter = new Helicopter()
  private readonly edge = new Vector3()
  private readonly near = new Vector3()
  private readonly far = new Vector3()
  private readonly target = new Vector3()
  private flight: Flight = 'ready'
  private elapsed = 0
  private nextFollow = 0
  private saved = 0

  constructor(scene: Object3D, private readonly camera: Camera, private readonly squad: readonly Object3D[]) {
    scene.add(this.helicopter.model, ...this.civilians.map(civilian => civilian.model))
  }

  call() {
    if (this.flight !== 'ready' || this.saved === this.civilians.length) return
    this.setFlight('incoming')
    this.setEdge()
    this.helicopter.model.position.copy(this.edge)
    this.helicopter.model.visible = true
  }

  update(dt: number, obstacles: readonly Box2[]) {
    this.follow(dt, obstacles)
    if (this.flight !== 'ready') {
      this.elapsed += dt
      this.helicopter.spin(dt)
      switch (this.flight) {
        case 'incoming':
          this.fly(this.edge, hoverPoint, duration.incoming)
          if (this.elapsed >= duration.incoming) this.setFlight('hovering')
          break
        case 'hovering':
          this.helicopter.model.position.y = hoverPoint.y + Math.sin(this.elapsed * 2.9) * 0.13
          if (this.elapsed >= duration.hovering) {
            for (const civilian of this.civilians) {
              const { x, z } = civilian.model.position
              if (!civilian.rescued && Math.hypot(x - helipad.x, z - helipad.z) <= helipad.radius) {
                civilian.board()
                this.saved++
              }
            }
            this.setFlight('departing')
            this.setEdge()
          }
          break
        case 'departing':
          this.fly(hoverPoint, this.edge, duration.departing)
          if (this.elapsed >= duration.departing) {
            this.helicopter.model.visible = false
            this.setFlight('cooldown')
          }
          break
        case 'cooldown':
          if (this.elapsed >= duration.cooldown) this.setFlight('ready')
          break
      }
    }
  }

  get status() {
    return {
      flight: this.flight,
      seconds: this.flight === 'ready' ? 0 : Math.ceil(Math.max(0, duration[this.flight] - this.elapsed)),
      saved: this.saved,
      total: this.civilians.length,
    }
  }

  private follow(dt: number, obstacles: readonly Box2[]) {
    this.nextFollow -= dt
    for (const [index, civilian] of this.civilians.entries()) {
      if (civilian.rescued) continue
      const position = civilian.model.position
      if (!civilian.escort) {
        let nearest = 3.2
        for (const soldier of this.squad) {
          const distance = position.distanceTo(soldier.position)
          if (distance <= nearest) {
            civilian.escort = soldier
            nearest = distance
          }
        }
      }
      if (civilian.escort && this.nextFollow <= 0) {
        const leader = civilian.escort.position
        const surface = surfaceAt(leader.x, leader.z)
        if (surface) {
          this.target.set(
            MathUtils.clamp(leader.x + (index - 1) * 0.85, surface.minX + 0.45, surface.maxX - 0.45),
            0,
            MathUtils.clamp(leader.z + 1.05, -surface.halfDepth + 0.45, surface.halfDepth - 0.45),
          )
          const lane = (index - 1) * 0.55
          const path = route(position, this.target.clone(), lane, obstacles)
          civilian.move(path.length ? path : route(position, leader.clone(), lane, obstacles))
        }
      }
      civilian.update(dt)
    }
    if (this.nextFollow <= 0) this.nextFollow = 0.19
  }

  private setFlight(flight: Flight) {
    this.flight = flight
    this.elapsed = 0
  }

  private setEdge() {
    // Intersect a point just beyond the right side of the camera with the flight altitude.
    this.near.set(1.45, 0.42, -1).unproject(this.camera)
    this.far.set(1.45, 0.42, 1).unproject(this.camera)
    this.edge.copy(this.near).lerp(this.far, (11 - this.near.y) / (this.far.y - this.near.y))
    if (this.edge.distanceTo(hoverPoint) < 14) this.edge.x += 18
  }

  private fly(from: Vector3, to: Vector3, seconds: number) {
    const progress = Math.min(1, this.elapsed / seconds)
    const model = this.helicopter.model
    model.position.lerpVectors(from, to, MathUtils.smoothstep(progress, 0, 1))
    model.rotation.y = Math.atan2(to.x - from.x, to.z - from.z)
    model.rotation.x = Math.sin(progress * Math.PI) * 0.13
  }
}
