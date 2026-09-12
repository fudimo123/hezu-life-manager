/* 提醒中心：值日/库存/结算/投票/违约 五类提醒聚合 */
(function () {
  'use strict';
  const S = () => Store;
  const TYPE_META = {
    chore: { name: '🧹 值日待办', color: '#E9F1FF', line: '#2E86AB' },
    stock: { name: '📦 库存预警', color: '#FFF6E5', line: '#F5A623' },
    settle: { name: '💸 待结算', color: '#E6F7F2', line: '#0EA47A' },
    vote: { name: '🗳️ 公约投票', color: '#F2EFFF', line: '#7C5CF0' },
    violation: { name: '🚫 违约记录', color: '#FDECEC', line: '#EF4444' },
  };

  function open() {
    const st = S();
    const list = st.allReminders();
    const groups = {};
    list.forEach((r) => { (groups[r.type] = groups[r.type] || []).push(r); });

    const body = list.length ? `
      <div style="font-size:12.5px;color:var(--ink3);margin-bottom:14px">共 ${list.length} 条待办，点击条目直接跳转处理。提醒由系统自动聚合，替你开口、不伤感情。</div>
      ${Object.keys(groups).map((type) => `
        <div class="section-title" style="margin:16px 0 8px;font-size:14px">${TYPE_META[type].name} <span class="more">${groups[type].length}</span></div>
        ${groups[type].map((r) => `
          <div class="list-item" data-go="${r.action}" data-key="${r.transferKey || ''}" style="cursor:pointer;border-left:3px solid ${TYPE_META[type].line}">
            <span class="li-ic" style="background:${TYPE_META[type].color}">${r.icon}</span>
            <div class="li-main">
              <div class="li-title">${UI.esc(r.title)}</div>
              <div class="li-sub">${UI.esc(r.sub)}</div>
            </div>
            <span style="color:var(--ink3)">›</span>
          </div>`).join('')}
      `).join('')}`
      : `<div class="empty"><span class="empty-ic">🎉</span>一切井井有条，暂无待办提醒</div>`;

    const modal = UI.openModal('🔔 提醒中心', body, '');
    modal.root.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => {
      modal.close();
      Router.go(el.dataset.go);
    }));
  }

  window.Views = window.Views || {};
  window.Views.reminders = open;
})();
