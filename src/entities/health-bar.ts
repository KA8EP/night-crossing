import { Group, Sprite, SpriteMaterial } from 'three'

export class HealthBar {
  readonly model = new Group()
  private readonly fill: Sprite

  constructor(private readonly width: number, height: number, color: number) {
    const background = new Sprite(new SpriteMaterial({ color: 0x201324, depthTest: false, depthWrite: false }))
    background.scale.set(width + 0.09, 0.21, 1)
    background.renderOrder = 3
    this.fill = new Sprite(new SpriteMaterial({ color, depthTest: false, depthWrite: false }))
    this.fill.scale.set(width, 0.12, 1)
    this.fill.renderOrder = 4
    this.model.position.y = height
    this.model.add(background, this.fill)
  }

  update(fraction: number) {
    this.fill.scale.x = Math.max(0.001, this.width * fraction)
  }
}
