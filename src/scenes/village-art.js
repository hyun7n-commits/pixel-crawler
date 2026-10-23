// The village's pictures (src/art/village.js) as textures: cottages drawn to their footprint, the dirt
// paths between them, the firefly posts, the trees round the edge and the lot for your house.

import { houseArt, pathArt, postArt, lotArt, treeArt } from '../art/village.js';

export const houseCanvas = houseArt;
export const lampPostCanvas = postArt;
export const lotCanvas = lotArt;

// `mask`: the neighbours that are not path (all 8 bits)
export function pathKey(scene, mask, v = 0) {
  const key = `village_path_${mask}_${v}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, pathArt(mask, v));
  return key;
}
export function treeKey(scene, v) {
  const key = `village_tree_${v}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, treeArt(v));
  return key;
}
