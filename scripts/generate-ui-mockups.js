/**
 * Genera mockups SVG originales (NO screenshots reales) para el dataset de
 * UIGuessr. Cada mockup recrea la PALETA de color y un layout GENÉRICO
 * inspirado en el tipo de app (feed, reproductor, bandeja de entrada,
 * perfil, etc.), sin copiar el diseño real de cada producto pixel por
 * pixel — evita cualquier problema de derechos de autor de screenshots
 * reales (ver Commons:Screenshots, que prohíbe subir capturas de
 * interfaces propietarias sin licencia libre).
 *
 * Ejecutar con: node scripts/generate-ui-mockups.js
 */
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'public', 'assets', 'ui-screenshots');

const W = 900;
const H = 600;
const CHROME_H = 44;

function escape(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Barra superior tipo navegador, con los tres puntos de "semáforo" y una URL genérica ofuscada. */
function browserChrome(bg = '#e8e8e8') {
  return `
  <rect x="0" y="0" width="${W}" height="${CHROME_H}" fill="${bg}"/>
  <circle cx="18" cy="${CHROME_H / 2}" r="5" fill="#ff5f57"/>
  <circle cx="36" cy="${CHROME_H / 2}" r="5" fill="#febc2e"/>
  <circle cx="54" cy="${CHROME_H / 2}" r="5" fill="#28c840"/>
  <rect x="90" y="12" width="${W - 180}" height="20" rx="10" fill="white" opacity="0.85"/>
  <rect x="102" y="19" width="120" height="6" rx="3" fill="#999"/>`;
}

function cardRow(x, y, w, h, fill = '#ffffff') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>`;
}

function textLine(x, y, w, h = 10, fill = '#cccccc') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>`;
}

function circle(cx, cy, r, fill) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
}

// ---------------------------------------------------------------------------
// Layouts genéricos por tipo de app (sin copiar el diseño real de ninguna).
// ---------------------------------------------------------------------------

/**
 * Layout específico de Facebook: muro de dos columnas con foto de
 * portada, posts que incluyen una foto ADJUNTA rectangular (no solo
 * texto), nav lateral izquierda con iconos cuadrados (estilo app nativa)
 * y, a la derecha, un GRID de avatares circulares de "amigos" (no una
 * lista vertical) — es la señal visual que más distingue a Facebook de
 * un timeline de texto corto como Twitter.
 */
function facebookWallLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;
  // Barra superior con logo
  body += `<rect x="0" y="${CHROME_H}" width="${W}" height="50" fill="${accent}"/>`;
  body += circle(30, CHROME_H + 25, 12, 'white');
  body += textLine(56, CHROME_H + 19, 70, 12, 'rgba(255,255,255,0.9)');
  // Portada + info de perfil pequeña
  const coverY = CHROME_H + 50;
  body += `<rect x="220" y="${coverY}" width="460" height="60" fill="${accent}" opacity="0.4"/>`;
  body += circle(250, coverY + 60, 22, cardBg);
  body += textLine(284, coverY + 54, 140, 12);

  // 2 posts con foto adjunta rectangular (elemento distintivo de FB)
  const startY = coverY + 100;
  for (let i = 0; i < 2; i++) {
    const y = startY + i * 190;
    body += cardRow(220, y, 460, 170, cardBg);
    body += circle(248, y + 26, 14, accent);
    body += textLine(272, y + 18, 100, 9);
    body += textLine(272, y + 34, 60, 7, '#e0e0e0');
    body += textLine(240, y + 54, 380, 9);
    // foto adjunta al post
    body += `<rect x="240" y="${y + 70}" width="420" height="80" rx="4" fill="${bgLight}"/>`;
    body += `<rect x="240" y="${y + 156}" width="420" height="1" fill="#e5e5e5"/>`;
  }

  // Nav lateral izquierda: iconos cuadrados + etiqueta (estilo Facebook)
  body += cardRow(20, startY, 180, 330, cardBg);
  for (let i = 0; i < 5; i++) {
    body += `<rect x="42" y="${startY + 24 + i * 40}" width="18" height="18" rx="4" fill="${accent}"/>`;
    body += textLine(72, startY + 28 + i * 40, 100, 10);
  }

  // Sidebar derecha: GRID de avatares de amigos (no lista)
  body += cardRow(700, startY, 180, 330, cardBg);
  body += textLine(720, startY + 18, 110, 11);
  const cols = 3;
  for (let i = 0; i < 9; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    body += circle(735 + col * 48, startY + 60 + row * 48, 18, accent);
  }
  return body;
}

/**
 * Layout específico de Twitter: timeline de una sola columna angosta y
 * continua (sin tarjetas separadas grandes), tweets cortos con
 * avatar+nombre en línea, 1-2 líneas de texto breve, y una fila de 3
 * iconos de acción (reply/retweet/like) — nada de fotos adjuntas grandes
 * ni sidebar de navegación con iconos, para que se distinga claramente
 * del muro de Facebook.
 */
function timelineLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;

  const colW = 420;
  const colX = (W - colW) / 2 - 90; // desplazado un poco a la izquierda para dejar sidebar de trends
  body += cardRow(colX, CHROME_H + 20, colW, H - CHROME_H - 40, cardBg);

  // Caja de "¿qué está pasando?"
  body += `<rect x="${colX + 16}" y="${CHROME_H + 36}" width="${colW - 32}" height="40" rx="20" fill="${bgLight}"/>`;
  body += textLine(colX + 32, CHROME_H + 52, 140, 8, '#bbb');

  // Tweets cortos separados por línea delgada, no tarjetas con borde
  const tweetH = 78;
  const startY = CHROME_H + 96;
  for (let i = 0; i < 5; i++) {
    const y = startY + i * tweetH;
    body += circle(colX + 30, y + 20, 14, accent);
    body += textLine(colX + 54, y + 12, 90, 9);
    body += textLine(colX + 150, y + 12, 40, 7, '#ccc');
    body += textLine(colX + 54, y + 30, 300, 8, '#999');
    body += textLine(colX + 54, y + 44, 220, 8, '#999');
    // 3 iconos de acción pequeños
    for (let a = 0; a < 3; a++) {
      body += circle(colX + 60 + a * 40, y + 62, 5, '#ccc');
    }
    body += `<rect x="${colX}" y="${y + tweetH - 6}" width="${colW}" height="1" fill="#eee"/>`;
  }

  // Sidebar derecha: "Tendencias" solo texto (sin avatares), a diferencia
  // del grid de amigos de Facebook.
  body += cardRow(colX + colW + 20, CHROME_H + 20, 160, 260, cardBg);
  body += textLine(colX + colW + 36, CHROME_H + 36, 100, 11);
  for (let i = 0; i < 5; i++) {
    body += textLine(colX + colW + 36, CHROME_H + 66 + i * 32, 70, 8, '#999');
    body += textLine(colX + colW + 36, CHROME_H + 78 + i * 32, 110, 10);
  }
  return body;
}

/**
 * Layout específico para apps de fotos mobile-first (Instagram en su
 * primera época): frame de teléfono centrado, header simple, y posts
 * apilados verticalmente con foto CUADRADA (no rectangular como un feed
 * de texto), barra de acciones (like/comentario) y una línea de caption
 * debajo. Distinto a `feed` a propósito: Instagram no mostraba texto
 * largo de "estado" como Twitter/Facebook, sino fotos con poco texto.
 */
function photoFeedLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;

  const phoneW = 320;
  const phoneX = (W - phoneW) / 2;
  const phoneY = CHROME_H + 20;
  const phoneH = H - CHROME_H - 40;
  const headerH = 44;
  const navH = 40;

  // Marco de teléfono
  body += `<rect x="${phoneX - 14}" y="${phoneY - 14}" width="${phoneW + 28}" height="${phoneH + 28}" rx="28" fill="#1a1a1a"/>`;
  body += `<rect x="${phoneX}" y="${phoneY}" width="${phoneW}" height="${phoneH}" rx="8" fill="#ffffff"/>`;

  // Header simple: ícono de cámara a la izquierda + logo centrado + acento
  body += `<rect x="${phoneX}" y="${phoneY}" width="${phoneW}" height="${headerH}" fill="#ffffff"/>`;
  body += `<rect x="${phoneX + 16}" y="${phoneY + 16}" width="18" height="14" rx="3" fill="none" stroke="#333" stroke-width="2"/>`;
  body += textLine(phoneX + phoneW / 2 - 45, phoneY + 16, 90, 12, '#333');
  body += circle(phoneX + phoneW - 26, phoneY + 22, 3, accent);

  // Un solo post visible completo (encabezado + foto CUADRADA + acciones +
  // caption corta), más un "peek" del siguiente post debajo del área de
  // contenido: refleja fielmente cómo se ve un feed de fotos en pantalla
  // mobile (rara vez se ve más de un post completo a la vez), a diferencia
  // de feedLayout que muestra varias tarjetas de texto largo apiladas.
  const contentTop = phoneY + headerH;
  const contentBottom = phoneY + phoneH - navH;
  const availableH = contentBottom - contentTop;
  const postHeaderH = 28;
  const actionsH = 24;
  const captionH = 14;
  const photoSize = phoneW - 16; // ancho completo del teléfono, foto cuadrada
  const post1Bottom = contentTop + postHeaderH + photoSize + actionsH + captionH;

  // Post 1 (completo)
  body += circle(phoneX + 22, contentTop + 14, 10, accent);
  body += textLine(phoneX + 40, contentTop + 8, 80, 8, '#999');
  body += `<rect x="${phoneX + 8}" y="${contentTop + postHeaderH}" width="${photoSize}" height="${photoSize}" fill="${accent}" opacity="0.85"/>`;
  const actions1Y = contentTop + postHeaderH + photoSize + 12;
  body += `<path d="M ${phoneX + 14} ${actions1Y} l 5 5 l 5 -5" fill="none" stroke="#333" stroke-width="2"/>`;
  body += `<circle cx="${phoneX + 40}" cy="${actions1Y + 2}" r="7" fill="none" stroke="#333" stroke-width="2"/>`;
  body += textLine(phoneX + 8, actions1Y + 16, 140, 7, '#bbb');

  // Peek del post 2: solo el header (avatar+usuario) asomando, recortado
  // por el borde inferior del contenido (simula scroll infinito real).
  if (post1Bottom + postHeaderH < contentBottom + postHeaderH) {
    const peekY = Math.min(post1Bottom + 8, contentBottom - 4);
    body += circle(phoneX + 22, peekY + 10, 10, '#333');
    body += textLine(phoneX + 40, peekY + 4, 80, 8, '#ccc');
  }

  // Barra de navegación inferior (5 íconos)
  const navY = phoneY + phoneH - navH / 2;
  body += `<rect x="${phoneX}" y="${navY - navH / 2}" width="${phoneW}" height="1" fill="#eee"/>`;
  for (let i = 0; i < 5; i++) {
    const cx = phoneX + 30 + (i * (phoneW - 60)) / 4;
    body += i === 2
      ? `<rect x="${cx - 8}" y="${navY - 8}" width="16" height="16" rx="3" fill="none" stroke="#333" stroke-width="2"/>`
      : circle(cx, navY, 7, '#ccc');
  }

  return body;
}

/**
 * Layout específico de YouTube: video grande 16:9 a la izquierda (con
 * barra de progreso) y, a la derecha, una COLUMNA de miniaturas de
 * "videos relacionados" también en 16:9 con su duración — la lista de
 * relacionados en columna angosta a la derecha es la seña distintiva de
 * YouTube frente a Netflix (que no tiene panel de relacionados así) o
 * Spotify (que no reproduce video).
 */
function videoPlayerLayout({ accent, bgDark, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgDark}"/>`;

  const videoW = 560;
  const videoH = (videoW * 9) / 16;
  const videoX = 30;
  const videoY = CHROME_H + 30;
  body += `<rect x="${videoX}" y="${videoY}" width="${videoW}" height="${videoH}" fill="#000"/>`;
  body += `<polygon points="${videoX + 250},${videoY + videoH / 2 - 25} ${videoX + 250},${videoY + videoH / 2 + 25} ${videoX + 300},${videoY + videoH / 2}" fill="white"/>`;
  body += `<rect x="${videoX}" y="${videoY + videoH - 4}" width="${videoW}" height="4" fill="#555"/>`;
  body += `<rect x="${videoX}" y="${videoY + videoH - 4}" width="${videoW * 0.35}" height="4" fill="${accent}"/>`;

  // Título + canal debajo del video
  body += textLine(videoX, videoY + videoH + 20, 380, 14);
  body += circle(videoX + 16, videoY + videoH + 54, 14, accent);
  body += textLine(videoX + 40, videoY + videoH + 48, 120, 10, '#999');

  // Columna de "videos relacionados": miniatura 16:9 + 2 líneas de texto.
  // Solo 3 (no 4): con el ancho de columna disponible, el thumbnail 16:9
  // ya ocupa suficiente alto como para que un 4to se saliera del canvas.
  const relX = videoX + videoW + 24;
  const relW = W - relX - 24;
  const thumbH = (relW * 9) / 16;
  for (let i = 0; i < 3; i++) {
    const y = CHROME_H + 30 + i * (thumbH + 24);
    body += `<rect x="${relX}" y="${y}" width="${relW}" height="${thumbH}" fill="#333"/>`;
    body += `<rect x="${relX + relW - 34}" y="${y + thumbH - 16}" width="30" height="12" rx="2" fill="rgba(0,0,0,0.8)"/>`;
    body += textLine(relX, y + thumbH + 8, relW - 20, 8, '#999');
    body += textLine(relX, y + thumbH + 20, relW - 60, 7, '#666');
  }
  return body;
}

/**
 * Layout específico de Spotify: sidebar oscura con playlists, panel
 * central con una LISTA de tracks numerada (no un video grande), y una
 * barra de reproducción DELGADA fija en la parte inferior con el track
 * actual + controles — así se distingue de YouTube (sin video central)
 * y de Netflix (sin grid de carátulas).
 */
function musicPlayerLayout({ accent, bgDark, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgDark}"/>`;

  const sidebarW = 200;
  body += `<rect x="0" y="${CHROME_H}" width="${sidebarW}" height="${H - CHROME_H}" fill="#000000"/>`;
  for (let i = 0; i < 6; i++) {
    body += textLine(24, CHROME_H + 30 + i * 32, 130, 9, i === 1 ? accent : '#888');
  }

  // Header de la playlist actual + botón de play grande
  const contentX = sidebarW + 30;
  body += `<rect x="${contentX}" y="${CHROME_H + 20}" width="120" height="120" fill="${accent}" opacity="0.5"/>`;
  body += textLine(contentX + 140, CHROME_H + 60, 220, 20);
  body += textLine(contentX + 140, CHROME_H + 90, 140, 10, '#999');
  body += circle(contentX + 20, CHROME_H + 160, 24, accent);

  // Lista de tracks numerada (elemento clave: número + título + duración)
  const listY = CHROME_H + 210;
  const bottomPlayerH = 70;
  for (let i = 0; i < 6; i++) {
    const y = listY + i * 34;
    body += textLine(contentX, y, 14, 8, '#666');
    body += textLine(contentX + 30, y, 220, 9, i === 0 ? accent : '#ccc');
    body += textLine(W - 120, y, 40, 8, '#666');
  }

  // Barra de reproducción delgada fija abajo (track actual + progreso)
  const barY = H - bottomPlayerH;
  body += `<rect x="0" y="${barY}" width="${W}" height="${bottomPlayerH}" fill="#181818"/>`;
  body += `<rect x="20" y="${barY + 14}" width="42" height="42" fill="${accent}" opacity="0.6"/>`;
  body += textLine(74, barY + 20, 140, 8, '#eee');
  body += textLine(74, barY + 34, 90, 7, '#888');
  body += `<rect x="${W / 2 - 150}" y="${barY + 22}" width="300" height="3" rx="1.5" fill="#444"/>`;
  body += `<rect x="${W / 2 - 150}" y="${barY + 22}" width="120" height="3" rx="1.5" fill="${accent}"/>`;
  return body;
}

/**
 * Layout específico de Netflix: hero banner ancho con imagen destacada
 * arriba, y debajo VARIAS FILAS ("carruseles") de carátulas verticales
 * tipo poster (aspect ratio ~2:3, no cuadradas ni 16:9) — el grid de
 * posters en filas es lo que distingue un catálogo de streaming de un
 * reproductor de video (YouTube) o de música (Spotify).
 */
function streamingCatalogLayout({ accent, bgDark, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgDark}"/>`;

  // Hero banner
  const heroH = 220;
  body += `<rect x="0" y="${CHROME_H}" width="${W}" height="${heroH}" fill="${cardBg}"/>`;
  body += textLine(50, CHROME_H + 90, 260, 24, 'white');
  body += textLine(50, CHROME_H + 128, 380, 10, '#bbb');
  body += `<rect x="50" y="${CHROME_H + 150}" width="90" height="30" rx="4" fill="white"/>`;

  // Filas de posters verticales (2:3). Dimensiones ajustadas para que 2
  // filas + su label quepan dentro del canvas sin desbordar (ver
  // CHROME_H + heroH como punto de partida).
  const posterW = 100;
  const posterH = 130;
  const rowGap = 26;
  const rows = 2;
  for (let row = 0; row < rows; row++) {
    const y = CHROME_H + heroH + 20 + row * (posterH + rowGap);
    body += textLine(50, y - 12, 140, 10, '#ccc');
    for (let col = 0; col < 7; col++) {
      const x = 50 + col * (posterW + 10);
      body += `<rect x="${x}" y="${y}" width="${posterW}" height="${posterH}" rx="4" fill="${col % 2 === 0 ? accent : '#444'}" opacity="0.7"/>`;
    }
  }
  return body;
}

function inboxLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;
  // sidebar
  body += `<rect x="0" y="${CHROME_H}" width="220" height="${H - CHROME_H}" fill="${cardBg}"/>`;
  body += `<rect x="24" y="${CHROME_H + 24}" width="140" height="32" rx="16" fill="${accent}"/>`;
  for (let i = 0; i < 5; i++) {
    body += textLine(24, CHROME_H + 90 + i * 34, 130, 10, '#ccc');
  }
  // lista de mensajes
  const startY = CHROME_H + 20;
  for (let i = 0; i < 7; i++) {
    const y = startY + i * 48;
    body += `<rect x="220" y="${y}" width="${W - 220}" height="46" fill="${i % 2 === 0 ? '#ffffff' : bgLight}"/>`;
    body += circle(250, y + 23, 12, accent);
    body += textLine(276, y + 12, 140, 10);
    body += textLine(276, y + 28, 300, 8, '#ddd');
    body += textLine(W - 100, y + 18, 60, 8, '#ddd');
  }
  return body;
}

function profileLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;
  // banner
  body += `<rect x="0" y="${CHROME_H}" width="${W}" height="140" fill="${accent}"/>`;
  body += circle(120, CHROME_H + 140, 60, cardBg);
  body += textLine(210, CHROME_H + 160, 200, 16);
  body += textLine(210, CHROME_H + 184, 140, 10, '#bbb');
  // tarjetas de info debajo
  const startY = CHROME_H + 230;
  body += cardRow(60, startY, 500, 300, cardBg);
  for (let i = 0; i < 4; i++) {
    body += textLine(90, startY + 30 + i * 60, 420, 12);
    body += textLine(90, startY + 50 + i * 60, 300, 8, '#e0e0e0');
  }
  body += cardRow(590, startY, 260, 300, cardBg);
  body += textLine(615, startY + 24, 120, 12);
  for (let i = 0; i < 3; i++) {
    body += circle(630, startY + 70 + i * 70, 20, accent);
    body += textLine(660, startY + 64 + i * 70, 150, 10);
  }
  return body;
}

function marketplaceLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;
  body += `<rect x="0" y="${CHROME_H}" width="${W}" height="60" fill="${cardBg}"/>`;
  body += textLine(40, CHROME_H + 22, 100, 16, accent);
  body += `<rect x="300" y="${CHROME_H + 16}" width="400" height="28" rx="14" fill="${bgLight}"/>`;
  // grid de productos
  const startY = CHROME_H + 100;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 40 + col * 205;
      const y = startY + row * 220;
      body += cardRow(x, y, 180, 190, cardBg);
      body += `<rect x="${x + 15}" y="${y + 15}" width="150" height="110" rx="4" fill="${bgLight}"/>`;
      body += textLine(x + 15, y + 140, 130, 10);
      body += textLine(x + 15, y + 158, 70, 12, accent);
    }
  }
  return body;
}

function terminalCodeLayout({ accent, bgDark, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgDark}"/>`;
  // sidebar de repo
  body += `<rect x="0" y="${CHROME_H}" width="240" height="${H - CHROME_H}" fill="${cardBg}"/>`;
  body += circle(40, CHROME_H + 40, 16, accent);
  body += textLine(66, CHROME_H + 34, 130, 12, '#ccc');
  for (let i = 0; i < 6; i++) {
    body += textLine(30, CHROME_H + 100 + i * 30, 170, 8, '#555');
  }
  // panel de "código"
  const startY = CHROME_H + 30;
  body += cardRow(260, startY, 610, 480, '#1e1e1e');
  const codeColors = ['#f97583', '#79b8ff', '#9ecbff', '#ffab70', '#b392f0'];
  for (let i = 0; i < 14; i++) {
    const indent = (i % 4) * 16;
    body += textLine(280 + indent, startY + 20 + i * 30, 60 + Math.random() * 240, 10, codeColors[i % codeColors.length]);
  }
  return body;
}

/**
 * Layout específico de un cliente de mensajería tipo WhatsApp Web: lista
 * de chats a la izquierda (avatar + último mensaje + hora), header del
 * chat activo arriba a la derecha, burbujas CON COLA alternando
 * izquierda/derecha (recibido/enviado) sobre un fondo de chat con textura
 * sutil, y una caja de mensaje con botón de enviar fija abajo. Se
 * diferencia de `chatLayout` (Slack): ahí los "mensajes" son bloques
 * planos sin cola ni caja de texto, pensados para un feed de canal, no
 * para una conversación 1 a 1.
 */
function messengerLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;

  const sidebarW = 300;
  body += `<rect x="0" y="${CHROME_H}" width="${sidebarW}" height="${H - CHROME_H}" fill="#ffffff"/>`;
  body += `<rect x="0" y="${CHROME_H}" width="${sidebarW}" height="50" fill="${accent}"/>`;
  body += circle(26, CHROME_H + 25, 12, 'white');

  for (let i = 0; i < 7; i++) {
    const y = CHROME_H + 50 + i * 64;
    body += `<rect x="0" y="${y}" width="${sidebarW}" height="1" fill="#eee"/>`;
    body += circle(30, y + 32, 20, i === 1 ? accent : '#ccc');
    body += textLine(64, y + 20, 130, 10, '#333');
    body += textLine(64, y + 38, 170, 8, '#999');
    body += textLine(sidebarW - 40, y + 20, 24, 7, '#bbb');
  }

  // Header del chat activo
  const chatX = sidebarW;
  const chatW = W - sidebarW;
  body += `<rect x="${chatX}" y="${CHROME_H}" width="${chatW}" height="56" fill="${cardBg}"/>`;
  body += circle(chatX + 34, CHROME_H + 28, 16, accent);
  body += textLine(chatX + 62, CHROME_H + 22, 120, 11, '#333');

  // Área de chat con textura sutil (puntos) y burbujas con cola
  const chatTop = CHROME_H + 56;
  const chatBottom = H - 64;
  body += `<rect x="${chatX}" y="${chatTop}" width="${chatW}" height="${chatBottom - chatTop}" fill="#e8ded1"/>`;
  for (let dx = 0; dx < chatW; dx += 40) {
    for (let dy = 0; dy < chatBottom - chatTop; dy += 40) {
      body += circle(chatX + dx + 20, chatTop + dy + 20, 1.5, 'rgba(0,0,0,0.05)');
    }
  }

  const bubbles = [
    { fromMe: false, w: 200, textW: 160 },
    { fromMe: true, w: 240, textW: 200 },
    { fromMe: false, w: 260, textW: 220 },
    { fromMe: true, w: 180, textW: 140 },
  ];
  let by = chatTop + 24;
  bubbles.forEach((b) => {
    const bh = 44;
    const bx = b.fromMe ? chatX + chatW - b.w - 30 : chatX + 30;
    body += `<rect x="${bx}" y="${by}" width="${b.w}" height="${bh}" rx="12" fill="${b.fromMe ? '#dcf8c6' : '#ffffff'}"/>`;
    // colita de la burbuja
    const tailX = b.fromMe ? bx + b.w : bx;
    body += `<polygon points="${tailX},${by + bh - 14} ${tailX + (b.fromMe ? 10 : -10)},${by + bh - 8} ${tailX},${by + bh - 2}" fill="${b.fromMe ? '#dcf8c6' : '#ffffff'}"/>`;
    body += textLine(bx + 14, by + 14, b.textW, 8, '#999');
    body += textLine(bx + b.w - 34, by + bh - 14, 24, 6, '#bbb');
    by += bh + 20;
  });

  // Caja de mensaje fija abajo con botón de enviar circular
  body += `<rect x="${chatX}" y="${H - 64}" width="${chatW}" height="64" fill="${cardBg}"/>`;
  body += `<rect x="${chatX + 20}" y="${H - 46}" width="${chatW - 100}" height="28" rx="14" fill="${bgLight}"/>`;
  body += circle(chatX + chatW - 34, H - 32, 18, accent);
  return body;
}

function chatLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;
  // lista de canales/chats
  body += `<rect x="0" y="${CHROME_H}" width="260" height="${H - CHROME_H}" fill="${accent}"/>`;
  for (let i = 0; i < 8; i++) {
    body += circle(40, CHROME_H + 40 + i * 44, 12, 'rgba(255,255,255,0.85)');
    body += textLine(64, CHROME_H + 34 + i * 44, 150, 9, 'rgba(255,255,255,0.6)');
  }
  // burbujas de mensaje
  const startY = CHROME_H + 40;
  const bubbles = [
    { x: 300, w: 220 },
    { x: 560, w: 260 },
    { x: 300, w: 300 },
    { x: 620, w: 200 },
    { x: 300, w: 180 },
  ];
  bubbles.forEach((b, i) => {
    const y = startY + i * 80;
    body += `<rect x="${b.x}" y="${y}" width="${b.w}" height="50" rx="14" fill="${i % 2 === 0 ? cardBg : accent}"/>`;
  });
  return body;
}

function boardLayout({ accent, bgLight, cardBg }) {
  // estilo "masonry" tipo tablero de pins, columnas de distinta altura
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;
  const colX = [40, 240, 440, 640];
  const heights = [
    [140, 200, 160],
    [220, 150, 130],
    [160, 220, 140],
    [180, 160, 180],
  ];
  colX.forEach((x, col) => {
    let y = CHROME_H + 30;
    heights[col].forEach((h) => {
      body += cardRow(x, y, 180, h, cardBg);
      y += h + 20;
    });
  });
  return body;
}

/**
 * Layout específico de un gestor de archivos en la nube tipo Dropbox:
 * sidebar de navegación (Inicio/Archivos/Compartidos/Papelera) con
 * indicador de espacio usado al fondo, una fila de CARPETAS como
 * tarjetas cuadradas con ícono de carpeta arriba, y debajo una lista de
 * ARCHIVOS con icono diferenciado (rectángulo con esquina doblada, no un
 * cuadrado genérico) + nombre + tamaño + fecha. La combinación
 * carpetas-en-grid / archivos-en-lista es la seña visual que distingue un
 * gestor de archivos de una lista genérica de filas.
 */
function fileManagerLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;

  // Sidebar de navegación
  const sidebarW = 200;
  body += `<rect x="0" y="${CHROME_H}" width="${sidebarW}" height="${H - CHROME_H}" fill="${cardBg}"/>`;
  body += circle(34, CHROME_H + 30, 12, accent);
  body += textLine(58, CHROME_H + 24, 100, 12);
  const navItems = ['Inicio', 'Archivos', 'Compartidos', 'Papelera'];
  navItems.forEach((_, i) => {
    const y = CHROME_H + 80 + i * 36;
    body += `<rect x="24" y="${y}" width="14" height="14" rx="3" fill="${i === 1 ? accent : '#ccc'}"/>`;
    body += textLine(50, y + 3, 110, 8, i === 1 ? '#333' : '#999');
  });
  // indicador de espacio usado al fondo del sidebar
  const storageY = CHROME_H + 400;
  body += textLine(24, storageY, 90, 8, '#999');
  body += `<rect x="24" y="${storageY + 16}" width="150" height="6" rx="3" fill="${bgLight}"/>`;
  body += `<rect x="24" y="${storageY + 16}" width="95" height="6" rx="3" fill="${accent}"/>`;

  // Fila de carpetas (tarjetas cuadradas con ícono de carpeta)
  const contentX = sidebarW + 30;
  body += textLine(contentX, CHROME_H + 30, 110, 11, '#333');
  const folderW = 130;
  for (let i = 0; i < 4; i++) {
    const x = contentX + i * (folderW + 16);
    const y = CHROME_H + 56;
    body += cardRow(x, y, folderW, 90, cardBg);
    // ícono de carpeta simple (trapecio + rectángulo)
    body += `<path d="M ${x + 20} ${y + 24} h 20 l 6 8 h 38 v 30 h -64 Z" fill="${accent}" opacity="0.85"/>`;
    body += textLine(x + 16, y + 72, folderW - 32, 8, '#999');
  }

  // Lista de archivos con ícono "documento con esquina doblada"
  const listTitleY = CHROME_H + 176;
  body += textLine(contentX, listTitleY, 90, 11, '#333');
  const listY = listTitleY + 26;
  for (let i = 0; i < 6; i++) {
    const y = listY + i * 42;
    body += `<rect x="${contentX}" y="${y}" width="${W - contentX - 30}" height="36" rx="6" fill="${i % 2 === 0 ? cardBg : bgLight}"/>`;
    // icono documento con esquina doblada
    const ix = contentX + 16;
    const iy = y + 8;
    body += `<path d="M ${ix} ${iy} h 14 l 6 6 v 14 h -20 Z" fill="none" stroke="${accent}" stroke-width="2"/>`;
    body += textLine(contentX + 56, y + 14, 220, 9, '#666');
    body += textLine(W - 220, y + 14, 50, 8, '#bbb');
    body += textLine(W - 140, y + 14, 70, 8, '#bbb');
  }
  return body;
}

function forumLayout({ accent, bgLight, cardBg }) {
  let body = `<rect x="0" y="${CHROME_H}" width="${W}" height="${H - CHROME_H}" fill="${bgLight}"/>`;
  const startY = CHROME_H + 30;
  for (let i = 0; i < 6; i++) {
    const y = startY + i * 80;
    body += cardRow(40, y, W - 80, 66, cardBg);
    // columna de votos
    body += textLine(60, y + 22, 24, 10, accent);
    body += textLine(60, y + 40, 24, 8, '#ccc');
    body += textLine(110, y + 16, 380, 12);
    body += textLine(110, y + 38, 250, 8, '#ddd');
  }
  return body;
}

const LAYOUTS = {
  facebookWall: facebookWallLayout,
  timeline: timelineLayout,
  photoFeed: photoFeedLayout,
  videoPlayer: videoPlayerLayout,
  musicPlayer: musicPlayerLayout,
  streamingCatalog: streamingCatalogLayout,
  inbox: inboxLayout,
  profile: profileLayout,
  marketplace: marketplaceLayout,
  code: terminalCodeLayout,
  chat: chatLayout,
  messenger: messengerLayout,
  board: boardLayout,
  fileManager: fileManagerLayout,
  forum: forumLayout,
};

// ---------------------------------------------------------------------------
// Dataset: paleta + layout por app (colores de marca aproximados; el
// LAYOUT es genérico, no una copia del diseño real).
// ---------------------------------------------------------------------------
const items = [
  { id: 'twitter-2010', app: 'Twitter', year: 2010, layout: 'timeline', accent: '#1DA1F2', bgLight: '#eef7fd', cardBg: '#ffffff' },
  { id: 'facebook-2008', app: 'Facebook', year: 2008, layout: 'facebookWall', accent: '#3b5998', bgLight: '#eef1f7', cardBg: '#ffffff' },
  { id: 'youtube-2012', app: 'YouTube', year: 2012, layout: 'videoPlayer', accent: '#FF0000', bgDark: '#181818', cardBg: '#2a2a2a' },
  { id: 'gmail-2011', app: 'Gmail', year: 2011, layout: 'inbox', accent: '#EA4335', bgLight: '#fbfbfb', cardBg: '#f2f2f2' },
  { id: 'instagram-2013', app: 'Instagram', year: 2013, layout: 'photoFeed', accent: '#E4405F', bgLight: '#fdf3f5', cardBg: '#ffffff' },
  { id: 'spotify-2015', app: 'Spotify', year: 2015, layout: 'musicPlayer', accent: '#1DB954', bgDark: '#121212', cardBg: '#282828' },
  { id: 'reddit-2009', app: 'Reddit', year: 2009, layout: 'forum', accent: '#FF4500', bgLight: '#f5f5f5', cardBg: '#ffffff' },
  { id: 'netflix-2014', app: 'Netflix', year: 2014, layout: 'streamingCatalog', accent: '#E50914', bgDark: '#141414', cardBg: '#333333' },
  { id: 'amazon-2007', app: 'Amazon', year: 2007, layout: 'marketplace', accent: '#FF9900', bgLight: '#f2f2f2', cardBg: '#ffffff' },
  { id: 'github-2011', app: 'GitHub', year: 2011, layout: 'code', accent: '#6e7681', bgDark: '#0d1117', cardBg: '#161b22' },
  { id: 'linkedin-2010', app: 'LinkedIn', year: 2010, layout: 'profile', accent: '#0A66C2', bgLight: '#eef3f8', cardBg: '#ffffff' },
  { id: 'slack-2016', app: 'Slack', year: 2016, layout: 'chat', accent: '#4A154B', bgLight: '#f8f8f8', cardBg: '#ffffff' },
  { id: 'airbnb-2012', app: 'Airbnb', year: 2012, layout: 'marketplace', accent: '#FF5A5F', bgLight: '#fff5f5', cardBg: '#ffffff' },
  { id: 'whatsapp-2015', app: 'WhatsApp', year: 2015, layout: 'messenger', accent: '#25D366', bgLight: '#f8f8f8', cardBg: '#ffffff' },
  { id: 'dropbox-2013', app: 'Dropbox', year: 2013, layout: 'fileManager', accent: '#0061FF', bgLight: '#f5f7fa', cardBg: '#ffffff' },
  { id: 'pinterest-2011', app: 'Pinterest', year: 2011, layout: 'board', accent: '#E60023', bgLight: '#f8f8f8', cardBg: '#ffffff' },
];

console.log('Generando mockups SVG originales para UIGuessr...\n');

for (const item of items) {
  const layoutFn = LAYOUTS[item.layout];
  const body = layoutFn(item);
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${browserChrome()}
  ${body}
</svg>
`;
  const filePath = path.join(outputDir, `${item.id}.svg`);
  fs.writeFileSync(filePath, svg, 'utf-8');
  console.log(`✓ ${item.id}.svg (${item.app}, layout: ${item.layout})`);
}

console.log(`\n${items.length} mockups generados en ${outputDir}`);
console.log('Nota: son diseños ORIGINALES inspirados en el tipo de interfaz de cada app,');
console.log('no capturas reales (evita cualquier problema de copyright de screenshots).');
