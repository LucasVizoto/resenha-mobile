import { AVIATOR_PNG, GLASSES_PNG, THUG_PNG, WIZARD_BEARD_PNG, WIZARD_HAT_PNG } from './filter-images';

export function faceFilterDocument(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: #0E1424; overflow: hidden; }
  video { position: absolute; width: 2px; height: 2px; opacity: 0; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
</head>
<body>
<video id="cam" autoplay playsinline muted></video>
<canvas id="overlay"></canvas>
<script>
const video = document.getElementById('cam');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const glassesImg = new Image();
glassesImg.src = ${JSON.stringify(GLASSES_PNG)};
const aviatorImg = new Image();
aviatorImg.src = ${JSON.stringify(AVIATOR_PNG)};
const thugImg = new Image();
thugImg.src = ${JSON.stringify(THUG_PNG)};
const customSprites = {};
function customSprite(src) {
  if (!src) return null;
  let img = customSprites[src];
  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    customSprites[src] = img;
  }
  return img;
}
const hatImg = new Image();
hatImg.src = ${JSON.stringify(WIZARD_HAT_PNG)};
const beardImg = new Image();
beardImg.src = ${JSON.stringify(WIZARD_BEARD_PNG)};
const tintCanvas = document.createElement('canvas');
const tintCtx = tintCanvas.getContext('2d');
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
  };
}
const sample = document.createElement('canvas');
const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
let faceMesh = null;
let detector = null;
let segmenter = null;
let personMask = null;
let filter = null;
let faces = [];
let view = { ox: 0, oy: 0, dw: 1, dh: 1 };
let lastDetect = 0;
let lastPost = 0;
let detecting = false;

const FACE = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const LIPS = [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185];

function post(payload) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
}
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(window.innerWidth * dpr));
  const height = Math.max(1, Math.round(window.innerHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
  view.dw = video.videoWidth * scale;
  view.dh = video.videoHeight * scale;
  view.ox = (canvas.width - view.dw) / 2;
  view.oy = (canvas.height - view.dh) / 2;
}
function drawVideo() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0E1424';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(view.ox + view.dw, view.oy);
  ctx.scale(-view.dw / video.videoWidth, view.dh / video.videoHeight);
  ctx.drawImage(video, 0, 0);
  ctx.restore();
}
function P(marks, index) {
  const point = (marks && marks[index]) || { x: 0.5, y: 0.5 };
  return {
    x: view.ox + (1 - point.x) * view.dw,
    y: view.oy + point.y * view.dh,
  };
}
function marksFromBox(box, width, height) {
  const x0 = box.x / width;
  const y0 = box.y / height;
  const bw = box.width / width;
  const bh = box.height / height;
  const at = (fx, fy) => ({ x: x0 + bw * fx, y: y0 + bh * fy });
  const marks = [];
  const put = (index, fx, fy) => { marks[index] = at(fx, fy); };
  put(10, 0.5, 0.08);
  put(33, 0.3, 0.38);
  put(133, 0.46, 0.4);
  put(263, 0.7, 0.38);
  put(362, 0.54, 0.4);
  put(127, 0.12, 0.42);
  put(356, 0.88, 0.42);
  put(234, 0.08, 0.55);
  put(454, 0.92, 0.55);
  put(1, 0.5, 0.55);
  put(54, 0.28, 0.16);
  put(284, 0.72, 0.16);
  put(205, 0.22, 0.62);
  put(425, 0.78, 0.62);
  put(50, 0.28, 0.58);
  put(280, 0.72, 0.58);
  LIPS.forEach((index, order) => {
    const angle = (order / LIPS.length) * Math.PI * 2;
    put(index, 0.5 + Math.cos(angle) * 0.1, 0.74 + Math.sin(angle) * 0.045);
  });
  FACE.forEach((index, order) => {
    const angle = (order / FACE.length) * Math.PI * 2 - Math.PI / 2;
    put(index, 0.5 + Math.cos(angle) * 0.42, 0.52 + Math.sin(angle) * 0.46);
  });
  [70, 63, 105, 66, 107].forEach((index, order) => put(index, 0.26 + order * 0.045, 0.3));
  [300, 293, 334, 296, 336].forEach((index, order) => put(index, 0.56 + order * 0.045, 0.3));
  return marks;
}
function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function path(marks, indices, close) {
  ctx.beginPath();
  indices.forEach((index, order) => {
    const point = P(marks, index);
    if (order === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  if (close) ctx.closePath();
}

function glasses(marks, color, scale, kind) {
  const outerL = P(marks, 33);
  const innerL = P(marks, 133);
  const outerR = P(marks, 263);
  const innerR = P(marks, 362);
  const eye = ((dist(outerL, innerL) + dist(outerR, innerR)) / 2) * (0.85 + scale * 0.55);
  const lens = (a, b, wide) => {
    const c = mid(a, b);
    ctx.beginPath();
    if (kind === 'aviator') {
      ctx.moveTo(c.x - eye * wide, c.y - eye * 0.15);
      ctx.quadraticCurveTo(c.x, c.y - eye * 1.05, c.x + eye * wide, c.y - eye * 0.15);
      ctx.quadraticCurveTo(c.x + eye * 0.15, c.y + eye * 0.95, c.x, c.y + eye * 0.72);
      ctx.quadraticCurveTo(c.x - eye * 0.15, c.y + eye * 0.95, c.x - eye * wide, c.y - eye * 0.15);
    } else {
      ctx.roundRect(c.x - eye * wide, c.y - eye * 0.72, eye * wide * 2, eye * 1.35, eye * 0.45);
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = kind === 'aviator' ? 0.28 : 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(3, eye * 0.14);
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  lens(outerL, innerL, kind === 'aviator' ? 1.15 : 1.05);
  lens(outerR, innerR, kind === 'aviator' ? 1.15 : 1.05);
  ctx.beginPath();
  ctx.moveTo(innerL.x, innerL.y);
  ctx.quadraticCurveTo((innerL.x + innerR.x) / 2, innerL.y - eye * 0.35, innerR.x, innerR.y);
  ctx.lineWidth = Math.max(3, eye * 0.12);
  ctx.strokeStyle = color;
  ctx.stroke();
  const temple = (from, to) => {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };
  temple(outerL, P(marks, 127));
  temple(outerR, P(marks, 356));
}

function animalEar(base, peak, width, fill, inner) {
  ctx.beginPath();
  ctx.moveTo(base.x - width, base.y);
  ctx.quadraticCurveTo(base.x - width * 0.2, peak.y, peak.x, peak.y);
  ctx.quadraticCurveTo(base.x + width * 0.2, peak.y, base.x + width, base.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(base.x - width * 0.45, base.y - width * 0.15);
  ctx.quadraticCurveTo(base.x, peak.y + width * 0.55, base.x + width * 0.45, base.y - width * 0.15);
  ctx.fillStyle = inner;
  ctx.fill();
}

function dog(marks, color, scale) {
  const span = dist(P(marks, 234), P(marks, 454));
  const lift = span * (0.55 + scale * 0.35);
  const left = P(marks, 127);
  const right = P(marks, 356);
  animalEar(left, { x: left.x - span * 0.22, y: left.y - lift }, span * 0.28, color, '#F3D2B5');
  animalEar(right, { x: right.x + span * 0.22, y: right.y - lift }, span * 0.28, color, '#F3D2B5');
  const nose = P(marks, 1);
  const r = span * 0.12 * (0.8 + scale * 0.4);
  ctx.beginPath();
  ctx.ellipse(nose.x, nose.y, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2A211C';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(nose.x, nose.y + r * 0.9, r * 0.85, r * 0.45, 0, 0, Math.PI);
  ctx.fillStyle = '#E38B8B';
  ctx.fill();
}

function cat(marks, color, scale) {
  const span = dist(P(marks, 234), P(marks, 454));
  const lift = span * (0.62 + scale * 0.28);
  const left = P(marks, 54);
  const right = P(marks, 284);
  const ear = (base, tipX) => {
    ctx.beginPath();
    ctx.moveTo(base.x - span * 0.16, base.y);
    ctx.lineTo(tipX, base.y - lift);
    ctx.lineTo(base.x + span * 0.16, base.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(base.x - span * 0.07, base.y - span * 0.04);
    ctx.lineTo(tipX, base.y - lift * 0.62);
    ctx.lineTo(base.x + span * 0.07, base.y - span * 0.04);
    ctx.closePath();
    ctx.fillStyle = '#F7C5D4';
    ctx.fill();
  };
  ear(left, left.x - span * 0.05);
  ear(right, right.x + span * 0.05);
  const nose = P(marks, 1);
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y - span * 0.03);
  ctx.lineTo(nose.x + span * 0.045, nose.y + span * 0.04);
  ctx.lineTo(nose.x - span * 0.045, nose.y + span * 0.04);
  ctx.closePath();
  ctx.fillStyle = '#F284A8';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, span * 0.012);
  [205, 425].forEach((index) => {
    const cheek = P(marks, index);
    const dir = index === 205 ? -1 : 1;
    for (let row = -1; row <= 1; row += 1) {
      ctx.beginPath();
      ctx.moveTo(cheek.x, cheek.y + row * span * 0.04);
      ctx.lineTo(cheek.x + dir * span * 0.28, cheek.y + row * span * 0.07);
      ctx.stroke();
    }
  });
}

function bunny(marks, color, scale) {
  const span = dist(P(marks, 234), P(marks, 454));
  const head = P(marks, 10);
  const lift = span * (0.95 + scale * 0.45);
  [-0.18, 0.18].forEach((side) => {
    const x = head.x + span * side;
    ctx.beginPath();
    ctx.ellipse(x, head.y - lift * 0.45, span * 0.11, lift * 0.48, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, head.y - lift * 0.42, span * 0.055, lift * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#F7C9D6';
    ctx.fill();
  });
  const nose = P(marks, 1);
  ctx.beginPath();
  ctx.ellipse(nose.x, nose.y, span * 0.035, span * 0.025, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#F284A8';
  ctx.fill();
}

function makeup(marks, color, scale) {
  const span = dist(P(marks, 234), P(marks, 454));
  [50, 280].forEach((index) => {
    const cheek = P(marks, index);
    const radius = span * (0.16 + scale * 0.08);
    const glow = ctx.createRadialGradient(cheek.x, cheek.y, radius * 0.1, cheek.x, cheek.y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cheek.x, cheek.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  path(marks, LIPS, true);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.82;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function neon(marks, color, scale) {
  path(marks, FACE, true);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, dist(P(marks, 234), P(marks, 454)) * 0.02 * (0.7 + scale));
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;
  [[70, 63, 105, 66, 107], [300, 293, 334, 296, 336]].forEach((brow) => {
    path(marks, brow, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
  });
}

function smooth(marks) {
  ctx.save();
  path(marks, FACE, true);
  ctx.clip();
  ctx.filter = 'blur(8px) contrast(0.92) saturate(1.06)';
  ctx.translate(view.ox + view.dw, view.oy);
  ctx.scale(-view.dw / video.videoWidth, view.dh / video.videoHeight);
  ctx.drawImage(video, 0, 0);
  ctx.filter = 'none';
  ctx.restore();
}

function spriteOnEyes(img, marks, cover) {
  if (!img || !img.complete || !img.naturalWidth) return;
  let left = mid(P(marks, 33), P(marks, 133));
  let right = mid(P(marks, 263), P(marks, 362));
  if (left.x > right.x) {
    const swap = left;
    left = right;
    right = swap;
  }
  const eyeDist = Math.max(12, dist(left, right));
  const width = eyeDist / cover;
  const height = width * (img.naturalHeight / img.naturalWidth);
  const center = mid(left, right);
  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();
}

let beardChains = null;

function stepBeard(marks) {
  const raw = [132, 172, 136, 176, 152, 400, 365, 397, 361].map((index) => P(marks, index));
  const midX = raw[4].x;
  const anchors = raw.map((point) => ({
    x: midX + (point.x - midX) * 1.35,
    y: point.y,
  }));
  const rows = 11;
  const jumped = beardChains && dist(beardChains[0][0], anchors[0]) > 160;
  if (!beardChains || beardChains.length !== anchors.length || jumped) {
    beardChains = anchors.map((anchor) => {
      const points = [];
      for (let row = 0; row < rows; row += 1) {
        points.push({
          x: anchor.x,
          y: anchor.y + row * 18,
          px: anchor.x,
          py: anchor.y + row * 18,
        });
      }
      return points;
    });
  }
  const span = Math.max(24, dist(anchors[0], anchors[anchors.length - 1]));
  const rest = span * 0.22;
  for (let column = 0; column < beardChains.length; column += 1) {
    const chain = beardChains[column];
    chain[0].x = anchors[column].x;
    chain[0].y = anchors[column].y;
    chain[0].px = anchors[column].x;
    chain[0].py = anchors[column].y;
    for (let row = 1; row < chain.length; row += 1) {
      const point = chain[row];
      const vx = (point.x - point.px) * 0.84;
      const vy = (point.y - point.py) * 0.84;
      point.px = point.x;
      point.py = point.y;
      point.x += vx + Math.sin(performance.now() / 260 + column) * 0.22;
      point.y += vy + 1.05;
    }
    for (let pass = 0; pass < 4; pass += 1) {
      for (let row = 1; row < chain.length; row += 1) {
        const previous = chain[row - 1];
        const point = chain[row];
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const length = Math.hypot(dx, dy) || 1;
        const fix = (length - rest) / length;
        if (row === 1) {
          point.x -= dx * fix;
          point.y -= dy * fix;
        } else {
          previous.x += dx * fix * 0.5;
          previous.y += dy * fix * 0.5;
          point.x -= dx * fix * 0.5;
          point.y -= dy * fix * 0.5;
        }
      }
      chain[0].x = anchors[column].x;
      chain[0].y = anchors[column].y;
    }
  }
  const side = span / Math.max(1, beardChains.length - 1);
  for (let column = 1; column < beardChains.length; column += 1) {
    for (let row = 1; row < beardChains[column].length; row += 1) {
      const left = beardChains[column - 1][row];
      const right = beardChains[column][row];
      const dx = right.x - left.x;
      const gap = Math.abs(dx);
      if (gap > side * 1.15) {
        const pull = (gap - side) * 0.18;
        const sign = dx > 0 ? 1 : -1;
        left.x += sign * pull;
        right.x -= sign * pull;
      }
    }
  }
}

function drawBeardSheet(img, left, right, u0, u1) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let row = 1; row < left.length; row += 1) ctx.lineTo(left[row].x, left[row].y);
  for (let row = right.length - 1; row >= 0; row -= 1) ctx.lineTo(right[row].x, right[row].y);
  ctx.closePath();
  ctx.clip();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  left.concat(right).forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  const pad = Math.max(10, (maxX - minX) * 0.45);
  const sx = Math.max(0, u0 * img.naturalWidth);
  const sw = Math.max(1, (u1 - u0) * img.naturalWidth);
  ctx.drawImage(img, sx, 0, sw, img.naturalHeight, minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
  ctx.restore();
}

function drawBeard(img, marks) {
  if (!img || !img.complete || !img.naturalWidth) return;
  stepBeard(marks);
  const columns = beardChains.length;
  for (let column = 0; column < columns - 1; column += 1) {
    const u0 = Math.max(0, column / (columns - 1) - 0.12);
    const u1 = Math.min(1, (column + 1) / (columns - 1) + 0.12);
    drawBeardSheet(img, beardChains[column], beardChains[column + 1], u0, u1);
  }
}

function drawHat(img, marks) {
  if (!img || !img.complete || !img.naturalWidth) return;
  let left = P(marks, 33);
  let right = P(marks, 263);
  if (left.x > right.x) {
    const swap = left;
    left = right;
    right = swap;
  }
  const forehead = P(marks, 10);
  const faceWidth = Math.max(48, dist(P(marks, 234), P(marks, 454)));
  const width = faceWidth * 1.45;
  const height = width * (img.naturalHeight / img.naturalWidth);
  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  ctx.save();
  ctx.translate(forehead.x, forehead.y);
  ctx.rotate(angle);
  ctx.drawImage(img, -width / 2, -height * 0.9, width, height);
  ctx.restore();
}

function paintTint(color) {
  if (!personMask) return;
  tintCanvas.width = canvas.width;
  tintCanvas.height = canvas.height;
  tintCtx.setTransform(1, 0, 0, 1, 0, 0);
  tintCtx.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
  tintCtx.fillStyle = color;
  tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
  tintCtx.globalCompositeOperation = 'destination-in';
  tintCtx.save();
  tintCtx.translate(view.ox + view.dw, view.oy);
  tintCtx.scale(-view.dw / personMask.width, view.dh / personMask.height);
  tintCtx.drawImage(personMask, 0, 0);
  tintCtx.restore();
  tintCtx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.drawImage(tintCanvas, 0, 0);
  ctx.restore();
}

function landmarks(marks) {
  const radius = Math.max(1.4, view.dw * 0.0035);
  ctx.fillStyle = '#39FF6A';
  for (let index = 0; index < marks.length; index += 1) {
    if (!marks[index]) continue;
    const point = P(marks, index);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(57,255,106,0.9)';
  ctx.lineWidth = Math.max(1.25, view.dw * 0.0025);
  path(marks, FACE, true);
  ctx.stroke();
}

function trackedSprite(img, marks, anchor, scale) {
  if (!img || !img.complete || !img.naturalWidth) return;
  let left = mid(P(marks, 33), P(marks, 133));
  let right = mid(P(marks, 263), P(marks, 362));
  if (left.x > right.x) {
    const swap = left;
    left = right;
    right = swap;
  }
  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  const span = Math.max(24, dist(P(marks, 234), P(marks, 454)));
  const eyeDist = Math.max(12, dist(left, right));
  const size = Math.max(0.35, Math.min(Number(scale) || 1, 1.5));
  let center = mid(left, right);
  let width = eyeDist * 2.2 * size;
  if (anchor === 'forehead') {
    const top = P(marks, 10);
    center = { x: top.x, y: top.y - span * 0.22 };
    width = span * 0.95 * size;
  } else if (anchor === 'nose') {
    center = P(marks, 1);
    width = span * 0.46 * size;
  } else if (anchor === 'mouth') {
    center = mid(P(marks, 61), P(marks, 291));
    width = span * 0.55 * size;
  } else if (anchor === 'cheeks') {
    center = mid(P(marks, 50), P(marks, 280));
    width = span * 1.05 * size;
  } else if (anchor === 'face') {
    const top = P(marks, 10);
    const chin = P(marks, 152);
    center = mid(top, chin);
    width = span * 1.35 * size;
  }
  const height = width * (img.naturalHeight / img.naturalWidth);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function paint(marks) {
  if (!filter) return;
  const scale = Number(filter.scale) || 0.7;
  const color = filter.color || '#111111';
  if (filter.image) {
    trackedSprite(customSprite(filter.image), marks, filter.anchor || 'eyes', scale);
    return;
  }
  if (filter.style === 'glasses') spriteOnEyes(glassesImg, marks, 0.29 / Math.max(scale, 0.4));
  else if (filter.style === 'aviator') spriteOnEyes(aviatorImg, marks, 0.28 / Math.max(scale, 0.4));
  else if (filter.style === 'thug') spriteOnEyes(thugImg, marks, 0.34 / Math.max(scale, 0.4));
  else if (filter.style === 'gandalf') {
    drawHat(hatImg, marks);
    drawBeard(beardImg, marks);
  }
  else if (filter.style === 'marks') landmarks(marks);
  else if (filter.style === 'dog') dog(marks, color, scale);
  else if (filter.style === 'cat') cat(marks, color, scale);
  else if (filter.style === 'bunny') bunny(marks, color, scale);
  else if (filter.style === 'neon') neon(marks, color, scale);
  else if (filter.style === 'smooth') smooth(marks);
}

function paintFrame() {
  if (filter && filter.style === 'tint') paintTint(filter.color || '#2F6BFF');
  faces.forEach(paint);
}

async function detectFrame() {
  if (detecting || !video.videoWidth) return;
  detecting = true;
  try {
    const sw = 320;
    const sh = Math.max(1, Math.round(sw * video.videoHeight / video.videoWidth));
    if (sample.width !== sw || sample.height !== sh) {
      sample.width = sw;
      sample.height = sh;
    }
    const wantsTint = filter && filter.style === 'tint';
    if (wantsTint && segmenter) {
      await segmenter.send({ image: video });
    } else if (faceMesh) {
      await faceMesh.send({ image: video });
    } else if (detector) {
      sampleCtx.drawImage(video, 0, 0, sw, sh);
      const found = await detector.detect(sample);
      faces = found.map((face) => marksFromBox(face.boundingBox, sw, sh));
    }
  } catch (error) {
    faces = [];
  } finally {
    detecting = false;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!video.videoWidth) return;
  layout();
  drawVideo();
  if ((faceMesh || detector || segmenter) && now - lastDetect > 90) {
    lastDetect = now;
    detectFrame();
    if (now - lastPost > 280) {
      lastPost = now;
      post({ type: 'status', engine: faceMesh ? 'mesh' : 'box', faces: faces.length });
    }
  }
  paintFrame();
}

window.applyFilter = function (next) {
  filter = next && next.style && next.style !== 'none' ? next : null;
};

window.capturePhoto = function () {
  try {
    const base64 = (canvas.toDataURL('image/jpeg', 0.72).split(',')[1]) || '';
    post({ type: 'photo', base64: base64 });
  } catch (error) {
    post({ type: 'error', message: 'Não foi possível capturar a foto.' });
  }
};

async function relaxZoom(stream) {
  try {
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : null;
    if (caps && typeof caps.zoom === 'object' && caps.zoom.min != null) {
      await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] });
    }
  } catch (error) {
    // o aparelho não deixa ajustar o zoom
  }
}

async function boot() {
  try {
    post({ type: 'status', engine: 'loading', faces: 0 });
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user' }
    });
    await relaxZoom(stream);
    video.srcObject = stream;
    await video.play();
    if ('FaceDetector' in window) {
      try {
        detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch (error) {
        detector = null;
      }
    }
    requestAnimationFrame(frame);
    post({ type: 'status', engine: detector ? 'box' : 'loading', faces: 0 });
    const bases = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/',
      'https://unpkg.com/@mediapipe/face_mesh@0.4.1633559619/',
    ];
    for (const base of bases) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = base + 'face_mesh.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('arquivo do rastreador'));
          document.head.appendChild(script);
        });
        if (!window.FaceMesh) throw new Error('rastreador indisponível');
        const mesh = new window.FaceMesh({
          locateFile: (file) => base + file,
        });
        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
          selfieMode: false,
        });
        mesh.onResults((results) => {
          faces = results.multiFaceLandmarks || [];
        });
        await Promise.race([
          mesh.initialize(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('tempo')), 20000);
          }),
        ]);
        faceMesh = mesh;
        post({ type: 'status', engine: 'mesh', faces: 0 });
        break;
      } catch (error) {
        faceMesh = null;
      }
    }
    try {
      const segBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/';
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = segBase + 'selfie_segmentation.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('segmentação'));
        document.head.appendChild(script);
      });
      if (window.SelfieSegmentation) {
        const seg = new window.SelfieSegmentation({
          locateFile: (file) => segBase + file,
        });
        seg.setOptions({ modelSelection: 0 });
        seg.onResults((results) => {
          personMask = results.segmentationMask || null;
        });
        await seg.initialize();
        segmenter = seg;
      }
    } catch (error) {
      segmenter = null;
    }
    if (!faceMesh && !detector) {
      post({
        type: 'error',
        message: 'Não consegui iniciar o reconhecimento do rosto.',
      });
    }
  } catch (error) {
    post({ type: 'error', message: 'A câmera não abriu.' });
  }
}
boot();
</script>
</body>
</html>`;
}
