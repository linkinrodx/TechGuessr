/**
 * Genera public/assets/og-image.png (1200x630, tamaño estándar de Open
 * Graph) con un diseño propio: fondo oscuro tipo "editor de código" +
 * logo + tagline. No es una captura de pantalla del juego (evita
 * depender de datos reales de dataset/UI para la preview social) sino un
 * banner de marca dibujado a mano con Canvas.
 *
 * Usa el paquete `canvas` ya presente en infra/node_modules (dependencia
 * transitiva de CDK) en vez de agregar una dependencia nueva al frontend
 * solo para este script puntual.
 *
 * Ejecutar con: node scripts/generate-og-image.js
 */
const path = require('path');
const fs = require('fs');
const { createCanvas } = require(path.join(__dirname, '..', 'infra', 'node_modules', 'canvas'));

const W = 1200;
const H = 630;

const COLORS = {
  background: '#121212',
  surface: '#1e1e1e',
  accent: '#4f46e5',
  textPrimary: '#f5f5f5',
  textSecondary: '#888888',
  success: '#22c55e',
  borderSubtle: '#444444',
};

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Fondo con degradado sutil, igual estilo que AnimatedBackground del frontend.
const gradient = ctx.createLinearGradient(0, 0, W, H);
gradient.addColorStop(0, '#1a1530');
gradient.addColorStop(0.5, COLORS.background);
gradient.addColorStop(1, '#0f1f18');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, W, H);

// Manchas de "aurora" translúcidas, más sutiles que en el frontend
// (rendering estático, sin blur real disponible en canvas sin filtros).
function blob(x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color + alpha);
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
blob(220, 120, 420, '#4f46e5', '55');
blob(1000, 500, 420, '#22c55e', '33');

// Grid tenue tipo editor de código.
ctx.strokeStyle = 'rgba(68, 68, 68, 0.25)';
ctx.lineWidth = 1;
for (let x = 0; x <= W; x += 48) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, H);
  ctx.stroke();
}
for (let y = 0; y <= H; y += 48) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}

// Tarjeta central tipo "code editor window".
const cardX = 120;
const cardY = 150;
const cardW = W - 240;
const cardH = 330;
const radius = 16;

ctx.fillStyle = COLORS.surface;
ctx.beginPath();
ctx.moveTo(cardX + radius, cardY);
ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardH, radius);
ctx.arcTo(cardX + cardW, cardY + cardH, cardX, cardY + cardH, radius);
ctx.arcTo(cardX, cardY + cardH, cardX, cardY, radius);
ctx.arcTo(cardX, cardY, cardX + cardW, cardY, radius);
ctx.closePath();
ctx.fill();

// Barra superior tipo ventana, con semáforo de puntos.
ctx.fillStyle = '#2a2a2a';
ctx.beginPath();
ctx.moveTo(cardX + radius, cardY);
ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + 40, radius);
ctx.lineTo(cardX, cardY + 40);
ctx.arcTo(cardX, cardY, cardX + cardW, cardY, radius);
ctx.closePath();
ctx.fill();

['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
  ctx.beginPath();
  ctx.arc(cardX + 28 + i * 24, cardY + 20, 7, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
});

// Logo / título dentro de la tarjeta.
ctx.textBaseline = 'alphabetic';
ctx.fillStyle = COLORS.accent;
ctx.font = 'bold 40px monospace';
ctx.fillText('{ }', cardX + 40, cardY + 120);

ctx.fillStyle = COLORS.textPrimary;
ctx.font = 'bold 72px monospace';
ctx.fillText('TechGuessr', cardX + 130, cardY + 130);

ctx.fillStyle = COLORS.textSecondary;
ctx.font = '28px monospace';
ctx.fillText('El GeoGuessr para gente de tech', cardX + 40, cardY + 190);

// Chips de modalidades.
const chips = [
  { label: 'CodeGuessr', color: COLORS.accent },
  { label: 'CommitGuessr', color: COLORS.success },
  { label: 'UIGuessr', color: COLORS.accent },
  { label: 'AIGuessr', color: COLORS.success },
];
let chipX = cardX + 40;
const chipY = cardY + 230;
ctx.font = '24px monospace';
chips.forEach((chip) => {
  const textWidth = ctx.measureText(chip.label).width;
  const chipW = textWidth + 36;
  const chipH = 44;

  ctx.strokeStyle = chip.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(chipX + 10, chipY);
  ctx.arcTo(chipX + chipW, chipY, chipX + chipW, chipY + chipH, 10);
  ctx.arcTo(chipX + chipW, chipY + chipH, chipX, chipY + chipH, 10);
  ctx.arcTo(chipX, chipY + chipH, chipX, chipY, 10);
  ctx.arcTo(chipX, chipY, chipX + chipW, chipY, 10);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = chip.color;
  ctx.fillText(chip.label, chipX + 18, chipY + 30);

  chipX += chipW + 16;
});

// Pie: hackathon.
ctx.fillStyle = COLORS.textSecondary;
ctx.font = '22px monospace';
ctx.fillText('Hackathon IA Masivo Online AWS · Código Facilito (Kiro + AWS)', cardX + 40, H - 70);

const outputPath = path.join(__dirname, '..', 'public', 'assets', 'og-image.png');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
console.log(`OG image generada en ${outputPath}`);
