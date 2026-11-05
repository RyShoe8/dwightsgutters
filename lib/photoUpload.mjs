// Runs in the browser. Shrinks a photo to a JPEG small enough for the hosting upload limit, with
// a thumbnail. Redrawing on a canvas keeps the photo upright and drops location (EXIF) data.
const readDataUrl = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
const loadImage = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
function render(image, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('encode failed')), 'image/jpeg', quality));
}
const toBase64 = async blob => (await readDataUrl(blob)).split(',')[1];
export async function preparePhoto(file) {
  let image;
  try { image = await loadImage(await readDataUrl(file)); }
  catch { throw new Error(`“${file.name}” couldn’t be read. Try a JPG or PNG photo.`); }
  let full = null;
  for (const [maxSide, quality] of [[2000, 0.85], [2000, 0.7], [1600, 0.7], [1200, 0.7]]) {
    full = await render(image, maxSide, quality);
    if (full.size <= 2400000) break;
  }
  if (full.size > 2400000) throw new Error(`“${file.name}” is too large to upload.`);
  const thumb = await render(image, 480, 0.75);
  return { image: await toBase64(full), thumb: await toBase64(thumb), name: file.name.slice(0, 200) };
}
