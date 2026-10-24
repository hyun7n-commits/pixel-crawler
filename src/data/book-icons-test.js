// temporary: lists icons for the dev sheet (not shipped)
export default async function (mod) {
  const { TRINKETS } = await import('./trinkets.js');
  const { findIcon } = await import('./finds-art.js');
  if (mod === 'trinkets') return TRINKETS.map(t => [t.name, findIcon(t.shape, t.pal)]);
  return [];
}
