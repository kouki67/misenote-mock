import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, isComplete, canRead, canEdit, canComplete, toggleCompletion, isValidState } from '../domain.mjs';

test('個人タスクは本人と同じ店舗の管理者だけが閲覧できる', () => {
  const { members, tasks } = createSeed();
  const task = tasks.find((entry) => entry.id === 'shift-yuto');
  assert.equal(canRead(task, members[0]), true);
  assert.equal(canRead(task, members[1]), true);
  assert.equal(canRead(task, members[2]), false);
  assert.equal(canRead(task, { ...members[0], storeId: 'other-store' }), false);
});

test('通常メンバーは自分が作成したタスクだけ編集できる', () => {
  const { members, tasks } = createSeed();
  const task = tasks.find((entry) => entry.id === 'display');
  assert.equal(canEdit(task, members[0]), true);
  assert.equal(canEdit(task, members[1]), false);
  assert.equal(canEdit(task, members[2]), true);
  assert.equal(canEdit(task, { ...members[0], storeId: 'other-store' }), false);
});

test('同じ内容の個人タスクも、完了状態は担当者ごとに独立する', () => {
  const { members, tasks } = createSeed();
  const mine = tasks.find((entry) => entry.id === 'shift');
  const other = tasks.find((entry) => entry.id === 'shift-hina');
  const completed = toggleCompletion(mine, members[0], '2026-10-21T01:00:00Z');
  assert.equal(isComplete(completed), true);
  assert.equal(isComplete(other), false);
  assert.equal(isComplete(mine), false);
  assert.equal(isComplete(toggleCompletion(completed, members[0])), false);
  assert.equal(toggleCompletion(other, members[0]), other);
});

test('店舗の通常タスクは1人で完了し、完了した本人が取り消せる', () => {
  const { members, tasks } = createSeed();
  const task = tasks.find((entry) => entry.id === 'stock');
  const completed = toggleCompletion(task, members[1]);
  assert.equal(isComplete(completed), true);
  assert.equal(canComplete(completed, members[0]), false);
  assert.equal(canComplete(completed, members[1]), true);
  assert.equal(isComplete(toggleCompletion(completed, members[1])), false);
});

test('全員確認は指定された全員が確認したときだけ完了する', () => {
  const { members, tasks } = createSeed();
  const task = tasks.find((entry) => entry.id === 'menu');
  const first = toggleCompletion(task, members[0]);
  assert.equal(isComplete(first), false);
  const completed = toggleCompletion(first, members[2]);
  assert.equal(isComplete(completed), true);
  assert.equal(isComplete(toggleCompletion(completed, members[1])), false);
});

test('指定外メンバー・他店舗の管理者は確認できない', () => {
  const { members, tasks } = createSeed();
  const task = { ...tasks.find((entry) => entry.id === 'menu'), confirmers: ['yuto', 'hina'] };
  assert.equal(canComplete(task, members[0]), false);
  assert.equal(toggleCompletion(task, members[0]), task);
  assert.equal(canComplete(task, { ...members[1], storeId: 'other-store' }), false);
});

test('不正な保存データは読み込まない', () => {
  const seed = createSeed();
  assert.equal(isValidState(seed), true);
  assert.equal(isValidState(null), false);
  assert.equal(isValidState({ ...seed, members: [] }), false);
  assert.equal(isValidState({ ...seed, tasks: [{ ...seed.tasks[0], completions: [] }] }), false);
  assert.equal(isValidState({ ...seed, tasks: [{ ...seed.tasks[0], confirmers: ['unknown'] }] }), false);
  assert.equal(isValidState({ ...seed, members: seed.members.map((member) => ({ ...member, role: 'member' })) }), false);
});
