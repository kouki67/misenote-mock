import { STORE_ID, createSeed, localDate, isComplete, canRead, canEdit, canComplete, toggleCompletion, taskStats, isValidState } from './domain.mjs';

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
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return isValidState(saved) ? saved : createSeed();
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
  if (me.role !== 'admin' && ['progress', 'members'].includes(page)) page = 'today';
  const nav = [
    ['today', 'grid', 'タスク', ''],
    ...(me.role === 'admin' ? [['progress', 'chart', 'みんなの進捗', ''], ['members', 'users', 'メンバー管理', '']] : []),
  ];
  document.title = `${nav.find(([id]) => id === page)?.[2] || 'タスク'} | みせノート`;
  app.innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="#" data-action="navigate" data-page="today"><span class="brand-mark">${icon('logo')}</span><span>みせノート<span class="brand-dot">.</span></span></a>
      <div class="store-identity"><span class="store-symbol">${icon('store')}</span><div><strong>こもれび珈琲</strong><span>本店 <span class="store-open-dot"></span> ${data.members.length}人のチーム</span></div></div>
      <p class="nav-caption">ワークスペース</p>
      <nav class="main-nav" aria-label="メインメニュー">${nav.map(([id, glyph, label, count]) => `<button class="nav-item ${page === id ? 'active' : ''}" data-action="navigate" data-page="${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${count ? `<span class="nav-count">${count}</span>` : ''}</button>`).join('')}</nav>
      <div class="sidebar-team"><p class="nav-caption">お店のメンバー <span>${data.members.length}</span></p>${data.members.map((member) => `<div class="sidebar-person">${avatar(member, 'small')}<span>${escapeHtml(member.name)}</span>${member.role === 'admin' ? '<span class="manager-label">店長</span>' : '<span class="presence-dot" aria-label="メンバー"></span>'}</div>`).join('')}</div>
      <div class="sidebar-bottom"><div class="demo-hint">${icon('leaf')}<strong>小さなチームに、<br>ちょうどいいタスク管理。</strong><span>ひとつずつ、みんなで。</span></div><button class="subtle-button reset-button" data-action="reset">${icon('reset')}デモを最初の状態に戻す</button></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb">${icon('logo')}<span>みせノート</span><span class="slash">/</span><strong>${nav.find(([id]) => id === page)?.[2] || 'タスク'}</strong></div><div class="user-picker"><span class="demo-pill">体験用モック</span><label class="user-select">${avatar(me, 'small')}<select id="demo-user" aria-label="体験するメンバーを切り替え">${data.members.map((member) => `<option value="${escapeHtml(member.id)}" ${member.id === me.id ? 'selected' : ''}>${escapeHtml(member.name)}${member.role === 'admin' ? '（店長）' : '（メンバー）'}</option>`).join('')}</select>${icon('down')}</label></div></header>
      <main class="main-content" id="main-content">
        ${page === 'progress' ? renderProgress() : page === 'members' ? renderMembers() : renderTaskPage()}
        <footer class="page-footer"><span>${icon('logo')}みせノート</span><span>架空のお店・サンプルデータです。変更はこのブラウザ内に保存されます。</span></footer>
      </main>
      <nav class="mobile-nav" aria-label="モバイルメニュー">${nav.map(([id, glyph]) => `<button class="${page === id ? 'active' : ''}" data-action="navigate" data-page="${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${id === 'today' ? 'タスク' : id === 'progress' ? '進捗' : 'メンバー'}</span></button>`).join('')}</nav>
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
  const dueRows = taskRows.filter(({ task }) => task.dueDate && task.dueDate <= today());
  const dueStats = { total: dueRows.length, done: dueRows.filter(({ complete }) => complete).length };
  const waiting = tasks.filter((task) => task.scope === 'store' && task.confirmers.length && !isComplete(task) && Object.keys(task.completions).length).length;
  const scopeTabs = [['all', 'すべて'], ['store', '店舗'], ['mine', '自分'], ...(user().role === 'admin' ? [['personal', '全員の個人']] : [])];
  return `${renderPageHeading('タスク', 'お店のことも、自分のことも。ひとつずつ、みんなで。')}
    <div class="dashboard-grid"><section class="task-column" aria-label="タスク一覧">
      <div class="summary-strip"><div class="summary-item"><span class="summary-symbol mint">${icon('calendar')}</span><div><span>今日までのタスク</span><strong>${dueStats.total}<small>件</small></strong></div></div><div class="summary-item"><span class="summary-symbol pale-green">${icon('check')}</span><div><span>完了したタスク</span><strong>${dueStats.done}<small>/ ${dueStats.total}件</small></strong></div></div><div class="summary-item"><span class="summary-symbol pale-yellow">${icon('users')}</span><div><span>みんなの確認待ち</span><strong>${waiting}<small>件</small></strong></div></div></div>
      <div class="task-panel"><div class="task-panel-heading"><div class="scope-tabs" role="group" aria-label="表示するタスク">${scopeTabs.map(([value, label]) => `<button class="scope-tab ${scopeFilter === value ? 'active' : ''}" data-action="scope" data-value="${value}" aria-pressed="${scopeFilter === value}">${label}${scopeFilter === value ? `<span>${taskRows.length}</span>` : ''}</button>`).join('')}</div></div>
        <div class="task-tools"><label class="search-box">${icon('search')}<input id="task-search" type="search" placeholder="タスクを検索" value="${escapeHtml(query)}" aria-label="タスクを検索" /></label><label class="status-select"><select id="status-filter" aria-label="完了状況で絞り込み"><option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>未完了</option><option value="all" ${statusFilter === 'all' ? 'selected' : ''}>すべての状態</option><option value="done" ${statusFilter === 'done' ? 'selected' : ''}>完了済み</option></select>${icon('down')}</label></div>
        <div class="task-list">${renderTaskGroups(taskRows)}</div>
        <button class="inline-add" data-action="add">${icon('plus')}タスクを追加する</button>
      </div><div class="task-legend"><span><span class="legend-circle"></span>丸を押して完了・取り消し</span><span>${icon('users')}全員確認は、各メンバーの操作が必要です</span></div>
    </section><aside class="insight-column">${renderInsights()}</aside></div>`;
}

function createTaskRows(tasks) {
  const groups = new Map();
  const combineAssignments = user().role === 'admin' && scopeFilter !== 'mine';
  for (const task of tasks) {
    const key = combineAssignments && task.scope === 'personal' && task.groupId ? `group:${task.groupId}` : `task:${task.id}`;
    groups.set(key, [...(groups.get(key) || []), task]);
  }
  return [...groups.values()].map((assignments) => ({
    task: assignments.find((task) => task.assigneeId === user().id) || assignments[0],
    assignments,
    complete: assignments.every(isComplete),
  }));
}

function renderTaskGroups(taskRows) {
  const filtered = taskRows.filter(({ assignments, complete }) =>
    (statusFilter === 'all' || (statusFilter === 'done' ? complete : !complete)) &&
    assignments.some((assignment) => `${assignment.title} ${assignment.detail} ${memberById(assignment.assigneeId)?.name || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  if (!filtered.length) return `<div class="empty-state"><span>${icon(statusFilter === 'done' ? 'check' : 'leaf')}</span><h3>${query ? '該当するタスクがありません' : statusFilter === 'done' ? '完了したタスクはまだありません' : 'やることが、すっきりしました'}</h3><p>${query ? '別の言葉や条件で探してみてください。' : statusFilter === 'done' ? '完了したタスクは、ここに並びます。' : '新しいタスクを追加するか、完了済みのタスクを確認できます。'}</p></div>`;
  const groups = [
    { title: '期限を過ぎています', className: 'overdue', match: ({ task, complete }) => task.dueDate && task.dueDate < today() && !complete },
    { title: '今日まで', className: 'today-group', match: ({ task, complete }) => task.dueDate && task.dueDate <= today() && (task.dueDate === today() || complete) },
    { title: 'これから', className: 'upcoming', match: ({ task }) => !task.dueDate || task.dueDate > today() },
  ];
  return groups.map((group) => {
    const groupTasks = filtered.filter(group.match).sort((a, b) => Number(a.complete) - Number(b.complete) || (a.task.dueDate || '9999').localeCompare(b.task.dueDate || '9999'));
    return groupTasks.length ? `<section class="task-group ${group.className}"><h2>${group.className === 'overdue' ? icon('clock') : ''}${group.title}<span>${groupTasks.length}</span></h2>${groupTasks.map(renderTaskRow).join('')}</section>` : '';
  }).join('');
}

function renderTaskRow({ task, assignments, complete }) {
  const groupedPersonal = task.scope === 'personal' && assignments.length > 1;
  const checked = Boolean(task.completions[user().id]);
  const allowed = canComplete(task, user());
  const confirmCount = task.confirmers.filter((id) => task.completions[id]).length;
  const assignee = memberById(task.assigneeId);
  const label = groupedPersonal ? `${assignments.length}人に割り当て` : task.scope === 'personal' ? assignee?.shortName : task.confirmers.length ? '全員確認' : '誰でもOK';
  const assignmentProgress = groupedPersonal ? `<span class="confirmation-label">${assignments.filter(isComplete).length}/${assignments.length}人完了</span>` : '';
  const assignedAvatars = groupedPersonal ? `<div class="avatar-stack">${assignments.slice(0, 3).map((assignment) => avatar(memberById(assignment.assigneeId), 'tiny')).join('')}</div>` : '';
  const overdue = task.dueDate && task.dueDate < today() && !complete;
  return `<article class="task-row ${complete ? 'complete' : ''}">
    <button class="completion-check ${complete || checked ? 'checked' : ''} ${checked && !complete ? 'partial' : ''}" data-action="complete" data-id="${escapeHtml(task.id)}" ${allowed ? '' : 'disabled'} aria-label="${escapeHtml(task.title)}：${checked ? '自分の完了を取り消す' : complete ? '完了済み' : task.confirmers.length ? '自分の確認を完了する' : '完了する'}" aria-pressed="${checked || complete}" title="${allowed ? checked ? '完了を取り消す' : '完了する' : task.scope === 'personal' ? '本人が完了操作できます' : complete ? '完了した本人が取り消せます' : '指定された確認者が操作できます'}">${complete || checked ? icon('check') : ''}</button>
    <button class="task-content" data-action="detail" data-id="${escapeHtml(task.id)}"><span class="task-title">${escapeHtml(task.title)}</span><span class="task-meta"><span class="scope-label ${task.scope}">${icon(task.scope === 'store' ? 'store' : 'user')}${task.scope === 'store' ? '店舗' : '個人'}</span><span class="meta-separator"></span><span class="due-label ${overdue ? 'late' : ''}">${icon('calendar')}${task.dueDate === today() ? '今日' : shortDate(task.dueDate)}</span>${assignmentProgress}${task.confirmers.length ? `<span class="confirmation-label">${confirmCount}/${task.confirmers.length}人確認済み</span>` : ''}</span></button>
    <div class="task-assignee">${assignedAvatars || (task.scope === 'personal' ? avatar(assignee, 'small') : task.confirmers.length ? `<div class="avatar-stack">${task.confirmers.slice(0, 3).map((id) => avatar(memberById(id), 'tiny')).join('')}</div>` : `<span class="anyone-avatar">${icon('users')}</span>`)}<span>${escapeHtml(label)}</span></div><button class="row-open icon-button" data-action="detail" data-id="${escapeHtml(task.id)}" aria-label="${escapeHtml(task.title)}の詳細">${icon('chevron')}</button></article>`;
}

function renderInsights() {
  const storeTasks = readableTasks().filter((task) => task.scope === 'store');
  const stats = taskStats(storeTasks);
  const percentage = stats.total ? Math.round(stats.done / stats.total * 100) : 0;
  return `<section class="store-progress"><div class="section-eyebrow">${icon('leaf')}お店の進みぐあい</div><div class="progress-ring-wrap"><div class="progress-ring" style="--progress:${percentage}%"><div><strong>${stats.done}<small>/ ${stats.total}</small></strong><span>店舗タスク完了</span></div></div><span class="ring-leaf">${icon('leaf')}</span></div><h2>${stats.pending ? 'ひとつの完了が、みんなの力に。' : 'みんなで、すっきり。'}</h2><p>${stats.pending ? `あと${stats.pending}件。できることから進めましょう。` : '店舗タスクがすべて完了しました。'}</p><div class="team-avatar-line"><div class="avatar-stack">${data.members.slice(0, 5).map((member) => avatar(member, 'small')).join('')}</div><span>${data.members.length}人で、ひとつのチーム</span></div></section>
    <section class="team-progress"><div class="section-heading"><h2>${user().role === 'admin' ? 'みんなの個人タスク' : '自分の個人タスク'}</h2>${user().role === 'admin' ? `<button class="text-button" data-action="navigate" data-page="progress">一覧${icon('arrow')}</button>` : ''}</div>${data.members.filter((member) => user().role === 'admin' || member.id === user().id).map((member) => {
      const stats = taskStats(readableTasks().filter((task) => task.scope === 'personal' && task.assigneeId === member.id));
      return `<div class="member-progress-row"><div>${avatar(member, 'small')}<span>${escapeHtml(member.shortName)}さん${member.id === user().id ? '<small>あなた</small>' : ''}</span><strong>${stats.done}<span>/${stats.total}</span></strong></div><div class="progress-track"><span style="width:${stats.total ? stats.done / stats.total * 100 : 0}%"></span></div></div>`;
    }).join('')}</section>
    <div class="demo-tip">${icon('info')}<div><strong>メンバーの視点も試せます</strong><p>右上の名前を切り替えると、各メンバーの画面や操作を体験できます。</p></div></div>${user().role === 'admin' ? `<button class="export-button" data-action="export">${icon('download')}データを書き出す${icon('chevron')}</button>` : ''}<button class="mobile-reset text-button" data-action="reset">${icon('reset')}デモをリセット</button>`;
}

function renderProgress() {
  const tasks = readableTasks().filter((task) => task.scope === 'personal');
  const groups = new Map();
  tasks.filter((task) => selectedMember === 'all' || task.assigneeId === selectedMember).forEach((task) => {
    const key = task.groupId || task.id;
    groups.set(key, [...(groups.get(key) || []), task]);
  });
  return `${renderPageHeading('みんなの進捗', '同じタスクも、一人ひとりの完了が見える。')}
    <div class="member-summary-grid">${data.members.map((member) => {
      const stats = taskStats(tasks.filter((task) => task.assigneeId === member.id));
      return `<button class="member-summary ${selectedMember === member.id ? 'selected' : ''}" data-action="member-filter" data-id="${escapeHtml(member.id)}">${avatar(member)}<div><strong>${escapeHtml(member.name)}${member.role === 'admin' ? '<span class="role-badge">店長</span>' : ''}</strong><p>個人タスク <b>${stats.done}</b> / ${stats.total} 完了</p><div class="progress-track"><span style="width:${stats.total ? stats.done / stats.total * 100 : 0}%"></span></div></div></button>`;
    }).join('')}</div>
    <section class="progress-panel"><div class="progress-panel-heading"><h2>個人タスクの進捗</h2><button class="text-button" data-action="member-filter" data-id="all">${selectedMember === 'all' ? '全メンバーを表示中' : '絞り込みを解除'}</button></div><div class="progress-table-scroll"><table class="progress-table"><thead><tr><th>タスク / 期限</th>${data.members.map((member) => `<th>${avatar(member, 'small')}<span>${escapeHtml(member.shortName)}さん</span></th>`).join('')}</tr></thead><tbody>${[...groups.values()].map((group) => `<tr><td><button class="table-title" data-action="detail" data-id="${escapeHtml(group[0].id)}">${escapeHtml(group[0].title)}</button><span class="table-date">${icon('calendar')}${shortDate(group[0].dueDate)}${group.length > 1 ? '<span class="shared-label">まとめて割り当て</span>' : ''}</span></td>${data.members.map((member) => {
      const task = group.find((entry) => entry.assigneeId === member.id);
      return `<td>${task ? `<button class="progress-status ${isComplete(task) ? 'done' : 'pending'}" data-action="detail" data-id="${escapeHtml(task.id)}">${isComplete(task) ? icon('check') : '<span class="status-dot"></span>'}${isComplete(task) ? '完了' : '未完了'}</button>` : '<span class="not-assigned" aria-label="割り当てなし">—</span>'}</td>`;
    }).join('')}</tr>`).join('') || '<tr><td colspan="4">個人タスクはまだありません。</td></tr>'}</tbody></table></div><p class="panel-note">${icon('info')}個人タスクの完了・取り消しは、割り当てられた本人が操作します。</p></section>`;
}

function renderMembers() {
  return `${renderPageHeading('メンバー管理', 'このお店のメンバーと、役割を管理します。', false)}<section class="members-panel"><div class="progress-panel-heading"><h2>こもれび珈琲のメンバー <span class="count-badge">${data.members.length}</span></h2><button class="button primary" data-action="invite">${icon('plus')}メンバーを追加</button></div><div class="member-list">${data.members.map((member) => `<div class="member-management-row">${avatar(member)}<div class="member-name"><strong>${escapeHtml(member.name)}</strong><span>${member.id === user().id ? 'あなた · ' : ''}こもれび珈琲 本店</span></div><label class="role-select"><span class="sr-only">${escapeHtml(member.name)}の権限</span><select data-role-member="${escapeHtml(member.id)}" ${member.id === user().id ? 'disabled title="自分の権限は変更できません"' : ''}><option value="admin" ${member.role === 'admin' ? 'selected' : ''}>管理者（店長）</option><option value="member" ${member.role === 'member' ? 'selected' : ''}>通常メンバー</option></select></label></div>`).join('')}</div><div class="member-policy">${icon('shield')}<div><strong>お店ごとに、見える範囲を分けます。</strong><p>店長は店舗のすべてのタスクを、通常メンバーは店舗タスクと自分の個人タスクを確認できます。</p></div></div></section><div class="demo-notice">${icon('info')}このモックのメンバー追加は体験用です。本番ではGoogleログインと許可メンバーの登録を接続します。</div><button class="export-button standalone-export" data-action="export">${icon('download')}バックアップ用データを書き出す${icon('chevron')}</button>`;
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

function openTaskEditor(taskId) {
  const task = taskId ? data.tasks.find((entry) => entry.id === taskId) : null;
  if (taskId && (!task || !canEdit(task, user()))) return;
  const isAdmin = user().role === 'admin';
  const scope = task?.scope || (['mine', 'personal'].includes(scopeFilter) ? 'personal' : 'store');
  openModal(`${modalHeading(task ? 'タスクを編集' : '新しいタスク', 'やることを、チームにひとつ共有しましょう。')}
    <form id="task-form" data-edit-id="${escapeHtml(task?.id || '')}"><div class="modal-body">
      <fieldset class="scope-picker"><legend class="sr-only">タスクの種類</legend><label><input type="radio" name="scope" value="store" ${scope === 'store' ? 'checked' : ''} />${icon('store')}店舗タスク<span>お店のみんなで</span></label><label><input type="radio" name="scope" value="personal" ${scope === 'personal' ? 'checked' : ''} />${icon('user')}個人タスク<span>一人ひとりのやること</span></label></fieldset>
      <label class="field-label" for="task-title">タスク名 <span class="required-mark">必須</span></label><input id="task-title" class="form-input" name="title" placeholder="例：週末の備品を確認する" maxlength="100" required value="${escapeHtml(task?.title || '')}" autofocus />
      <label class="field-label" for="task-detail">詳細 <span class="optional-label">任意</span></label><textarea id="task-detail" class="form-input" name="detail" rows="3" maxlength="2000" placeholder="手順や、伝えておきたいこと">${escapeHtml(task?.detail || '')}</textarea>
      <label class="field-label" for="task-date">期限 <span class="optional-label">任意</span></label><input id="task-date" class="form-input date-input" type="date" name="dueDate" value="${escapeHtml(task?.dueDate ?? today())}" />
      <div id="personal-fields" ${scope !== 'personal' ? 'hidden' : ''}>${isAdmin ? `<p class="field-label">担当者${!task ? ' <span class="optional-label">複数選択で個別に割り当て</span>' : ''}</p><div class="member-checkboxes">${data.members.map((member) => `<label><input type="${task ? 'radio' : 'checkbox'}" name="assignees" value="${escapeHtml(member.id)}" ${(task?.assigneeId || user().id) === member.id ? 'checked' : ''} />${avatar(member, 'tiny')}<span>${escapeHtml(member.shortName)}</span></label>`).join('')}</div>` : `<p class="field-note">個人タスクは、自分のタスクとして追加されます。</p>`}</div>
      <div id="store-fields" ${scope !== 'store' ? 'hidden' : ''}>${isAdmin ? `<p class="field-label">完了に必要な確認</p><label class="form-radio"><input type="radio" name="confirmMode" value="anyone" ${!task?.confirmers.length ? 'checked' : ''} /><span><strong>誰か1人が完了すればOK</strong><small>所属するメンバーなら誰でも操作できます</small></span></label><label class="form-radio"><input type="radio" name="confirmMode" value="all" ${task?.confirmers.length ? 'checked' : ''} /><span><strong>指定した全員の確認が必要</strong><small>一人ひとりの確認状況を記録します</small></span></label><div id="confirmer-fields" class="member-checkboxes" ${!task?.confirmers.length ? 'hidden' : ''}>${data.members.map((member) => `<label><input type="checkbox" name="confirmers" value="${escapeHtml(member.id)}" ${task?.confirmers.includes(member.id) ? 'checked' : ''} />${avatar(member, 'tiny')}<span>${escapeHtml(member.shortName)}</span></label>`).join('')}</div>` : `<p class="field-note">${task?.confirmers.length ? 'このタスクは、店長が指定した全員の確認で完了します。' : '店舗タスクは、誰か1人が完了すると完了になります。'}</p>`}</div>
      ${task ? '<p class="field-note edit-note">担当者・種類・確認条件を変更すると、完了状況をリセットします。</p>' : ''}<p id="form-error" class="form-error" role="alert"></p>
    </div><div class="modal-footer"><button type="button" class="button secondary" data-action="close">キャンセル</button><button type="submit" class="button primary">${task ? '変更を保存' : 'タスクを追加'}</button></div></form>`);
}

function saveTask(form) {
  const fields = new FormData(form);
  const task = data.tasks.find((entry) => entry.id === form.dataset.editId);
  if (task && !canEdit(task, user())) return;
  const isAdmin = user().role === 'admin';
  const scope = fields.get('scope') === 'personal' ? 'personal' : 'store';
  const title = String(fields.get('title') || '').trim();
  const assignees = isAdmin ? fields.getAll('assignees').map(String).filter((id) => memberById(id)) : [user().id];
  const confirmers = scope === 'store' ? isAdmin ? fields.get('confirmMode') === 'all' ? fields.getAll('confirmers').map(String).filter((id) => memberById(id)) : [] : task?.scope === 'store' ? task.confirmers : [] : [];
  const error = !title ? 'タスク名を入力してください。' : scope === 'personal' && !assignees.length ? '担当者を1人以上選んでください。' : scope === 'store' && isAdmin && fields.get('confirmMode') === 'all' && !confirmers.length ? '確認者を1人以上選んでください。' : '';
  if (error) { document.querySelector('#form-error').textContent = error; return; }
  const base = { title, detail: String(fields.get('detail') || '').trim(), dueDate: String(fields.get('dueDate') || ''), scope, confirmers, storeId: user().storeId };
  if (task) {
    const assigneeId = scope === 'personal' ? assignees[0] : null;
    const conditionsChanged = task.scope !== scope || task.assigneeId !== assigneeId || [...task.confirmers].sort().join() !== [...confirmers].sort().join();
    data = { ...data, tasks: data.tasks.map((entry) => entry.id === task.id ? { ...entry, ...base, assigneeId, completions: conditionsChanged ? {} : entry.completions, groupId: conditionsChanged || entry.title !== title ? null : entry.groupId } : entry) };
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
  const confirmationMembers = task.scope === 'personal' ? groupTasks.map((entry) => ({ member: memberById(entry.assigneeId), timestamp: entry.completions[entry.assigneeId] })) : task.confirmers.length ? task.confirmers.map((id) => ({ member: memberById(id), timestamp: task.completions[id] })) : Object.entries(task.completions).map(([id, timestamp]) => ({ member: memberById(id), timestamp }));
  openModal(`${modalHeading('タスクの詳細')}<div class="modal-body detail-body"><span class="detail-scope ${task.scope}">${icon(task.scope === 'store' ? 'store' : 'user')}${task.scope === 'store' ? '店舗タスク' : '個人タスク'}</span><h3 class="detail-title">${escapeHtml(task.title)}</h3><div class="detail-properties"><span>${icon('calendar')}期限</span><strong>${task.dueDate ? task.dueDate.replaceAll('-', '/') : '設定なし'}</strong><span>${icon('user')}作成者</span><strong>${escapeHtml(memberById(task.createdBy)?.name || 'メンバー')}</strong><span>${icon('check')}完了条件</span><strong>${task.scope === 'personal' ? '担当者本人の完了' : task.confirmers.length ? `指定した${task.confirmers.length}人全員の確認` : '誰か1人の完了'}</strong></div><div class="detail-description">${task.detail ? escapeHtml(task.detail) : '<span class="muted">詳細はありません。</span>'}</div><section class="detail-confirmations"><h4>${task.scope === 'personal' ? groupTasks.length > 1 ? '担当者ごとの完了状況' : '担当者の完了状況' : 'メンバーの確認状況'}</h4>${confirmationMembers.length ? confirmationMembers.map(({ member, timestamp }) => `<div class="confirmation-person">${avatar(member, 'small')}<span>${escapeHtml(member?.name || '')}<small>${timestamp ? `${new Date(timestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 完了` : 'まだ完了していません'}</small></span><span class="status-badge ${timestamp ? 'done' : ''}">${timestamp ? `${icon('check')}完了` : '未完了'}</span></div>`).join('') : '<p class="field-note">まだ完了したメンバーはいません。</p>'}</section>${canComplete(task, user()) ? `<button class="button ${checked ? 'secondary' : 'primary'} full-width" data-action="complete" data-id="${escapeHtml(task.id)}" data-detail="true">${icon(checked ? 'reset' : 'check')}${checked ? '自分の完了を取り消す' : task.confirmers.length ? '自分の確認を完了する' : '完了にする'}</button>` : `<p class="field-note">${task.scope === 'personal' ? '完了・取り消しは担当者本人が操作できます。' : complete ? '完了した本人が取り消せます。' : '指定された確認者が操作できます。'}</p>`}</div>${canEdit(task, user()) ? `<div class="modal-footer detail-actions"><button class="text-button danger" data-action="delete" data-id="${escapeHtml(task.id)}">${icon('trash')}削除</button><button class="button secondary" data-action="edit" data-id="${escapeHtml(task.id)}">${icon('edit')}編集する</button></div>` : ''}`);
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

function exportData() {
  if (user().role !== 'admin') return;
  const exportValue = { application: 'みせノート', formatVersion: 1, demo: true, exportedAt: new Date().toISOString(), store: { id: STORE_ID, name: 'こもれび珈琲 本店' }, members: data.members.filter((member) => member.storeId === user().storeId), tasks: readableTasks() };
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
  else if (action === 'close') closeModal();
  else if (action === 'scope') { scopeFilter = value; render(); }
  else if (action === 'detail') openDetail(id);
  else if (action === 'edit') openTaskEditor(id);
  else if (action === 'delete') confirmDelete(id);
  else if (action === 'confirm-delete') {
    const task = data.tasks.find((entry) => entry.id === id);
    if (!task || !canEdit(task, user())) return;
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
  else if (target.id === 'status-filter') { statusFilter = target.value; render(); }
  else if (target.name === 'scope') {
    document.querySelector('#personal-fields').hidden = target.value !== 'personal';
    document.querySelector('#store-fields').hidden = target.value !== 'store';
  } else if (target.name === 'confirmMode') document.querySelector('#confirmer-fields').hidden = target.value !== 'all';
  else if (target.dataset.roleMember && user().role === 'admin' && target.dataset.roleMember !== user().id) {
    data = { ...data, members: data.members.map((member) => member.id === target.dataset.roleMember ? { ...member, role: target.value === 'admin' ? 'admin' : 'member' } : member) };
    persist(); render(); toast('メンバーの権限を更新しました');
  }
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'task-form') saveTask(event.target);
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

render();
if (storageUnavailable) toast('このブラウザでは保存できません。変更は画面を閉じるまで有効です。');
