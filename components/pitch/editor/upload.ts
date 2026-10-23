'use client';

export type Picked = { src: string; width: number; height: number };

const size = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1600, height: img.naturalHeight || 900 });
    img.onerror = () => reject(new Error('That image couldn’t be loaded'));
    img.src = src;
  });

// Uploads into the deck's folder and measures the image, since templates lay images out by their ratio
export async function uploadImage(deckId: string, file: File): Promise<Picked> {
  const local = URL.createObjectURL(file);
  try {
    const dims = await size(local);
    const body = new FormData();
    body.set('file', file);
    const res = await fetch(`/api/pitch/decks/${deckId}/assets`, { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? 'Upload failed');
    return { src: json.url, ...dims };
  } finally {
    URL.revokeObjectURL(local);
  }
}

export async function imageFromUrl(src: string): Promise<Picked> {
  return { src, ...(await size(src)) };
}
