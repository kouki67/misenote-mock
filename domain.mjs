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
  return {
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
};

export const isComplete = (task) => task.scope === 'personal'
  ? Boolean(task.completions[task.assigneeId])
  : task.confirmers.length > 0
    ? task.confirmers.every((id) => Boolean(task.completions[id]))
    : Object.keys(task.completions).length > 0;

export const canRead = (task, user) => task.storeId === user.storeId &&
  (task.scope === 'store' || user.role === 'admin' || task.assigneeId === user.id);

export const canEdit = (task, user) => task.storeId === user.storeId &&
  (user.role === 'admin' || task.createdBy === user.id);

export const canComplete = (task, user) => task.storeId === user.storeId && (
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
  total: tasks.length,
  done: tasks.filter(isComplete).length,
  pending: tasks.filter((task) => !isComplete(task)).length,
});

export const isValidState = (value) => {
  if (!value || typeof value !== 'object' || !Array.isArray(value.members) || !Array.isArray(value.tasks)) return false;
  if (value.members.length === 0 || !value.members.some((member) => member?.role === 'admin')) return false;
  const validMembers = value.members.every((member) => member &&
    ['id', 'name', 'shortName', 'color', 'storeId'].every((key) => typeof member[key] === 'string') &&
    ['admin', 'member'].includes(member.role));
  if (!validMembers) return false;
  const memberIds = new Set(value.members.map((member) => member.id));
  return value.tasks.every((task) => task &&
    ['id', 'title', 'detail', 'dueDate', 'storeId', 'createdBy'].every((key) => typeof task[key] === 'string') &&
    ['store', 'personal'].includes(task.scope) &&
    (task.scope === 'store' || memberIds.has(task.assigneeId)) &&
    Array.isArray(task.confirmers) && task.confirmers.every((id) => memberIds.has(id)) &&
    task.completions && typeof task.completions === 'object' && !Array.isArray(task.completions) &&
    Object.entries(task.completions).every(([id, date]) => memberIds.has(id) && typeof date === 'string'));
};
