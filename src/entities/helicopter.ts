import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { box } from './mesh'

const hull = new MeshStandardMaterial({ color: 0x58706d, roughness: 0.72, flatShading: true })
const dark = new MeshStandardMaterial({ color: 0x27383d, roughness: 0.72 })
const glass = new MeshStandardMaterial({ color: 0x7ecadd, emissive: 0x193944, metalness: 0.35 })
const light = new MeshBasicMaterial({ color: 0xffca93 })

export class Helicopter {
  readonly model = new Group()
  private readonly mainRotor = new Group()
  private readonly tailRotor = new Group()

  constructor(kind: 'transport' | 'gunship' | 'rescue' = 'transport') {
    const paint = hull.clone()
    paint.color.setHex(kind === 'rescue' ? 0x80958e : kind === 'gunship' ? 0x3a566b : 0x596e65)
    const cabin = new Mesh(new CylinderGeometry(1, 0.84, 3.5, 8), paint)
    cabin.rotation.x = Math.PI / 2
    cabin.scale.set(1.1, 1, 0.86)
    cabin.castShadow = true
    this.model.add(cabin)
    box(this.model, glass, [1.63, 0.61, 0.11], [0, 0.28, 1.76]).rotation.x = -0.19
    for (const side of [-1, 1]) {
      box(this.model, glass, [0.1, 0.46, 0.8], [side * 1, 0.27, 0.96])
      box(this.model, dark, [0.08, 0.48, 0.7], [side * 1.02, 0.12, -0.35])
      box(this.model, dark, [0.14, 0.14, 3.65], [side * 0.91, -1.04, 0.05])
      box(this.model, hull, [0.13, 0.53, 0.15], [side * 0.9, -0.8, 0.91])
      box(this.model, hull, [0.13, 0.53, 0.15], [side * 0.9, -0.8, -0.91])
      box(this.model, light, [0.14, 0.12, 0.14], [side * 1.04, -0.17, 1.2], false)
    }
    box(this.model, hull, [0.39, 0.37, 3], [0, 0.11, -2.95]).rotation.x = 0.13
    box(this.model, hull, [0.27, 1.16, 0.61], [0, 0.58, -4.45]).rotation.x = -0.24
    box(this.model, dark, [0.18, 0.48, 0.18], [0, 1, -0.1])
    this.mainRotor.position.set(0, 1.28, -0.1)
    this.tailRotor.position.set(0.2, 0.7, -4.42)
    for (const angle of [0, Math.PI / 2]) {
      box(this.mainRotor, dark, [0.22, 0.065, 7], [0, 0, 0], false).rotation.y = angle
      box(this.tailRotor, dark, [0.058, 0.12, 1.35], [0, 0, 0], false).rotation.x = angle
    }
    this.model.add(this.mainRotor, this.tailRotor)
    if (kind === 'rescue') {
      const rescue = new MeshBasicMaterial({ color: 0x8bf9bf })
      for (const side of [-1, 1]) {
        box(this.model, rescue, [0.06, 0.14, 0.65], [side * 1.02, 0.16, -0.62], false)
        box(this.model, rescue, [0.06, 0.48, 0.14], [side * 1.03, 0.16, -0.62], false)
      }
    }
    if (kind === 'gunship') for (const side of [-1, 1]) {
      box(this.model, paint, [1.3, 0.11, 0.63], [side * 1.21, -0.25, -0.36])
      box(this.model, dark, [0.43, 0.36, 0.8], [side * 1.68, -0.48, -0.36])
    }
    this.model.visible = false
  }

  spin(dt: number) {
    this.mainRotor.rotation.y += dt * 23
    this.tailRotor.rotation.x += dt * 36
  }
}
