import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const sizes = [16, 32, 48, 128];
const outputDir = "public/icons";

await mkdir(outputDir, { recursive: true });

for (const size of sizes) {
  const image = renderIcon(size);
  await writeFile(`${outputDir}/icon${size}.png`, encodePng(size, size, image));
}

function renderIcon(size) {
  const scale = 4;
  const w = size * scale;
  const h = size * scale;
  const pixels = new Uint8Array(w * h * 4);

  drawRoundedRect(pixels, w, h, 0, 0, w, h, size * scale * 0.22, [17, 17, 19, 255]);
  drawRoundedRect(pixels, w, h, w * 0.18, h * 0.24, w * 0.64, h * 0.17, size * scale * 0.03, [255, 255, 255, 255]);
  drawRoundedRect(pixels, w, h, w * 0.40, h * 0.37, w * 0.20, h * 0.40, size * scale * 0.025, [255, 255, 255, 255]);

  return downsample(pixels, w, h, scale);
}

function drawRoundedRect(pixels, w, h, x, y, width, height, radius, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(w, Math.ceil(x + width));
  const y1 = Math.min(h, Math.ceil(y + height));
  const r = Math.max(0, radius);

  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const cx = px < x + r ? x + r : px > x + width - r ? x + width - r : px;
      const cy = py < y + r ? y + r : py > y + height - r ? y + height - r : py;
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r ** 2) {
        setPixel(pixels, w, px, py, color);
      }
    }
  }
}

function setPixel(pixels, w, x, y, [r, g, b, a]) {
  const index = (y * w + x) * 4;
  pixels[index] = r;
  pixels[index + 1] = g;
  pixels[index + 2] = b;
  pixels[index + 3] = a;
}

function downsample(source, w, h, scale) {
  const outW = w / scale;
  const outH = h / scale;
  const output = new Uint8Array(outW * outH * 4);

  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const sum = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const sourceIndex = ((y * scale + sy) * w + (x * scale + sx)) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            sum[channel] += source[sourceIndex + channel];
          }
        }
      }

      const outIndex = (y * outW + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        output[outIndex + channel] = Math.round(sum[channel] / (scale * scale));
      }
    }
  }

  return output;
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(rgba.subarray(y * width * 4, (y + 1) * width * 4)).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
