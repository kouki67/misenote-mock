import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, isComplete, canRead, canEdit, canComplete, toggleCompletion, isValidState, recurrenceDates, generateRecurringTasks, updateRecurringTemplate, migrateState, taskStats, overviewTasks } from '../domain.mjs';

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

test('実在する別店舗の管理者にもタスクの閲覧・編集・完了を許可しない', () => {
  const { members, tasks } = createSeed();
  const task = tasks.find((entry) => entry.id === 'stock');
  const manager = members.find((member) => member.id === 'aoi');
  assert.equal(canRead(task, manager), false);
  assert.equal(canEdit(task, manager), false);
  assert.equal(canComplete(task, manager), false);
});

test('毎週の指定曜日を年境界をまたいで作成する', () => {
  assert.deepEqual(recurrenceDates({ frequency: 'weekly', weekday: 1 }, '2026-12-28', '2027-01-11'), ['2026-12-28', '2027-01-04', '2027-01-11']);
  assert.deepEqual(recurrenceDates({ frequency: 'weekly', weekday: 0 }, '2026-10-23', '2026-10-25'), ['2026-10-25']);
});

test('毎月31日は日付がない月だけ月末にし、翌月は31日に戻す', () => {
  assert.deepEqual(recurrenceDates({ frequency: 'monthly', day: 31 }, '2027-01-01', '2027-04-30'), ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  assert.deepEqual(recurrenceDates({ frequency: 'monthly', day: 29 }, '2028-02-01', '2028-03-31'), ['2028-02-29', '2028-03-29']);
});

test('月末はうるう年・年越しを扱い、開始日より前を作成しない', () => {
  assert.deepEqual(recurrenceDates({ frequency: 'monthEnd' }, '2027-12-31', '2028-03-31'), ['2027-12-31', '2028-01-31', '2028-02-29', '2028-03-31']);
  assert.deepEqual(recurrenceDates({ frequency: 'monthly', day: 20 }, '2026-10-23', '2026-11-22'), ['2026-11-20']);
  assert.deepEqual(recurrenceDates({ frequency: 'weekly', weekday: 7 }, '2026-10-23', '2026-11-22'), []);
  assert.deepEqual(recurrenceDates({ frequency: 'monthEnd' }, '2026-02-30', '2026-03-31'), []);
});

const recurringFixture = (extra = {}) => {
  const seed = createSeed();
  const template = {
    id: 'repeat-test', title: '月報', detail: '月報の提出', scope: 'personal', storeId: 'store-01',
    createdBy: 'misaki', assigneeIds: ['misaki', 'yuto'], confirmers: [],
    schedule: { frequency: 'monthEnd' }, startDate: '2026-10-01', generatedThrough: null, active: true, ...extra,
  };
  return { ...seed, tasks: [], recurringTemplates: [template] };
};

test('30日先まで生成し、繰り返し呼んでも二重作成せず担当者ごとに完了を記録する', () => {
  const state = generateRecurringTasks(recurringFixture(), '2026-10-23');
  assert.equal(state.tasks.length, 2);
  assert.equal(state.tasks[0].dueDate, '2026-10-31');
  assert.equal(state.tasks[0].groupId, state.tasks[1].groupId);
  assert.equal(generateRecurringTasks(state, '2026-10-23'), state);
  const completed = toggleCompletion(state.tasks[0], state.members[0]);
  assert.equal(isComplete(completed), true);
  assert.equal(isComplete(state.tasks[1]), false);
  assert.equal(isValidState(state), true);
});

test('長期間開かなかった場合も未生成分を補い、過去の完了を維持する', () => {
  const initial = generateRecurringTasks(recurringFixture(), '2026-10-23');
  const completed = toggleCompletion(initial.tasks[0], initial.members[0]);
  const state = { ...initial, tasks: [completed, initial.tasks[1]] };
  const generated = generateRecurringTasks(state, '2027-02-10');
  assert.equal(generated.tasks.length, 10);
  assert.equal(generated.tasks.find((task) => task.id === completed.id), completed);
  assert.equal(new Set(generated.tasks.map((task) => task.id)).size, generated.tasks.length);
});

test('個別の期限変更・スキップ・確認履歴は、繰り返し設定の変更で上書きしない', () => {
  const initial = generateRecurringTasks(recurringFixture({ schedule: { frequency: 'weekly', weekday: 1 }, startDate: '2026-10-23' }), '2026-10-23');
  const dates = [...new Set(initial.tasks.map((task) => task.occurrenceDate))];
  const changedTasks = initial.tasks.map((task, index) => index === 0 ? { ...task, dueDate: '2026-10-29', occurrenceOverride: true } :
    task.occurrenceDate === dates[1] && task.assigneeId === 'misaki' ? { ...task, skippedAt: '2026-10-23T00:00:00Z', occurrenceOverride: true } :
    task.occurrenceDate === dates[2] && task.assigneeId === 'misaki' ? toggleCompletion(task, initial.members[0]) : task);
  const state = { ...initial, tasks: changedTasks };
  const edited = updateRecurringTemplate(state, { ...state.recurringTemplates[0], title: '新しい月報' }, '2026-10-23');
  assert.equal(edited.tasks.find((task) => task.id === changedTasks[0].id).dueDate, '2026-10-29');
  assert.equal(edited.tasks.filter((task) => task.occurrenceDate === dates[0]).every((task) => task.title === '月報'), true);
  assert.equal(edited.tasks.filter((task) => task.occurrenceDate === dates[1]).some((task) => task.skippedAt), true);
  assert.equal(edited.tasks.filter((task) => task.occurrenceDate === dates[2]).some(isComplete), true);
  assert.equal(edited.tasks.filter((task) => task.occurrenceDate === dates[3]).every((task) => task.title === '新しい月報'), true);
  assert.equal(isValidState(edited), true);
});

test('今回の期限を移動しても元の日付の定期タスクを再作成しない', () => {
  const state = generateRecurringTasks(recurringFixture(), '2026-10-23');
  const moved = { ...state, tasks: state.tasks.map((task) => ({ ...task, dueDate: '2026-11-02', occurrenceOverride: true })), recurringTemplates: state.recurringTemplates.map((template) => ({ ...template, generatedThrough: null })) };
  assert.equal(generateRecurringTasks(moved, '2026-10-23').tasks.length, 2);
});

test('繰り返しの曜日変更は過去を残して今後の未着手分を置き換える', () => {
  const initial = generateRecurringTasks(recurringFixture({ scope: 'store', assigneeIds: [], schedule: { frequency: 'weekly', weekday: 1 } }), '2026-10-23');
  const edited = updateRecurringTemplate(initial, { ...initial.recurringTemplates[0], schedule: { frequency: 'weekly', weekday: 5 } }, '2026-10-23');
  assert.deepEqual(edited.tasks.filter((task) => task.occurrenceDate < '2026-10-23'), initial.tasks.filter((task) => task.occurrenceDate < '2026-10-23'));
  assert.deepEqual(edited.tasks.filter((task) => task.occurrenceDate >= '2026-10-23').map((task) => task.occurrenceDate), ['2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20']);
});

test('全員確認の途中でも設定変更から確認履歴と旧確認条件を保護する', () => {
  const initial = generateRecurringTasks(recurringFixture({ scope: 'store', assigneeIds: [], confirmers: ['misaki', 'yuto'] }), '2026-10-23');
  const checked = toggleCompletion(initial.tasks[0], initial.members[0]);
  const edited = updateRecurringTemplate({ ...initial, tasks: [checked] }, { ...initial.recurringTemplates[0], confirmers: ['hina'] }, '2026-10-23');
  assert.equal(edited.tasks[0], checked);
  assert.equal(isComplete(edited.tasks[0]), false);
  assert.deepEqual(edited.tasks[0].confirmers, ['misaki', 'yuto']);
});

test('一時停止中は追加せず、設定を編集しても作成済みタスクを残す', () => {
  const initial = generateRecurringTasks(recurringFixture(), '2026-10-23');
  const template = { ...initial.recurringTemplates[0], active: false, title: '変更後の月報' };
  const paused = updateRecurringTemplate(initial, template, '2026-10-23');
  assert.equal(paused.tasks, initial.tasks);
  assert.equal(generateRecurringTasks(paused, '2027-02-10'), paused);
  const resumed = updateRecurringTemplate(paused, { ...template, active: true }, '2027-02-10');
  assert.deepEqual([...new Set(resumed.tasks.map((task) => task.occurrenceDate))].sort(), ['2026-10-31', '2027-02-28']);
});

test('スキップ済みは完了操作とタスク件数の対象から外す', () => {
  const initial = generateRecurringTasks(recurringFixture(), '2026-10-23');
  const skipped = { ...initial.tasks[0], skippedAt: '2026-10-23T00:00:00Z' };
  assert.equal(canComplete(skipped, initial.members[0]), false);
  assert.equal(toggleCompletion(skipped, initial.members[0]), skipped);
  assert.deepEqual(taskStats([skipped, initial.tasks[1]]), { total: 1, done: 0, pending: 1 });
});

test('旧形式の店舗・タスク・完了状態を失わず移行する', () => {
  const seed = createSeed();
  const legacy = { members: seed.members.filter((member) => member.storeId === 'store-01'), tasks: seed.tasks.filter((task) => !task.templateId && task.storeId === 'store-01') };
  const migrated = migrateState(legacy);
  assert.equal(migrated.tasks, legacy.tasks);
  assert.equal(migrated.members, legacy.members);
  assert.deepEqual(migrated.stores, [{ id: 'store-01', name: 'こもれび珈琲 本店' }]);
  assert.deepEqual(migrated.recurringTemplates, []);
  assert.equal(isValidState(migrated), true);
});

test('別店舗への担当割り当て・不正な繰り返し条件・重複IDを保存データとして受け入れない', () => {
  const seed = recurringFixture();
  assert.equal(isValidState(seed), true);
  assert.equal(isValidState({ ...seed, recurringTemplates: [{ ...seed.recurringTemplates[0], assigneeIds: ['aoi'] }] }), false);
  assert.equal(isValidState({ ...seed, recurringTemplates: [{ ...seed.recurringTemplates[0], schedule: { frequency: 'monthly', day: 32 } }] }), false);
  assert.equal(isValidState({ ...seed, tasks: createSeed().tasks.filter((task) => !task.templateId).map((task, index) => index === 0 ? { ...task, confirmers: ['aoi'] } : task) }), false);
  assert.equal(isValidState({ ...seed, members: [...seed.members, seed.members[0]] }), false);
});

test('全体管理者はすべての店舗タスクと個人タスクを閲覧できる', () => {
  const state = createSeed();
  const owner = state.members.find((member) => member.role === 'owner');
  assert.equal(state.tasks.every((task) => canRead(task, owner)), true);
  const tasks = overviewTasks(state, owner);
  assert.equal(tasks.length, state.tasks.length);
  assert.equal(new Set(tasks.map((task) => task.storeId)).size, 2);
  assert.equal(tasks.some((task) => task.scope === 'store'), true);
  assert.equal(tasks.some((task) => task.scope === 'personal'), true);
  assert.equal(isValidState(state), true);
});

test('店長と通常メンバーには全店舗一覧のタスクを返さない', () => {
  const state = createSeed();
  for (const member of state.members.filter((member) => member.role !== 'owner')) {
    assert.deepEqual(overviewTasks(state, member), []);
    assert.equal(state.tasks.filter((task) => task.storeId !== member.storeId).every((task) => !canRead(task, member)), true);
  }
});

test('全体管理者の閲覧によって、タスクの編集・代理完了を許可しない', () => {
  const state = createSeed();
  const owner = state.members.find((member) => member.role === 'owner');
  for (const task of state.tasks) {
    assert.equal(canEdit(task, owner), false);
    assert.equal(canComplete(task, owner), false);
    assert.equal(toggleCompletion(task, owner), task);
  }
});

test('全店舗一覧で店舗・タスク種類・完了状況を組み合わせて絞り込む', () => {
  const state = createSeed();
  const owner = state.members.find((member) => member.role === 'owner');
  const tasks = overviewTasks(state, owner, { storeId: 'store-01', scope: 'personal', status: 'done' });
  assert.deepEqual(tasks.map((task) => task.id), ['shift-yuto']);
  assert.equal(overviewTasks(state, owner, { storeId: 'store-02' }).every((task) => task.storeId === 'store-02'), true);
  assert.deepEqual(overviewTasks(state, owner, { storeId: 'missing-store' }), []);
});

test('タスク名・店舗名・担当者名・確認者名で全店舗を横断検索する', () => {
  const state = createSeed();
  const owner = state.members.find((member) => member.role === 'owner');
  assert.equal(overviewTasks(state, owner, { query: ' 駅前店 ' }).length, state.tasks.filter((task) => task.storeId === 'store-02').length);
  assert.equal(overviewTasks(state, owner, { query: '田中 悠斗' }).some((task) => task.id === 'shift-yuto'), true);
  assert.equal(overviewTasks(state, owner, { query: '田中 悠斗' }).some((task) => task.id === 'menu'), true);
  assert.equal(overviewTasks(state, owner, { query: '月報' }).every((task) => task.title.includes('月報')), true);
  assert.deepEqual(overviewTasks(state, owner, { query: '該当なしのタスク名' }), []);
});

test('全店舗一覧の並べ替えは未完了・期限順とし、元の保存データを変更しない', () => {
  const seed = createSeed();
  const base = seed.tasks.find((task) => task.id === 'stock');
  const state = { ...seed, tasks: [
    { ...base, id: 'done', dueDate: '2026-01-01', completions: { misaki: '2026-01-01T00:00:00Z' } },
    { ...base, id: 'no-date', dueDate: '' },
    { ...base, id: 'later', dueDate: '2026-10-30' },
    { ...base, id: 'skipped', dueDate: '2026-01-01', skippedAt: '2026-01-01T00:00:00Z' },
    { ...base, id: 'earlier', dueDate: '2026-10-23' },
  ] };
  const before = structuredClone(state);
  const owner = state.members.find((member) => member.role === 'owner');
  assert.deepEqual(overviewTasks(state, owner).map((task) => task.id), ['earlier', 'later', 'no-date', 'done', 'skipped']);
  assert.deepEqual(overviewTasks(state, owner, { status: 'pending' }).map((task) => task.id), ['earlier', 'later', 'no-date']);
  assert.deepEqual(overviewTasks(state, owner, { status: 'skipped' }).map((task) => task.id), ['skipped']);
  assert.deepEqual(state, before);
});

test('既存の店舗・メンバー権限・タスクを保持し、体験用の全体管理者だけを追加する', () => {
  const seed = createSeed();
  const previous = { ...seed, members: seed.members.filter((member) => member.role !== 'owner') };
  const migrated = migrateState(previous);
  assert.equal(migrated.tasks, previous.tasks);
  assert.equal(migrated.stores, previous.stores);
  assert.equal(migrated.recurringTemplates, previous.recurringTemplates);
  assert.deepEqual(migrated.members.filter((member) => member.role !== 'owner'), previous.members);
  assert.equal(migrated.members.filter((member) => member.role === 'owner').length, 1);
  assert.equal(migrateState(migrated), migrated);
  assert.equal(isValidState(migrated), true);
});

test('全体管理者の体験用IDが既存メンバーと衝突しても既存データを変えない', () => {
  const seed = createSeed();
  const members = [...seed.members.filter((member) => member.role !== 'owner'), { id: 'demo-owner', name: '既存メンバー', shortName: '既存', color: 'blue', role: 'member', storeId: 'store-01' }];
  const migrated = migrateState({ ...seed, members });
  assert.equal(migrated.members.find((member) => member.id === 'demo-owner').role, 'member');
  assert.equal(migrated.members.find((member) => member.role === 'owner').id, 'demo-owner-1');
  assert.equal(isValidState(migrated), true);
});
