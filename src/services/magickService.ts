import { initializeImageMagick, ImageMagick, MagickFormat, MagickGeometry, MagickReadSettings } from '@imagemagick/magick-wasm';
import wasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';

let initialized = false;

export async function initMagick() {
  if (initialized) return;
  try {
    const response = await fetch(wasmUrl);
    const wasmBytes = new Uint8Array(await response.arrayBuffer());
    await initializeImageMagick(wasmBytes);
    initialized = true;
  } catch (error) {
    console.error("Failed to initialize ImageMagick:", error);
    throw error;
  }
}

export interface ConvertOptions {
  format: MagickFormat;
  width?: number;
  height?: number;
  percentage?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  rotate?: number;
  quality?: number;
}

export async function convertImage(file: File, options: ConvertOptions): Promise<Blob> {
  await initMagick();
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Try to determine the format from the file extension
  const ext = file.name.split('.').pop()?.toUpperCase();
  let readFormat: MagickFormat | undefined;
  
  if (ext) {
    // Check if the extension matches any MagickFormat value
    const formatValues = Object.values(MagickFormat);
    if (formatValues.includes(ext as MagickFormat)) {
      readFormat = ext as MagickFormat;
    } else if (ext === 'JPG') {
      readFormat = MagickFormat.Jpeg;
    } else if (ext === 'TIF') {
      readFormat = MagickFormat.Tiff;
    }
  }

  const readSettings = new MagickReadSettings();
  if (readFormat) {
    readSettings.format = readFormat;
  }

  return ImageMagick.read(data, readSettings, async (image) => {
    // Resize
    if (options.percentage && options.percentage !== 100) {
      const newWidth = Math.max(1, Math.round(image.width * (options.percentage / 100)));
      const newHeight = Math.max(1, Math.round(image.height * (options.percentage / 100)));
      image.resize(new MagickGeometry(newWidth, newHeight));
    } else if (options.width || options.height) {
      const w = options.width || image.width;
      const h = options.height || image.height;
      image.resize(new MagickGeometry(w, h));
    }

    // Flip
    if (options.flipHorizontal) {
      image.flop();
    }
    if (options.flipVertical) {
      image.flip();
    }

    // Rotate
    if (options.rotate) {
      image.rotate(options.rotate);
    }

    // Quality
    if (options.quality !== undefined) {
      image.quality = options.quality;
    }

    // Write
    return image.write(options.format, (data) => {
      let mimeType = 'image/jpeg';
      if (options.format === MagickFormat.Png) mimeType = 'image/png';
      else if (options.format === MagickFormat.Webp) mimeType = 'image/webp';
      else if (options.format === MagickFormat.Gif) mimeType = 'image/gif';
      
      return new Blob([data], { type: mimeType });
    });
  });
}
