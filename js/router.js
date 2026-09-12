/* 路由：landing ↔ app（总览/账单/值日/物品/公约）+ 底部导航 + FAB */
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
    const h = location.hash.replace(/^#\/?/, ''); // 去掉 # 与首个 /
    const parts = h.split('/').filter(Boolean);
    if (parts[0] === 'app') return { app: true, tab: TABS.includes(parts[1]) ? parts[1] : 'overview' };
    return { app: false, tab: null };
  }

  function renderHeader() {
    const st = Store;
    document.getElementById('app-home-name').textContent = '🏠 ' + st.state().home.name;
    document.getElementById('app-home-sub').textContent = st.state().home.address + ' · ' + st.activeMembers().length + ' 位室友';
    document.getElementById('avatar-stack').innerHTML = UI.avatarStack(st.activeMembers());
  }

  function render() {
    const main = document.getElementById('app-main');
    const view = Views[currentTab];
    if (view) view.render(main);
    // 底部导航高亮
    document.querySelectorAll('#app-nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === currentTab));
    // FAB
    const fab = document.getElementById('app-fab');
    const conf = FAB_CONF[currentTab];
    document.getElementById('fab-label').textContent = conf.label;
    fab.onclick = conf.fn;
  }

  function go(tab) {
    if (!inApp || !TABS.includes(tab)) { location.hash = '#/app/' + (TABS.includes(tab) ? tab : 'overview'); return; }
    currentTab = tab;
    location.hash = '#/app/' + tab;
    render();
    document.getElementById('app-main').scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function route() {
    const { app, tab } = parseHash();
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
      // 首次进入 Demo 提示
      if (!sessionStorage.getItem('hezu-tip')) {
        sessionStorage.setItem('hezu-tip', '1');
        setTimeout(() => UI.toast('已加载演示数据，点击右下角按钮开始体验', '👋'), 400);
      }
    }
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#app-nav button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
    document.getElementById('btn-members').addEventListener('click', () => Views.membersDrawer());
    route();
  });

  window.Router = { go, render, renderHeader, current: () => currentTab };
})();
