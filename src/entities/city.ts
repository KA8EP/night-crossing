import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, PointLight, RingGeometry, Vector2, Vector3 } from 'three'
import { bridges, extent, pads, policeBlocks, roofEquipment, roofs, stairs, vehicles, type Link } from './district'
import { box } from './mesh'

const stone = new MeshStandardMaterial({ color: 0x485267, roughness: 1 })
const asphalt = new MeshStandardMaterial({ color: 0x282f40, roughness: 1 })
const concrete = new MeshStandardMaterial({ color: 0x666c76, roughness: 1 })
const steel = new MeshStandardMaterial({ color: 0x343b4e, metalness: 0.35, roughness: 0.73 })
const trim = new MeshStandardMaterial({ color: 0x536178, roughness: 0.95 })
const paint = new MeshStandardMaterial({ color: 0xb9aa80, roughness: 1 })
const glass = new MeshStandardMaterial({ color: 0x252f41, roughness: 0.55 })
const warm = new MeshBasicMaterial({ color: 0xffc386 })
const green = new MeshBasicMaterial({ color: 0x74f6af })
const markings = new MeshBasicMaterial({ color: 0xd2dacd })
const rubber = new MeshStandardMaterial({ color: 0x151c29 })
const amber = new MeshBasicMaterial({ color: 0xffc164, transparent: true, opacity: 0.095, depthWrite: false })

export function beam(parent: Group, material: MeshStandardMaterial | MeshBasicMaterial, from: Vector3, to: Vector3, width: number, thickness = width, shadow = false) {
  const mesh = box(parent, material, [width, thickness, from.distanceTo(to)], [0, 0, 0], shadow)
  mesh.position.copy(from).lerp(to, 0.5)
  mesh.lookAt(to)
  return mesh
}

export function createCity() {
  const model = new Group()
  const pickSurfaces: Mesh[] = []
  const blockers: Mesh[] = []
  const flashers: { red: MeshBasicMaterial; blue: MeshBasicMaterial; light: PointLight }[] = []
  const windows: { x: number; y: number; z: number; side: boolean; color: number }[] = []
  const smoke: Vector3[] = []

  box(model, asphalt, [190, 0.55, 190], [0, -0.81, 0], false)
  pickSurfaces.push(box(model, asphalt, [extent * 2, 0.8, extent * 2], [0, -0.4, 0]))
  for (const [i, roof] of roofs.entries()) {
    const x = (roof.minX + roof.maxX) / 2
    const z = (roof.minZ + roof.maxZ) / 2
    const w = roof.maxX - roof.minX
    const d = roof.maxZ - roof.minZ
    box(model, concrete, [w + 2.8, 0.16, d + 2.8], [x, 0, z])
    const facade = new MeshStandardMaterial({ color: [0x475372, 0x526071, 0x535c68, 0x414f66][i], roughness: 0.93 })
    blockers.push(box(model, facade, [w, roof.y - 0.18, d], [x, (roof.y - 0.18) / 2, z]))
    pickSurfaces.push(box(model, stone, [w, 0.18, d], [x, roof.y - 0.09, z]))
    for (const side of [-1, 1]) {
      for (const level of [roof.y - 0.4, 0.35]) {
        box(model, trim, [w + 0.12, 0.26, 0.22], [x, level, z + d / 2 * side])
        box(model, trim, [0.22, 0.26, d + 0.12], [x + w / 2 * side, level, z])
      }
      for (let row = 1; row < roof.y - 0.6; row += 2.05) {
        for (let col = 0; col < 8; col++) {
          const offset = (col - 3.5) * 2.38
          const palette = [0x334458, 0x3d5064, 0xce8454, 0xffc082, 0x485a6e]
          const color = palette[(col * 7 + Math.floor(row) * 3 + i + side + 5) % palette.length]
          windows.push({ x: x + offset, y: row, z: z + side * (d / 2 + 0.045), side: false, color })
          windows.push({ x: x + side * (w / 2 + 0.045), y: row, z: z + offset, side: true, color: palette[(col + i + Math.floor(row) * 2) % palette.length] })
        }
      }
    }

    for (const direction of [-1, 1]) {
      for (let t = -8; t <= 8; t += 4) {
        box(model, trim, [0.035, 0.012, 4], [x + t, roof.y + 0.009, z + direction * 6], false)
        box(model, trim, [4, 0.012, 0.035], [x + direction * 6, roof.y + 0.009, z + t], false)
      }
    }
    const light = new PointLight(0xffae64, 25, 9)
    light.position.set(x, roof.y - 0.6, roof.maxZ < 0 ? roof.maxZ + 1.2 : roof.minZ - 1.2)
    model.add(light)
  }

  // Leave the four road approaches open and fill in the surrounding skyline.
  for (const x of [-63, -44, -24, 24, 44, 63]) {
    for (const z of [-64, -43, -23, 23, 43, 64]) {
      if (Math.abs(x) < 36 && Math.abs(z) < 36) continue
      const variation = Math.abs((x * 59 + z * 23) % 13)
      const height = 4 + variation * 0.77
      const w = 12 + variation * 0.36
      const d = 12 + (12 - variation) * 0.33
      const mass = box(model, variation % 3 ? stone : steel, [w, height, d], [x, height / 2 - 0.53, z], false)
      mass.receiveShadow = false
      for (let row = 1.8; row < height - 1; row += 2.65) {
        for (const side of [-1, 1]) {
          for (const column of [-2, -1, 0, 1, 2]) {
            const color = (variation + Math.floor(row) + column * 3) % 6 === 0 ? 0xca9169 : 0x39475f
            windows.push({ x: x + column * 2.05, y: row, z: z + side * (d / 2 + 0.05), side: false, color })
            windows.push({ x: x + side * (w / 2 + 0.05), y: row, z: z + column * 2.05, side: true, color })
          }
        }
      }
    }
  }

  for (const [i, { point, width, depth }] of roofEquipment.entries()) {
    const { x, y, z } = point
    box(model, steel, [width + 0.24, 0.24, depth + 0.24], [x, y + 0.12, z])
    box(model, trim, [width, 1.11, depth], [x, y + 0.69, z])
    box(model, concrete, [width + 0.18, 0.15, depth + 0.18], [x, y + 1.32, z])
    for (let vent = -2; vent <= 2; vent++) {
      box(model, steel, [0.13, 0.47, 0.055], [x + vent * 0.39, y + 0.72, z + depth / 2 + 0.02], false)
    }
    box(model, paint, [width * 0.5, 0.07, 0.19], [x, y + 0.36, z + depth / 2 + 0.027], false)
    if (i === 1 || i === 3) {
      box(model, steel, [0.14, 1.45, 0.14], [x + 1.2, y + 2.0, z])
      box(model, warm, [0.19, 0.19, 0.19], [x + 1.2, y + 2.7, z], false)
    }
  }

  const windowMesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), windows.length)
  const matrix = new Matrix4()
  windows.forEach(({ x, y, z, side, color }, i) => {
    windowMesh.setMatrixAt(i, matrix.makeScale(side ? 0.095 : 1.24, 0.93, side ? 1.24 : 0.095).setPosition(x, y, z))
    windowMesh.setColorAt(i, new Color(color))
  })
  model.add(windowMesh)

  for (const link of [...stairs, ...bridges]) {
    const { from, to, kind } = link
    const width = kind === 'stairs' ? 1.85 : 2.35
    const a = from.clone().add(new Vector3(0, -0.13, 0))
    const b = to.clone().add(new Vector3(0, -0.13, 0))
    const walkway = beam(model, steel, a, b, width, 0.23, true)
    const picker = new Mesh(new PlaneGeometry(width, from.distanceTo(to)), new MeshBasicMaterial({ visible: false }))
    picker.position.copy(from).lerp(to, 0.5)
    picker.quaternion.copy(walkway.quaternion)
    picker.rotateX(-Math.PI / 2)
    picker.userData.link = link
    model.add(picker)
    pickSurfaces.push(picker)
    const sideways = new Vector3(to.z - from.z, 0, from.x - to.x).normalize()
    const count = kind === 'stairs' ? 16 : 12
    for (let i = 0; i <= count; i++) {
      const p = from.clone().lerp(to, i / count)
      const size: [number, number, number] = kind === 'stairs' ? [width, 0.09, 0.37] : [0.15, 0.06, width]
      box(model, trim, size, [p.x, p.y + 0.015, p.z], false)
      if (i % 4) continue
      for (const side of [-1, 1]) {
        const edge = p.clone().addScaledVector(sideways, side * width / 2)
        box(model, trim, [0.085, 1.02, 0.085], [edge.x, edge.y + 0.5, edge.z], false)
      }
    }
    for (const side of [-1, 1]) {
      const shift = sideways.clone().multiplyScalar(side * width / 2)
      shift.y = 0.99
      beam(model, trim, from.clone().add(shift), to.clone().add(shift), 0.095)
    }
  }

  for (const axis of [0, 1]) {
    for (const sign of [-1, 1]) {
      for (let i = 12; i < extent; i += 5) {
        const x = axis ? i * sign : 0
        const z = axis ? 0 : i * sign
        box(model, paint, axis ? [2.3, 0.018, 0.13] : [0.13, 0.018, 2.3], [x, 0.014, z], false)
      }
      for (let i = -3; i <= 3; i++) {
        box(model, markings, axis ? [1.8, 0.016, 0.38] : [0.38, 0.016, 1.8],
          [axis ? sign * 7.5 : i * 0.84, 0.018, axis ? i * 0.84 : sign * 7.5], false)
      }
      if (axis === 1) continue
      for (const gap of [-1, 1]) {
        const x = axis ? 7 * sign : 7 * gap
        const z = axis ? 16 * gap : 16 * sign
        box(model, steel, [0.18, 4.1, 0.18], [x, 2.05, z])
        box(model, steel, [0.9, 0.16, 0.25], [x - 0.34 * Math.sign(x), 4.05, z])
        box(model, warm, [0.46, 0.12, 0.32], [x - 0.7 * Math.sign(x), 3.94, z], false)
        const light = new PointLight(0xffad65, 46, 10, 1.9)
        light.position.set(x - 0.7 * Math.sign(x), 3.8, z)
        model.add(light)
        const pool = new Mesh(new RingGeometry(0, 2.4, 12), amber)
        pool.rotation.x = -Math.PI / 2
        pool.position.set(light.position.x, 0.024, z)
        model.add(pool)
      }
    }
  }

  for (const vehicle of vehicles) {
    const car = new Group()
    car.position.set(vehicle.x, 0, vehicle.z)
    car.rotation.y = vehicle.angle
    model.add(car)
    const body = new MeshStandardMaterial({ color: vehicle.color, roughness: 0.74 })
    box(car, body, [3.75, 0.55, 1.7], [0, 0.55, 0])
    box(car, glass, [1.75, 0.52, 1.47], [-0.19, 1.04, 0])
    box(car, body, [1.48, 0.13, 1.44], [-0.24, 1.34, 0])
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) box(car, rubber, [0.62, 0.55, 0.31], [1.08 * end, 0.29, side * 0.79])
      box(car, warm, [0.055, 0.15, 0.37], [1.9, 0.63, side * 0.53], false)
    }
    if (vehicle.burning) smoke.push(new Vector3(vehicle.x + 1, 0.96, vehicle.z))
    if (vehicle.police) {
      box(car, markings, [1.3, 0.28, 1.73], [0, 0.57, 0])
      addFlasher(car, flashers, 1.48)
    }
  }

  for (const { area } of policeBlocks) {
    const center = area.getCenter(new Vector2())
    const block = new Group()
    block.position.set(center.x, 0, center.y)
    if (area.max.y - area.min.y > area.max.x - area.min.x) block.rotation.y = Math.PI / 2
    model.add(block)
    box(block, concrete, [3.1, 0.66, 0.66], [0, 0.36, 0])
    for (const x of [-1.05, 0, 1.05]) box(block, paint, [0.31, 0.69, 0.675], [x, 0.365, 0], false)
    addFlasher(block, flashers, 0.82)
  }

  for (const { point } of pads) {
    const ring = new Mesh(new RingGeometry(3.47, 3.62, 20), green)
    ring.position.copy(point).y += 0.039
    ring.rotation.x = -Math.PI / 2
    model.add(ring)
    for (const x of [-0.83, 0.83]) box(model, markings, [0.29, 0.018, 2.82], [point.x + x, point.y + 0.04, point.z], false)
    box(model, markings, [1.66, 0.018, 0.29], [point.x, point.y + 0.04, point.z], false)
    for (const side of [-1, 1]) box(model, green, [0.25, 0.08, 0.25], [point.x + side * 3.57, point.y + 0.05, point.z], false)
  }

  return {
    model, pickSurfaces, blockers, smoke,
    addZip({ from, to }: Link) {
      const offset = new Vector3(0, 1.75, 0)
      beam(model, green, from.clone().add(offset), to.clone().add(offset), 0.065)
      for (const anchor of [from, to]) box(model, steel, [0.18, 1.75, 0.18], [anchor.x, anchor.y + 0.875, anchor.z])
    },
    update(time: number) {
      for (const [index, { red, blue, light }] of flashers.entries()) {
        const a = (Math.floor(time * 8 + index) % 4) < 2
        red.color.setHex(a ? 0xff455b : 0x632935)
        blue.color.setHex(a ? 0x203a6b : 0x4898ff)
        light.color.copy(a ? red.color : blue.color)
        light.intensity = Math.floor(time * 16) % 4 === 3 ? 5 : 25
      }
    },
  }
}

function addFlasher(parent: Group, flashers: { red: MeshBasicMaterial; blue: MeshBasicMaterial; light: PointLight }[], y: number) {
  const red = new MeshBasicMaterial()
  const blue = new MeshBasicMaterial()
  box(parent, red, [0.27, 0.14, 0.22], [0, y, -0.29], false)
  box(parent, blue, [0.27, 0.14, 0.22], [0, y, 0.29], false)
  const light = new PointLight(0xff3555, 25, 8)
  light.position.y = y + 0.22
  parent.add(light)
  flashers.push({ red, blue, light })
}
