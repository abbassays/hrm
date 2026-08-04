import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCroppedProfilePhoto } from './crop-image';

const originalGetContext = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  'getContext',
);
const originalToBlob = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  'toBlob',
);

const drawImage = vi.fn();

class TestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_source: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('createCroppedProfilePhoto', () => {
  beforeEach(() => {
    drawImage.mockClear();
    vi.stubGlobal('Image', TestImage);

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({
        drawImage,
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
      })),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: vi.fn((callback: BlobCallback, mimeType?: string) => {
        callback(new Blob(['cropped-photo'], { type: mimeType }));
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalGetContext) {
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        'getContext',
        originalGetContext,
      );
    }
    if (originalToBlob) {
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        'toBlob',
        originalToBlob,
      );
    }
  });

  it('renders the chosen crop into a 512px square file', async () => {
    const file = new File(['source-photo'], 'portrait.jpg', {
      type: 'image/jpeg',
    });

    const croppedFile = await createCroppedProfilePhoto(
      'blob:portrait',
      { x: 12, y: 24, width: 240, height: 240 },
      file,
    );

    expect(drawImage).toHaveBeenCalledWith(
      expect.any(TestImage),
      12,
      24,
      240,
      240,
      0,
      0,
      512,
      512,
    );
    expect(croppedFile.name).toBe('portrait-cropped.jpg');
    expect(croppedFile.type).toBe('image/jpeg');
  });

  it('preserves PNG output for transparent source images', async () => {
    const file = new File(['source-photo'], 'portrait.png', {
      type: 'image/png',
    });

    const croppedFile = await createCroppedProfilePhoto(
      'blob:portrait',
      { x: 0, y: 0, width: 320, height: 320 },
      file,
    );

    expect(croppedFile.name).toBe('portrait-cropped.png');
    expect(croppedFile.type).toBe('image/png');
  });
});
