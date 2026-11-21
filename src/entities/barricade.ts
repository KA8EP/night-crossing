import { Box2, CanvasTexture, Group, MeshStandardMaterial, Sprite, SpriteMaterial, Vector2, Vector3 } from 'three'
import { box } from './mesh'

const canvasColor = [0xc4a67d, 0xaa8e69, 0xd5b58a].map(color => new MeshStandardMaterial({ color, roughness: 1 }))

export class Barricade {
  static readonly maxHealth = 100
  readonly model = new Group()
  readonly footprint: Box2
  private readonly canvas = document.createElement('canvas')
  private readonly texture = new CanvasTexture(this.canvas)
  private health = Barricade.maxHealth

  constructor(point: Vector3) {
    this.model.position.copy(point)
    this.footprint = new Box2(new Vector2(point.x - 1.65, point.z - 0.75), new Vector2(point.x + 1.65, point.z + 0.75))
    for (let row = 0; row < 3; row++) {
      const count = row === 1 ? 2 : 3
      for (let i = 0; i < count; i++) {
        const bag = box(this.model, canvasColor[(row + i) % canvasColor.length], [0.82, 0.23, 0.73],
          [(i - (count - 1) / 2) * 0.83, 0.12 + row * 0.2, row % 2 ? 0.04 : -0.04])
        bag.rotation.y = (i % 2 ? -1 : 1) * 0.07
      }
    }
    this.canvas.width = 128
    this.canvas.height = 32
    const meter = new Sprite(new SpriteMaterial({ map: this.texture, depthWrite: false }))
    meter.scale.set(2.1, 0.525, 1)
    meter.position.y = 0.94
    this.model.add(meter)
    this.drawHealth()
  }

  damage(amount: number) {
    this.health = Math.max(0, this.health - Math.max(0, amount))
    this.model.visible = this.health > 0
    this.drawHealth()
  }

  get standing() {
    return this.health > 0
  }

  private drawHealth() {
    const context = this.canvas.getContext('2d')!
    context.clearRect(0, 0, 128, 32)
    context.fillStyle = '#18222e'
    context.fillRect(0, 0, 128, 32)
    context.fillStyle = '#d6ad75'
    context.fillRect(3, 24, 122 * this.health / Barricade.maxHealth, 5)
    context.fillStyle = '#fff0d3'
    context.font = 'bold 17px sans-serif'
    context.textAlign = 'center'
    context.fillText(Math.ceil(this.health) + ' / ' + Barricade.maxHealth, 64, 19)
    this.texture.needsUpdate = true
  }
}
