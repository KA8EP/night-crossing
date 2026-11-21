import { Box2, Vector2, Vector3 } from 'three'

export const extent = 35
export const ground = { id: 'street', y: 0, minX: -extent, maxX: extent, minZ: -extent, maxZ: extent }
export const roofs = [
  { id: 'nw', y: 8, minX: -30, maxX: -8, minZ: -29, maxZ: -8 },
  { id: 'ne', y: 11, minX: 8, maxX: 30, minZ: -29, maxZ: -8 },
  { id: 'sw', y: 6, minX: -30, maxX: -8, minZ: 8, maxZ: 29 },
  { id: 'se', y: 9.5, minX: 8, maxX: 30, minZ: 8, maxZ: 29 },
]
export type Surface = typeof ground
export type Obstacle = { area: Box2; y: number }
export type Link = { from: Vector3; to: Vector3; kind: 'stairs' | 'bridge' | 'zip' }

export const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
export function footprint(x: number, z: number, halfX: number, halfZ: number, y = 0): Obstacle {
  return { area: new Box2(new Vector2(x - halfX, z - halfZ), new Vector2(x + halfX, z + halfZ)), y }
}

export const stairs: Link[] = roofs.map(roof => {
  const north = roof.maxZ < 0
  const edge = north ? roof.maxZ : roof.minZ
  const x = roof.minX < 0 ? -24 : 24
  return { from: v(x, 0, edge + (north ? 6 : -6)), to: v(x, roof.y, edge), kind: 'stairs' }
})
export const bridges: Link[] = [
  { from: v(-8, roofs[0].y, -21), to: v(8, roofs[1].y, -21), kind: 'bridge' },
  { from: v(-8, roofs[2].y, 22), to: v(8, roofs[3].y, 22), kind: 'bridge' },
]
export const pads = [
  { name: 'Перекрёсток', point: v(0, 0, 0), radius: 4.2 },
  { name: 'Крыша', point: v(-19, roofs[2].y, 19), radius: 4.2 },
]
export const vehicles = [
  { x: -13, z: 3.7, angle: 0, color: 0x9c644f, burning: true },
  { x: 3.7, z: -15, angle: Math.PI / 2, color: 0x557a86, burning: false },
  { x: 4, z: 15, angle: Math.PI / 2, color: 0x315c88, police: true, burning: false },
  { x: 16, z: -3.8, angle: 0, color: 0x315c88, police: true, burning: false },
]
export const vehicleCover = vehicles.map(car => footprint(car.x, car.z, car.angle ? 1.15 : 2.05, car.angle ? 2.05 : 1.15))
export const policeBlocks = [footprint(3.9, 19, 1.65, 0.55), footprint(20, -3.8, 0.55, 1.65)]
export const buildingFootprints = roofs.map(roof => footprint(
  (roof.minX + roof.maxX) / 2, (roof.minZ + roof.maxZ) / 2,
  (roof.maxX - roof.minX) / 2, (roof.maxZ - roof.minZ) / 2,
))

export const roofEquipment = [
  { point: v(-25.6, roofs[0].y, -23.4), width: 4.8, depth: 2.8 },
  { point: v(24.4, roofs[1].y, -23.8), width: 4.6, depth: 3.2 },
  { point: v(-24.7, roofs[2].y, 13.6), width: 2.7, depth: 2.4 },
  { point: v(24.2, roofs[3].y, 24.3), width: 4.7, depth: 3.1 },
]
export const equipmentCover = roofEquipment.map(({ point, width, depth }) =>
  footprint(point.x, point.z, width * 0.5 + 0.16, depth * 0.5 + 0.16, point.y))
