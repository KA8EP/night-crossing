import { MathUtils, Vector3, type Object3D } from 'three'
import { Civilian } from '../entities/civilian'
import { pads, v } from '../entities/district'
import { Helicopter } from '../entities/helicopter'
import type { Soldier } from '../entities/soldier'
import { approach } from './air-support'
import { surfaceAt, type Navigation, type Travel } from './navigation'

type Flight = 'ready' | 'incoming' | 'landed' | 'departing' | 'cooldown'
const duration = { incoming: 5.2, landed: 10, departing: 4.3, cooldown: 12 }
const civilianSpawns = [v(-15, 0, 0), v(-20, 0, 5), v(11, 0, -5), v(20, 0, 3.2), v(-15, 6, 24), v(14, 9.5, 20)]

export class Evacuation {
  readonly civilians = civilianSpawns.map(p => new Civilian(p.x, p.z, p.y))
  private readonly helicopter = new Helicopter('rescue')
  private readonly destinations = new Map<Civilian, Vector3>()
  private readonly edge = new Vector3()
  private pad = pads[0]
  private flight: Flight = 'ready'
  private elapsed = 0
  private nextFollow = 0
  private saved = 0

  constructor(scene: Object3D, private readonly navigation: Navigation, private readonly squad: readonly Soldier[]) {
    scene.add(this.helicopter.model, ...this.civilians.map(civilian => civilian.model))
  }

  call(point: Vector3 | undefined) {
    if (this.flight !== 'ready' || !this.civilians.some(civilian => civilian.available)) return 'Эвакуация сейчас недоступна'
    const pad = point && pads.find(candidate => candidate.point.distanceTo(point) <= candidate.radius)
    if (!pad) return 'Щёлкните по площадке H с зелёным дымом'
    this.pad = pad
    this.edge.copy(pad.point).add(v(56, 27, -53))
    this.helicopter.model.position.copy(this.edge)
    this.helicopter.model.visible = true
    this.setFlight('incoming')
  }

  update(dt: number, threat: Vector3 | undefined, escorting = true) {
    if (escorting) this.follow(dt, threat)
    const model = this.helicopter.model
    const ground = this.pad.point.clone().add(v(0, 1.14, 0))
    const above = ground.clone().add(v(0, 15, 0))
    this.elapsed += dt
    switch (this.flight) {
      case 'incoming':
        if (this.elapsed < 3.3) approach(model, this.edge, above, this.elapsed / 3.3)
        else {
          model.position.lerpVectors(above, ground, MathUtils.smoothstep(this.elapsed, 3.3, duration.incoming))
          model.rotation.x = 0
        }
        if (this.elapsed >= duration.incoming) this.setFlight('landed')
        break
      case 'landed':
        for (const civilian of this.civilians) {
          if (civilian.available && civilian.escort && civilian.model.position.distanceTo(this.pad.point) <= this.pad.radius) {
            civilian.board()
            this.saved++
          }
        }
        if (this.elapsed >= duration.landed) this.setFlight('departing')
        break
      case 'departing':
        if (this.elapsed < 1.35) model.position.lerpVectors(ground, above, this.elapsed / 1.35)
        else approach(model, above, this.edge, (this.elapsed - 1.35) / (duration.departing - 1.35))
        if (this.elapsed >= duration.departing) {
          model.visible = false
          this.setFlight('cooldown')
        }
        break
      case 'cooldown':
        if (this.elapsed >= duration.cooldown) this.setFlight('ready')
        break
    }
    if (model.visible) this.helicopter.spin(dt)
  }

  get status() {
    return {
      flight: this.flight, pad: this.pad.name,
      seconds: this.flight === 'ready' ? 0 : Math.ceil(Math.max(0, duration[this.flight] - this.elapsed)),
      saved: this.saved, total: this.civilians.length,
      available: this.civilians.filter(civilian => civilian.available).length,
    }
  }

  private follow(dt: number, threat: Vector3 | undefined) {
    this.nextFollow -= dt
    for (const [index, civilian] of this.civilians.entries()) {
      if (!civilian.available) continue
      if (this.nextFollow <= 0) {
        const position = civilian.model.position
        if (civilian.escort && !civilian.escort.visible) civilian.escort = undefined
        if (!civilian.escort) {
          const soldier = this.squad.reduce<Soldier | undefined>((nearest, member) => {
            if (!member.ready || member.model.position.distanceTo(position) > 4.8) return nearest
            return !nearest || nearest.model.position.distanceToSquared(position) > member.model.position.distanceToSquared(position) ? member : nearest
          }, undefined)
          if (soldier) civilian.escort = soldier.model
        }
        if (civilian.escort) {
          const assigned = this.destinations.get(civilian)
          if (!assigned) {
            const choices = pads.map(pad => {
              const point = pad.point.clone().add(v((index % 3 - 1) * 1.2, 0, index % 2 ? 1.55 : -1.25))
              const path = this.navigation.route(position, point)
              return { point, path, cost: travelTime(position, path) }
            }).sort((a, b) => a.cost - b.cost)
            const choice = choices[0]
            if (choice.path.length) {
              this.destinations.set(civilian, choice.point)
              civilian.move(choice.path)
            }
          } else if (position.distanceToSquared(assigned) > 0.01) {
            civilian.move(this.navigation.route(position, assigned))
          }
        } else {
          this.destinations.delete(civilian)
          if (threat && position.distanceTo(threat) <= 11) this.panic(civilian, threat)
        }
      }
      civilian.update(dt)
    }
    if (this.nextFollow <= 0) this.nextFollow = 0.65
  }

  private panic(civilian: Civilian, threat: Vector3) {
    const position = civilian.model.position
    const surface = surfaceAt(position)
    if (!surface) return
    const away = position.clone().sub(threat).setY(0)
    if (away.lengthSq() < 0.01) away.x = 1
    away.normalize()
    const candidates = [0, 0.72, -0.72, 1.4, -1.4].map(turn =>
      position.clone().addScaledVector(away.clone().applyAxisAngle(v(0, 1, 0), turn), 5.5))
      .filter(point => surfaceAt(point) === surface && this.navigation.walkable(point))
    for (const point of candidates) {
      const path = this.navigation.route(position, point)
      if (path.length) {
        civilian.move(path)
        return
      }
    }
    // If cornered on a roof, use the nearest exit that increases distance from danger.
    for (const { from, to, kind } of this.navigation.links) {
      if (surfaceAt(from) !== surface && surfaceAt(to) !== surface) continue
      const exit = surfaceAt(from) === surface ? to : from
      if (exit.distanceTo(threat) <= position.distanceTo(threat) || (kind === 'zip' && exit === from)) continue
      const path = this.navigation.route(position, exit)
      if (path.length) {
        civilian.move(path)
        return
      }
    }
  }

  private setFlight(flight: Flight) {
    this.flight = flight
    this.elapsed = 0
  }
}

function travelTime(start: Vector3, path: Travel[]) {
  if (!path.length) return Infinity
  return path.reduce((time, point, i) => time + point.distanceTo(path[i - 1] ?? start) / (point.speed ?? 4.5), 0)
}
