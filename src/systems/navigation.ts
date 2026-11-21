import { Box3, Ray, Vector2, Vector3, type Box2 } from 'three'
import { bridges, buildingFootprints, equipmentCover, ground, policeBlocks, roofs, stairs, v, vehicleCover, type Link, type Obstacle } from '../entities/district'

const clearance = 0.36
const permanent = [...buildingFootprints, ...vehicleCover, ...policeBlocks, ...equipmentCover]
const walls = roofs.map(roof => new Box3(v(roof.minX, 0, roof.minZ), v(roof.maxX, roof.y, roof.maxZ)))
type Node = { point: Vector3; layer?: string }
export type Travel = Vector3 & { speed?: number }
const projected = new Vector3()

export function surfaceAt(point: Vector3) {
  return [...roofs, ground].find(surface => Math.abs(point.y - surface.y) < 0.08 &&
    point.x >= surface.minX - 0.001 && point.x <= surface.maxX + 0.001 &&
    point.z >= surface.minZ - 0.001 && point.z <= surface.maxZ + 0.001)
}

export function lineOfSight(from: Vector3, to: Vector3) {
  const delta = to.clone().sub(from)
  const distance = delta.length()
  const ray = new Ray(from, delta.normalize())
  return !walls.some(wall => ray.intersectBox(wall, projected) && projected.distanceTo(from) < distance - 0.05)
}

export class Navigation {
  readonly links = [...stairs, ...bridges]
  obstacles: readonly Obstacle[] = []

  addZip(link: Link) {
    this.links.push(link)
  }

  walkable(point: Vector3) {
    return Boolean(surfaceAt(point)) && ![...permanent, ...this.obstacles].some(({ area, y }) =>
      Math.abs(y - point.y) < 0.08 && area.containsPoint(new Vector2(point.x, point.z)))
  }

  occupied(area: Box2, y: number) {
    return [...permanent, ...this.obstacles].some(obstacle => Math.abs(obstacle.y - y) < 0.08 && obstacle.area.intersectsBox(area))
  }

  formation(center: Vector3, count: number) {
    const surface = surfaceAt(center)
    if (!surface) return Array.from({ length: count }, () => center.clone())
    const candidates: Vector3[] = []
    for (let ring = 0; ring <= 4 && candidates.length < count; ring++) {
      for (let x = -ring; x <= ring; x++) {
        for (let z = -ring; z <= ring; z++) {
          if (Math.max(Math.abs(x), Math.abs(z)) !== ring) continue
          const candidate = v(center.x + x * 1.3, center.y, center.z + z * 1.3)
          if (surfaceAt(candidate) === surface && this.walkable(candidate)) candidates.push(candidate)
        }
      }
    }
    return Array.from({ length: count }, (_, i) => candidates[i] ?? center.clone())
  }

  route(start: Vector3, end: Vector3): Travel[] {
    const from = surfaceAt(start)
    const to = surfaceAt(end)
    const fromLink = from ? undefined : this.onLink(start)
    const toLink = to ? undefined : this.onLink(end)
    if ((!from && !fromLink) || (!to && !toLink)) return []

    const obstacles = [...permanent, ...this.obstacles].map(({ area, y }) => ({ area: area.clone().expandByScalar(clearance), y }))
    const nodes: Node[] = [{ point: start, layer: from?.id }, { point: end, layer: to?.id }]
    const connections = this.links.map(link => {
      const a = nodes.length
      nodes.push({ point: link.from, layer: surfaceAt(link.from)?.id }, { point: link.to, layer: surfaceAt(link.to)?.id })
      return { link, a, b: a + 1 }
    })

    for (const { area, y } of obstacles) {
      for (const x of [area.min.x - 0.06, area.max.x + 0.06]) {
        for (const z of [area.min.y - 0.06, area.max.y + 0.06]) {
          const point = v(x, y, z)
          const layer = surfaceAt(point)?.id
          if (layer) nodes.push({ point, layer })
        }
      }
    }

    const blocked = (a: Vector3, b: Vector3) => obstacles.some(({ area, y }) =>
      Math.abs(a.y - y) < 0.08 && crosses(a, b, area) &&
      !(a === start && area.containsPoint(new Vector2(a.x, a.z))) &&
      !(b === end && area.containsPoint(new Vector2(b.x, b.z)) && this.walkable(b)))
    if (from && from === to && !blocked(start, end)) return [end.clone()]

    const progress = (point: Vector3, link: Link) => point.distanceToSquared(link.from)
    const speed = (i: number, j: number) => {
      const a = nodes[i]
      const b = nodes[j]
      for (const { link, a: first, b: last } of connections) {
        const onA = i === first || i === last || (i === 0 && link === fromLink)
        const onB = j === first || j === last || (j === 1 && link === toLink)
        if (!onA || !onB) continue
        if (link.kind !== 'zip') return link.kind === 'stairs' ? 3.3 : 5
        if (progress(a.point, link) <= progress(b.point, link)) return 13
      }
      return a.layer && a.layer === b.layer && !blocked(a.point, b.point) ? 5 : 0
    }

    const distance = nodes.map(() => Infinity)
    const previous = nodes.map(() => -1)
    const speeds = nodes.map(() => 0)
    const unvisited = new Set(nodes.keys())
    distance[0] = 0
    while (unvisited.size) {
      let current = -1
      let best = Infinity
      for (const i of unvisited) {
        if (distance[i] >= best) continue
        current = i
        best = distance[i]
      }
      if (current < 0) return []
      if (current === 1) break
      unvisited.delete(current)
      for (const i of unvisited) {
        const pace = speed(current, i)
        if (!pace) continue
        const score = best + nodes[current].point.distanceTo(nodes[i].point) / pace
        if (score >= distance[i]) continue
        distance[i] = score
        previous[i] = current
        speeds[i] = pace
      }
    }
    const path: Travel[] = []
    for (let i = 1; i > 0; i = previous[i]) {
      const step: Travel = nodes[i].point.clone()
      step.speed = speeds[i]
      path.unshift(step)
    }
    return path
  }

  private onLink(point: Vector3) {
    return this.links.find(({ from, to }) => {
      const along = to.clone().sub(from)
      const t = point.clone().sub(from).dot(along) / along.lengthSq()
      return t >= -0.01 && t <= 1.01 && projected.copy(from).addScaledVector(along, t).distanceToSquared(point) < 0.08
    })
  }
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
