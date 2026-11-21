import { type Box2, type Camera, type Mesh, Raycaster, Vector2, Vector3 } from 'three'
import type { Soldier } from '../entities/soldier'
import { formation, route } from './navigation'

export function bindCommands(
  canvas: HTMLCanvasElement,
  camera: Camera,
  soldiers: Soldier[],
  surfaces: Mesh[],
  box: HTMLElement,
  onSelection: (count: number) => void,
  onOrder: (point: Vector3) => void,
  building: () => boolean,
  onBuild: (point: Vector3 | undefined) => void,
  obstacles: () => readonly Box2[],
  active: () => boolean,
) {
  const raycaster = new Raycaster()
  const cursor = new Vector2()
  const projected = new Vector3()
  const orders = new Map<Soldier, { destination: Vector3; lane: number }>()
  let drag: { id: number; start: Vector2 } | undefined
  let selected: Soldier[] = []
  onSelection(0)

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
    return raycaster.intersectObjects(surfaces, false)[0]?.point
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
      const hitboxes = soldiers.filter(soldier => soldier.alive).map(soldier => soldier.hitbox)
      const hit = raycaster.intersectObjects(hitboxes, false)[0]
      selected = hit ? soldiers.filter(soldier => soldier.hitbox === hit.object) : []
    } else {
      const minX = Math.min(start.x, end.x)
      const maxX = Math.max(start.x, end.x)
      const minY = Math.min(start.y, end.y)
      const maxY = Math.max(start.y, end.y)
      selected = soldiers.filter(soldier => {
        if (!soldier.alive) return false
        projected.copy(soldier.model.position)
        projected.y += 0.9
        projected.project(camera)
        const x = (projected.x + 1) / 2 * canvas.clientWidth
        const y = (1 - projected.y) / 2 * canvas.clientHeight
        return x >= minX && x <= maxX && y >= minY && y <= maxY
      })
    }
    soldiers.forEach(soldier => soldier.select(selected.includes(soldier)))
    onSelection(selected.length)
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
    const destinations = formation(point, selected.length)
    if (!destinations.length) return
    const blocked = obstacles()
    selected.forEach((soldier, index) => {
      const lane = (index - (selected.length - 1) / 2) * 0.56
      const destination = destinations[index]
      const path = route(soldier.model.position, destination, lane, blocked)
      if (path.length) {
        orders.set(soldier, { destination, lane })
        soldier.move(path)
      }
    })
    onOrder(point)
  })

  return {
    removeFallen() {
      const living = selected.filter(soldier => soldier.alive)
      if (selected.length !== living.length) {
        selected = living
        onSelection(selected.length)
      }
    },
    replan() {
      const blocked = obstacles()
      for (const [soldier, { destination, lane }] of orders) {
        if (soldier.alive && soldier.model.position.distanceToSquared(destination) > 0.01) {
          soldier.move(route(soldier.model.position, destination, lane, blocked))
        }
      }
    },
  }
}
