import { supabase } from './supabase';

// Compresse une photo avant envoi (réseau instable) : redimensionne et convertit en JPEG.
export async function compresserImage(fichier: File, maxCote = 1280, qualite = 0.8): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) throw new Error('Format non pris en charge (JPEG, PNG ou WebP).');
  if (fichier.size > 15 * 1024 * 1024) throw new Error('Image trop volumineuse (15 Mo maximum avant compression).');
  const bitmap = await createImageBitmap(fichier);
  const ratio = Math.min(1, maxCote / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', qualite));
  if (!blob) throw new Error("Impossible de traiter l'image.");
  return blob;
}

export const blobEnBase64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Lecture impossible'));
    r.readAsDataURL(b);
  });

// Envoi avec quelques nouvelles tentatives (connexion instable). Le chemin commence par l'atelier_id.
export async function televerser(bucket: string, chemin: string, blob: Blob, essais = 3): Promise<void> {
  let derniere: unknown;
  for (let i = 0; i < essais; i++) {
    const { error } = await supabase.storage.from(bucket).upload(chemin, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (!error) return;
    derniere = error;
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  throw derniere;
}
