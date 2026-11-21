import { BoxGeometry, Mesh, type Material, type Object3D } from 'three'

const cube = new BoxGeometry()

export function box(parent: Object3D, material: Material, size: [number, number, number], position: [number, number, number], shadow = true) {
  const mesh = new Mesh(cube, material)
  mesh.scale.set(...size)
  mesh.position.set(...position)
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
