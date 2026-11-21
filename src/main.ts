import {
  ACESFilmicToneMapping, Color, DirectionalLight, FogExp2, HemisphereLight,
  Mesh, MeshBasicMaterial, PCFShadowMap, RingGeometry, Scene, WebGLRenderer,
} from 'three'
import { createCity } from './entities/city'
import { Soldier } from './entities/soldier'
import { TacticalCamera } from './systems/camera'
import { bindCommands } from './systems/commands'
import { createHud } from './ui/hud'
import './ui/style.css'

const hud = createHud(document.querySelector<HTMLElement>('#game')!)
const scene = new Scene()
scene.background = new Color(0x222c46)
scene.fog = new FogExp2(0x252e48, 0.009)

const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFShadowMap
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
hud.viewport.prepend(renderer.domElement)

const camera = new TacticalCamera(renderer.domElement)
const resize = new ResizeObserver(([entry]) => {
  const width = Math.max(1, Math.round(entry.contentRect.width))
  const height = Math.max(1, Math.round(entry.contentRect.height))
  renderer.setSize(width, height, false)
  camera.resize(width, height)
})
resize.observe(hud.viewport)

scene.add(new HemisphereLight(0x9cc6ff, 0x364963, 1.65))
const sun = new DirectionalLight(0xffc09a, 2.1)
sun.position.set(-26, 34, -17)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
Object.assign(sun.shadow.camera, { left: -37, right: 37, top: 34, bottom: -33, near: 1, far: 95 })
sun.shadow.camera.updateProjectionMatrix()
sun.shadow.normalBias = 0.035
sun.shadow.radius = 3
scene.add(sun)

const city = createCity()
scene.add(city.model)
const soldiers = [
  new Soldier(-16, -1.9), new Soldier(-13.6, -1.9),
  new Soldier(-16, 0.6), new Soldier(-13.6, 0.6),
]
scene.add(...soldiers.map(soldier => soldier.model))

const markerMaterial = new MeshBasicMaterial({ color: 0x82ffff, transparent: true, depthWrite: false })
const marker = new Mesh(new RingGeometry(0.48, 0.55, 34), markerMaterial)
marker.rotation.x = -Math.PI / 2
marker.visible = false
scene.add(marker)
let markerTime = 0
bindCommands(renderer.domElement, camera.camera, soldiers, city.pickSurfaces, hud.selectionBox, hud.selected, point => {
  marker.position.copy(point)
  marker.position.y = 0.075
  marker.visible = true
  markerTime = 0.85
})

let previousTime = performance.now()
let objectiveComplete = false
renderer.setAnimationLoop(time => {
  const dt = Math.max(0, Math.min((time - previousTime) / 1000, 0.05))
  previousTime = time
  camera.update(dt)
  soldiers.forEach(soldier => soldier.update(dt))
  if (!objectiveComplete && soldiers.every(({ model: { position } }) => Math.hypot(position.x - 14, position.z) < 4.35)) {
    objectiveComplete = true
    hud.arrived()
  }
  if (marker.visible) {
    markerTime -= dt
    marker.visible = markerTime > 0
    marker.scale.setScalar(1 + (0.85 - markerTime) * 1.25)
    markerMaterial.opacity = Math.max(0, markerTime / 0.85)
  }
  renderer.render(scene, camera.camera)
})
