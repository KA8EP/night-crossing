import { ConeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, SphereGeometry, Vector3 } from 'three'
import { HealthBar } from './health-bar'
import { box } from './mesh'

const armor = new MeshStandardMaterial({ color: 0x58305f, roughness: 0.78 })
const capeMaterial = new MeshStandardMaterial({ color: 0x952448, roughness: 0.9 })
const ember = new MeshStandardMaterial({ color: 0xff6644, emissive: 0xff3008, emissiveIntensity: 1.45 })
const auraGeometry = new RingGeometry(1.1, 1.22, 32)

export class Pyrokinetic {
  static readonly maxHealth = 1300
  readonly model = new Group()
  private readonly cape = new Group()
  private readonly aura = new Group()
  private readonly bar = new HealthBar(2.25, 3.4, 0xff497d)
  private time = 0
  health = Pyrokinetic.maxHealth

  constructor() {
    this.model.position.set(22, 0, -1.65)
    this.model.rotation.y = -1
    box(this.model, armor, [1.05, 0.96, 0.58], [0, 1.66, 0])
    box(this.model, ember, [0.24, 0.49, 0.09], [0, 1.71, 0.33])
    const head = new Mesh(new SphereGeometry(0.38, 7, 5), armor)
    head.position.y = 2.46
    head.castShadow = true
    this.model.add(head)
    box(this.model, ember, [0.46, 0.12, 0.2], [0, 2.5, 0.3])
    for (const side of [-1, 1]) {
      box(this.model, armor, [0.33, 1.19, 0.42], [side * 0.28, 0.6, 0.02])
      box(this.model, armor, [0.37, 0.71, 0.4], [side * 0.67, 1.72, 0.04]).rotation.z = -side * 0.26
      box(this.model, ember, [0.32, 0.37, 0.34], [side * 0.8, 1.29, 0.14])
    }
    this.cape.position.set(0, 2.04, -0.3)
    const cloth = new Mesh(new ConeGeometry(0.91, 1.9, 4, 1, false, Math.PI / 4), capeMaterial)
    cloth.scale.z = 0.28
    cloth.position.set(0, -0.85, -0.34)
    cloth.castShadow = true
    this.cape.add(cloth)
    this.cape.rotation.x = 0.24
    for (const [index, color] of [0xff4d54, 0xc85aff].entries()) {
      const ring = new Mesh(auraGeometry, new MeshBasicMaterial({ color, transparent: true, opacity: 0.72 - index * 0.25, depthWrite: false }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.06 + index * 0.014
      ring.scale.setScalar(1 + index * 0.23)
      this.aura.add(ring)
    }
    this.model.add(this.cape, this.aura, this.bar.model)
  }

  get alive() {
    return this.health > 0
  }

  damage(amount: number) {
    this.health = Math.max(0, this.health - amount)
    this.bar.update(this.health / Pyrokinetic.maxHealth)
    this.model.visible = this.alive
  }

  face(point: Vector3) {
    this.model.rotation.y = Math.atan2(point.x - this.model.position.x, point.z - this.model.position.z)
  }

  update(dt: number) {
    this.time += dt
    this.aura.scale.setScalar(1 + 0.09 * Math.sin(this.time * 4))
    this.cape.rotation.x = 0.24 + 0.1 * Math.sin(this.time * 4.6)
  }
}
