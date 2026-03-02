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
const obstaclesToggle = document.getElementById("obstacles-toggle");
const slitherToggle = document.getElementById("slither-toggle");
const musicToggle = document.getElementById("music-toggle");
const dailyToggle = document.getElementById("daily-toggle");
const gridThemeButtons = document.querySelectorAll(".theme-btn[data-grid-theme]");
const menu = document.getElementById("menu");
const startButton = document.getElementById("start-game");
const styleButtons = document.querySelectorAll(".style-btn[data-style]");
const colorButtons = document.querySelectorAll(".color-swatch[data-color]");
const ctx = board.getContext("2d");

let gridSize = 24;
let cellSize = board.width / gridSize;
let obstaclesEnabled = false;
let slitherEnabled = true;
let currentDifficulty = "medium";
const DIFFICULTIES = {
  easy: { baseTick: 140, minTick: 140, stepScore: 9999, lives: 2 },
  medium: { baseTick: 140, minTick: 60, stepScore: 5, lives: 1 },
  hard: { baseTick: 120, minTick: 50, stepScore: 3, lives: 0 },
};

let state = createInitialState({
  width: gridSize,
  height: gridSize,
  wrapWalls: currentDifficulty === "easy",
  obstacles: obstaclesEnabled,
});
let countdown = 0;
let tickId = null;
let lastTickMs = null;
let highScore = Number(localStorage.getItem("snake:highScore")) || 0;
let lives = 0;
const THEME_KEY = "snake:theme";
const COLOR_KEY = "snake:color";
const DIFFICULTY_KEY = "snake:difficulty";
const GRID_KEY = "snake:grid";
const GRID_SIZE_KEY = "snake:gridSize";
const STYLE_KEY = "snake:style";
const GRID_THEME_KEY = "snake:gridTheme";
const DAILY_KEY = "snake:daily";
const OBSTACLES_KEY = "snake:obstacles";
const SLITHER_KEY = "snake:slither";
const MUSIC_KEY = "snake:music";
let showGrid = true;
let gameStarted = false;
let snakeStyle = "glossy";
let gridTheme = "classic";
let dailyMode = false;
let rng = Math.random;
let currentDailySeed = "";
const particles = [];
const popBursts = [];
let visualLoopId = null;
let musicEnabled = true;
let audioCtx = null;
let musicGain = null;
let musicTimer = null;
let musicStep = 0;

const MUSIC_TEMPO_MS = 220;
const MUSIC_LEAD = [64, 67, 69, 71, 72, 71, 69, 67, 64, 67, 69, 67, 65, 64, 62, null];
const MUSIC_BASS = [40, null, 40, null, 43, null, 38, null];

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
  if (state.walls?.length) drawWalls();

  state.snake.forEach((part, index) => {
    const prev = state.snake[index - 1] || null;
    const next = state.snake[index + 1] || null;
    const slither = slitherEnabled
      ? getSlitherOffset(
          part,
          index,
          state.snake.length,
          prev,
          next,
          state.direction,
          now
        )
      : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(slither.x, slither.y);
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
    ctx.restore();
  });

  if (state.food) {
    drawFoodDot(state.food.x, state.food.y, cssVar("--food"));
  }

  if (state.bonusFood) {
    const isBlinking = state.bonusTimer > 0 && state.bonusTimer <= 6;
    if (!isBlinking || state.bonusTimer % 2 === 0) {
      drawBonusPepper(state.bonusFood.x, state.bonusFood.y, cssVar("--bonus"));
    }
  }

  drawParticles();

  scoreNode.textContent = String(state.score);
  if (highScoreNode) highScoreNode.textContent = String(highScore);
  if (livesNode) {
    const maxLives = DIFFICULTIES[currentDifficulty].lives;
    if (maxLives > 0) {
      livesNode.textContent = lives === 0 ? "❤ x0" : "❤".repeat(lives);
    } else {
      livesNode.textContent = "❤ x0";
    }
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
    ctx.fillText("Press R to Restart", board.width / 2, board.height / 2 + 24);
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

function drawWalls() {
  ctx.fillStyle = cssVar("--wall");
  ctx.strokeStyle = cssVar("--wall-stroke");
  ctx.lineWidth = 1;
  state.walls.forEach((wall) => {
    const x = wall.x * cellSize;
    const y = wall.y * cellSize;
    ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    ctx.strokeRect(x + 2.5, y + 2.5, cellSize - 5, cellSize - 5);
  });
}

function drawFoodDot(x, y, color) {
  const cx = x * cellSize + cellSize / 2;
  const cy = y * cellSize + cellSize / 2;
  const t = performance.now() / 1000;
  const pulse = 1 + Math.sin(t * 5.2 + x * 0.35 + y * 0.2) * 0.06;
  const radius = Math.max(3, cellSize * 0.22) * pulse;
  const rim = Math.max(1, cellSize * 0.035);

  ctx.save();
  ctx.shadowColor = toRgba(color, 0.32);
  ctx.shadowBlur = cellSize * 0.24;

  const grad = ctx.createRadialGradient(
    cx - radius * 0.42,
    cy - radius * 0.42,
    radius * 0.14,
    cx + radius * 0.55,
    cy + radius * 0.62,
    radius * 1.22
  );
  grad.addColorStop(0, mixColors(color, "#ffffff", 0.42));
  grad.addColorStop(0.58, color);
  grad.addColorStop(1, mixColors(color, "#000000", 0.3));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Thin rim improves contrast on busy boards without looking cartoonish.
  ctx.lineWidth = rim;
  ctx.strokeStyle = toRgba(mixColors(color, "#ffffff", 0.3), 0.75);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
  ctx.beginPath();
  ctx.ellipse(
    cx - radius * 0.33,
    cy - radius * 0.35,
    radius * 0.33,
    radius * 0.24,
    -0.38,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.ellipse(
    cx + radius * 0.16,
    cy + radius * 0.12,
    radius * 0.18,
    radius * 0.12,
    0.22,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

function drawBonusPepper(x, y, color) {
  const t = performance.now() / 1000;
  const pulse = 1 + Math.sin(t * 4.5 + x * 0.28 + y * 0.2) * 0.05;
  const cx = x * cellSize + cellSize / 2;
  const cy = y * cellSize + cellSize / 2;
  const w = cellSize * 0.55 * pulse;
  const h = cellSize * 0.7 * pulse;
  const left = cx - w / 2;
  const top = cy - h / 2;

  ctx.save();
  ctx.shadowColor = toRgba(color, 0.32);
  ctx.shadowBlur = cellSize * 0.2;

  const grad = ctx.createLinearGradient(left, top, left + w, top + h);
  grad.addColorStop(0, mixColors(color, "#ffffff", 0.28));
  grad.addColorStop(0.58, color);
  grad.addColorStop(1, mixColors(color, "#000000", 0.32));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.15, top + h * 0.2);
  ctx.quadraticCurveTo(left - w * 0.05, top + h * 0.6, left + w * 0.2, top + h * 0.9);
  ctx.quadraticCurveTo(left + w * 0.55, top + h * 1.05, left + w * 0.9, top + h * 0.78);
  ctx.quadraticCurveTo(left + w * 1.08, top + h * 0.55, left + w * 0.84, top + h * 0.32);
  ctx.quadraticCurveTo(left + w * 0.7, top + h * 0.1, left + w * 0.45, top + h * 0.15);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  const innerGrad = ctx.createRadialGradient(
    left + w * 0.42,
    top + h * 0.34,
    w * 0.08,
    left + w * 0.62,
    top + h * 0.62,
    w * 0.75
  );
  innerGrad.addColorStop(0, "rgba(255,255,255,0.28)");
  innerGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = innerGrad;
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.34)";
  ctx.lineWidth = Math.max(1, cellSize * 0.03);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.33)";
  ctx.beginPath();
  ctx.ellipse(left + w * 0.52, top + h * 0.38, w * 0.2, h * 0.13, -0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.beginPath();
  ctx.ellipse(left + w * 0.68, top + h * 0.68, w * 0.12, h * 0.08, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = Math.max(1.6, cellSize * 0.07);
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

function getSlitherOffset(part, index, total, prev, next, fallbackDirection, nowMs) {
  const time = nowMs / 1000;
  const phase = time * 4.6 + index * 0.65;
  const primary = Math.sin(phase);
  const secondary = Math.sin(phase * 0.5 + 1.2) * 0.2;
  const wave = primary * 0.8 + secondary;
  const centerBias =
    total > 1 ? 1 - Math.abs(index / (total - 1) - 0.5) * 1.3 : 1;
  const amplitudeScale = clamp(centerBias, 0.35, 1);
  const baseAmplitude = Math.max(0.8, cellSize * 0.05 * amplitudeScale);
  const dir = getSegmentVector(part, prev, next, fallbackDirection);
  const perp = { x: -dir.y, y: dir.x };
  return {
    x: perp.x * baseAmplitude * wave,
    y: perp.y * baseAmplitude * wave,
  };
}

function getSegmentVector(part, prev, next, fallbackDirection) {
  const vector = { x: 0, y: 0 };
  if (prev && next) {
    vector.x = next.x - prev.x;
    vector.y = next.y - prev.y;
  } else if (next) {
    vector.x = next.x - part.x;
    vector.y = next.y - part.y;
  } else if (prev) {
    vector.x = part.x - prev.x;
    vector.y = part.y - prev.y;
  } else {
    return directionToVector(fallbackDirection);
  }

  if (vector.x !== 0) vector.x = Math.sign(vector.x);
  if (vector.y !== 0) vector.y = Math.sign(vector.y);
  if (vector.x === 0 && vector.y === 0) {
    return directionToVector(fallbackDirection);
  }
  return vector;
}

function directionToVector(direction) {
  if (direction === "down") return { x: 0, y: 1 };
  if (direction === "left") return { x: -1, y: 0 };
  if (direction === "right") return { x: 1, y: 0 };
  return { x: 0, y: -1 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  const eyeRadius = cellSize * 0.11;
  const pupilRadius = eyeRadius * 0.45;

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

  const now = performance.now() / 1000;
  const wobble = Math.sin(now * 6) * eyeRadius * 0.12;
  const look = getLookOffset(direction, eyeRadius * 0.35);

  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "rgba(15, 23, 42, 0.25)";
  ctx.lineWidth = Math.max(1, cellSize * 0.03);
  ctx.beginPath();
  ctx.arc(left.x, left.y, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(right.x, right.y, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0b1020";
  ctx.beginPath();
  ctx.arc(
    left.x + look.x + wobble,
    left.y + look.y + wobble,
    pupilRadius,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.beginPath();
  ctx.arc(
    right.x + look.x + wobble,
    right.y + look.y - wobble,
    pupilRadius,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function getLookOffset(direction, distance) {
  if (direction === "down") return { x: 0, y: distance };
  if (direction === "left") return { x: -distance, y: 0 };
  if (direction === "right") return { x: distance, y: 0 };
  return { x: 0, y: -distance };
}

function drawParticles() {
  drawPopBursts();
  for (const particle of particles) {
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPopBursts() {
  for (const burst of popBursts) {
    const progress = 1 - burst.life;
    const radius = burst.startRadius + (burst.endRadius - burst.startRadius) * progress;
    ctx.globalAlpha = burst.life * 0.8;
    ctx.strokeStyle = burst.color;
    ctx.lineWidth = burst.lineWidth * burst.life;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
    ctx.stroke();
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
    particles.length > 0 ||
    popBursts.length > 0 ||
    (slitherEnabled &&
      gameStarted &&
      !state.isPaused &&
      !state.isGameOver &&
      countdown === 0)
  );
}

function updateVisuals(delta, now) {
  if (particles.length) {
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

  if (popBursts.length) {
    for (let i = popBursts.length - 1; i >= 0; i -= 1) {
      const burst = popBursts[i];
      burst.life -= delta / burst.ttl;
      if (burst.life <= 0) popBursts.splice(i, 1);
    }
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

function spawnPopBurst(x, y, color, strength = 1) {
  const cx = x * cellSize + cellSize / 2;
  const cy = y * cellSize + cellSize / 2;
  popBursts.push({
    x: cx,
    y: cy,
    life: 1,
    ttl: 180 + strength * 80,
    startRadius: cellSize * (0.12 + strength * 0.02),
    endRadius: cellSize * (0.52 + strength * 0.12),
    lineWidth: Math.max(1.4, cellSize * 0.1),
    color: toRgba(color, 0.9),
  });
  startVisualLoop();
}

function handleDirectionInput(direction) {
  state = setDirection(state, direction);
  render();
}

function onKeyDown(event) {
  activateMusic();
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
    if (!state.isPaused && slitherEnabled && gameStarted) {
      startVisualLoop();
    }
    render();
    return;
  }
  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    rng = getRng(true);
    state = restart(state, rng);
    lives = DIFFICULTIES[currentDifficulty].lives;
    if (!gameStarted) {
      startGame();
      return;
    }
    startCountdown();
    render();
    return;
  }

  const direction = map[event.key];
  if (!direction) return;
  event.preventDefault();
  handleDirectionInput(direction);
}


function resetBoard(nextGridSize) {
  gridSize = nextGridSize;
  cellSize = board.width / gridSize;
  rng = getRng();
  state = createInitialState({
    width: gridSize,
    height: gridSize,
    wrapWalls: currentDifficulty === "easy",
    obstacles: obstaclesEnabled,
    rng,
  });
  lives = DIFFICULTIES[currentDifficulty].lives;
  if (gameStarted) {
    startCountdown();
    startLoop();
  }
  render();
}

restartButton.addEventListener("click", () => {
  activateMusic();
  rng = getRng(true);
  state = restart(state, rng);
  lives = DIFFICULTIES[currentDifficulty].lives;
  if (!gameStarted) {
    startGame();
    return;
  }
  startCountdown();
  render();
});

themeToggle.addEventListener("click", () => {
  activateMusic();
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

if (obstaclesToggle) {
  obstaclesToggle.addEventListener("change", () => {
    obstaclesEnabled = obstaclesToggle.checked;
    localStorage.setItem(OBSTACLES_KEY, obstaclesEnabled ? "on" : "off");
    resetBoard(gridSize);
  });
}

if (slitherToggle) {
  slitherToggle.addEventListener("change", () => {
    slitherEnabled = slitherToggle.checked;
    localStorage.setItem(SLITHER_KEY, slitherEnabled ? "on" : "off");
    if (slitherEnabled && gameStarted) {
      startVisualLoop();
    }
    render();
  });
}

if (musicToggle) {
  musicToggle.addEventListener("change", () => {
    musicEnabled = musicToggle.checked;
    localStorage.setItem(MUSIC_KEY, musicEnabled ? "on" : "off");
    if (musicEnabled) {
      activateMusic();
    } else {
      stopMusicLoop();
    }
  });
}

if (dailyToggle) {
  dailyToggle.addEventListener("change", () => {
    dailyMode = dailyToggle.checked;
    localStorage.setItem(DAILY_KEY, dailyMode ? "on" : "off");
    resetBoard(gridSize);
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
  activateMusic();
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
document.addEventListener("pointerdown", activateMusic, { passive: true });

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
    state = tick(state, rng);
    const died = !prevState.isGameOver && state.isGameOver;
    if (state.isGameOver && lives > 0) {
      lives -= 1;
      state = respawn(state, rng);
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
      spawnPopBurst(prevState.food.x, prevState.food.y, cssVar("--food"), 1);
      triggerZoom(0.1, 190);
      triggerShake(2.5, 120);
    } else if (ateBonus) {
      spawnParticles(prevState.bonusFood.x, prevState.bonusFood.y, cssVar("--bonus"), 18);
      spawnPopBurst(prevState.bonusFood.x, prevState.bonusFood.y, cssVar("--bonus"), 1.45);
      triggerZoom(0.14, 240);
      triggerShake(4, 150);
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
      if (slitherEnabled && gameStarted) {
        startVisualLoop();
      }
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

const savedObstacles = localStorage.getItem(OBSTACLES_KEY);
if (savedObstacles === "on") {
  obstaclesEnabled = true;
  if (obstaclesToggle) obstaclesToggle.checked = true;
}

const savedDaily = localStorage.getItem(DAILY_KEY);
if (savedDaily === "on") {
  dailyMode = true;
  if (dailyToggle) dailyToggle.checked = true;
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

const savedSlither = localStorage.getItem(SLITHER_KEY);
if (savedSlither === "off") {
  slitherEnabled = false;
  if (slitherToggle) slitherToggle.checked = false;
}

const savedMusic = localStorage.getItem(MUSIC_KEY);
if (savedMusic === "off") {
  musicEnabled = false;
  if (musicToggle) musicToggle.checked = false;
}

lives = DIFFICULTIES[currentDifficulty].lives;
currentDailySeed = getDailySeed();
if (dailyMode) rng = getRng(true);
state = createInitialState({
  width: gridSize,
  height: gridSize,
  wrapWalls: currentDifficulty === "easy",
  obstacles: obstaclesEnabled,
  rng,
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

function getDailySeed() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getRng(forceRefresh = false) {
  if (!dailyMode) return Math.random;
  const today = getDailySeed();
  if (forceRefresh || today !== currentDailySeed) {
    currentDailySeed = today;
  }
  return mulberry32(hashString(currentDailySeed));
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function activateMusic() {
  if (!musicEnabled) return;
  ensureAudioContext();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  startMusicLoop();
}

function ensureAudioContext() {
  if (audioCtx) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  audioCtx = new AudioCtor();
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.06;
  musicGain.connect(audioCtx.destination);
}

function startMusicLoop() {
  if (!audioCtx || musicTimer) return;
  musicTimer = setInterval(() => {
    playMusicStep();
  }, MUSIC_TEMPO_MS);
  playMusicStep();
}

function stopMusicLoop() {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = null;
}

function playMusicStep() {
  if (!audioCtx || !musicGain) return;
  const step = musicStep;
  const leadNote = MUSIC_LEAD[step % MUSIC_LEAD.length];
  const bassNote = MUSIC_BASS[step % MUSIC_BASS.length];
  const now = audioCtx.currentTime;
  const beat = MUSIC_TEMPO_MS / 1000;

  if (leadNote != null) {
    scheduleSynthNote(midiToFreq(leadNote), now, beat * 0.92, "triangle", 0.75);
  }
  if (bassNote != null) {
    scheduleSynthNote(midiToFreq(bassNote), now, beat * 0.98, "sine", 0.52);
  }
  musicStep += 1;
}

function scheduleSynthNote(freq, when, duration, type, level) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), when + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function midiToFreq(note) {
  return 440 * 2 ** ((note - 69) / 12);
}
