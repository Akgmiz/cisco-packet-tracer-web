import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Function to generate a valid PNG file from raw RGBA buffer
function createPng(width, height, rgbaBuffer) {
  // 1. PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // Helper to write a chunk with CRC32
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);

    const crcBuf = Buffer.alloc(4);
    const crc = crc32(body);
    crcBuf.writeUInt32BE(crc >>> 0, 0);

    return Buffer.concat([len, body, crcBuf]);
  }

  // 2. IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // 3. Scanlines with Filter Type 0 (None)
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  let srcOffset = 0;
  let dstOffset = 0;

  for (let y = 0; y < height; y++) {
    scanlines[dstOffset++] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      scanlines[dstOffset++] = rgbaBuffer[srcOffset++]; // R
      scanlines[dstOffset++] = rgbaBuffer[srcOffset++]; // G
      scanlines[dstOffset++] = rgbaBuffer[srcOffset++]; // B
      scanlines[dstOffset++] = rgbaBuffer[srcOffset++]; // A
    }
  }

  // 4. IDAT Chunk
  const compressed = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);

  // 5. IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table & function
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Draw a stylized cyber-networking app icon on RGBA buffer
function renderIconRgba(size, isMaskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 512;

  // Background: dark navy/slate (#070a13 to #0b1329)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      
      // Rounded corner check if not maskable
      let alpha = 255;
      if (!isMaskable) {
        const cornerR = size * 0.22;
        const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerR));
        const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerR));
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > cornerR) {
          alpha = Math.max(0, Math.min(255, Math.round((cornerR + 1 - dist) * 255)));
        }
      }

      // Vertical background gradient
      const t = y / size;
      const r = Math.round(11 * (1 - t) + 4 * t);
      const g = Math.round(19 * (1 - t) + 8 * t);
      const b = Math.round(41 * (1 - t) + 18 * t);

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = alpha;
    }
  }

  // Draw lines function
  function drawLine(x1, y1, x2, y2, color, thickness) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    for (let i = 0; i <= len; i++) {
      const px = Math.round(x1 + (dx * i) / len);
      const py = Math.round(y1 + (dy * i) / len);
      drawCircle(px, py, thickness / 2, color);
    }
  }

  // Draw filled circle
  function drawCircle(centerX, centerY, radius, [r, g, b, a = 255]) {
    const rInt = Math.ceil(radius);
    for (let dy = -rInt; dy <= rInt; dy++) {
      for (let dx = -rInt; dx <= rInt; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= radius + 0.5) {
          const px = Math.round(centerX + dx);
          const py = Math.round(centerY + dy);
          if (px >= 0 && px < size && py >= 0 && py < size) {
            const idx = (py * size + px) * 4;
            const edgeAlpha = Math.min(1, radius + 0.5 - d);
            const blendA = (a / 255) * edgeAlpha;
            buf[idx] = Math.round(buf[idx] * (1 - blendA) + r * blendA);
            buf[idx + 1] = Math.round(buf[idx + 1] * (1 - blendA) + g * blendA);
            buf[idx + 2] = Math.round(buf[idx + 2] * (1 - blendA) + b * blendA);
            buf[idx + 3] = 255;
          }
        }
      }
    }
  }

  // Draw Nodes and Cables
  const topX = cx, topY = cy - 130 * scale;
  const leftX = cx - 120 * scale, leftY = cy + 115 * scale;
  const rightX = cx + 120 * scale, rightY = cy + 115 * scale;

  // Cables
  drawLine(cx, cy, topX, topY, [14, 165, 233, 200], 6 * scale);
  drawLine(cx, cy, leftX, leftY, [99, 102, 241, 200], 6 * scale);
  drawLine(cx, cy, rightX, rightY, [16, 185, 129, 200], 6 * scale);
  drawLine(leftX, leftY, rightX, rightY, [51, 65, 85, 150], 4 * scale);

  // Nodes Outer Rings and Inner Cores
  // Top Node (Router)
  drawCircle(topX, topY, 40 * scale, [15, 23, 42, 255]);
  drawCircle(topX, topY, 22 * scale, [56, 189, 248, 255]);
  drawCircle(topX, topY, 8 * scale, [255, 255, 255, 255]);

  // Left Node (PC)
  drawCircle(leftX, leftY, 36 * scale, [15, 23, 42, 255]);
  drawCircle(leftX, leftY, 20 * scale, [129, 140, 248, 255]);
  drawCircle(leftX, leftY, 7 * scale, [255, 255, 255, 255]);

  // Right Node (Server)
  drawCircle(rightX, rightY, 36 * scale, [15, 23, 42, 255]);
  drawCircle(rightX, rightY, 20 * scale, [52, 211, 153, 255]);
  drawCircle(rightX, rightY, 7 * scale, [255, 255, 255, 255]);

  // Central Core Switch Node
  drawCircle(cx, cy, 44 * scale, [15, 23, 42, 255]);
  drawCircle(cx, cy, 24 * scale, [56, 189, 248, 255]);
  drawCircle(cx, cy, 9 * scale, [255, 255, 255, 255]);

  // Traveling Packet Glow
  drawCircle(cx, cy - 65 * scale, 8 * scale, [255, 255, 255, 255]);
  drawCircle(cx - 55 * scale, cy + 50 * scale, 7 * scale, [56, 189, 248, 255]);

  return buf;
}

// Generate PNG assets in public directory
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. 192x192 PNG
const png192 = createPng(192, 192, renderIconRgba(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

// 2. 512x512 PNG
const png512 = createPng(512, 512, renderIconRgba(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

// 3. 512x512 Maskable PNG (full bleed background)
const pngMaskable512 = createPng(512, 512, renderIconRgba(512, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable512);

// 4. Apple Touch Icon 180x180
const pngApple = createPng(180, 180, renderIconRgba(180, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngApple);

// 5. Favicon 48x48
const pngFavicon = createPng(48, 48, renderIconRgba(48, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), pngFavicon);

console.log('PWA PNG and icon assets generated successfully in public/');
