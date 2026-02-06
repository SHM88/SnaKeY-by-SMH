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
let showGrid = true;
let gameStarted = false;
let snakeStyle = "glossy";

function render() {
  ctx.clearRect(0, 0, board.width, board.height);
  drawBoardBackground();
  if (showGrid) drawGrid();

  state.snake.forEach((part, index) => {
    drawSnakeCell(part.x, part.y, cssVar("--snake"));
    if (index === 0) drawEyes(part, state.direction);
  });

  if (state.food) {
    drawFoodDot(state.food.x, state.food.y, cssVar("--food"));
  }

  if (state.bonusFood) {
    drawBonusPepper(state.bonusFood.x, state.bonusFood.y, cssVar("--bonus"));
  }

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
  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
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

function drawSnakeCell(x, y, color) {
  const px = x * cellSize + 1;
  const py = y * cellSize + 1;
  const size = cellSize - 2;
  const radius = Math.max(3, size * 0.18);

  if (snakeStyle === "classic") {
    ctx.fillStyle = color;
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    return;
  }

  if (snakeStyle === "neon") {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    roundRect(px, py, size, size, radius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    roundRect(px + 2, py + 2, size - 4, size - 4, radius * 0.8);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  roundRect(px, py, size, size, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  roundRect(px + 1.5, py + 1.5, size - 3, size * 0.45, radius * 0.7);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
  ctx.lineWidth = 1;
  roundRect(px + 0.5, py + 0.5, size - 1, size - 1, radius);
  ctx.stroke();
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
    state = tick(state);
    if (state.isGameOver && lives > 0) {
      lives -= 1;
      state = respawn(state);
      startCountdown();
    }
    if (state.score > highScore) {
      highScore = state.score;
      localStorage.setItem("snake:highScore", String(highScore));
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

render();

function cssVar(name) {
  const target = document.body || document.documentElement;
  return getComputedStyle(target).getPropertyValue(name).trim();
}
