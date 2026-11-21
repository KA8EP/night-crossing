import {
  ACESFilmicToneMapping, Color, DirectionalLight, FogExp2, HemisphereLight,
  Mesh, MeshBasicMaterial, PCFShadowMap, RingGeometry, Scene, WebGLRenderer,
} from 'three'
import { createCity } from './entities/city'
import { pads, v } from './entities/district'
import { Soldier } from './entities/soldier'
import { Pyrokinetic } from './entities/pyrokinetic'
import { AirSupport } from './systems/air-support'
import { TacticalCamera } from './systems/camera'
import { bindCommands } from './systems/commands'
import { Construction } from './systems/construction'
import { Evacuation } from './systems/evacuation'
import { Combat, type Outcome } from './systems/combat'
import { Navigation } from './systems/navigation'
import { fire, Particles, smokeColors } from './systems/particles'
import { actionInfo, createHud, type Action } from './ui/hud'
import './ui/style.css'

const hud = createHud(document.querySelector<HTMLElement>('#game')!, soldier => commands.select(soldier))
const scene = new Scene()
const dusk = new Color(0x29364b)
scene.background = dusk
scene.fog = new FogExp2(dusk, 0.008)

const renderer = new WebGLRenderer({ antialias: false })
renderer.setPixelRatio(1)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFShadowMap
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
hud.viewport.prepend(renderer.domElement)

const camera = new TacticalCamera(renderer.domElement)
const resize = new ResizeObserver(([entry]) => {
  const width = Math.max(1, Math.round(entry.contentRect.width))
  const height = Math.max(1, Math.round(entry.contentRect.height))
  renderer.setSize(Math.max(1, Math.round(width * 0.4)), Math.max(1, Math.round(height * 0.4)), false)
  camera.resize(width, height)
})
resize.observe(hud.viewport)

scene.add(new HemisphereLight(0x9dbbff, 0x4b4962, 1.72))
const sun = new DirectionalLight(0xb8cdff, 2.5)
sun.position.set(-47, 62, -21)
sun.castShadow = true
sun.shadow.mapSize.set(1536, 1536)
Object.assign(sun.shadow.camera, { left: -52, right: 52, top: 52, bottom: -52, near: 1, far: 148 })
sun.shadow.camera.updateProjectionMatrix()
sun.shadow.normalBias = 0.04
sun.shadow.radius = 2.5
scene.add(sun)

const city = createCity()
scene.add(city.model)
const soldiers = [
  new Soldier(-24, -4.2), new Soldier(-22.4, -5.1),
  new Soldier(-20.5, -14, 'sniper', 8), new Soldier(-24, -10.1, 'engineer', 8),
]
scene.add(...soldiers.map(soldier => soldier.model))
const navigation = new Navigation()
const particles = new Particles(scene)
const construction = new Construction(scene, navigation, city.addZip)
const evacuation = new Evacuation(scene, navigation, soldiers)
const combat = new Combat(scene, soldiers, evacuation.civilians, construction, navigation, particles)
const air = new AirSupport(scene, soldiers, navigation, particles, point => combat.airImpact(point))
let outcome: Outcome | undefined
let action: Action | undefined
let noticeTime = 0
let exhaustTime = 0
let clock = 0

function setAction(next: Action | undefined, message = '') {
  action = next
  noticeTime = next ? 0 : 3.5
  hud.targeting(next, message || (next ? actionInfo[next].hint : ''))
}

for (const [key, button] of Object.entries(hud.buttons)) {
  button.addEventListener('click', () => {
    if (outcome) return
    setAction(action === key ? undefined : key as Action)
  })
}
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && action) setAction(undefined)
})

const markerMaterial = new MeshBasicMaterial({ color: 0x9dfbdc, transparent: true, depthWrite: false })
const marker = new Mesh(new RingGeometry(0.46, 0.58, 20), markerMaterial)
marker.rotation.x = -Math.PI / 2
marker.visible = false
scene.add(marker)
let markerTime = 0

function execute(point: ReturnType<typeof v> | undefined) {
  if (!action) return
  let error: string | undefined
  let message: string
  if (action === 'barricade' || action === 'turret' || action === 'zip') {
    const units = [
      ...soldiers.filter(soldier => soldier.ready).map(soldier => soldier.model.position),
      ...evacuation.civilians.filter(civilian => civilian.available).map(civilian => civilian.model.position),
      combat.boss.model.position,
    ]
    error = construction.place(action, point, soldiers, units)
    message = action === 'zip' ? 'Зиплайн готов · Бойцы и гражданские используют его при спуске' : 'Строительство началось'
    if (!error && action === 'zip') commands.replan()
  } else if (action === 'evac') {
    error = evacuation.call(point)
    message = 'Вертолёт направляется к площадке «' + evacuation.status.pad + '»'
  } else if (action === 'strike') {
    error = air.attack(point)
    message = 'Боевой вертолёт заходит на цель'
  } else {
    error = air.reinforce(point, action)
    message = 'Транспортный вертолёт в пути'
  }
  if (error) hud.targeting(action, error)
  else setAction(undefined, message)
}

const commands = bindCommands(renderer.domElement, camera.camera, soldiers, city.pickSurfaces, city.blockers, hud.selectionBox, hud.selected, point => {
  marker.position.copy(point).y += 0.065
  marker.visible = true
  markerTime = 0.65
}, () => Boolean(action), execute, navigation, () => !outcome)

let previousTime = performance.now()
renderer.setAnimationLoop(time => {
  const dt = Math.max(0, Math.min((time - previousTime) / 1000, 0.05))
  previousTime = time
  clock += dt
  camera.update(dt)
  city.update(clock)
  exhaustTime -= dt
  if (exhaustTime <= 0) {
    exhaustTime = 0.16
    for (const point of city.smoke) {
      particles.burst(point, smokeColors, 5, 0.82, 1.65, 2.2, 0.44)
      particles.burst(point, fire, 4, 0.9, 2, 0.53, 0.29, 3)
    }
    for (const pad of pads) {
      const source = pad.point.clone().add(v(3.42, 0.1, 0))
      particles.burst(source, [0x83eca2, 0x57a475, 0x417e65], 4, 0.87, 1.85, 2.45, 0.43)
    }
  }
  if (!outcome) {
    air.update(dt)
    if (construction.update(dt)) commands.replan()
    soldiers.forEach(soldier => soldier.update(dt))
    if (combat.update(dt)) commands.replan()
    commands.removeFallen()
    evacuation.update(dt, combat.boss.model.position)
    const status = evacuation.status
    outcome = combat.outcome(status.saved, status.total, air.pending)
    if (outcome) {
      setAction(undefined)
      hud.finish(outcome, status.saved)
    }
  } else {
    evacuation.update(dt, undefined, false)
    air.update(dt)
  }
  hud.update(soldiers, combat.boss.health / Pyrokinetic.maxHealth * 100, combat.wavesLeft, evacuation.status, air.status)
  if (noticeTime > 0) {
    noticeTime -= dt
    if (noticeTime <= 0) hud.targeting(undefined)
  }
  if (marker.visible) {
    markerTime -= dt
    marker.visible = markerTime > 0
    marker.scale.setScalar(1 + (0.65 - markerTime) * 1.2)
    markerMaterial.opacity = Math.max(0, markerTime / 0.65)
  }
  particles.update(dt)
  renderer.render(scene, camera.camera)
})
