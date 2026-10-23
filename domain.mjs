export const STORE_ID = 'store-01';

export const localDate = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const relativeDate = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDate(date);
};

export const createSeed = () => {
  const members = [
    { id: 'misaki', name: '佐藤 美咲', shortName: '美咲', color: 'green', role: 'admin', storeId: STORE_ID },
    { id: 'yuto', name: '田中 悠斗', shortName: '悠斗', color: 'blue', role: 'member', storeId: STORE_ID },
    { id: 'hina', name: '鈴木 陽菜', shortName: '陽菜', color: 'rose', role: 'member', storeId: STORE_ID },
  ];
  const completedAt = new Date().toISOString();
  const task = (id, title, scope, dueOffset, extra = {}) => ({
    id, title, scope, detail: '', dueDate: relativeDate(dueOffset), storeId: STORE_ID,
    createdBy: 'misaki', assigneeId: scope === 'personal' ? 'misaki' : null,
    confirmers: [], completions: {}, groupId: null, ...extra,
  });
  const seed = {
    stores: [
      { id: STORE_ID, name: 'こもれび珈琲 本店' },
      { id: 'store-02', name: 'こもれび珈琲 駅前店' },
    ],
    members,
    tasks: [
      task('stock', '週末に向けて、消耗品の在庫を確認する', 'store', 0, { detail: 'ペーパーカップ・ナプキン・テイクアウト袋の残数を確認してください。少ないものは発注リストに追記しましょう。' }),
      task('menu', '新しい季節メニューをみんなで確認', 'store', 0, { detail: '秋の新メニューの材料と提供方法を確認したら、自分の確認ボタンを押してください。全員の確認で完了になります。', confirmers: ['misaki', 'yuto', 'hina'], completions: { yuto: completedAt } }),
      task('display', '入口のディスプレイを秋仕様に', 'store', 0, { detail: '入口の小さな棚に、季節のおすすめと秋の飾りを配置してください。', createdBy: 'hina' }),
      task('shift', '来月のシフト希望を提出する', 'personal', 0, { detail: '希望するお休みと出勤できる曜日を店長に伝えてください。', groupId: 'shift-group' }),
      task('shift-yuto', '来月のシフト希望を提出する', 'personal', 0, { detail: '希望するお休みと出勤できる曜日を店長に伝えてください。', assigneeId: 'yuto', groupId: 'shift-group', completions: { yuto: completedAt } }),
      task('shift-hina', '来月のシフト希望を提出する', 'personal', 0, { detail: '希望するお休みと出勤できる曜日を店長に伝えてください。', assigneeId: 'hina', groupId: 'shift-group' }),
      task('handover', '引き継ぎノートに今週の気づきを記入', 'personal', 1, { detail: '接客やお店のことで気づいたことを、引き継ぎノートに書きましょう。' }),
      task('plants', '店内の植物の水やり', 'store', 1, { detail: '窓際と入口の植物を確認。土が乾いているものに水をあげてください。', createdBy: 'yuto' }),
      task('clean', '開店前のカウンター清掃', 'store', 0, { detail: 'カウンターとレジ周りを拭き、備品を整えてください。', completions: { hina: completedAt } }),
      task('training-yuto', 'レジ締めの手順を復習する', 'personal', 2, { detail: 'マニュアルのレジ締めのページを確認してください。', assigneeId: 'yuto' }),
      task('training-hina', 'おすすめ商品の説明を練習する', 'personal', 2, { detail: '季節のおすすめをお客さまに紹介できるように準備しましょう。', assigneeId: 'hina', createdBy: 'hina' }),
      task('order', '今週のコーヒー豆を発注する', 'personal', -1, { detail: '販売予定と在庫を確認して、必要な豆を発注してください。' }),
    ],
  };
  seed.members.push(
    { id: 'aoi', name: '高橋 葵', shortName: '葵', color: 'blue', role: 'admin', storeId: 'store-02' },
    { id: 'ren', name: '伊藤 蓮', shortName: '蓮', color: 'green', role: 'member', storeId: 'store-02' },
  );
  seed.tasks.push(task('station-stock', '週末のテイクアウト資材を発注する', 'store', 1, { storeId: 'store-02', createdBy: 'aoi' }));
  seed.recurringTemplates = seed.stores.flatMap((store) => {
    const storeMembers = seed.members.filter((member) => member.storeId === store.id);
    const manager = storeMembers.find((member) => member.role === 'admin');
    const template = (id, title, schedule, extra = {}) => ({
      id: `${store.id}-${id}`, title, detail: '', storeId: store.id, createdBy: manager.id,
      scope: 'store', assigneeIds: [], confirmers: [], schedule, startDate: localDate(),
      generatedThrough: null, active: true, ...extra,
    });
    return [
      template('shift', '来月のシフト希望を提出する', { frequency: 'monthly', day: 20 }, { scope: 'personal', assigneeIds: storeMembers.map((member) => member.id) }),
      template('report', '月報を作成する', { frequency: 'monthEnd' }, { scope: 'personal', assigneeIds: [manager.id] }),
      template('meeting', '店舗ミーティングの準備をする', { frequency: 'weekly', weekday: 1 }),
    ];
  });
  return generateRecurringTasks(addDemoOwner(seed));
};

export const isComplete = (task) => task.scope === 'personal'
  ? Boolean(task.completions[task.assigneeId])
  : task.confirmers.length > 0
    ? task.confirmers.every((id) => Boolean(task.completions[id]))
    : Object.keys(task.completions).length > 0;

export const canRead = (task, user) => user.role === 'owner' || (task.storeId === user.storeId &&
  (task.scope === 'store' || user.role === 'admin' || task.assigneeId === user.id));

export const canEdit = (task, user) => user.role !== 'owner' && task.storeId === user.storeId &&
  (user.role === 'admin' || task.createdBy === user.id);

export const canComplete = (task, user) => user.role !== 'owner' && !task.skippedAt && task.storeId === user.storeId && (
  task.scope === 'personal'
    ? task.assigneeId === user.id
    : task.confirmers.length > 0
      ? task.confirmers.includes(user.id)
      : !isComplete(task) || Boolean(task.completions[user.id])
);

export const toggleCompletion = (task, user, timestamp = new Date().toISOString()) => {
  if (!canComplete(task, user)) return task;
  const completions = { ...task.completions };
  if (completions[user.id]) delete completions[user.id];
  else completions[user.id] = timestamp;
  return { ...task, completions };
};

export const taskStats = (tasks) => ({
  total: tasks.filter((task) => !task.skippedAt).length,
  done: tasks.filter((task) => !task.skippedAt && isComplete(task)).length,
  pending: tasks.filter((task) => !task.skippedAt && !isComplete(task)).length,
});

export const overviewTasks = (state, user, { storeId = 'all', scope = 'all', status = 'all', query = '' } = {}) => {
  if (user.role !== 'owner') return [];
  const memberNames = new Map(state.members.map((member) => [member.id, member.name]));
  const storeNames = new Map(state.stores.map((store) => [store.id, store.name]));
  const search = query.trim().toLocaleLowerCase();
  const statusOf = (task) => task.skippedAt ? 'skipped' : isComplete(task) ? 'done' : 'pending';
  const statusOrder = { pending: 0, done: 1, skipped: 2 };
  return state.tasks.filter((task) => canRead(task, user) && (storeId === 'all' || task.storeId === storeId) &&
    (scope === 'all' || task.scope === scope) && (status === 'all' || statusOf(task) === status) &&
    [task.title, task.detail, storeNames.get(task.storeId), memberNames.get(task.assigneeId), ...task.confirmers.map((id) => memberNames.get(id))]
      .join(' ').toLocaleLowerCase().includes(search))
    .sort((a, b) => statusOrder[statusOf(a)] - statusOrder[statusOf(b)] ||
      (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31') || a.storeId.localeCompare(b.storeId) || a.id.localeCompare(b.id));
};

const dateFromString = (value) => new Date(`${value}T00:00:00Z`);
const dateString = (date) => date.toISOString().slice(0, 10);
export const addDays = (value, days) => {
  const date = dateFromString(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateString(date);
};

export const isValidDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(dateFromString(value).getTime()) && dateString(dateFromString(value)) === value;

export const isValidSchedule = (schedule) => Boolean(schedule && (
  schedule.frequency === 'weekly' ? Number.isInteger(schedule.weekday) && schedule.weekday >= 0 && schedule.weekday <= 6 :
  schedule.frequency === 'monthly' ? Number.isInteger(schedule.day) && schedule.day >= 1 && schedule.day <= 31 :
  schedule.frequency === 'monthEnd'
));

export const recurrenceDates = (schedule, from, through) => {
  if (!isValidSchedule(schedule) || !isValidDate(from) || !isValidDate(through) || from > through) return [];
  const dates = [];
  const cursor = dateFromString(from);
  if (schedule.frequency === 'weekly') {
    cursor.setUTCDate(cursor.getUTCDate() + (schedule.weekday - cursor.getUTCDay() + 7) % 7);
    while (dateString(cursor) <= through) {
      dates.push(dateString(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return dates;
  }
  cursor.setUTCDate(1);
  while (dateString(cursor) <= through) {
    const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
    cursor.setUTCDate(schedule.frequency === 'monthEnd' ? lastDay : Math.min(schedule.day, lastDay));
    const dueDate = dateString(cursor);
    if (dueDate >= from && dueDate <= through) dates.push(dueDate);
    cursor.setUTCDate(1);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return dates;
};

export const generateRecurringTasks = (state, asOf = localDate()) => {
  const through = addDays(asOf, 30);
  const tasks = [];
  const occurrences = new Set(state.tasks.filter((task) => task.templateId).map((task) => JSON.stringify([task.templateId, task.occurrenceDate])));
  let changed = false;
  const recurringTemplates = state.recurringTemplates.map((template) => {
    if (!template.active || (template.generatedThrough && template.generatedThrough >= through)) return template;
    const from = template.generatedThrough ? addDays(template.generatedThrough, 1) : template.startDate;
    for (const dueDate of recurrenceDates(template.schedule, from > template.startDate ? from : template.startDate, through)) {
      if (occurrences.has(JSON.stringify([template.id, dueDate]))) continue;
      const groupId = template.scope === 'personal' && template.assigneeIds.length > 1 ? `${template.id}:${dueDate}` : null;
      for (const assigneeId of template.scope === 'personal' ? template.assigneeIds : [null]) {
        tasks.push({
          id: `${template.id}:${dueDate}:${assigneeId || 'store'}`, title: template.title, detail: template.detail,
          storeId: template.storeId, createdBy: template.createdBy, scope: template.scope,
          dueDate, assigneeId, confirmers: [...template.confirmers], completions: {}, groupId,
          templateId: template.id, occurrenceDate: dueDate,
        });
      }
    }
    changed = true;
    return { ...template, generatedThrough: through };
  });
  return changed ? { ...state, recurringTemplates, tasks: [...tasks, ...state.tasks] } : state;
};

export const updateRecurringTemplate = (state, template, asOf = localDate()) => {
  if (!template.active) return {
    ...state,
    recurringTemplates: state.recurringTemplates.some((entry) => entry.id === template.id)
      ? state.recurringTemplates.map((entry) => entry.id === template.id ? template : entry)
      : [...state.recurringTemplates, template],
  };
  const protectedDates = new Set(state.tasks.filter((task) => task.templateId === template.id &&
    (task.occurrenceOverride || task.skippedAt || Object.keys(task.completions).length > 0)).map((task) => task.occurrenceDate));
  const tasks = state.tasks.filter((task) => task.templateId !== template.id || task.occurrenceDate < asOf || protectedDates.has(task.occurrenceDate));
  const updatedTemplate = { ...template, generatedThrough: addDays(asOf > template.startDate ? asOf : template.startDate, -1) };
  const recurringTemplates = state.recurringTemplates.some((entry) => entry.id === template.id)
    ? state.recurringTemplates.map((entry) => entry.id === template.id ? updatedTemplate : entry)
    : [...state.recurringTemplates, updatedTemplate];
  return generateRecurringTasks({ ...state, tasks, recurringTemplates }, asOf);
};

const addDemoOwner = (state) => {
  if (state.members.some((member) => member.role === 'owner')) return state;
  const memberIds = new Set(state.members.map((member) => member.id));
  let id = 'demo-owner';
  while (memberIds.has(id)) id += '-1';
  return { ...state, members: [...state.members, { id, name: '全体管理者', shortName: '管理', color: 'green', role: 'owner', storeId: state.stores[0].id }] };
};

export const migrateState = (value) => {
  if (!value || typeof value !== 'object' || !Array.isArray(value.members)) return value;
  const storeIds = [...new Set(value.members.map((member) => member?.storeId))];
  const migrated = value.stores !== undefined ? value : {
    ...value,
    stores: storeIds.map((id) => ({ id, name: id === STORE_ID ? 'こもれび珈琲 本店' : '店舗' })),
    recurringTemplates: [],
  };
  return isValidState(migrated) ? addDemoOwner(migrated) : migrated;
};

export const isValidState = (value) => {
  if (!value || typeof value !== 'object' || !['stores', 'members', 'tasks', 'recurringTemplates'].every((key) => Array.isArray(value[key]))) return false;
  const uniqueIds = (entries) => entries.every((entry) => entry && typeof entry.id === 'string' && entry.id.length > 0) && new Set(entries.map((entry) => entry.id)).size === entries.length;
  if (![value.stores, value.members, value.tasks, value.recurringTemplates].every(uniqueIds) || value.stores.length === 0) return false;
  if (!value.stores.every((store) => typeof store.name === 'string' && store.name.trim() && value.members.some((member) => member?.storeId === store.id && member.role === 'admin'))) return false;
  const storeIds = new Set(value.stores.map((store) => store.id));
  const validMembers = value.members.every((member) =>
    ['name', 'shortName', 'color', 'storeId'].every((key) => typeof member[key] === 'string') &&
    storeIds.has(member.storeId) && ['owner', 'admin', 'member'].includes(member.role));
  if (!validMembers) return false;
  const members = new Map(value.members.map((member) => [member.id, member]));
  const belongsToStore = (id, storeId) => members.get(id)?.storeId === storeId;
  const validBase = (entry) => ['title', 'detail', 'storeId', 'createdBy'].every((key) => typeof entry[key] === 'string') &&
    storeIds.has(entry.storeId) && belongsToStore(entry.createdBy, entry.storeId) && ['store', 'personal'].includes(entry.scope) &&
    Array.isArray(entry.confirmers) && entry.confirmers.every((id) => belongsToStore(id, entry.storeId));
  const validTemplates = value.recurringTemplates.every((template) => validBase(template) && isValidSchedule(template.schedule) &&
    isValidDate(template.startDate) && (template.generatedThrough === null || isValidDate(template.generatedThrough)) && typeof template.active === 'boolean' &&
    Array.isArray(template.assigneeIds) && new Set(template.assigneeIds).size === template.assigneeIds.length &&
    template.assigneeIds.every((id) => belongsToStore(id, template.storeId)) &&
    (template.scope !== 'personal' || template.assigneeIds.length > 0));
  if (!validTemplates) return false;
  const templates = new Map(value.recurringTemplates.map((template) => [template.id, template]));
  return value.tasks.every((task) => validBase(task) && (task.dueDate === '' || isValidDate(task.dueDate)) &&
    (task.scope === 'store' || belongsToStore(task.assigneeId, task.storeId)) &&
    (task.skippedAt === undefined || typeof task.skippedAt === 'string') &&
    (task.occurrenceOverride === undefined || typeof task.occurrenceOverride === 'boolean') &&
    (!task.templateId || (templates.get(task.templateId)?.storeId === task.storeId && isValidDate(task.occurrenceDate))) &&
    task.completions && typeof task.completions === 'object' && !Array.isArray(task.completions) &&
    Object.entries(task.completions).every(([id, date]) => belongsToStore(id, task.storeId) && typeof date === 'string'));
};
