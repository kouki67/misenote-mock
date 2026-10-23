import { createSeed, localDate, isComplete, canRead, canEdit, canComplete, toggleCompletion, taskStats, isValidState, migrateState, addDays, isValidDate, isValidSchedule, recurrenceDates, generateRecurringTasks, updateRecurringTemplate } from './domain.mjs';

const STORAGE_KEY = 'misenote-demo-v1';
const app = document.querySelector('#app');
const overlays = document.querySelector('#overlays');
let storageUnavailable = false;
let data = loadData();
let currentUserId = data.members.find((member) => member.role === 'admin').id;
let page = 'today';
let scopeFilter = 'all';
let statusFilter = 'pending';
let query = '';
let selectedMember = 'all';
let toastTimer;
let returnFocus;

const paths = {
  logo: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 3v4m6-4v4m-6 7 2 2 4-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  store: '<path d="M3 10h18l-2-6H5l-2 6Zm1 0v10h16V10M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 5a6 6 0 0 1 3 5"/>',
  chart: '<path d="M4 20V4m0 16h17M9 16v-5m5 5V7m5 9v-8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  leaf: '<path d="M20 3C9 2 3 8 5 15s14 7 15-12ZM4 21l10-11"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
};

const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const user = () => data.members.find((member) => member.id === currentUserId);
const currentStore = () => data.stores.find((store) => store.id === user().storeId);
const storeMembers = () => data.members.filter((member) => member.storeId === user().storeId);
const storeTemplates = () => data.recurringTemplates.filter((template) => template.storeId === user().storeId);
const memberById = (id) => data.members.find((member) => member.id === id);
const avatar = (member, size = '') => `<span class="avatar ${escapeHtml(member?.color || 'green')} ${size}" title="${escapeHtml(member?.name || 'メンバー')}">${escapeHtml(member?.shortName?.slice(0, 1) || '？')}</span>`;
const today = () => localDate();
const shortDate = (date) => date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '期限なし';
const fullDate = (date) => new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' }).format(date);
const readableTasks = () => data.tasks.filter((task) => canRead(task, user()));
const matchesTaskScope = (task) => scopeFilter === 'all' ||
  (scopeFilter === 'mine' ? task.scope === 'personal' && task.assigneeId === user().id : task.scope === scopeFilter);

function loadData() {
  try {
    const saved = migrateState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
    return isValidState(saved) ? generateRecurringTasks(saved) : createSeed();
  } catch {
    storageUnavailable = true;
    return createSeed();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    storageUnavailable = true;
    toast('このブラウザでは保存できません。画面を閉じると変更が消えます。');
  }
}

function toast(message) {
  const target = document.querySelector('#toast');
  target.textContent = message;
  target.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => target.classList.remove('visible'), 3800);
}

function navigate(nextPage) {
  page = nextPage;
  query = '';
  scopeFilter = 'all';
  statusFilter = 'pending';
  selectedMember = 'all';
  closeModal();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function render() {
  const activeSearch = document.activeElement?.id === 'task-search';
  const selection = activeSearch ? document.activeElement.selectionStart : null;
  const me = user();
  if (me.role !== 'admin' && ['progress', 'members', 'recurring'].includes(page)) page = 'today';
  const nav = [
    ['today', 'grid', 'タスク', ''],
    ...(me.role === 'admin' ? [['recurring', 'reset', '定期タスク', ''], ['progress', 'chart', 'みんなの進捗', ''], ['members', 'users', 'メンバー管理', '']] : []),
  ];
  document.title = `${nav.find(([id]) => id === page)?.[2] || 'タスク'} | みせノート`;
  app.innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="#" data-action="navigate" data-page="today"><span class="brand-mark">${icon('logo')}</span><span>みせノート<span class="brand-dot">.</span></span></a>
      <div class="store-identity"><span class="store-symbol">${icon('store')}</span><div><strong>${escapeHtml(currentStore().name)}</strong><span>${storeMembers().length}人のチーム</span></div></div>
      <p class="nav-caption">ワークスペース</p>
      <nav class="main-nav" aria-label="メインメニュー">${nav.map(([id, glyph, label, count]) => `<button class="nav-item ${page === id ? 'active' : ''}" data-action="navigate" data-page="${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${count ? `<span class="nav-count">${count}</span>` : ''}</button>`).join('')}</nav>
      <div class="sidebar-team"><p class="nav-caption">お店のメンバー <span>${storeMembers().length}</span></p>${storeMembers().map((member) => `<div class="sidebar-person">${avatar(member, 'small')}<span>${escapeHtml(member.name)}</span>${member.role === 'admin' ? '<span class="manager-label">店長</span>' : '<span class="presence-dot" aria-label="メンバー"></span>'}</div>`).join('')}</div>
      <div class="sidebar-bottom"><div class="demo-hint">${icon('leaf')}<strong>小さなチームに、<br>ちょうどいいタスク管理。</strong><span>ひとつずつ、みんなで。</span></div><button class="subtle-button reset-button" data-action="reset">${icon('reset')}デモを最初の状態に戻す</button></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb">${icon('logo')}<span>みせノート</span><span class="slash">/</span><strong>${nav.find(([id]) => id === page)?.[2] || 'タスク'}</strong></div><div class="user-picker"><span class="demo-pill">体験用モック</span><label class="user-select">${avatar(me, 'small')}<select id="demo-user" aria-label="体験するメンバーを切り替え">${storeMembers().map((member) => `<option value="${escapeHtml(member.id)}" ${member.id === me.id ? 'selected' : ''}>${escapeHtml(member.name)}${member.role === 'admin' ? '（店長）' : '（メンバー）'}</option>`).join('')}</select>${icon('down')}</label></div></header>
      <main class="main-content" id="main-content">
        <div class="store-toolbar"><label class="store-switcher">${icon('store')}<span class="sr-only">体験する店舗を切り替え</span><select id="store-switcher" aria-label="体験する店舗を切り替え">${data.stores.map((store) => `<option value="${escapeHtml(store.id)}" ${store.id === me.storeId ? 'selected' : ''}>${escapeHtml(store.name)}</option>`).join('')}</select>${icon('down')}</label>${me.role === 'admin' ? `<button class="text-button" data-action="add-store">${icon('plus')}店舗を追加</button>` : ''}<span class="store-switch-note">店舗を切り替えると、その店舗の店長として体験できます。</span></div>
        ${page === 'progress' ? renderProgress() : page === 'members' ? renderMembers() : page === 'recurring' ? renderRecurring() : renderTaskPage()}
        <footer class="page-footer"><span>${icon('logo')}みせノート</span><span>架空のお店・サンプルデータです。変更はこのブラウザ内に保存されます。</span></footer>
      </main>
      <nav class="mobile-nav" aria-label="モバイルメニュー">${nav.map(([id, glyph]) => `<button class="${page === id ? 'active' : ''}" data-action="navigate" data-page="${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${id === 'today' ? 'タスク' : id === 'recurring' ? '定期タスク' : id === 'progress' ? '進捗' : 'メンバー'}</span></button>`).join('')}</nav>
    </div>`;
  if (activeSearch) {
    const input = document.querySelector('#task-search');
    input?.focus();
    input?.setSelectionRange(selection, selection);
  }
}

function renderPageHeading(title, description, action = true) {
  return `<div class="page-heading"><div><p class="date-label">${fullDate(new Date())}</p><h1>${title}</h1><p class="page-description">${description}</p></div>${action ? `<button class="button primary add-task" data-action="add">${icon('plus')}<span>タスクを追加</span></button>` : ''}</div>`;
}

function renderTaskPage() {
  const tasks = readableTasks().filter(matchesTaskScope);
  const taskRows = createTaskRows(tasks);
  const dueRows = taskRows.filter(({ task, skipped }) => !skipped && task.dueDate && task.dueDate <= today());
  const dueStats = { total: dueRows.length, done: dueRows.filter(({ complete }) => complete).length };
  const waiting = tasks.filter((task) => task.scope === 'store' && task.confirmers.length && !task.skippedAt && !isComplete(task) && Object.keys(task.completions).length).length;
  const scopeTabs = [['all', 'すべて'], ['store', '店舗'], ['mine', '自分'], ...(user().role === 'admin' ? [['personal', '全員の個人']] : [])];
  return `${renderPageHeading('タスク', 'お店のことも、自分のことも。ひとつずつ、みんなで。')}
    <div class="dashboard-grid"><section class="task-column" aria-label="タスク一覧">
      <div class="summary-strip"><div class="summary-item"><span class="summary-symbol mint">${icon('calendar')}</span><div><span>今日までのタスク</span><strong>${dueStats.total}<small>件</small></strong></div></div><div class="summary-item"><span class="summary-symbol pale-green">${icon('check')}</span><div><span>完了したタスク</span><strong>${dueStats.done}<small>/ ${dueStats.total}件</small></strong></div></div><div class="summary-item"><span class="summary-symbol pale-yellow">${icon('users')}</span><div><span>みんなの確認待ち</span><strong>${waiting}<small>件</small></strong></div></div></div>
      <div class="task-panel"><div class="task-panel-heading"><div class="scope-tabs" role="group" aria-label="表示するタスク">${scopeTabs.map(([value, label]) => `<button class="scope-tab ${scopeFilter === value ? 'active' : ''}" data-action="scope" data-value="${value}" aria-pressed="${scopeFilter === value}">${label}${scopeFilter === value ? `<span>${taskRows.length}</span>` : ''}</button>`).join('')}</div></div>
        <div class="task-tools"><label class="search-box">${icon('search')}<input id="task-search" type="search" placeholder="タスクを検索" value="${escapeHtml(query)}" aria-label="タスクを検索" /></label><label class="status-select"><select id="status-filter" aria-label="完了状況で絞り込み"><option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>未完了</option><option value="all" ${statusFilter === 'all' ? 'selected' : ''}>すべての状態</option><option value="skipped" ${statusFilter === 'skipped' ? 'selected' : ''}>スキップ済み</option><option value="done" ${statusFilter === 'done' ? 'selected' : ''}>完了済み</option></select>${icon('down')}</label></div>
        <div class="task-list">${renderTaskGroups(taskRows)}</div>
        <button class="inline-add" data-action="add">${icon('plus')}タスクを追加する</button>
      </div><div class="task-legend"><span><span class="legend-circle"></span>丸を押して完了・取り消し</span><span>${icon('users')}全員確認は、各メンバーの操作が必要です</span></div>
    </section><aside class="insight-column">${renderInsights()}</aside></div>`;
}

function createTaskRows(tasks) {
  const groups = new Map();
  const combineAssignments = user().role === 'admin' && scopeFilter !== 'mine' && statusFilter !== 'skipped';
  for (const task of tasks) {
    const key = combineAssignments && task.scope === 'personal' && task.groupId ? `group:${task.groupId}` : `task:${task.id}`;
    groups.set(key, [...(groups.get(key) || []), task]);
  }
  return [...groups.values()].map((assignments) => ({
    task: assignments.find((task) => task.assigneeId === user().id) || assignments[0],
    assignments,
    complete: assignments.some((task) => !task.skippedAt) && assignments.every((task) => task.skippedAt || isComplete(task)),
    skipped: assignments.every((task) => Boolean(task.skippedAt)),
  }));
}

function renderTaskGroups(taskRows) {
  const filtered = taskRows.filter(({ assignments, complete, skipped }) =>
    (statusFilter === 'all' || (statusFilter === 'skipped' ? skipped : statusFilter === 'done' ? complete : !complete && !skipped)) &&
    assignments.some((assignment) => `${assignment.title} ${assignment.detail} ${memberById(assignment.assigneeId)?.name || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  if (!filtered.length) return `<div class="empty-state"><span>${icon(statusFilter === 'done' ? 'check' : 'leaf')}</span><h3>${query ? '該当するタスクがありません' : statusFilter === 'done' ? '完了したタスクはまだありません' : statusFilter === 'skipped' ? 'スキップしたタスクはまだありません' : 'やることが、すっきりしました'}</h3><p>${query ? '別の言葉や条件で探してみてください。' : statusFilter === 'done' ? '完了したタスクは、ここに並びます。' : statusFilter === 'skipped' ? '定期タスクの詳細から、今回分だけスキップできます。' : '新しいタスクを追加するか、完了済みのタスクを確認できます。'}</p></div>`;
  const groups = [
    { title: '期限を過ぎています', className: 'overdue', match: ({ task, complete, skipped }) => !skipped && task.dueDate && task.dueDate < today() && !complete },
    { title: '今日まで', className: 'today-group', match: ({ task, complete, skipped }) => !skipped && task.dueDate && task.dueDate <= today() && (task.dueDate === today() || complete) },
    { title: 'これから', className: 'upcoming', match: ({ task, skipped }) => !skipped && (!task.dueDate || task.dueDate > today()) },
    { title: 'スキップ済み', className: 'skipped-group', match: ({ skipped }) => skipped },
  ];
  return groups.map((group) => {
    const groupTasks = filtered.filter(group.match).sort((a, b) => Number(a.complete) - Number(b.complete) || (a.task.dueDate || '9999').localeCompare(b.task.dueDate || '9999'));
    return groupTasks.length ? `<section class="task-group ${group.className}"><h2>${group.className === 'overdue' ? icon('clock') : ''}${group.title}<span>${groupTasks.length}</span></h2>${groupTasks.map(renderTaskRow).join('')}</section>` : '';
  }).join('');
}

function renderTaskRow({ task, assignments, complete, skipped }) {
  const groupedPersonal = task.scope === 'personal' && assignments.length > 1;
  const checked = Boolean(task.completions[user().id]);
  const allowed = canComplete(task, user());
  const confirmCount = task.confirmers.filter((id) => task.completions[id]).length;
  const assignee = memberById(task.assigneeId);
  const label = groupedPersonal ? `${assignments.length}人に割り当て` : task.scope === 'personal' ? assignee?.shortName : task.confirmers.length ? '全員確認' : '誰でもOK';
  const assignmentProgress = groupedPersonal ? `<span class="confirmation-label">${assignments.filter(isComplete).length}/${assignments.length}人完了${assignments.some((assignment) => assignment.skippedAt) ? ` · ${assignments.filter((assignment) => assignment.skippedAt).length}人スキップ` : ''}</span>` : '';
  const assignedAvatars = groupedPersonal ? `<div class="avatar-stack">${assignments.slice(0, 3).map((assignment) => avatar(memberById(assignment.assigneeId), 'tiny')).join('')}</div>` : '';
  const overdue = task.dueDate && task.dueDate < today() && !complete && !skipped;
  return `<article class="task-row ${complete || skipped ? 'complete' : ''}">
    <button class="completion-check ${complete || checked ? 'checked' : ''} ${checked && !complete ? 'partial' : ''}" data-action="complete" data-id="${escapeHtml(task.id)}" ${allowed ? '' : 'disabled'} aria-label="${escapeHtml(task.title)}：${checked ? '自分の完了を取り消す' : complete ? '完了済み' : task.confirmers.length ? '自分の確認を完了する' : '完了する'}" aria-pressed="${checked || complete}" title="${allowed ? checked ? '完了を取り消す' : '完了する' : task.scope === 'personal' ? '本人が完了操作できます' : complete ? '完了した本人が取り消せます' : '指定された確認者が操作できます'}">${complete || checked ? icon('check') : ''}</button>
    <button class="task-content" data-action="detail" data-id="${escapeHtml(task.id)}"><span class="task-title">${escapeHtml(task.title)}</span><span class="task-meta"><span class="scope-label ${task.scope}">${icon(task.scope === 'store' ? 'store' : 'user')}${task.scope === 'store' ? '店舗' : '個人'}</span><span class="meta-separator"></span><span class="due-label ${overdue ? 'late' : ''}">${icon('calendar')}${task.dueDate === today() ? '今日' : shortDate(task.dueDate)}</span>${task.templateId ? '<span class="recurring-badge">定期</span>' : ''}${skipped ? '<span class="recurring-badge">スキップ済み</span>' : ''}${assignmentProgress}${task.confirmers.length ? `<span class="confirmation-label">${confirmCount}/${task.confirmers.length}人確認済み</span>` : ''}</span></button>
    <div class="task-assignee">${assignedAvatars || (task.scope === 'personal' ? avatar(assignee, 'small') : task.confirmers.length ? `<div class="avatar-stack">${task.confirmers.slice(0, 3).map((id) => avatar(memberById(id), 'tiny')).join('')}</div>` : `<span class="anyone-avatar">${icon('users')}</span>`)}<span>${escapeHtml(label)}</span></div><button class="row-open icon-button" data-action="detail" data-id="${escapeHtml(task.id)}" aria-label="${escapeHtml(task.title)}の詳細">${icon('chevron')}</button></article>`;
}

function renderInsights() {
  const storeTasks = readableTasks().filter((task) => task.scope === 'store');
  const stats = taskStats(storeTasks);
  const percentage = stats.total ? Math.round(stats.done / stats.total * 100) : 0;
  return `<section class="store-progress"><div class="section-eyebrow">${icon('leaf')}お店の進みぐあい</div><div class="progress-ring-wrap"><div class="progress-ring" style="--progress:${percentage}%"><div><strong>${stats.done}<small>/ ${stats.total}</small></strong><span>店舗タスク完了</span></div></div><span class="ring-leaf">${icon('leaf')}</span></div><h2>${stats.pending ? 'ひとつの完了が、みんなの力に。' : 'みんなで、すっきり。'}</h2><p>${stats.pending ? `あと${stats.pending}件。できることから進めましょう。` : '店舗タスクがすべて完了しました。'}</p><div class="team-avatar-line"><div class="avatar-stack">${storeMembers().slice(0, 5).map((member) => avatar(member, 'small')).join('')}</div><span>${storeMembers().length}人で、ひとつのチーム</span></div></section>
    <section class="team-progress"><div class="section-heading"><h2>${user().role === 'admin' ? 'みんなの個人タスク' : '自分の個人タスク'}</h2>${user().role === 'admin' ? `<button class="text-button" data-action="navigate" data-page="progress">一覧${icon('arrow')}</button>` : ''}</div>${storeMembers().filter((member) => user().role === 'admin' || member.id === user().id).map((member) => {
      const stats = taskStats(readableTasks().filter((task) => task.scope === 'personal' && task.assigneeId === member.id));
      return `<div class="member-progress-row"><div>${avatar(member, 'small')}<span>${escapeHtml(member.shortName)}さん${member.id === user().id ? '<small>あなた</small>' : ''}</span><strong>${stats.done}<span>/${stats.total}</span></strong></div><div class="progress-track"><span style="width:${stats.total ? stats.done / stats.total * 100 : 0}%"></span></div></div>`;
    }).join('')}</section>
    <div class="demo-tip">${icon('info')}<div><strong>メンバーの視点も試せます</strong><p>右上の名前を切り替えると、各メンバーの画面や操作を体験できます。</p></div></div>${user().role === 'admin' ? `<button class="export-button" data-action="export">${icon('download')}データを書き出す${icon('chevron')}</button>` : ''}<button class="mobile-reset text-button" data-action="reset">${icon('reset')}デモをリセット</button>`;
}

function renderProgress() {
  const tasks = readableTasks().filter((task) => task.scope === 'personal' && !task.skippedAt);
  const groups = new Map();
  tasks.filter((task) => selectedMember === 'all' || task.assigneeId === selectedMember).forEach((task) => {
    const key = task.groupId || task.id;
    groups.set(key, [...(groups.get(key) || []), task]);
  });
  return `${renderPageHeading('みんなの進捗', '同じタスクも、一人ひとりの完了が見える。')}
    <div class="member-summary-grid">${storeMembers().map((member) => {
      const stats = taskStats(tasks.filter((task) => task.assigneeId === member.id));
      return `<button class="member-summary ${selectedMember === member.id ? 'selected' : ''}" data-action="member-filter" data-id="${escapeHtml(member.id)}">${avatar(member)}<div><strong>${escapeHtml(member.name)}${member.role === 'admin' ? '<span class="role-badge">店長</span>' : ''}</strong><p>個人タスク <b>${stats.done}</b> / ${stats.total} 完了</p><div class="progress-track"><span style="width:${stats.total ? stats.done / stats.total * 100 : 0}%"></span></div></div></button>`;
    }).join('')}</div>
    <section class="progress-panel"><div class="progress-panel-heading"><h2>個人タスクの進捗</h2><button class="text-button" data-action="member-filter" data-id="all">${selectedMember === 'all' ? '全メンバーを表示中' : '絞り込みを解除'}</button></div><div class="progress-table-scroll"><table class="progress-table"><thead><tr><th>タスク / 期限</th>${storeMembers().map((member) => `<th>${avatar(member, 'small')}<span>${escapeHtml(member.shortName)}さん</span></th>`).join('')}</tr></thead><tbody>${[...groups.values()].map((group) => `<tr><td><button class="table-title" data-action="detail" data-id="${escapeHtml(group[0].id)}">${escapeHtml(group[0].title)}</button><span class="table-date">${icon('calendar')}${shortDate(group[0].dueDate)}${group.length > 1 ? '<span class="shared-label">まとめて割り当て</span>' : ''}</span></td>${storeMembers().map((member) => {
      const task = group.find((entry) => entry.assigneeId === member.id);
      return `<td>${task ? `<button class="progress-status ${isComplete(task) ? 'done' : 'pending'}" data-action="detail" data-id="${escapeHtml(task.id)}">${isComplete(task) ? icon('check') : '<span class="status-dot"></span>'}${isComplete(task) ? '完了' : '未完了'}</button>` : '<span class="not-assigned" aria-label="割り当てなし">—</span>'}</td>`;
    }).join('')}</tr>`).join('') || `<tr><td colspan="${storeMembers().length + 1}">個人タスクはまだありません。</td></tr>`}</tbody></table></div><p class="panel-note">${icon('info')}個人タスクの完了・取り消しは、割り当てられた本人が操作します。</p></section>`;
}

function renderMembers() {
  return `${renderPageHeading('メンバー管理', 'このお店のメンバーと、役割を管理します。', false)}<section class="members-panel"><div class="progress-panel-heading"><h2>この店舗のメンバー <span class="count-badge">${storeMembers().length}</span></h2><button class="button primary" data-action="invite">${icon('plus')}メンバーを追加</button></div><div class="member-list">${storeMembers().map((member) => `<div class="member-management-row">${avatar(member)}<div class="member-name"><strong>${escapeHtml(member.name)}</strong><span>${member.id === user().id ? 'あなた · ' : ''}${escapeHtml(currentStore().name)}</span></div><label class="role-select"><span class="sr-only">${escapeHtml(member.name)}の権限</span><select data-role-member="${escapeHtml(member.id)}" ${member.id === user().id ? 'disabled title="自分の権限は変更できません"' : ''}><option value="admin" ${member.role === 'admin' ? 'selected' : ''}>管理者（店長）</option><option value="member" ${member.role === 'member' ? 'selected' : ''}>通常メンバー</option></select></label></div>`).join('')}</div><div class="member-policy">${icon('shield')}<div><strong>お店ごとに、見える範囲を分けます。</strong><p>店長は店舗のすべてのタスクを、通常メンバーは店舗タスクと自分の個人タスクを確認できます。</p></div></div></section><div class="demo-notice">${icon('info')}このモックのメンバー追加は体験用です。本番ではGoogleログインと許可メンバーの登録を接続します。</div><button class="export-button standalone-export" data-action="export">${icon('download')}バックアップ用データを書き出す${icon('chevron')}</button>`;
}

const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
const scheduleLabel = (schedule) => schedule.frequency === 'weekly' ? `毎週${weekdayNames[schedule.weekday]}曜日` : schedule.frequency === 'monthly' ? `毎月${schedule.day}日` : '毎月末日';

function renderRecurring() {
  const templates = storeTemplates();
  return `${renderPageHeading('定期タスク', 'シフトも月報も、一度決めたら毎回のやることに。', false)}
    <section class="recurring-panel"><div class="progress-panel-heading"><h2>この店舗の繰り返し設定 <span class="count-badge">${templates.length}</span></h2><button class="button primary" data-action="add-recurring">${icon('plus')}定期タスクを追加</button></div>
    <p class="recurring-guide">30日先までのタスクを自動で作成します。月に指定日がない場合は、その月の末日を期限にします。</p>
    <div class="recurring-list">${templates.map((template) => {
      const from = template.startDate > today() ? template.startDate : today();
      const nextDate = recurrenceDates(template.schedule, from, addDays(from, 370))[0];
      const assignees = template.scope === 'personal' ? template.assigneeIds.map((id) => memberById(id)?.shortName).join('・') : template.confirmers.length ? '指定した全員の確認' : '誰か1人が完了';
      return `<article class="recurring-row"><span class="recurring-symbol">${icon('reset')}</span><div class="recurring-description"><h3>${escapeHtml(template.title)}</h3><p><span class="recurring-badge">${scheduleLabel(template.schedule)}</span><span>${template.scope === 'personal' ? '個人' : '店舗'} · ${escapeHtml(assignees)}</span></p><small>${template.active ? `次の期限 ${nextDate ? nextDate.replaceAll('-', '/') : '未設定'}` : '自動作成を一時停止中（作成済みのタスクは残ります）'}</small></div><div class="recurring-actions"><button class="text-button" data-action="edit-recurring" data-id="${escapeHtml(template.id)}">${icon('edit')}編集</button><button class="button secondary" data-action="toggle-recurring" data-id="${escapeHtml(template.id)}">${template.active ? '一時停止' : '再開'}</button></div></article>`;
    }).join('') || '<div class="empty-state"><h3>定期タスクを登録しましょう</h3><p>毎週・毎月のやることを、自動でタスクにできます。</p></div>'}</div></section>
    <p class="panel-note">${icon('info')}今回分だけの期限変更・スキップは、タスク一覧の詳細から操作できます。このモックでは画面を開いたときと表示中に自動作成します。</p>`;
}

function openModal(content, wide = false) {
  if (!overlays.firstElementChild) returnFocus = document.activeElement;
  overlays.innerHTML = `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">${content}</section></div>`;
  app.inert = true;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    const target = overlays.querySelector('[autofocus]') || overlays.querySelector('.modal');
    target?.focus();
  });
}

function closeModal() {
  if (!overlays.firstElementChild) return;
  overlays.innerHTML = '';
  app.inert = false;
  document.body.classList.remove('modal-open');
  if (returnFocus?.isConnected) returnFocus.focus();
}

const modalHeading = (title, subtitle = '') => `<div class="modal-heading"><div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div><button class="icon-button" data-action="close" aria-label="閉じる">${icon('close')}</button></div>`;

function openTaskEditor(taskId, templateId, recurring = false) {
  const task = taskId ? data.tasks.find((entry) => entry.id === taskId) : null;
  const template = templateId ? storeTemplates().find((entry) => entry.id === templateId) : null;
  const isAdmin = user().role === 'admin';
  if (taskId && (!task || !canEdit(task, user()))) return;
  if ((templateId && !template) || ((templateId || recurring) && !isAdmin)) return;
  const draft = task || template;
  const scope = draft?.scope || (['mine', 'personal'].includes(scopeFilter) ? 'personal' : 'store');
  const frequency = template?.schedule.frequency || (recurring ? 'weekly' : 'none');
  const title = template ? '定期タスクを編集' : task ? '今回のタスクを編集' : recurring ? '新しい定期タスク' : '新しいタスク';
  const selectedAssignees = template?.assigneeIds || [task?.assigneeId || user().id];
  openModal(`${modalHeading(title, task?.templateId ? '変更は今回分にだけ反映します。' : 'この店舗のやることと、担当を設定します。')}
    <form id="task-form" data-edit-id="${escapeHtml(task?.id || '')}" data-template-id="${escapeHtml(template?.id || '')}"><div class="modal-body">
      <p class="editor-store">${icon('store')}${escapeHtml(currentStore().name)}</p>
      <fieldset class="scope-picker"><legend class="sr-only">タスクの種類</legend><label><input type="radio" name="scope" value="store" ${scope === 'store' ? 'checked' : ''} />${icon('store')}店舗タスク<span>お店のみんなで</span></label><label><input type="radio" name="scope" value="personal" ${scope === 'personal' ? 'checked' : ''} />${icon('user')}個人タスク<span>一人ひとりのやること</span></label></fieldset>
      <label class="field-label" for="task-title">タスク名 <span class="required-mark">必須</span></label><input id="task-title" class="form-input" name="title" placeholder="例：月報を作成する" maxlength="100" required value="${escapeHtml(draft?.title || '')}" autofocus />
      <label class="field-label" for="task-detail">詳細 <span class="optional-label">任意</span></label><textarea id="task-detail" class="form-input" name="detail" rows="3" maxlength="2000" placeholder="手順や、伝えておきたいこと">${escapeHtml(draft?.detail || '')}</textarea>
      ${!task && isAdmin ? `<label class="field-label" for="task-repeat">繰り返し</label><select class="form-input" id="task-repeat" name="frequency">${[...(!template ? [['none', '繰り返しなし（単発）']] : []), ['weekly', '毎週、決まった曜日'], ['monthly', '毎月、決まった日'], ['monthEnd', '毎月、末日']].map(([value, label]) => `<option value="${value}" ${frequency === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
      <div id="repeat-weekday" ${frequency !== 'weekly' ? 'hidden' : ''}><label class="field-label" for="task-weekday">曜日</label><select class="form-input" id="task-weekday" name="weekday">${weekdayNames.map((day, index) => `<option value="${index}" ${(template?.schedule.weekday ?? 1) === index ? 'selected' : ''}>${day}曜日</option>`).join('')}</select></div>
      <div id="repeat-day" ${frequency !== 'monthly' ? 'hidden' : ''}><label class="field-label" for="task-monthday">毎月の日付</label><select class="form-input" id="task-monthday" name="monthday">${Array.from({ length: 31 }, (_, index) => index + 1).map((day) => `<option value="${day}" ${(template?.schedule.day ?? 20) === day ? 'selected' : ''}>${day}日</option>`).join('')}</select><p class="field-note">指定日がない月は、月末を期限にします。</p></div>` : ''}
      <label class="field-label" id="task-date-label" for="task-date">${frequency === 'none' ? '期限（任意）' : '繰り返しの開始日'}</label><input id="task-date" class="form-input date-input" type="date" name="dueDate" ${frequency !== 'none' ? 'required' : ''} value="${escapeHtml(task?.dueDate ?? template?.startDate ?? today())}" />
      <p id="repeat-note" class="field-note" ${frequency === 'none' ? 'hidden' : ''}>開始日以降の設定した曜日・日付を期限として、30日先まで自動作成します。設定変更は今日以降の未着手分に反映します。個別に変更・スキップした分と、確認済みの分は残ります。</p>
      <div id="personal-fields" ${scope !== 'personal' ? 'hidden' : ''}>${isAdmin ? `<p class="field-label">担当者${!task ? ' <span class="optional-label">複数選択で個別に割り当て</span>' : ''}</p><div class="member-checkboxes">${storeMembers().map((member) => `<label><input type="${task ? 'radio' : 'checkbox'}" name="assignees" value="${escapeHtml(member.id)}" ${selectedAssignees.includes(member.id) ? 'checked' : ''} />${avatar(member, 'tiny')}<span>${escapeHtml(member.shortName)}</span></label>`).join('')}</div>` : '<p class="field-note">個人タスクは、自分のタスクとして追加されます。</p>'}</div>
      <div id="store-fields" ${scope !== 'store' ? 'hidden' : ''}>${isAdmin ? `<p class="field-label">完了に必要な確認</p><label class="form-radio"><input type="radio" name="confirmMode" value="anyone" ${!draft?.confirmers.length ? 'checked' : ''} /><span><strong>誰か1人が完了すればOK</strong><small>所属するメンバーなら誰でも操作できます</small></span></label><label class="form-radio"><input type="radio" name="confirmMode" value="all" ${draft?.confirmers.length ? 'checked' : ''} /><span><strong>指定した全員の確認が必要</strong><small>一人ひとりの確認状況を記録します</small></span></label><div id="confirmer-fields" class="member-checkboxes" ${!draft?.confirmers.length ? 'hidden' : ''}>${storeMembers().map((member) => `<label><input type="checkbox" name="confirmers" value="${escapeHtml(member.id)}" ${draft?.confirmers.includes(member.id) ? 'checked' : ''} />${avatar(member, 'tiny')}<span>${escapeHtml(member.shortName)}</span></label>`).join('')}</div>` : `<p class="field-note">${task?.confirmers.length ? 'このタスクは、店長が指定した全員の確認で完了します。' : '店舗タスクは、誰か1人が完了すると完了になります。'}</p>`}</div>
      ${task ? '<p class="field-note edit-note">担当者・種類・確認条件を変更すると、完了状況をリセットします。</p>' : ''}<p id="form-error" class="form-error" role="alert"></p>
    </div><div class="modal-footer"><button type="button" class="button secondary" data-action="close">キャンセル</button><button type="submit" class="button primary">${task || template ? '変更を保存' : '追加する'}</button></div></form>`);
}

function saveTask(form) {
  const fields = new FormData(form);
  const task = data.tasks.find((entry) => entry.id === form.dataset.editId);
  const template = storeTemplates().find((entry) => entry.id === form.dataset.templateId);
  if ((form.dataset.editId && !task) || (task && !canEdit(task, user())) || (form.dataset.templateId && !template)) return;
  const isAdmin = user().role === 'admin';
  const frequency = !task && isAdmin ? String(fields.get('frequency') || 'none') : 'none';
  if (template && !isAdmin) return;
  const scope = fields.get('scope') === 'personal' ? 'personal' : 'store';
  const title = String(fields.get('title') || '').trim();
  const assignees = isAdmin ? fields.getAll('assignees').map(String).filter((id) => storeMembers().some((member) => member.id === id)) : [user().id];
  const confirmers = scope === 'store' ? isAdmin ? fields.get('confirmMode') === 'all' ? fields.getAll('confirmers').map(String).filter((id) => storeMembers().some((member) => member.id === id)) : [] : task?.scope === 'store' ? task.confirmers : [] : [];
  const dueDate = String(fields.get('dueDate') || '');
  const schedule = { frequency, ...(frequency === 'weekly' ? { weekday: Number(fields.get('weekday')) } : frequency === 'monthly' ? { day: Number(fields.get('monthday')) } : {}) };
  const error = !title ? 'タスク名を入力してください。' : scope === 'personal' && !assignees.length ? '担当者を1人以上選んでください。' : scope === 'store' && isAdmin && fields.get('confirmMode') === 'all' && !confirmers.length ? '確認者を1人以上選んでください。' : (dueDate && !isValidDate(dueDate)) || (frequency !== 'none' && (!isValidDate(dueDate) || !isValidSchedule(schedule))) ? '日付と繰り返し条件を確認してください。' : '';
  if (error) { document.querySelector('#form-error').textContent = error; return; }
  const base = { title, detail: String(fields.get('detail') || '').trim(), dueDate, scope, confirmers, storeId: user().storeId };
  if (frequency !== 'none') {
    const recurringTemplate = { ...template, id: template?.id || crypto.randomUUID(), title, detail: base.detail, scope, confirmers, storeId: user().storeId, createdBy: template?.createdBy || user().id, assigneeIds: scope === 'personal' ? assignees : [], schedule, startDate: dueDate, generatedThrough: null, active: template?.active ?? true };
    data = updateRecurringTemplate(data, recurringTemplate);
    persist(); closeModal(); navigate('recurring');
    toast(template ? '定期タスクの設定を更新しました' : '定期タスクを追加しました');
    return;
  } else if (task) {
    const assigneeId = scope === 'personal' ? assignees[0] : null;
    const conditionsChanged = task.scope !== scope || task.assigneeId !== assigneeId || [...task.confirmers].sort().join() !== [...confirmers].sort().join();
    data = { ...data, tasks: data.tasks.map((entry) => entry.id === task.id ? { ...entry, ...base, assigneeId, ...(task.templateId ? { occurrenceOverride: true } : {}), completions: conditionsChanged ? {} : entry.completions, groupId: conditionsChanged || entry.title !== title || entry.dueDate !== dueDate ? null : entry.groupId } : entry) };
  } else {
    const groupId = scope === 'personal' && assignees.length > 1 ? crypto.randomUUID() : null;
    const newTasks = (scope === 'personal' ? assignees : [null]).map((assigneeId) => ({ ...base, id: crypto.randomUUID(), assigneeId, createdBy: user().id, groupId, completions: {} }));
    data = { ...data, tasks: [...newTasks, ...data.tasks] };
  }
  persist();
  closeModal();
  query = '';
  scopeFilter = scope === 'store' ? 'store' : user().role === 'admin' ? 'personal' : 'mine';
  statusFilter = 'pending';
  render();
  toast(task ? 'タスクを更新しました' : scope === 'personal' && assignees.length > 1 ? `${assignees.length}人にタスクを割り当てました` : 'タスクを追加しました');
}

function openDetail(taskId) {
  const task = data.tasks.find((entry) => entry.id === taskId);
  if (!task || !canRead(task, user())) return;
  const complete = isComplete(task);
  const checked = Boolean(task.completions[user().id]);
  const groupTasks = task.groupId ? readableTasks().filter((entry) => entry.groupId === task.groupId) : [task];
  const confirmationMembers = task.scope === 'personal' ? groupTasks.map((entry) => ({ member: memberById(entry.assigneeId), timestamp: entry.completions[entry.assigneeId], skipped: Boolean(entry.skippedAt) })) : task.confirmers.length ? task.confirmers.map((id) => ({ member: memberById(id), timestamp: task.completions[id] })) : Object.entries(task.completions).map(([id, timestamp]) => ({ member: memberById(id), timestamp }));
  openModal(`${modalHeading('タスクの詳細')}<div class="modal-body detail-body"><span class="detail-scope ${task.scope}">${icon(task.scope === 'store' ? 'store' : 'user')}${task.scope === 'store' ? '店舗タスク' : '個人タスク'}</span>${task.templateId ? '<span class="recurring-badge">定期タスク</span>' : ''}<h3 class="detail-title">${escapeHtml(task.title)}</h3><div class="detail-properties"><span>${icon('calendar')}期限</span><strong>${task.dueDate ? task.dueDate.replaceAll('-', '/') : '設定なし'}</strong><span>${icon('user')}作成者</span><strong>${escapeHtml(memberById(task.createdBy)?.name || 'メンバー')}</strong><span>${icon('check')}完了条件</span><strong>${task.scope === 'personal' ? '担当者本人の完了' : task.confirmers.length ? `指定した${task.confirmers.length}人全員の確認` : '誰か1人の完了'}</strong></div><div class="detail-description">${task.detail ? escapeHtml(task.detail) : '<span class="muted">詳細はありません。</span>'}</div><section class="detail-confirmations"><h4>${task.scope === 'personal' ? groupTasks.length > 1 ? '担当者ごとの完了状況' : '担当者の完了状況' : 'メンバーの確認状況'}</h4>${confirmationMembers.length ? confirmationMembers.map(({ member, timestamp, skipped }) => `<div class="confirmation-person">${avatar(member, 'small')}<span>${escapeHtml(member?.name || '')}<small>${timestamp ? `${new Date(timestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 完了` : skipped ? '今回分はスキップ済みです' : 'まだ完了していません'}</small></span><span class="status-badge ${timestamp ? 'done' : ''}">${timestamp ? `${icon('check')}完了` : skipped ? 'スキップ' : '未完了'}</span></div>`).join('') : '<p class="field-note">まだ完了したメンバーはいません。</p>'}</section>${task.skippedAt ? '<p class="skip-notice">今回分はスキップ済みです。</p>' : ''}${canComplete(task, user()) ? `<button class="button ${checked ? 'secondary' : 'primary'} full-width" data-action="complete" data-id="${escapeHtml(task.id)}" data-detail="true">${icon(checked ? 'reset' : 'check')}${checked ? '自分の完了を取り消す' : task.confirmers.length ? '自分の確認を完了する' : '完了にする'}</button>` : task.skippedAt ? '' : `<p class="field-note">${task.scope === 'personal' ? '完了・取り消しは担当者本人が操作できます。' : complete ? '完了した本人が取り消せます。' : '指定された確認者が操作できます。'}</p>`}</div>${canEdit(task, user()) ? `<div class="modal-footer detail-actions">${task.templateId ? `<button class="text-button" data-action="skip-occurrence" data-id="${escapeHtml(task.id)}" ${!task.skippedAt && Object.keys(task.completions).length ? 'disabled' : ''}>${task.skippedAt ? 'スキップを取り消す' : task.scope === 'personal' ? 'この担当者の今回分をスキップ' : '今回分をスキップ'}</button>` : `<button class="text-button danger" data-action="delete" data-id="${escapeHtml(task.id)}">${icon('trash')}削除</button>`}<button class="button secondary" data-action="edit" data-id="${escapeHtml(task.id)}">${icon('edit')}編集する</button></div>` : ''}`);
}

function confirmDelete(taskId) {
  const task = data.tasks.find((entry) => entry.id === taskId);
  if (!task || !canEdit(task, user())) return;
  openModal(`${modalHeading('タスクを削除しますか？')}<div class="modal-body"><p class="confirmation-copy">「${escapeHtml(task.title)}」を削除します。この操作は取り消せません。</p></div><div class="modal-footer"><button class="button secondary" data-action="detail" data-id="${escapeHtml(task.id)}">戻る</button><button class="button danger-button" data-action="confirm-delete" data-id="${escapeHtml(task.id)}">削除する</button></div>`);
}

function openInvite() {
  if (user().role !== 'admin') return;
  openModal(`${modalHeading('体験用メンバーを追加', '架空の名前で、画面の見え方を試せます。')}<form id="member-form"><div class="modal-body"><label class="field-label" for="member-name">名前 <span class="required-mark">必須</span></label><input class="form-input" id="member-name" name="name" maxlength="30" required placeholder="例：山田 花子" autofocus /><label class="field-label" for="member-role">権限</label><select class="form-input" id="member-role" name="role"><option value="member">通常メンバー</option><option value="admin">管理者（店長）</option></select><p class="field-note">実際の招待やメール送信は行われません。</p><p class="form-error" id="form-error" role="alert"></p></div><div class="modal-footer"><button type="button" class="button secondary" data-action="close">キャンセル</button><button class="button primary" type="submit">追加する</button></div></form>`);
}

function openStoreEditor() {
  if (user().role !== 'admin') return;
  openModal(`${modalHeading('体験用の店舗を追加', '店舗ごとにメンバーとタスクを分けて管理できます。')}<form id="store-form"><div class="modal-body"><label class="field-label" for="store-name">店舗名 <span class="required-mark">必須</span></label><input class="form-input" id="store-name" name="name" maxlength="50" required autofocus placeholder="例：こもれび珈琲 南店" /><label class="field-label" for="store-manager">店長の名前 <span class="required-mark">必須</span></label><input class="form-input" id="store-manager" name="managerName" maxlength="30" required placeholder="例：山田 花子" /><p id="form-error" class="form-error" role="alert"></p></div><div class="modal-footer"><button type="button" class="button secondary" data-action="close">キャンセル</button><button type="submit" class="button primary">店舗を追加</button></div></form>`);
}

function exportData() {
  if (user().role !== 'admin') return;
  const exportValue = { application: 'みせノート', formatVersion: 2, demo: true, exportedAt: new Date().toISOString(), store: currentStore(), members: storeMembers(), recurringTemplates: storeTemplates(), tasks: readableTasks() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportValue, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `misenote-backup-${today()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('バックアップ用データを書き出しました');
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) {
    if (event.target.classList.contains('modal-backdrop')) closeModal();
    return;
  }
  event.preventDefault();
  const { action, id, value } = button.dataset;
  if (action === 'navigate') navigate(button.dataset.page);
  else if (action === 'add') openTaskEditor();
  else if (action === 'add-store') openStoreEditor();
  else if (action === 'add-recurring') openTaskEditor(null, null, true);
  else if (action === 'edit-recurring') openTaskEditor(null, id);
  else if (action === 'toggle-recurring') {
    const template = storeTemplates().find((entry) => entry.id === id);
    if (!template || user().role !== 'admin') return;
    const updated = { ...template, active: !template.active, generatedThrough: template.active ? template.generatedThrough : addDays(today(), -1) };
    data = updated.active ? updateRecurringTemplate(data, updated) : { ...data, recurringTemplates: data.recurringTemplates.map((entry) => entry.id === id ? updated : entry) };
    persist(); render(); toast(updated.active ? '定期タスクの自動作成を再開しました' : '定期タスクの自動作成を一時停止しました');
  } else if (action === 'skip-occurrence') {
    const task = data.tasks.find((entry) => entry.id === id);
    if (!task?.templateId || !canEdit(task, user()) || (!task.skippedAt && Object.keys(task.completions).length > 0)) return;
    data = { ...data, tasks: data.tasks.map((entry) => {
      if (entry.id !== id) return entry;
      const { skippedAt, ...rest } = entry;
      return skippedAt ? { ...rest, occurrenceOverride: true } : { ...entry, skippedAt: new Date().toISOString(), occurrenceOverride: true };
    }) };
    persist(); render(); openDetail(id); toast(task.skippedAt ? 'スキップを取り消しました' : '今回分をスキップしました');
  } else if (action === 'close') closeModal();
  else if (action === 'scope') { scopeFilter = value; render(); }
  else if (action === 'detail') openDetail(id);
  else if (action === 'edit') openTaskEditor(id);
  else if (action === 'delete') confirmDelete(id);
  else if (action === 'confirm-delete') {
    const task = data.tasks.find((entry) => entry.id === id);
    if (!task || task.templateId || !canEdit(task, user())) return;
    data = { ...data, tasks: data.tasks.filter((entry) => entry.id !== id) };
    persist(); closeModal(); render(); toast('タスクを削除しました');
  } else if (action === 'complete') {
    const task = data.tasks.find((entry) => entry.id === id);
    if (!task || !canComplete(task, user())) return;
    const updated = toggleCompletion(task, user());
    data = { ...data, tasks: data.tasks.map((entry) => entry.id === id ? updated : entry) };
    persist(); render();
    if (button.dataset.detail) openDetail(id);
    toast(updated.completions[user().id] ? updated.confirmers.length && !isComplete(updated) ? '自分の確認を記録しました。ほかのメンバーの確認を待っています。' : 'タスクを完了しました。おつかれさまです！' : '自分の完了を取り消しました');
  } else if (action === 'member-filter') { selectedMember = selectedMember === id ? 'all' : id; render(); }
  else if (action === 'invite') openInvite();
  else if (action === 'export') exportData();
  else if (action === 'reset') openModal(`${modalHeading('デモを最初の状態に戻しますか？')}<div class="modal-body"><p class="confirmation-copy">追加・編集したタスクとメンバーを消して、最初のサンプルデータに戻します。</p></div><div class="modal-footer"><button class="button secondary" data-action="close">キャンセル</button><button class="button primary" data-action="confirm-reset">最初の状態に戻す</button></div>`);
  else if (action === 'confirm-reset') { data = createSeed(); currentUserId = 'misaki'; persist(); navigate('today'); toast('デモを最初の状態に戻しました'); }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'task-search') { query = event.target.value; render(); }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.id === 'demo-user') { currentUserId = target.value; navigate('today'); toast(`${user().name}さんの画面に切り替えました`); }
  else if (target.id === 'store-switcher') {
    const manager = data.members.find((member) => member.storeId === target.value && member.role === 'admin');
    if (!manager) return;
    currentUserId = manager.id;
    navigate('today'); toast(`${currentStore().name}に切り替えました`);
  } else if (target.id === 'task-repeat') {
    document.querySelector('#repeat-weekday').hidden = target.value !== 'weekly';
    document.querySelector('#repeat-day').hidden = target.value !== 'monthly';
    document.querySelector('#repeat-note').hidden = target.value === 'none';
    document.querySelector('#task-date-label').textContent = target.value === 'none' ? '期限（任意）' : '繰り返しの開始日';
    document.querySelector('#task-date').required = target.value !== 'none';
  }
  else if (target.id === 'status-filter') { statusFilter = target.value; render(); }
  else if (target.name === 'scope') {
    document.querySelector('#personal-fields').hidden = target.value !== 'personal';
    document.querySelector('#store-fields').hidden = target.value !== 'store';
  } else if (target.name === 'confirmMode') document.querySelector('#confirmer-fields').hidden = target.value !== 'all';
  else if (target.dataset.roleMember && user().role === 'admin' && target.dataset.roleMember !== user().id && storeMembers().some((member) => member.id === target.dataset.roleMember)) {
    data = { ...data, members: data.members.map((member) => member.id === target.dataset.roleMember ? { ...member, role: target.value === 'admin' ? 'admin' : 'member' } : member) };
    persist(); render(); toast('メンバーの権限を更新しました');
  }
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'task-form') saveTask(event.target);
  else if (event.target.id === 'store-form' && user().role === 'admin') {
    const fields = new FormData(event.target);
    const name = String(fields.get('name') || '').trim();
    const managerName = String(fields.get('managerName') || '').trim();
    if (!name || !managerName) { document.querySelector('#form-error').textContent = '店舗名と店長の名前を入力してください。'; return; }
    const storeId = crypto.randomUUID();
    const managerId = crypto.randomUUID();
    data = { ...data, stores: [...data.stores, { id: storeId, name }], members: [...data.members, { id: managerId, name: managerName, shortName: managerName.split(/[\s　]+/).at(-1), color: 'green', role: 'admin', storeId }] };
    currentUserId = managerId;
    persist(); navigate('today'); toast('店舗を追加しました');
  }
  else if (event.target.id === 'member-form' && user().role === 'admin') {
    const fields = new FormData(event.target);
    const name = String(fields.get('name') || '').trim();
    if (!name) { document.querySelector('#form-error').textContent = '名前を入力してください。'; return; }
    const shortName = name.split(/[\s　]+/).at(-1);
    data = { ...data, members: [...data.members, { id: crypto.randomUUID(), name, shortName, role: fields.get('role') === 'admin' ? 'admin' : 'member', storeId: user().storeId, color: ['green', 'blue', 'rose'][data.members.length % 3] }] };
    persist(); closeModal(); render(); toast('体験用メンバーを追加しました');
  }
});

document.addEventListener('keydown', (event) => {
  const modal = overlays.querySelector('.modal');
  if (!modal) return;
  if (event.key === 'Escape') closeModal();
  if (event.key !== 'Tab') return;
  const focusable = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, select:not(:disabled), a[href]')].filter((element) => element.getClientRects().length);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) { event.preventDefault(); first?.focus(); }
});

function syncRecurringTasks() {
  const nextData = generateRecurringTasks(data);
  if (nextData === data) return;
  data = nextData;
  persist();
  if (!overlays.firstElementChild) render();
}

setInterval(() => { if (!document.hidden) syncRecurringTasks(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncRecurringTasks(); });
window.addEventListener('focus', syncRecurringTasks);

render();
persist();
if (storageUnavailable) toast('このブラウザでは保存できません。変更は画面を閉じるまで有効です。');
