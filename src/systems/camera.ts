import { OrthographicCamera, Vector3 } from 'three'

export class TacticalCamera {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 320)
  private readonly target = new Vector3(0, 2.6, 0)
  private readonly offset = new Vector3(31, 68, 57)
  private readonly up = new Vector3(0, 1, 0)
  private readonly right = new Vector3(this.offset.z, 0, -this.offset.x).normalize()
  private readonly forward = new Vector3(-this.offset.x, 0, -this.offset.z).normalize()
  private readonly keys = new Set<string>()
  private readonly direction = new Vector3()

  constructor(canvas: HTMLCanvasElement) {
    const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']
    window.addEventListener('keydown', event => {
      if (movementKeys.includes(event.code) && !event.ctrlKey && !event.altKey && !event.metaKey) {
        this.keys.add(event.code)
        event.preventDefault()
      }
    })
    window.addEventListener('keyup', event => this.keys.delete(event.code))
    window.addEventListener('blur', () => this.keys.clear())
    canvas.addEventListener('wheel', event => {
      event.preventDefault()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1)
      this.camera.zoom = Math.max(0.65, Math.min(2.7, this.camera.zoom * Math.exp(-delta * 0.0014)))
      this.camera.updateProjectionMatrix()
    }, { passive: false })
    this.update(0)
  }

  resize(width: number, height: number) {
    const aspect = width / height
    const viewport = Math.max(62, 72 / aspect)
    this.camera.left = -viewport * aspect / 2
    this.camera.right = viewport * aspect / 2
    this.camera.top = viewport / 2
    this.camera.bottom = -viewport / 2
    this.camera.updateProjectionMatrix()
  }

  update(dt: number) {
    const rotation = Number(this.keys.has('KeyQ')) - Number(this.keys.has('KeyE'))
    if (rotation) {
      const angle = dt * rotation * 1.45
      this.offset.applyAxisAngle(this.up, angle)
      this.right.applyAxisAngle(this.up, angle)
      this.forward.applyAxisAngle(this.up, angle)
    }
    const x = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'))
    const z = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'))
    this.direction.copy(this.right).multiplyScalar(x).addScaledVector(this.forward, z).normalize()
    this.target.addScaledVector(this.direction, dt * 18 / this.camera.zoom)
    this.target.x = Math.max(-38, Math.min(38, this.target.x))
    this.target.z = Math.max(-37, Math.min(37, this.target.z))
    this.camera.position.copy(this.target).add(this.offset)
    this.camera.lookAt(this.target)
    this.camera.updateMatrixWorld()
  }
}
