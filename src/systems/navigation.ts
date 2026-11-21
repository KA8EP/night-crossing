import { Vector2, Vector3, type Box2 } from 'three'

export const roofs = [
  { minX: -24, maxX: -4, halfDepth: 9 },
  { minX: 4, maxX: 24, halfDepth: 9 },
] as const
export const bridge = { minX: -4, maxX: 4, halfDepth: 1.55 }
export const surfaces = [...roofs, bridge]
export const helipad = { x: 14, z: 0, radius: 4.35 }

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

export function route(start: Vector3, destination: Vector3, lane: number, obstacles: readonly Box2[] = []) {
  const from = surfaceAt(start.x, start.z)
  const to = surfaceAt(destination.x, destination.z)
  const waypoints: Vector3[] = []
  if (from !== to) {
    if (from === roofs[0]) waypoints.push(new Vector3(bridge.minX, 0, lane))
    if (from === roofs[1]) waypoints.push(new Vector3(bridge.maxX, 0, lane))
    if (to === roofs[0]) waypoints.push(new Vector3(bridge.minX, 0, lane))
    if (to === roofs[1]) waypoints.push(new Vector3(bridge.maxX, 0, lane))
  }
  waypoints.push(destination)
  const path: Vector3[] = []
  let current = start
  for (const waypoint of waypoints) {
    const surface = surfaceAt((current.x + waypoint.x) / 2, (current.z + waypoint.z) / 2)
    const nearby = obstacles.filter(obstacle => surfaceAt(obstacle.min.x, obstacle.min.y) === surface)
    const segment = detour(current, waypoint, nearby)
    if (!segment.length) return []
    path.push(...segment)
    current = waypoint
  }
  return path
}

function crosses(from: Vector3, to: Vector3, area: Box2) {
  let enter = 0
  let exit = 1
  for (const [origin, delta, min, max] of [
    [from.x, to.x - from.x, area.min.x, area.max.x],
    [from.z, to.z - from.z, area.min.y, area.max.y],
  ]) {
    if (Math.abs(delta) < 0.000001) {
      if (origin < min || origin > max) return false
      continue
    }
    const a = (min - origin) / delta
    const b = (max - origin) / delta
    enter = Math.max(enter, Math.min(a, b))
    exit = Math.min(exit, Math.max(a, b))
    if (enter > exit) return false
  }
  return true
}

function detour(start: Vector3, destination: Vector3, obstacles: readonly Box2[]) {
  const visible = (from: Vector3, to: Vector3) => !obstacles.some(area => crosses(from, to, area))
  if (visible(start, destination)) return [destination]
  const end = new Vector2(destination.x, destination.z)
  if (obstacles.some(area => area.containsPoint(end))) return []
  const nodes = [start, destination]
  for (const { min, max } of obstacles) {
    for (const x of [min.x - 0.05, max.x + 0.05]) {
      for (const z of [min.y - 0.05, max.y + 0.05]) nodes.push(new Vector3(x, 0, z))
    }
  }
  const distance = nodes.map(() => Infinity)
  const previous = nodes.map(() => -1)
  const remaining = new Set(nodes.keys())
  distance[0] = 0
  while (remaining.size) {
    let current = -1
    let best = Infinity
    for (const index of remaining) {
      if (distance[index] < best) {
        current = index
        best = distance[index]
      }
    }
    if (current === -1) return []
    if (current === 1) break
    remaining.delete(current)
    for (const index of remaining) {
      const next = best + nodes[current].distanceTo(nodes[index])
      if (next < distance[index] && visible(nodes[current], nodes[index])) {
        distance[index] = next
        previous[index] = current
      }
    }
  }
  const path: Vector3[] = []
  for (let index = 1; index > 0; index = previous[index]) path.unshift(nodes[index])
  return path
}
