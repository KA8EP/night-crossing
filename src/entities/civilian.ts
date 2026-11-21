import { Group, Mesh, MeshStandardMaterial, SphereGeometry, type Object3D } from 'three'
import type { Travel } from '../systems/navigation'
import { box } from './mesh'

const vest = new MeshStandardMaterial({ color: 0xff812d, emissive: 0x3b1504 })
const reflective = new MeshStandardMaterial({ color: 0xffdf9a })
const clothes = new MeshStandardMaterial({ color: 0x394553 })
const skin = new MeshStandardMaterial({ color: 0xbc8468 })
const head = new SphereGeometry(0.2, 8, 6)

export class Civilian {
  readonly model = new Group()
  escort?: Object3D
  rescued = false
  private health = 100
  private readonly legs = [new Group(), new Group()]
  private waypoints: Travel[] = []
  private stride = 0

  constructor(x: number, z: number, y = 0) {
    this.model.position.set(x, y, z)
    this.model.rotation.y = -0.7
    box(this.model, vest, [0.47, 0.48, 0.31], [0, 0.93, 0])
    box(this.model, reflective, [0.49, 0.075, 0.33], [0, 0.82, 0])
    const face = new Mesh(head, skin)
    face.position.y = 1.37
    face.castShadow = true
    this.model.add(face)
    for (const [index, side] of [-1, 1].entries()) {
      box(this.model, clothes, [0.13, 0.44, 0.14], [side * 0.28, 0.88, 0]).rotation.z = side * 0.12
      const leg = this.legs[index]
      leg.position.set(side * 0.12, 0.68, 0)
      box(leg, clothes, [0.16, 0.65, 0.22], [0, -0.325, 0.02])
      this.model.add(leg)
    }
  }

  move(waypoints: Travel[]) {
    this.waypoints = waypoints
  }

  get available() {
    return !this.rescued && this.health > 0
  }

  damage(amount: number) {
    if (!this.available) return
    this.health = Math.max(0, this.health - amount)
    if (!this.available) {
      this.model.visible = false
      this.escort = undefined
      this.waypoints = []
    }
  }

  update(dt: number) {
    const position = this.model.position
    const next = this.waypoints[0]
    let swing = 0
    if (next) {
      const distance = position.distanceTo(next)
      if (distance > 0.001) this.model.rotation.y = Math.atan2(next.x - position.x, next.z - position.z)
      const step = (next.speed === 5 ? 4.5 : next.speed ?? 4.5) * dt
      if (distance <= step) {
        position.copy(next)
        this.waypoints.shift()
      } else {
        position.lerp(next, step / distance)
      }
      this.stride += dt * 13
      swing = Math.sin(this.stride) * Math.min(0.43, distance * 2)
    }
    this.legs[0].rotation.x = swing
    this.legs[1].rotation.x = -swing
  }

  board() {
    this.rescued = true
    this.model.visible = false
  }
}
