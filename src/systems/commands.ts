import { type Camera, type Mesh, Raycaster, Vector2, Vector3 } from 'three'
import type { Soldier } from '../entities/soldier'
import type { Link } from '../entities/district'
import type { Navigation } from './navigation'

export function bindCommands(
  canvas: HTMLCanvasElement,
  camera: Camera,
  soldiers: Soldier[],
  surfaces: Mesh[],
  blockers: Mesh[],
  box: HTMLElement,
  onSelection: (selected: readonly Soldier[]) => void,
  onOrder: (point: Vector3) => void,
  building: () => boolean,
  onBuild: (point: Vector3 | undefined) => void,
  navigation: Navigation,
  active: () => boolean,
) {
  const raycaster = new Raycaster()
  const cursor = new Vector2()
  const projected = new Vector3()
  const orders = new Map<Soldier, { destination: Vector3 }>()
  let drag: { id: number; start: Vector2 } | undefined
  let selected: Soldier[] = []
  onSelection([])

  function local(event: MouseEvent) {
    const bounds = canvas.getBoundingClientRect()
    return new Vector2(event.clientX - bounds.left, event.clientY - bounds.top)
  }

  function cast(point: Vector2) {
    cursor.set(point.x / canvas.clientWidth * 2 - 1, 1 - point.y / canvas.clientHeight * 2)
    raycaster.setFromCamera(cursor, camera)
  }

  function ground(point: Vector2) {
    cast(point)
    const hit = raycaster.intersectObjects(surfaces, false)[0]
    const wall = raycaster.intersectObjects(blockers, false)[0]
    if (!hit || (wall && wall.distance < hit.distance - 0.025)) return
    const link = hit.object.userData.link as Link | undefined
    if (!link) return hit.point
    const direction = link.to.clone().sub(link.from)
    const progress = hit.point.clone().sub(link.from).dot(direction) / direction.lengthSq()
    return link.from.clone().lerp(link.to, Math.max(0, Math.min(1, progress)))
  }

  canvas.addEventListener('pointerdown', event => {
    if (!active() || event.button !== 0 || drag) return
    drag = { id: event.pointerId, start: local(event) }
    canvas.setPointerCapture(event.pointerId)
  })

  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId || building()) return
    const end = local(event)
    const { start } = drag
    box.hidden = start.distanceTo(end) < 6
    box.style.left = Math.min(start.x, end.x) + 'px'
    box.style.top = Math.min(start.y, end.y) + 'px'
    box.style.width = Math.abs(start.x - end.x) + 'px'
    box.style.height = Math.abs(start.y - end.y) + 'px'
  })

  canvas.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId || event.button !== 0) return
    if (!active()) return clearDrag()
    const { start } = drag
    const end = local(event)
    if (building()) {
      if (start.distanceTo(end) < 6) onBuild(ground(end))
      clearDrag()
      return
    }
    if (start.distanceTo(end) < 6) {
      cast(end)
      const hitboxes = soldiers.filter(soldier => soldier.ready).map(soldier => soldier.hitbox)
      const hit = raycaster.intersectObjects(hitboxes, false)[0]
      selected = hit ? soldiers.filter(soldier => soldier.hitbox === hit.object) : []
    } else {
      const minX = Math.min(start.x, end.x)
      const maxX = Math.max(start.x, end.x)
      const minY = Math.min(start.y, end.y)
      const maxY = Math.max(start.y, end.y)
      selected = soldiers.filter(soldier => {
        if (!soldier.ready) return false
        projected.copy(soldier.model.position)
        projected.y += 0.9
        projected.project(camera)
        const x = (projected.x + 1) / 2 * canvas.clientWidth
        const y = (1 - projected.y) / 2 * canvas.clientHeight
        return x >= minX && x <= maxX && y >= minY && y <= maxY
      })
    }
    soldiers.forEach(soldier => soldier.select(selected.includes(soldier)))
    onSelection(selected)
    clearDrag()
  })

  function clearDrag() {
    drag = undefined
    box.hidden = true
  }

  canvas.addEventListener('lostpointercapture', clearDrag)
  canvas.addEventListener('contextmenu', event => event.preventDefault())
  canvas.addEventListener('pointerdown', event => {
    if (!active() || event.button !== 2 || !selected.length) return
    event.preventDefault()
    const point = ground(local(event))
    if (!point) return
    const destinations = navigation.formation(point, selected.length)
    if (!destinations.length) return

    selected.forEach((soldier, index) => {
      const destination = destinations[index]
      const path = navigation.route(soldier.model.position, destination)
      if (path.length) {
        orders.set(soldier, { destination })
        soldier.move(path)
      }
    })
    onOrder(point)
  })

  return {
    select(soldier: Soldier) {
      if (!active() || !soldier.ready) return
      selected = [soldier]
      soldiers.forEach(member => member.select(member === soldier))
      onSelection(selected)
    },
    removeFallen() {
      const living = selected.filter(soldier => soldier.ready)
      if (selected.length !== living.length) {
        selected = living
        onSelection(selected)
      }
    },
    replan() {
      for (const [soldier, { destination }] of orders) {
        if (soldier.ready && soldier.model.position.distanceToSquared(destination) > 0.01) {
          soldier.move(navigation.route(soldier.model.position, destination))
        }
      }
    },
  }
}
