import * as db from './db';
import { newId } from './id';
import type { Photo } from '../game/types';

const MAX_SIDE = 1280;
const QUALITY = 0.8;

/** Downscales a camera photo to a 1280px JPEG before storing, so IndexedDB stays small. */
export async function savePhoto(file: File, raidId: string): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Photo encode failed'))), 'image/jpeg', QUALITY),
  );
  const photo: Photo = { id: newId(), raidId, blob, w, h, takenAt: Date.now() };
  await db.put('photos', photo);
  return photo;
}

export function getPhoto(id: string) {
  return db.get('photos', id);
}
