import { initializeImageMagick, MagickFormatInfo, MagickFormat, ImageMagick } from '@imagemagick/magick-wasm';
import wasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';

async function check() {
  const response = await fetch(wasmUrl);
  const wasmBytes = new Uint8Array(await response.arrayBuffer());
  await initializeImageMagick(wasmBytes);
  
  const formats = MagickFormatInfo.supportedFormats;
  const cr2 = formats.find(f => f.format === MagickFormat.Cr2);
  console.log("CR2 support:", cr2);
  console.log("Delegates:", ImageMagick.delegates);
}

check();
