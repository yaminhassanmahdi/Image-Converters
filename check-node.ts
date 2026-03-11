import { initializeImageMagick, MagickFormat, Magick, ImageMagick } from '@imagemagick/magick-wasm';
import * as fs from 'fs';

async function check() {
  const wasmBytes = fs.readFileSync('./node_modules/@imagemagick/magick-wasm/dist/magick.wasm');
  await initializeImageMagick(wasmBytes);
  
  const formats = Magick.supportedFormats;
  const cr2 = formats.find(f => f.format === MagickFormat.Cr2);
  console.log("CR2 support:", cr2);
  console.log("Delegates:", Magick.delegates);
}

check();
