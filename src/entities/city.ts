import { BoxGeometry, Color, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, RingGeometry } from 'three'
import { box } from './mesh'
import { bridge, roofs, surfaces } from '../systems/navigation'

const concrete = new MeshStandardMaterial({ color: 0x435360, roughness: 0.94 })
const trim = new MeshStandardMaterial({ color: 0x738a99, roughness: 0.8 })
const steel = new MeshStandardMaterial({ color: 0x405b6e, metalness: 0.55, roughness: 0.54 })
const wall = new MeshStandardMaterial({ color: 0x253743, roughness: 0.88 })
const stripe = new MeshStandardMaterial({ color: 0x92abb1, roughness: 0.95 })
const amber = new MeshBasicMaterial({ color: 0xffb36e })
const cyan = new MeshBasicMaterial({ color: 0x73dbff })

export function createCity() {
  const model = new Group()
  const windows: { x: number; y: number; z: number; turned: boolean; color: Color }[] = []
  let seed = 2142
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const glass = [0x2a435b, 0x405973, 0xf6a666, 0xfbd2a4, 0x62afcf].map(value => new Color(value))

  function tower(x: number, z: number, width: number, depth: number, top: number, height: number, hero = false) {
    box(model, wall, [width, height, depth], [x, top - height / 2, z], hero)
    box(model, steel, [width + 0.45, 0.43, depth + 0.45], [x, top - 0.29, z], hero)
    for (let y = top - 2.1; y > top - height + 1; y -= 2.65) {
      const row = (span: number, turned: boolean, sign: number) => {
        for (let offset = -span / 2 + 1.4; offset < span / 2 - 0.7; offset += 2.05) {
          const color = glass[random() < 0.67 ? Math.floor(random() * 2) : 2 + Math.floor(random() * 3)]
          windows.push({
            x: turned ? x + sign * (width / 2 + 0.02) : x + offset,
            y,
            z: turned ? z + offset : z + sign * (depth / 2 + 0.02),
            turned,
            color,
          })
        }
      }
      row(width, false, 1)
      row(depth, true, 1)
    }
  }

  for (let ix = -5; ix <= 5; ix++) {
    for (let iz = -5; iz <= 3; iz++) {
      if (Math.abs(ix) <= 1 && Math.abs(iz) <= 1) continue
      const x = ix * 20 + (random() - 0.5) * 5
      const z = iz * 20 + (random() - 0.5) * 5
      const top = -10 - random() * 30
      tower(x, z, 8 + random() * 7, 8 + random() * 7, top, top + 58)
    }
  }
  box(model, wall, [250, 1, 220], [0, -58.5, -15], false)

  for (const roof of roofs) {
    const x = (roof.minX + roof.maxX) / 2
    const span = roof.maxX - roof.minX
    const nearX = x < 0 ? roof.maxX : roof.minX
    const farX = x < 0 ? roof.minX : roof.maxX
    tower(x, 0, span, roof.halfDepth * 2, -0.38, 57.6, true)
    box(model, concrete, [span, 0.42, roof.halfDepth * 2], [x, -0.21, 0])
    for (const sign of [-1, 1]) {
      box(model, trim, [span, 0.34, 0.2], [x, 0.16, sign * (roof.halfDepth - 0.1)])
      const length = roof.halfDepth - bridge.halfDepth
      box(model, trim, [0.2, 0.34, length], [nearX, 0.16, sign * (bridge.halfDepth + length / 2)])
      for (const dx of [-span / 2 + 0.75, span / 2 - 0.75]) {
        box(model, steel, [0.27, 0.35, 0.27], [x + dx, 0.2, sign * (roof.halfDepth - 0.12)])
        box(model, amber, [0.2, 0.08, 0.2], [x + dx, 0.41, sign * (roof.halfDepth - 0.12)], false)
      }
    }
    box(model, trim, [0.2, 0.34, roof.halfDepth * 2], [farX, 0.16, 0])
    for (let seam = roof.minX + 2; seam < roof.maxX; seam += 3.2) {
      box(model, wall, [0.025, 0.008, 17.5], [seam, 0.003, 0], false)
    }
    for (const z of [-6, -3, 3, 6]) {
      box(model, wall, [19.5, 0.008, 0.025], [x, 0.004, z], false)
    }
  }

  const span = bridge.maxX - bridge.minX
  box(model, steel, [span, 0.28, bridge.halfDepth * 2], [0, -0.14, 0])
  for (let x = bridge.minX + 0.24; x < bridge.maxX; x += 0.32) {
    box(model, trim, [0.055, 0.018, 2.95], [x, 0.008, 0], false)
  }
  for (const sign of [-1, 1]) {
    const z = sign * bridge.halfDepth
    box(model, steel, [span, 0.1, 0.11], [0, 0.65, z])
    box(model, steel, [span, 0.065, 0.075], [0, 0.34, z])
    for (const x of [-3.85, -2, 0, 2, 3.85]) {
      box(model, steel, [0.12, 0.65, 0.12], [x, 0.32, z])
      box(model, cyan, [0.12, 0.06, 0.12], [x, 0.72, z], false)
    }
  }

  const helipad = new Mesh(new RingGeometry(4.35, 4.48, 48), stripe)
  helipad.rotation.x = -Math.PI / 2
  helipad.position.set(14, 0.019, 0)
  helipad.receiveShadow = true
  model.add(helipad)
  for (const x of [12.95, 15.05]) box(model, stripe, [0.49, 0.025, 3.5], [x, 0.02, 0], false)
  box(model, stripe, [2.2, 0.025, 0.49], [14, 0.02, 0], false)
  for (const z of [-5.15, 5.15]) {
    for (const x of [9.65, 14, 18.35]) box(model, cyan, [0.24, 0.095, 0.21], [x, 0.045, z], false)
  }

  const windowMesh = new InstancedMesh(new BoxGeometry(0.95, 0.33, 0.025), new MeshBasicMaterial(), windows.length)
  const transform = new Object3D()
  windows.forEach((window, index) => {
    transform.position.set(window.x, window.y, window.z)
    transform.rotation.y = window.turned ? Math.PI / 2 : 0
    transform.updateMatrix()
    windowMesh.setMatrixAt(index, transform.matrix)
    windowMesh.setColorAt(index, window.color)
  })
  model.add(windowMesh)

  const pickSurfaces = surfaces.map(surface => {
    const plane = new Mesh(
      new PlaneGeometry(surface.maxX - surface.minX, surface.halfDepth * 2),
      new MeshBasicMaterial({ visible: false }),
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.x = (surface.minX + surface.maxX) / 2
    model.add(plane)
    return plane
  })
  return { model, pickSurfaces }
}
