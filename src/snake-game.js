import {
  createInitialState,
  setDirection,
  tick,
  togglePause,
  restart,
  respawn,
} from "./snake-core.js";

const board = document.getElementById("board");
const scoreNode = document.getElementById("score");
const highScoreNode = document.getElementById("high-score");
const livesNode = document.getElementById("lives");
const livesEmptyNode = document.getElementById("lives-empty");
const restartButton = document.getElementById("restart");
const themeToggle = document.getElementById("theme-toggle");
const difficultySelect = document.getElementById("difficulty");
const gridSizeSelect = document.getElementById("grid-size");
const gridToggle = document.getElementById("grid-toggle");
const gridThemeButtons = document.querySelectorAll(".theme-btn[data-grid-theme]");
const menu = document.getElementById("menu");
const startButton = document.getElementById("start-game");
const styleButtons = document.querySelectorAll(".style-btn[data-style]");
const controlButtons = document.querySelectorAll(".controls button[data-dir]");
const colorButtons = document.querySelectorAll(".color-swatch[data-color]");
const ctx = board.getContext("2d");

let gridSize = 24;
let cellSize = board.width / gridSize;
const DIFFICULTIES = {
  easy: { baseTick: 140, minTick: 140, stepScore: 9999, lives: 2 },
  medium: { baseTick: 140, minTick: 60, stepScore: 5, lives: 1 },
  hard: { baseTick: 120, minTick: 50, stepScore: 3, lives: 0 },
};

let state = createInitialState({
  width: gridSize,
  height: gridSize,
  wrapWalls: false,
});
let countdown = 0;
let tickId = null;
let lastTickMs = null;
let highScore = Number(localStorage.getItem("snake:highScore")) || 0;
let lives = 0;
let currentDifficulty = "medium";
const THEME_KEY = "snake:theme";
const COLOR_KEY = "snake:color";
const DIFFICULTY_KEY = "snake:difficulty";
const GRID_KEY = "snake:grid";
const GRID_SIZE_KEY = "snake:gridSize";
const STYLE_KEY = "snake:style";
const GRID_THEME_KEY = "snake:gridTheme";
let showGrid = true;
let gameStarted = false;
let snakeStyle = "glossy";
let gridTheme = "classic";
const particles = [];
let visualLoopId = null;

const effects = {
  shake: { end: 0, duration: 0, magnitude: 0 },
  zoom: { end: 0, duration: 0, magnitude: 0 },
};

function render() {
  ctx.clearRect(0, 0, board.width, board.height);
  const now = performance.now();
  ctx.save();
  applyCameraTransform(now);
  drawBoardBackground();
  if (showGrid) drawGrid();

  state.snake.forEach((part, index) => {
    const prev = state.snake[index - 1] || null;
    const next = state.snake[index + 1] || null;
    drawSnakeCell(
      part.x,
      part.y,
      cssVar("--snake"),
      index,
      state.snake.length,
      state.direction,
      prev,
      next
    );
    if (index === 0) drawEyes(part, state.direction);
  });

  if (state.food) {
    drawFoodDot(state.food.x, state.food.y, cssVar("--food"));
  }

  if (state.bonusFood) {
    drawBonusPepper(state.bonusFood.x, state.bonusFood.y, cssVar("--bonus"));
  }

  drawParticles();

  scoreNode.textContent = String(state.score);
  if (highScoreNode) highScoreNode.textContent = String(highScore);
  if (livesNode) {
    const maxLives = DIFFICULTIES[currentDifficulty].lives;
    livesNode.textContent = maxLives > 0 ? "❤".repeat(lives) : "0";
    if (livesEmptyNode) {
      const empty = Math.max(0, maxLives - lives);
      livesEmptyNode.textContent = empty > 0 ? "❤".repeat(empty) : "";
    }
  }

  if (state.isGameOver) {
    ctx.fillStyle = cssVar("--overlay");
    ctx.fillRect(0, 0, board.width, board.height);
    ctx.fillStyle = cssVar("--overlay-text");
    ctx.font = "bold 36px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", board.width / 2, board.height / 2 - 8);
    ctx.font = "18px system-ui";
    ctx.fillText("Press Restart", board.width / 2, board.height / 2 + 24);
  } else if (state.isPaused) {
    ctx.fillStyle = cssVar("--overlay");
    ctx.fillRect(0, 0, board.width, board.height);
    ctx.fillStyle = cssVar("--overlay-text");
    ctx.font = "bold 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Paused", board.width / 2, board.height / 2);
  } else if (countdown > 0) {
    ctx.fillStyle = cssVar("--overlay");
    ctx.fillRect(0, 0, board.width, board.height);
    ctx.fillStyle = cssVar("--overlay-text");
    ctx.font = "bold 36px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(String(countdown), board.width / 2, board.height / 2);
  }

  ctx.restore();
}

function drawBoardBackground() {
  ctx.fillStyle = cssVar("--board");
  ctx.fillRect(0, 0, board.width, board.height);
}

function drawFoodDot(x, y, color) {
  const cx = x * cellSize + cellSize / 2;
  const cy = y * cellSize + cellSize / 2;
  const radius = Math.max(2, cellSize * 0.18);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawBonusPepper(x, y, color) {
  const cx = x * cellSize + cellSize / 2;
  const cy = y * cellSize + cellSize / 2;
  const w = cellSize * 0.55;
  const h = cellSize * 0.7;
  const left = cx - w / 2;
  const top = cy - h / 2;

  ctx.save();
  const grad = ctx.createLinearGradient(left, top, left + w, top + h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(255,255,255,0.15)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.15, top + h * 0.2);
  ctx.quadraticCurveTo(left - w * 0.05, top + h * 0.6, left + w * 0.2, top + h * 0.9);
  ctx.quadraticCurveTo(left + w * 0.55, top + h * 1.05, left + w * 0.9, top + h * 0.78);
  ctx.quadraticCurveTo(left + w * 1.08, top + h * 0.55, left + w * 0.84, top + h * 0.32);
  ctx.quadraticCurveTo(left + w * 0.7, top + h * 0.1, left + w * 0.45, top + h * 0.15);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath();
  ctx.ellipse(left + w * 0.55, top + h * 0.4, w * 0.18, h * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.52, top + h * 0.14);
  ctx.quadraticCurveTo(left + w * 0.62, top + h * 0.02, left + w * 0.78, top + h * 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawGrid() {
  ctx.strokeStyle = cssVar("--grid-line");
  ctx.lineWidth = 1;
  for (let x = 0; x <= board.width; x += cellSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, board.height);
    ctx.stroke();
  }
  for (let y = 0; y <= board.height; y += cellSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(board.width, y);
    ctx.stroke();
  }
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(
    x * cellSize + 1,
    y * cellSize + 1,
    cellSize - 2,
    cellSize - 2
  );
}

function drawSnakeCell(x, y, color, index, total, headDirection, prev, next) {
  const px = x * cellSize + 1;
  const py = y * cellSize + 1;
  const size = cellSize - 2;
  const radius = Math.max(3, size * 0.18);
  const isHead = index === 0;
  const isTail = index === total - 1;
  const tailDir = isTail && prev ? getDirection({ x, y }, prev) : null;

  if (snakeStyle === "classic") {
    if (isHead) {
      ctx.fillStyle = color;
      drawHeadShape(px, py, size, radius, headDirection);
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
      ctx.lineWidth = 1;
      drawHeadShape(px + 0.5, py + 0.5, size - 1, radius * 0.8, headDirection);
      ctx.stroke();
      drawHeadLighting(px, py, size, headDirection);
      return;
    }

    if (isTail) {
      ctx.fillStyle = color;
      drawTailShape(px, py, size, radius, tailDir);
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
      ctx.lineWidth = 1;
      drawTailShape(px + 0.5, py + 0.5, size - 1, radius * 0.7, tailDir);
      ctx.stroke();
      return;
    }

    ctx.fillStyle = color;
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    drawBodyPattern(px, py, size);
    return;
  }

  if (snakeStyle === "neon") {
    const segmentColor = getNeonSegmentColor(color, index, total);
    const glowColor = toRgba(segmentColor, isHead ? 0.55 : 0.3);
    const neonRadius = Math.max(4, size * 0.24);
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isHead ? 18 : 10;
    ctx.fillStyle = segmentColor;
    if (isHead) {
      drawHeadShape(px, py, size, neonRadius, headDirection);
    } else if (isTail) {
      drawTailShape(px, py, size, neonRadius, tailDir);
    } else {
      roundRect(px, py, size, size, neonRadius);
    }
    ctx.fill();
    ctx.restore();

    if (isHead) drawHeadLighting(px, py, size, headDirection, true);

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    if (isHead) {
      drawHeadShape(px + 2, py + 2, size - 4, neonRadius * 0.7, headDirection);
    } else if (isTail) {
      drawTailShape(px + 2, py + 2, size - 4, neonRadius * 0.7, tailDir);
    } else {
      roundRect(px + 2, py + 2, size - 4, size - 4, neonRadius * 0.8);
    }
    ctx.fill();
    ctx.restore();
    if (!isHead) drawBodyPattern(px, py, size, 0.18);
    return;
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  if (isHead) {
    drawHeadShape(px, py, size, radius, headDirection);
  } else if (isTail) {
    drawTailShape(px, py, size, radius, tailDir);
  } else {
    roundRect(px, py, size, size, radius);
  }
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  if (isHead) {
    drawHeadShape(px + 1.5, py + 1.5, size - 3, radius * 0.7, headDirection);
  } else if (isTail) {
    drawTailShape(px + 1.5, py + 1.5, size - 3, radius * 0.7, tailDir);
  } else {
    roundRect(px + 1.5, py + 1.5, size - 3, size * 0.45, radius * 0.7);
  }
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
  ctx.lineWidth = 1;
  if (isHead) {
    drawHeadShape(px + 0.5, py + 0.5, size - 1, radius * 0.8, headDirection);
  } else if (isTail) {
    drawTailShape(px + 0.5, py + 0.5, size - 1, radius * 0.8, tailDir);
  } else {
    roundRect(px + 0.5, py + 0.5, size - 1, size - 1, radius);
  }
  ctx.stroke();
  if (isHead) drawHeadLighting(px, py, size, headDirection);
  if (!isHead) drawBodyPattern(px, py, size);
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function roundRectCustom(x, y, width, height, radii) {
  const { tl, tr, br, bl } = radii;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

function drawHeadShape(x, y, size, radius, direction) {
  const front = radius * 1.25;
  const back = radius * 0.5;
  if (direction === "right") {
    roundRectCustom(x, y, size, size, { tl: back, tr: front, br: front, bl: back });
  } else if (direction === "left") {
    roundRectCustom(x, y, size, size, { tl: front, tr: back, br: back, bl: front });
  } else if (direction === "down") {
    roundRectCustom(x, y, size, size, { tl: back, tr: back, br: front, bl: front });
  } else {
    roundRectCustom(x, y, size, size, { tl: front, tr: front, br: back, bl: back });
  }
}

function drawTailShape(x, y, size, radius, direction) {
  const inset = size * 0.08;
  const inner = size - inset * 2;
  const tailRadius = radius * 0.9;
  const tip = size * 0.35;
  const tailDir = direction || "right";

  ctx.beginPath();
  if (tailDir === "right") {
    roundRectCustom(x + inset + tip * 0.3, y + inset, inner - tip, inner, {
      tl: tailRadius,
      tr: tailRadius * 0.6,
      br: tailRadius * 0.6,
      bl: tailRadius,
    });
    ctx.moveTo(x + inset + tip * 0.3, y + inset + inner * 0.2);
    ctx.lineTo(x + inset, y + inset + inner / 2);
    ctx.lineTo(x + inset + tip * 0.3, y + inset + inner * 0.8);
  } else if (tailDir === "left") {
    roundRectCustom(x + inset, y + inset, inner - tip, inner, {
      tl: tailRadius * 0.6,
      tr: tailRadius,
      br: tailRadius,
      bl: tailRadius * 0.6,
    });
    ctx.moveTo(x + inset + inner - tip * 0.3, y + inset + inner * 0.2);
    ctx.lineTo(x + inset + inner, y + inset + inner / 2);
    ctx.lineTo(x + inset + inner - tip * 0.3, y + inset + inner * 0.8);
  } else if (tailDir === "down") {
    roundRectCustom(x + inset, y + inset, inner, inner - tip, {
      tl: tailRadius,
      tr: tailRadius,
      br: tailRadius * 0.6,
      bl: tailRadius * 0.6,
    });
    ctx.moveTo(x + inset + inner * 0.2, y + inset + inner - tip * 0.3);
    ctx.lineTo(x + inset + inner / 2, y + inset + inner);
    ctx.lineTo(x + inset + inner * 0.8, y + inset + inner - tip * 0.3);
  } else {
    roundRectCustom(x + inset, y + inset + tip, inner, inner - tip, {
      tl: tailRadius * 0.6,
      tr: tailRadius * 0.6,
      br: tailRadius,
      bl: tailRadius,
    });
    ctx.moveTo(x + inset + inner * 0.2, y + inset + tip * 0.3);
    ctx.lineTo(x + inset + inner / 2, y + inset);
    ctx.lineTo(x + inset + inner * 0.8, y + inset + tip * 0.3);
  }
  ctx.closePath();
}

function drawBodyPattern(x, y, size, alpha = 0.22) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  const stripeCount = 3;
  const stripeWidth = size * 0.15;
  for (let i = 0; i < stripeCount; i += 1) {
    const offset = (i + 1) * (size / (stripeCount + 1));
    ctx.beginPath();
    ctx.moveTo(x + offset, y + 2);
    ctx.lineTo(x + offset + stripeWidth, y + 2);
    ctx.lineTo(x + offset + stripeWidth * 0.5, y + size - 2);
    ctx.lineTo(x + offset - stripeWidth * 0.5, y + size - 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function getDirection(from, to) {
  if (!from || !to) return "right";
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  if (to.y > from.y) return "down";
  return "up";
}

function getNeonSegmentColor(baseColor, index, total) {
  const length = Math.max(1, total - 1);
  const t = total > 1 ? index / length : 0;
  const darker = mixColors(baseColor, "#000000", 0.35);
  const lighter = mixColors(baseColor, "#ffffff", 0.22);
  return mixColors(lighter, darker, t);
}

function mixColors(colorA, colorB, amount) {
  const a = parseHexColor(colorA);
  const b = parseHexColor(colorB);
  if (!a || !b) return colorA;
  const mix = (c1, c2) => Math.round(c1 + (c2 - c1) * amount);
  return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`;
}

function parseHexColor(hex) {
  if (!hex || typeof hex !== "string") return null;
  const value = hex.replace("#", "");
  if (value.length === 3) {
    const r = parseInt(value[0] + value[0], 16);
    const g = parseInt(value[1] + value[1], 16);
    const b = parseInt(value[2] + value[2], 16);
    return { r, g, b };
  }
  if (value.length === 6) {
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function toRgba(color, alpha) {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function drawHeadLighting(x, y, size, direction, isNeon = false) {
  const lead = size * 0.35;
  const band = size * 0.18;
  let gx0 = x;
  let gy0 = y;
  let gx1 = x + size;
  let gy1 = y + size;
  let highlightX = x + size * 0.2;
  let highlightY = y + size * 0.2;
  let highlightW = size * 0.35;
  let highlightH = size * 0.18;

  if (direction === "right") {
    gx0 = x;
    gx1 = x + size;
    highlightX = x + size - lead;
    highlightY = y + size * 0.25;
    highlightW = lead * 0.75;
    highlightH = band;
  } else if (direction === "left") {
    gx0 = x + size;
    gx1 = x;
    highlightX = x + lead * 0.25;
    highlightY = y + size * 0.25;
    highlightW = lead * 0.75;
    highlightH = band;
  } else if (direction === "down") {
    gy0 = y;
    gy1 = y + size;
    highlightX = x + size * 0.25;
    highlightY = y + size - lead;
    highlightW = band;
    highlightH = lead * 0.75;
  } else {
    gy0 = y + size;
    gy1 = y;
    highlightX = x + size * 0.25;
    highlightY = y + lead * 0.25;
    highlightW = band;
    highlightH = lead * 0.75;
  }

  ctx.save();
  const shade = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  shade.addColorStop(0, isNeon ? "rgba(0, 0, 0, 0.08)" : "rgba(0, 0, 0, 0.12)");
  shade.addColorStop(1, "rgba(255, 255, 255, 0.12)");
  ctx.fillStyle = shade;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
  ctx.beginPath();
  ctx.roundRect(highlightX, highlightY, highlightW, highlightH, band * 0.6);
  ctx.fill();
  ctx.restore();
}

function drawEyes(head, direction) {
  const baseX = head.x * cellSize;
  const baseY = head.y * cellSize;
  const center = {
    x: baseX + cellSize / 2,
    y: baseY + cellSize / 2,
  };
  const separation = cellSize * 0.14;
  const forward = cellSize * 0.12;
  const eyeRadius = cellSize * 0.09;

  let left = { x: center.x - separation, y: center.y - separation };
  let right = { x: center.x + separation, y: center.y - separation };

  if (direction === "down") {
    left = { x: center.x - separation, y: center.y + forward };
    right = { x: center.x + separation, y: center.y + forward };
  } else if (direction === "left") {
    left = { x: center.x - forward, y: center.y - separation };
    right = { x: center.x - forward, y: center.y + separation };
  } else if (direction === "right") {
    left = { x: center.x + forward, y: center.y - separation };
    right = { x: center.x + forward, y: center.y + separation };
  } else {
    left = { x: center.x - separation, y: center.y - forward };
    right = { x: center.x + separation, y: center.y - forward };
  }

  ctx.fillStyle = cssVar("--eye");
  ctx.beginPath();
  ctx.arc(left.x, left.y, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(right.x, right.y, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function applyCameraTransform(now) {
  const shake = effects.shake;
  const zoom = effects.zoom;

  let shakeX = 0;
  let shakeY = 0;
  if (now < shake.end) {
    const t = (shake.end - now) / shake.duration;
    const strength = shake.magnitude * t;
    shakeX = (Math.random() * 2 - 1) * strength;
    shakeY = (Math.random() * 2 - 1) * strength;
  }

  let scale = 1;
  if (now < zoom.end) {
    const t = (zoom.end - now) / zoom.duration;
    scale += zoom.magnitude * t * t;
  }

  const cx = board.width / 2;
  const cy = board.height / 2;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  if (shakeX || shakeY) ctx.translate(shakeX, shakeY);
}

function startVisualLoop() {
  if (visualLoopId) return;
  let last = performance.now();
  const frame = (now) => {
    const delta = Math.min(40, now - last);
    last = now;
    updateVisuals(delta, now);
    render();
    if (hasActiveVisuals(now)) {
      visualLoopId = requestAnimationFrame(frame);
    } else {
      visualLoopId = null;
    }
  };
  visualLoopId = requestAnimationFrame(frame);
}

function hasActiveVisuals(now) {
  return (
    now < effects.shake.end ||
    now < effects.zoom.end ||
    particles.length > 0
  );
}

function updateVisuals(delta, now) {
  if (!particles.length) return;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx * (delta / 1000);
    particle.y += particle.vy * (delta / 1000);
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    particle.life -= delta / particle.ttl;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function triggerShake(magnitude = 10, duration = 260) {
  const now = performance.now();
  effects.shake = { end: now + duration, duration, magnitude };
  startVisualLoop();
}

function triggerZoom(magnitude = 0.07, duration = 180) {
  const now = performance.now();
  effects.zoom = { end: now + duration, duration, magnitude };
  startVisualLoop();
}

function spawnParticles(x, y, color, count = 14) {
  const cx = x * cellSize + cellSize / 2;
  const cy = y * cellSize + cellSize / 2;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = cellSize * (0.6 + Math.random() * 0.8);
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      ttl: 420 + Math.random() * 180,
      size: Math.max(1.5, cellSize * (0.08 + Math.random() * 0.05)),
      color,
    });
  }
  startVisualLoop();
}

function handleDirectionInput(direction) {
  state = setDirection(state, direction);
  render();
}

function onKeyDown(event) {
  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    a: "left",
    s: "down",
    d: "right",
    W: "up",
    A: "left",
    S: "down",
    D: "right",
  };

  if (event.code === "Space") {
    event.preventDefault();
    state = togglePause(state);
    render();
    return;
  }

  const direction = map[event.key];
  if (!direction) return;
  event.preventDefault();
  handleDirectionInput(direction);
}

for (const button of controlButtons) {
  button.addEventListener("click", () => {
    const direction = button.dataset.dir;
    if (direction) handleDirectionInput(direction);
  });
}

function resetBoard(nextGridSize) {
  gridSize = nextGridSize;
  cellSize = board.width / gridSize;
  state = createInitialState({
    width: gridSize,
    height: gridSize,
    wrapWalls: currentDifficulty === "easy",
  });
  lives = DIFFICULTIES[currentDifficulty].lives;
  if (gameStarted) {
    startCountdown();
    startLoop();
  }
  render();
}

restartButton.addEventListener("click", () => {
  state = restart(state);
  lives = DIFFICULTIES[currentDifficulty].lives;
  if (!gameStarted) {
    startGame();
    return;
  }
  startCountdown();
  render();
});

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  render();
});

colorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const color = button.dataset.color;
    if (!color) return;
    document.body.style.setProperty("--snake", color);
    localStorage.setItem(COLOR_KEY, color);
    colorButtons.forEach((btn) =>
      btn.setAttribute("aria-pressed", btn === button ? "true" : "false")
    );
    render();
  });
});

if (difficultySelect) {
  difficultySelect.addEventListener("change", () => {
    const value = difficultySelect.value;
    if (!DIFFICULTIES[value]) return;
    currentDifficulty = value;
    localStorage.setItem(DIFFICULTY_KEY, value);
    resetBoard(gridSize);
  });
}

if (gridSizeSelect) {
  gridSizeSelect.addEventListener("change", () => {
    const value = Number(gridSizeSelect.value);
    if (!value || Number.isNaN(value)) return;
    localStorage.setItem(GRID_SIZE_KEY, String(value));
    resetBoard(value);
  });
}

if (gridToggle) {
  gridToggle.addEventListener("change", () => {
    showGrid = gridToggle.checked;
    localStorage.setItem(GRID_KEY, showGrid ? "on" : "off");
    render();
  });
}

gridThemeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextTheme = button.dataset.gridTheme;
    if (!nextTheme) return;
    gridTheme = nextTheme;
    document.body.setAttribute("data-grid-theme", nextTheme);
    localStorage.setItem(GRID_THEME_KEY, nextTheme);
    gridThemeButtons.forEach((btn) =>
      btn.setAttribute("aria-pressed", btn === button ? "true" : "false")
    );
    render();
  });
});

styleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextStyle = button.dataset.style;
    if (!nextStyle) return;
    snakeStyle = nextStyle;
    localStorage.setItem(STYLE_KEY, nextStyle);
    styleButtons.forEach((btn) =>
      btn.setAttribute("aria-pressed", btn === button ? "true" : "false")
    );
    render();
  });
});

function startGame() {
  gameStarted = true;
  if (menu) menu.classList.add("hidden");
  startLoop();
  startCountdown();
  render();
}

if (startButton) {
  startButton.addEventListener("click", () => {
    startGame();
  });
}

document.addEventListener("keydown", onKeyDown);

function getTickMs(score) {
  const config = DIFFICULTIES[currentDifficulty];
  const steps = Math.floor(score / config.stepScore);
  return Math.max(config.minTick, config.baseTick - steps * 10);
}

function startLoop() {
  if (tickId) clearInterval(tickId);
  lastTickMs = getTickMs(state.score);
  tickId = setInterval(() => {
    if (countdown > 0) return;
    const prevState = state;
    state = tick(state);
    const died = !prevState.isGameOver && state.isGameOver;
    if (state.isGameOver && lives > 0) {
      lives -= 1;
      state = respawn(state);
      startCountdown();
    }
    if (died) triggerShake(12, 260);
    if (state.score > highScore) {
      highScore = state.score;
      localStorage.setItem("snake:highScore", String(highScore));
    }
    const head = state.snake[0];
    const ateFood =
      prevState.food &&
      head.x === prevState.food.x &&
      head.y === prevState.food.y &&
      state.score === prevState.score + 1;
    const ateBonus =
      prevState.bonusFood &&
      head.x === prevState.bonusFood.x &&
      head.y === prevState.bonusFood.y;
    if (ateFood) {
      spawnParticles(prevState.food.x, prevState.food.y, cssVar("--food"));
      triggerZoom();
    } else if (ateBonus) {
      spawnParticles(prevState.bonusFood.x, prevState.bonusFood.y, cssVar("--bonus"), 18);
      triggerZoom(0.09, 220);
    }
    const nextTickMs = getTickMs(state.score);
    if (nextTickMs !== lastTickMs) {
      startLoop();
      return;
    }
    render();
  }, lastTickMs);
}

function startCountdown() {
  countdown = 3;
  const interval = setInterval(() => {
    countdown -= 1;
    if (countdown <= 0) {
      countdown = 0;
      clearInterval(interval);
    }
    render();
  }, 700);
}

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "Light mode";
}

const savedColor = localStorage.getItem(COLOR_KEY);
if (savedColor) {
  document.body.style.setProperty("--snake", savedColor);
  colorButtons.forEach((btn) =>
    btn.setAttribute("aria-pressed", btn.dataset.color === savedColor ? "true" : "false")
  );
}

const savedDifficulty = localStorage.getItem(DIFFICULTY_KEY);
if (savedDifficulty && DIFFICULTIES[savedDifficulty]) {
  currentDifficulty = savedDifficulty;
  if (difficultySelect) difficultySelect.value = savedDifficulty;
}

const savedGrid = localStorage.getItem(GRID_KEY);
if (savedGrid === "off") {
  showGrid = false;
  if (gridToggle) gridToggle.checked = false;
}

const savedGridSize = Number(localStorage.getItem(GRID_SIZE_KEY));
if (savedGridSize && !Number.isNaN(savedGridSize)) {
  gridSize = savedGridSize;
  if (gridSizeSelect) gridSizeSelect.value = String(savedGridSize);
}

const savedGridTheme = localStorage.getItem(GRID_THEME_KEY);
if (savedGridTheme) {
  gridTheme = savedGridTheme;
}

const savedStyle = localStorage.getItem(STYLE_KEY);
if (savedStyle) {
  snakeStyle = savedStyle;
  styleButtons.forEach((btn) =>
    btn.setAttribute("aria-pressed", btn.dataset.style === savedStyle ? "true" : "false")
  );
}

lives = DIFFICULTIES[currentDifficulty].lives;
state = createInitialState({
  width: gridSize,
  height: gridSize,
  wrapWalls: currentDifficulty === "easy",
});
cellSize = board.width / gridSize;

document.body.setAttribute("data-grid-theme", gridTheme);
gridThemeButtons.forEach((btn) =>
  btn.setAttribute("aria-pressed", btn.dataset.gridTheme === gridTheme ? "true" : "false")
);

render();

function cssVar(name) {
  const target = document.body || document.documentElement;
  return getComputedStyle(target).getPropertyValue(name).trim();
}
