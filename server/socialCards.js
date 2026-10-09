const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const ASSET_DIR = path.join(__dirname, 'assets');
const FONT_DIR = path.join(ASSET_DIR, 'fonts');
const WIDTH = 1080;
const HEIGHT = 1350;
const GOLD = '#f5a623';
const LATIN = '"SSM Latin", "SSM Gurmukhi"';
const LATIN_REGULAR = '"SSM Latin Regular", "SSM Gurmukhi Regular"';
const GURMUKHI = '"SSM Gurmukhi", "SSM Latin"';

let fontsReady = false;
let logoPromise = null;

const ensureFonts = () => {
  if (fontsReady) return;
  [
    ['noto-sans-gurmukhi-gurmukhi-700-normal.woff', 'SSM Gurmukhi'],
    ['noto-sans-gurmukhi-gurmukhi-400-normal.woff', 'SSM Gurmukhi Regular'],
    ['noto-sans-latin-700-normal.woff', 'SSM Latin'],
    ['noto-sans-latin-400-normal.woff', 'SSM Latin Regular']
  ].forEach(([file, alias]) => GlobalFonts.registerFromPath(path.join(FONT_DIR, file), alias));
  fontsReady = true;
};

const loadLogo = () => {
  logoPromise ||= loadImage(path.join(ASSET_DIR, 'gurdwara-logo.webp')).catch(() => null);
  return logoPromise;
};

const cleanText = (value) => String(value ?? '').replace(/\|\s*(?:\d+|pause)\s*\|/gi, ' ').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();

// Breaks text into lines no wider than maxWidth using the context's current font.
const wrapText = (ctx, text, maxWidth) => {
  const words = cleanText(text).split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const attempt = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(attempt).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  });
  if (current) lines.push(current);
  return lines;
};

// Finds the largest font size in [min, max] whose wrapped text stays inside the box; returns the lines to draw.
const fitWrapped = (ctx, { text, fontFamily, weight = '', maxWidth, maxHeight, maxSize, minSize, lineHeight = 1.3, maxLines = Infinity }) => {
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = `${weight} ${size}px ${fontFamily}`.trim();
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.length * size * lineHeight <= maxHeight) {
      return { size, lines, lineHeight, truncated: false };
    }
  }
  ctx.font = `${weight} ${minSize}px ${fontFamily}`.trim();
  const all = wrapText(ctx, text, maxWidth);
  const fitting = Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (minSize * lineHeight))));
  const lines = all.slice(0, fitting);
  if (all.length > fitting) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return { size: minSize, lines, lineHeight, truncated: all.length > fitting };
};

const drawLines = (ctx, { lines, size, lineHeight }, { x, y, align = 'center', color }) => {
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * size * lineHeight));
  return lines.length * size * lineHeight;
};

const drawBackground = (ctx) => {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, '#06142f');
  gradient.addColorStop(0.55, '#0b2a5b');
  gradient.addColorStop(1, '#06142f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH * 0.85, HEIGHT * 0.08, 20, WIDTH * 0.85, HEIGHT * 0.08, 620);
  glow.addColorStop(0, 'rgba(245, 166, 35, 0.22)');
  glow.addColorStop(1, 'rgba(245, 166, 35, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(245, 166, 35, 0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 28, 28, WIDTH - 56, HEIGHT - 56, 30);
  ctx.stroke();
};

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

const drawLogo = (ctx, logo, centerX, centerY, radius) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  if (logo) {
    ctx.clip();
    ctx.drawImage(logo, centerX - radius, centerY - radius, radius * 2, radius * 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  ctx.stroke();
};

const drawFooter = (ctx, { organizationName, websiteLabel }) => {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD;
  ctx.font = `34px ${LATIN}`;
  ctx.fillText(cleanText(organizationName), WIDTH / 2, 1232);
  ctx.fillStyle = 'rgba(214, 235, 255, 0.85)';
  ctx.font = `28px ${LATIN_REGULAR}`;
  ctx.fillText(cleanText(websiteLabel), WIDTH / 2, 1280);
};

const drawPills = (ctx, labels, centerX, y) => {
  ctx.font = `26px ${LATIN}`;
  const padding = 22;
  const gap = 14;
  let pills = labels.filter(Boolean).map((label) => ({ label, width: ctx.measureText(label).width + padding * 2 }));
  while (pills.length > 1 && pills.reduce((sum, pill) => sum + pill.width, 0) + gap * (pills.length - 1) > WIDTH - 140) {
    pills = pills.slice(0, -1);
  }
  let x = centerX - (pills.reduce((sum, pill) => sum + pill.width, 0) + gap * (pills.length - 1)) / 2;
  pills.forEach((pill) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    roundRect(ctx, x, y, pill.width, 48, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(pill.label, x + padding, y + 25);
    x += pill.width + gap;
  });
};

const toJpeg = (canvas) => canvas.toBuffer('image/jpeg', 92);

// Daily Hukamnama card: the first lines of Gurbani with their English meaning, for Instagram and Facebook (4:5).
const renderHukamnamaCard = async ({ lines = [], ang = '', raag = '', writer = '', dateLabel = '', organizationName = 'Gurdwara Singh Sabha Milton', websiteLabel = '' }) => {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  drawBackground(ctx);
  drawLogo(ctx, await loadLogo(), WIDTH / 2, 118, 64);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = `50px ${LATIN}`;
  ctx.fillText('Daily Hukamnama', WIDTH / 2, 210);
  ctx.fillStyle = 'rgba(214, 235, 255, 0.9)';
  ctx.font = `30px ${LATIN_REGULAR}`;
  ctx.fillText(cleanText(dateLabel), WIDTH / 2, 275);
  drawPills(ctx, [ang ? `Ang ${ang}` : '', raag ? cleanText(raag) : '', writer ? cleanText(writer) : ''], WIDTH / 2, 328);

  const usable = lines.filter((line) => cleanText(line.gurmukhi));
  let used = Math.min(usable.length, 8);
  let gurmukhi;
  let english;
  while (used >= 1) {
    const chosen = usable.slice(0, used);
    gurmukhi = fitWrapped(ctx, { text: chosen.map((line) => line.gurmukhi).join(' '), fontFamily: GURMUKHI, maxWidth: 900, maxHeight: 470, maxSize: 66, minSize: 34, lineHeight: 1.4 });
    if (!gurmukhi.truncated) break;
    used -= 1;
  }
  used = Math.max(1, used);
  const chosenLines = usable.slice(0, used);
  gurmukhi ||= fitWrapped(ctx, { text: cleanText(chosenLines.map((line) => line.gurmukhi).join(' ')), fontFamily: GURMUKHI, maxWidth: 900, maxHeight: 470, maxSize: 66, minSize: 34, lineHeight: 1.4 });
  const gurmukhiHeight = drawLines(ctx, gurmukhi, { x: WIDTH / 2, y: 410 + Math.max(0, (470 - gurmukhi.lines.length * gurmukhi.size * gurmukhi.lineHeight) / 2), color: '#ffffff' });

  const dividerY = 410 + 470 + 30;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 90, dividerY);
  ctx.lineTo(WIDTH / 2 + 90, dividerY);
  ctx.stroke();

  const meaning = chosenLines.map((line) => cleanText(line.translationEnglish)).filter(Boolean).join(' ');
  if (meaning) {
    english = fitWrapped(ctx, { text: meaning, fontFamily: LATIN_REGULAR, maxWidth: 880, maxHeight: 230, maxSize: 34, minSize: 24, lineHeight: 1.35, maxLines: 6 });
    drawLines(ctx, english, { x: WIDTH / 2, y: dividerY + 28, color: '#d9f2ff' });
  }

  drawFooter(ctx, { organizationName, websiteLabel });
  return { buffer: toJpeg(canvas), linesShown: used, gurmukhiHeight };
};

const coverFit = (ctx, image, x, y, width, height) => {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
};

// Event poster: title, when and where, with the event photo on top when there is one (4:5).
const renderEventPoster = async ({ title = '', when = '', where = '', description = '', coverImage = null, organizationName = 'Gurdwara Singh Sabha Milton', websiteLabel = '' }) => {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  drawBackground(ctx);

  let top = 90;
  if (coverImage) {
    const coverHeight = 560;
    coverFit(ctx, coverImage, 28, 28, WIDTH - 56, coverHeight);
    const fade = ctx.createLinearGradient(0, coverHeight - 220, 0, coverHeight + 28);
    fade.addColorStop(0, 'rgba(6, 20, 47, 0)');
    fade.addColorStop(1, 'rgba(6, 20, 47, 1)');
    ctx.fillStyle = fade;
    ctx.fillRect(28, coverHeight - 220, WIDTH - 56, 248);
    drawLogo(ctx, await loadLogo(), 128, 128, 56);
    top = 610;
  } else {
    drawLogo(ctx, await loadLogo(), WIDTH / 2, 150, 76);
    top = 270;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD;
  ctx.font = `34px ${LATIN}`;
  ctx.fillText('UPCOMING EVENT', WIDTH / 2, top);

  const titleBox = fitWrapped(ctx, { text: title, fontFamily: LATIN, maxWidth: 900, maxHeight: coverImage ? 210 : 340, maxSize: coverImage ? 76 : 92, minSize: 44, lineHeight: 1.18, maxLines: 3 });
  const titleHeight = drawLines(ctx, titleBox, { x: WIDTH / 2, y: top + 56, color: '#ffffff' });

  let y = top + 56 + titleHeight + 24;
  const detailLines = [[when, '#ffffff', 38, LATIN_REGULAR], [where, '#bfe6ff', 34, LATIN_REGULAR]].filter(([text]) => cleanText(text));
  detailLines.forEach(([text, color, size, family]) => {
    const block = fitWrapped(ctx, { text, fontFamily: family, maxWidth: 900, maxHeight: size * 1.35 * 2, maxSize: size, minSize: 26, lineHeight: 1.3, maxLines: 2 });
    y += drawLines(ctx, block, { x: WIDTH / 2, y, color }) + 10;
  });

  const room = 1210 - y - 20;
  if (cleanText(description) && room > 70) {
    const block = fitWrapped(ctx, { text: description, fontFamily: LATIN_REGULAR, maxWidth: 860, maxHeight: room, maxSize: 30, minSize: 24, lineHeight: 1.35, maxLines: 5 });
    drawLines(ctx, block, { x: WIDTH / 2, y: y + 14, color: 'rgba(214, 235, 255, 0.9)' });
  }

  drawFooter(ctx, { organizationName, websiteLabel });
  return { buffer: toJpeg(canvas) };
};

const readLocalImage = (filePath) => {
  try {
    return fs.existsSync(filePath) ? filePath : '';
  } catch {
    return '';
  }
};

module.exports = {
  HEIGHT,
  WIDTH,
  cleanText,
  fitWrapped,
  readLocalImage,
  renderEventPoster,
  renderHukamnamaCard,
  wrapText
};
