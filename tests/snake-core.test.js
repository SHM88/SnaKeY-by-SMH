import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialState,
  setDirection,
  tick,
  placeFood,
  respawn,
} from "../src/snake-core.js";

test("snake moves one cell per tick in active direction", () => {
  const state = createInitialState({ width: 10, height: 10 });
  const next = tick(state, () => 0);
  assert.equal(next.snake[0].x, state.snake[0].x + 1);
  assert.equal(next.snake[0].y, state.snake[0].y);
});

test("snake grows and score increments when eating food", () => {
  const state = {
    ...createInitialState({ width: 8, height: 8 }),
    snake: [{ x: 3, y: 3 }],
    direction: "right",
    pendingDirection: "right",
    food: { x: 4, y: 3 },
    score: 0,
  };
  const next = tick(state, () => 0);
  assert.equal(next.snake.length, 2);
  assert.equal(next.score, 1);
});

test("wall collision ends game", () => {
  const state = {
    ...createInitialState({ width: 4, height: 4 }),
    snake: [{ x: 3, y: 1 }],
    direction: "right",
    pendingDirection: "right",
  };
  const next = tick(state, () => 0);
  assert.equal(next.isGameOver, true);
});

test("self collision ends game", () => {
  const state = {
    ...createInitialState({ width: 8, height: 8 }),
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 3, y: 1 },
    ],
    direction: "right",
    pendingDirection: "down",
  };
  const next = tick(state, () => 0);
  assert.equal(next.isGameOver, true);
});

test("cannot reverse direction directly", () => {
  const state = {
    ...createInitialState({ width: 8, height: 8 }),
    direction: "right",
    pendingDirection: "right",
  };
  const next = setDirection(state, "left");
  assert.equal(next.pendingDirection, "right");
});

test("food is placed on an unoccupied cell", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];
  const food = placeFood(4, 4, snake, () => 0);
  assert.notEqual(food, null);
  const overlap = snake.some((part) => part.x === food.x && part.y === food.y);
  assert.equal(overlap, false);
});

test("bonus food awards extra points and clears", () => {
  const state = {
    ...createInitialState({ width: 8, height: 8 }),
    snake: [{ x: 2, y: 2 }],
    direction: "right",
    pendingDirection: "right",
    food: { x: 7, y: 7 },
    bonusFood: { x: 3, y: 2 },
    bonusTimer: 10,
    score: 1,
  };
  const next = tick(state, () => 0.9);
  assert.equal(next.score, 4);
  assert.equal(next.bonusFood, null);
  assert.equal(next.bonusTimer, 0);
});

test("respawn resets snake but keeps score", () => {
  const state = {
    ...createInitialState({ width: 8, height: 8 }),
    snake: [
      { x: 7, y: 7 },
      { x: 6, y: 7 },
      { x: 5, y: 7 },
    ],
    score: 5,
    bonusFood: { x: 1, y: 1 },
    bonusTimer: 10,
    isGameOver: true,
  };
  const next = respawn(state, () => 0);
  assert.equal(next.score, 5);
  assert.equal(next.isGameOver, false);
  assert.equal(next.bonusFood, null);
  assert.equal(next.bonusTimer, 0);
  assert.equal(next.snake.length, 3);
});

test("respawn resets snake but keeps score", () => {
  const state = {
    ...createInitialState({ width: 8, height: 8 }),
    snake: [{ x: 7, y: 7 }],
    score: 5,
    bonusFood: { x: 1, y: 1 },
    bonusTimer: 10,
    isGameOver: true,
  };
  const next = respawn(state, () => 0);
  assert.equal(next.score, 5);
  assert.equal(next.isGameOver, false);
  assert.equal(next.bonusFood, null);
  assert.equal(next.bonusTimer, 0);
  assert.equal(next.snake.length, 1);
});
