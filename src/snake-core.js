export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function createInitialState({
  width = 20,
  height = 20,
  wrapWalls = false,
  rng = Math.random,
} = {}) {
  const startX = Math.floor(width / 2);
  const startY = Math.floor(height / 2);
  const snake = [{ x: startX, y: startY }];
  return {
    width,
    height,
    wrapWalls,
    snake,
    direction: "right",
    pendingDirection: "right",
    food: placeFood(width, height, snake, rng),
    bonusFood: null,
    bonusTimer: 0,
    score: 0,
    isGameOver: false,
    isPaused: false,
  };
}

export function setDirection(state, nextDirection) {
  if (!DIRECTIONS[nextDirection]) return state;
  if (OPPOSITE[state.direction] === nextDirection) return state;
  return { ...state, pendingDirection: nextDirection };
}

export function togglePause(state) {
  if (state.isGameOver) return state;
  return { ...state, isPaused: !state.isPaused };
}

export function restart(state, rng = Math.random) {
  return createInitialState({
    width: state.width,
    height: state.height,
    wrapWalls: state.wrapWalls,
    rng,
  });
}

export function respawn(state, rng = Math.random) {
  const startX = Math.floor(state.width / 2);
  const startY = Math.floor(state.height / 2);
  const length = Math.max(1, state.snake.length);
  const snake = Array.from({ length }, (_, index) => ({
    x: startX - index,
    y: startY,
  }));
  return {
    ...state,
    snake,
    direction: "right",
    pendingDirection: "right",
    food: placeFood(state.width, state.height, snake, rng),
    bonusFood: null,
    bonusTimer: 0,
    isGameOver: false,
    isPaused: false,
  };
}

export function tick(state, rng = Math.random) {
  if (state.isGameOver || state.isPaused) return state;

  const direction = state.pendingDirection;
  const head = state.snake[0];
  const delta = DIRECTIONS[direction];
  let nextHead = { x: head.x + delta.x, y: head.y + delta.y };

  if (state.wrapWalls) {
    if (nextHead.x < 0) nextHead.x = state.width - 1;
    if (nextHead.y < 0) nextHead.y = state.height - 1;
    if (nextHead.x >= state.width) nextHead.x = 0;
    if (nextHead.y >= state.height) nextHead.y = 0;
  } else if (
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= state.width ||
    nextHead.y >= state.height
  ) {
    return { ...state, direction, isGameOver: true };
  }

  const ateFood =
    state.food &&
    nextHead.x === state.food.x &&
    nextHead.y === state.food.y;
  const ateBonus =
    state.bonusFood &&
    nextHead.x === state.bonusFood.x &&
    nextHead.y === state.bonusFood.y;
  const nextSnake = [nextHead, ...state.snake];
  if (!ateFood && !ateBonus) {
    nextSnake.pop();
  }

  if (hitsSelf(nextSnake)) {
    return { ...state, direction, isGameOver: true };
  }

  const nextState = {
    ...state,
    direction,
    snake: nextSnake,
  };

  if (ateFood) {
    nextState.food = placeFood(state.width, state.height, nextSnake, rng);
    nextState.score = state.score + 1;
  }

  if (ateBonus) {
    nextState.bonusFood = null;
    nextState.bonusTimer = 0;
    nextState.score = (nextState.score ?? state.score) + 3;
  }

  if (!ateFood && !ateBonus && state.bonusFood) {
    nextState.bonusTimer = Math.max(0, state.bonusTimer - 1);
    if (nextState.bonusTimer === 0) {
      nextState.bonusFood = null;
    }
  }

  if (!nextState.bonusFood && !ateBonus) {
    const shouldSpawnBonus = rng() < 0.15;
    if (shouldSpawnBonus) {
      nextState.bonusFood = placeFood(
        state.width,
        state.height,
        nextState.snake,
        rng
      );
      nextState.bonusTimer = nextState.bonusFood ? 35 : 0;
    }
  }

  return nextState;
}

function hitsSelf(snake) {
  const [head, ...body] = snake;
  return body.some((part) => part.x === head.x && part.y === head.y);
}

export function placeFood(width, height, snake, rng = Math.random) {
  const occupied = new Set(snake.map((part) => `${part.x},${part.y}`));
  const free = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  const index = Math.floor(rng() * free.length);
  return free[index];
}
