/* 路由：landing ↔ app + 底部导航 + FAB + 云引擎启动 + 邀请链接 + 键盘快捷键 */
(function () {
  'use strict';
  const TABS = ['overview', 'expenses', 'chores', 'items', 'covenant'];
  const FAB_CONF = {
    overview: { label: '记一笔', fn: () => Views.expenses.addBill() },
    expenses: { label: '记一笔', fn: () => Views.expenses.addBill() },
    chores: { label: '加任务', fn: () => Views.chores.addChore() },
    items: { label: '登记物品', fn: () => Views.items.addItem() },
    covenant: { label: '发起公约', fn: () => Views.covenant.addCovenant() },
  };
  let currentTab = 'overview';
  let inApp = false;

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, query] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = {};
    (query || '').split('&').forEach((kv) => {
      const [k, v] = kv.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    if (parts[0] === 'app') return { app: true, tab: TABS.includes(parts[1]) ? parts[1] : 'overview', join: params.join || '' };
    return { app: false, tab: null, join: '' };
  }

  function updateBell() {
    const n = Store.allReminders().length;
    const dot = document.getElementById('bell-dot');
    if (dot) dot.classList.toggle('hidden', n === 0);
  }

  function renderHeader() {
    const st = Store;
    document.getElementById('app-home-name').textContent = '🏠 ' + st.state().home.name;
    document.getElementById('app-home-sub').textContent = st.state().home.address + ' · ' + st.activeMembers().length + ' 位室友';
    document.getElementById('avatar-stack').innerHTML = UI.avatarStack(st.activeMembers());
    updateBell();
  }

  function render() {
    const main = document.getElementById('app-main');
    const view = Views[currentTab];
    if (view) view.render(main);
    document.querySelectorAll('#app-nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === currentTab));
    const fab = document.getElementById('app-fab');
    const conf = FAB_CONF[currentTab];
    document.getElementById('fab-label').textContent = conf.label;
    fab.onclick = conf.fn;
    updateBell();
  }

  function go(tab) {
    if (!inApp || !TABS.includes(tab)) { location.hash = '#/app/' + (TABS.includes(tab) ? tab : 'overview'); return; }
    currentTab = tab;
    location.hash = '#/app/' + tab;
    render();
    document.getElementById('app-main').scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ---------- 邀请链接自动加入 ---------- */
  function offerJoin(code) {
    if (!code || code.length !== 6) return;
    if (sessionStorage.getItem('join-offered') === code) return;
    sessionStorage.setItem('join-offered', code);
    UI.openModal('🏠 加入共享之家',
      `<p style="font-size:14px;color:var(--ink2)">你收到了一个共享之家邀请，邀请码：<b style="font-size:18px;letter-spacing:2px">${UI.esc(code.toUpperCase())}</b></p>
       <p style="font-size:13px;color:var(--ink3);margin-top:8px">加入后，本机的账本 · 值日 · 库存 · 公约将与云端家庭实时同步。</p>`,
      `<button class="btn btn-soft" data-close>稍后再说</button><button class="btn btn-primary" id="join-ok">立即加入</button>`
    ).submit('#join-ok', async () => { await Cloud.joinHome(code.toUpperCase()); });
  }

  function route() {
    const { app, tab, join } = parseHash();
    const landing = document.getElementById('view-landing');
    const appEl = document.getElementById('view-app');
    inApp = app;
    landing.classList.toggle('hidden', app);
    appEl.classList.toggle('hidden', !app);
    if (app) {
      currentTab = tab;
      renderHeader();
      render();
      window.scrollTo(0, 0);
      if (window.Cloud) Cloud.start();
      if (join) offerJoin(join);
      if (!sessionStorage.getItem('hezu-tip')) {
        sessionStorage.setItem('hezu-tip', '1');
        setTimeout(() => UI.toast('已加载演示数据，点击右下角按钮开始体验', '👋'), 400);
      }
    } else if (window.Cloud) {
      Cloud.stop();
    }
  }

  /* ---------- 键盘快捷键（桌面端友好） ---------- */
  function onKey(e) {
    if (!inApp) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'Escape') {
      const root = document.getElementById('modal-root');
      if (root && root.innerHTML) { root.innerHTML = ''; return; }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '?') { Views.guide(); return; }
    if (['1', '2', '3', '4', '5'].includes(e.key)) { go(TABS[Number(e.key) - 1]); return; }
    if (e.key === 'n' || e.key === 'N') { FAB_CONF[currentTab].fn(); return; }
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('keydown', onKey);
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#app-nav button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
    document.getElementById('btn-members').addEventListener('click', () => Views.membersDrawer());
    document.getElementById('btn-reminders').addEventListener('click', () => Views.reminders());
    document.getElementById('btn-help').addEventListener('click', () => Views.guide());
    route();
  });

  window.Router = { go, render, renderHeader, current: () => currentTab };
})();
