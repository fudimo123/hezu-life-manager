/* 公约广场 · 社区属性 P2
   官方模板（含采用数）+ 我的上传；一键采用 → 预填发起；分享我的公约 */
(function () {
  'use strict';
  const S = () => Store;

  const OFFICIAL = [
    { key: 'sleep', icon: '🌙', title: '23:00 后保持安静', cat: 'sleep', adopt: 1248, content: '23:00 后公共区域与房间内不进行外放、大声通话；需要加班或游戏请佩戴耳机；特殊情况提前在群里说明。' },
    { key: 'clean', icon: '🧹', title: '公共区域值日打卡制', cat: 'clean', adopt: 986, content: '按系统排班执行公共区域值日，完成后当日打卡；连续 3 次未打卡者请全屋奶茶；请假需提前与下一位值日人换班。' },
    { key: 'fee', icon: '💰', title: '水电均摊、燃气按天计费', cat: 'fee', adopt: 863, content: '水电宽带 AA 均摊；燃气费按入住天数折算；公共采购凭小票记账，月底统一结算；大额支出（>200 元）需先群内确认。' },
    { key: 'pet', icon: '🐾', title: '养宠物需全体同意', cat: 'pet', adopt: 615, content: '新宠物入住前须发起公约投票，全体室友同意后方可入住；宠物不得进入他人房间；公共区域毛发由宠物主人负责清理。' },
    { key: 'guest', icon: '🚪', title: '访客与过夜管理', cat: 'other', adopt: 542, content: '带访客回家需提前在群里告知；访客连续过夜不超过 3 晚；访客造成公共区域问题由邀请人负责。' },
    { key: 'cook', icon: '🍳', title: '厨房用后即清', cat: 'clean', adopt: 477, content: '使用厨房后 1 小时内清洗锅碗、擦净台面；冰箱内个人食物贴名签，过期 7 天可由室友处理。' },
    { key: 'split2', icon: '🧾', title: '公共采购凭票 AA', cat: 'fee', adopt: 431, content: '公共物品采购保留小票并拍照记账；月度统一结算；个人用品请勿使用公共资金购买。' },
  ];

  function open() {
    const st = S();
    const adopted = st.state().plaza.adopted || {};
    const uploads = st.state().plaza.uploads || [];
    const all = OFFICIAL.map((t) => ({ ...t, mine: false, adopt: t.adopt + (adopted[t.key] || 0) }))
      .concat(uploads.map((u) => ({ ...u, mine: true })));

    const body = `
      <div class="plaza-head">
        <div class="plaza-title">🏛️ 公约广场</div>
        <div class="plaza-sub">来自社区的高频公约 · 一键采用到你家的公约库 · 也可以分享你家的好公约</div>
      </div>
      <div class="chip-row">
        <button class="chip on" data-plaza-f="all">全部</button>
        ${['fee', 'clean', 'sleep', 'pet', 'other'].map((c) => `<button class="chip" data-plaza-f="${c}">${st.COV_CATS[c].icon} ${st.COV_CATS[c].name}</button>`).join('')}
      </div>
      <div id="plaza-list">${renderList(st, all, 'all')}</div>`;

    const modal = UI.openModal('', body, `<button class="btn btn-soft" data-close>关闭</button><button class="btn btn-purple" id="p-upload">📤 分享我家的公约</button>`);
    let filter = 'all';
    modal.root.querySelectorAll('[data-plaza-f]').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.plazaF;
      modal.root.querySelectorAll('[data-plaza-f]').forEach((x) => x.classList.toggle('on', x === b));
      modal.root.querySelector('#plaza-list').innerHTML = renderList(st, all, filter);
    }));
    modal.root.querySelector('#p-upload').addEventListener('click', () => shareMine(modal));
  }

  function renderList(st, all, filter) {
    const list = all.filter((t) => filter === 'all' || t.cat === filter);
    return list.map((t) => `
      <div class="plaza-card">
        <div class="plaza-card-head">
          <span class="plaza-ic">${t.icon}</span>
          <div class="plaza-info">
            <div class="plaza-name">${UI.esc(t.title)} ${t.mine ? '<span class="badge badge-blue" style="margin-left:4px">我家的</span>' : ''}</div>
            <div class="plaza-meta">${st.COV_CATS[t.cat]?.icon || '📌'} ${st.COV_CATS[t.cat]?.name || '其他'} · 🏠 ${t.adopt} 个家庭采用</div>
          </div>
        </div>
        <div class="plaza-body">${UI.esc(t.content)}</div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn btn-purple btn-sm" data-plaza-adopt="${UI.esc(t.title)}|${UI.esc(t.content)}|${t.cat}">✓ 一键采用</button>
          ${t.mine ? `<button class="btn btn-soft btn-sm" data-plaza-del="${UI.esc(t.title)}">删除</button>` : ''}
        </div>
      </div>`).join('');
  }

  function shareMine(modal) {
    const st = S();
    const mine = st.state().covenants.filter((c) => c.status === 'active');
    if (!mine.length) { UI.toast('还没有已生效的公约可分享', '⚠️'); return; }
    const body = mine.map((c) => `
      <div class="plaza-card">
        <div class="plaza-card-head"><span class="plaza-ic">${c.icon}</span><div class="plaza-info"><div class="plaza-name">${UI.esc(c.title)}</div><div class="plaza-meta">已生效 · 我家的公约</div></div></div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-purple btn-sm" data-share="${c.id}">📤 分享到广场</button>
        </div>
      </div>`).join('');
    const m2 = UI.openModal('📤 分享我家的公约', body || '<div class="empty">暂无已生效公约</div>', '');
    m2.root.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', () => {
      const c = st.state().covenants.find((x) => x.id === b.dataset.share);
      if (!c) return;
      const uploads = st.state().plaza.uploads || [];
      if (!uploads.some((u) => u.title === c.title)) {
        uploads.push({ key: 'up' + st.uid(), icon: c.icon || '📜', title: c.title, cat: c.cat, adopt: 0, content: c.content });
        st.save();
        UI.toast('已分享到公约广场 🎉');
        m2.close();
        modal.close();
        open();
      } else {
        UI.toast('这条公约已经分享过了', '⚠️');
      }
    }));
  }

  // 事件委托：采用 / 删除
  document.addEventListener('click', (e) => {
    const ad = e.target.closest('[data-plaza-adopt]');
    if (ad) {
      const [title, content, cat] = ad.dataset.plazaAdopt.split('|');
      const st = S();
      const official = OFFICIAL.find((t) => t.title === title);
      if (official) {
        const adopted = st.state().plaza.adopted || {};
        adopted[official.key] = (adopted[official.key] || 0) + 1;
        st.state().plaza.adopted = adopted;
        st.save();
        UI.toast('采用成功，采用数 +1 🎉');
      }
      const root = document.getElementById('modal-root');
      if (root) root.innerHTML = '';
      Views.covenant.addCovenant({ title: title || '新公约', content: content || '', cat: cat || 'other' });
    }
    const del = e.target.closest('[data-plaza-del]');
    if (del) {
      const st = S();
      st.state().plaza.uploads = (st.state().plaza.uploads || []).filter((u) => u.title !== del.dataset.plazaDel);
      st.save();
      UI.toast('已从广场移除', '🗑️');
      open();
    }
  });

  window.Views = window.Views || {};
  window.Views.plaza = open;
})();
