import { Vector3 } from 'three'

export const roofs = [
  { minX: -24, maxX: -4, halfDepth: 9 },
  { minX: 4, maxX: 24, halfDepth: 9 },
] as const
export const bridge = { minX: -4, maxX: 4, halfDepth: 1.55 }
export const surfaces = [...roofs, bridge]

export function surfaceAt(x: number, z: number) {
  return surfaces.find(surface => x >= surface.minX && x <= surface.maxX && Math.abs(z) <= surface.halfDepth)
}

export function formation(center: Vector3, count: number) {
  const surface = surfaceAt(center.x, center.z)
  if (!surface) return []
  const onBridge = surface === bridge
  const columns = onBridge ? Math.min(count, 2) : Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / columns)
  const halfX = (columns - 1) * 0.65
  const halfZ = (rows - 1) * 0.6
  const x = Math.max(surface.minX + halfX + 0.55, Math.min(surface.maxX - halfX - 0.55, center.x))
  const z = Math.max(-surface.halfDepth + halfZ + 0.5, Math.min(surface.halfDepth - halfZ - 0.5, center.z))
  return Array.from({ length: count }, (_, index) =>
    new Vector3(x - halfX + (index % columns) * 1.3, 0, z - halfZ + Math.floor(index / columns) * 1.2))
}

export function route(start: Vector3, destination: Vector3, lane: number) {
  const from = surfaceAt(start.x, start.z)
  const to = surfaceAt(destination.x, destination.z)
  if (from === to) return [destination]

  const waypoints: Vector3[] = []
  if (from === roofs[0]) waypoints.push(new Vector3(bridge.minX, 0, lane))
  if (from === roofs[1]) waypoints.push(new Vector3(bridge.maxX, 0, lane))
  if (to === roofs[0]) waypoints.push(new Vector3(bridge.minX, 0, lane))
  if (to === roofs[1]) waypoints.push(new Vector3(bridge.maxX, 0, lane))
  return [...waypoints, destination]
}
