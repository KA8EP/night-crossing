import { Group, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three'
import { HealthBar } from './health-bar'
import { box } from './mesh'

const armor = new MeshStandardMaterial({ color: 0x582842, roughness: 0.92 })
const glow = new MeshBasicMaterial({ color: 0xff7156 })

export class Ember {
  readonly model = new Group()
  private readonly bar = new HealthBar(0.74, 1.78, 0xff7858)
  health = 66
  swing = 0.8

  constructor(position: Vector3) {
    this.model.position.copy(position)
    box(this.model, armor, [0.48, 0.64, 0.36], [0, 0.97, 0])
    box(this.model, glow, [0.27, 0.23, 0.29], [0, 1.41, 0])
    for (const side of [-1, 1]) {
      box(this.model, armor, [0.17, 0.55, 0.25], [side * 0.13, 0.3, 0])
      box(this.model, glow, [0.13, 0.41, 0.15], [side * 0.33, 0.94, 0.04]).rotation.z = side * 0.24
    }
    this.model.add(this.bar.model)
  }

  damage(amount: number) {
    this.health = Math.max(0, this.health - amount)
    this.bar.update(this.health / 66)
    this.model.visible = this.health > 0
  }
}
