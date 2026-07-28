/**
 * Genera public/favicon.ico con el diseño propio de TechGuessr (mismo
 * diseño que public/favicon.svg: fondo oscuro + "{ }" en el color de
 * acento), reemplazando el favicon.ico por defecto que trae el scaffold
 * de Angular (el escudo rojo). Sin esto, navegadores que no usan
 * <link rel="icon" type="image/svg+xml"> (o que cachean el .ico
 * agresivamente) seguían mostrando el ícono de Angular.
 *
 * Empaqueta un PNG de 32x32 dentro de un contenedor ICO mínimo: el
 * formato ICO admite datos PNG directamente en cada entrada desde
 * Windows Vista, así que no hace falta un encoder de BMP/ICO completo.
 *
 * Usa el paquete `canvas` ya presente en infra/node_modules (dependencia
 * transitiva de CDK).
 *
 * Ejecutar con: node scripts/generate-favicon-ico.js
 */
const path = require('path');
const fs = require('fs');
const { createCanvas } = require(path.join(__dirname, '..', 'infra', 'node_modules', 'canvas'));

const SIZE = 32;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Fondo con esquinas redondeadas, igual que favicon.svg.
const radius = 7;
ctx.fillStyle = '#121212';
ctx.beginPath();
ctx.moveTo(radius, 0);
ctx.arcTo(SIZE, 0, SIZE, SIZE, radius);
ctx.arcTo(SIZE, SIZE, 0, SIZE, radius);
ctx.arcTo(0, SIZE, 0, 0, radius);
ctx.arcTo(0, 0, SIZE, 0, radius);
ctx.closePath();
ctx.fill();

ctx.fillStyle = '#4f46e5';
ctx.font = 'bold 17px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'alphabetic';
ctx.fillText('{ }', SIZE / 2, 22);

const pngBuffer = canvas.toBuffer('image/png');

// Contenedor ICO mínimo: ICONDIR (6 bytes) + 1 ICONDIRENTRY (16 bytes) + datos PNG.
const headerSize = 6;
const entrySize = 16;
const offset = headerSize + entrySize;

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(1, 4); // count: 1 imagen

const entry = Buffer.alloc(entrySize);
entry.writeUInt8(SIZE, 0); // width
entry.writeUInt8(SIZE, 1); // height
entry.writeUInt8(0, 2); // color count (0 = usa PNG, no paleta)
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bit count
entry.writeUInt32LE(pngBuffer.length, 8); // tamaño de los datos de imagen
entry.writeUInt32LE(offset, 12); // offset donde empiezan los datos

const icoBuffer = Buffer.concat([header, entry, pngBuffer]);

const outputPath = path.join(__dirname, '..', 'public', 'favicon.ico');
fs.writeFileSync(outputPath, icoBuffer);
console.log(`favicon.ico generado en ${outputPath} (${icoBuffer.length} bytes)`);
