import type { Area } from 'react-easy-crop';

const PROFILE_PHOTO_SIZE = 512;

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('The selected image could not be read.'));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('The cropped image could not be created.'));
      },
      mimeType,
      0.9,
    );
  });
}

/** Produces the square file that is persisted as a profile photo. The cropper
 * supplies source-image pixel coordinates, while the canvas normalizes every
 * successful crop to a compact avatar-sized image. */
export async function createCroppedProfilePhoto(
  source: string,
  crop: Area,
  originalFile: File,
) {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Image editing is not supported in this browser.');
  }

  canvas.width = PROFILE_PHOTO_SIZE;
  canvas.height = PROFILE_PHOTO_SIZE;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    PROFILE_PHOTO_SIZE,
    PROFILE_PHOTO_SIZE,
  );

  const mimeType =
    originalFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  const baseName =
    originalFile.name.replace(/\.[^/.]+$/, '') || 'profile-photo';
  const blob = await canvasToBlob(canvas, mimeType);

  return new File([blob], `${baseName}-cropped.${extension}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}
