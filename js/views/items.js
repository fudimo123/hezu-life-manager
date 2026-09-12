/* 物品视图：公共物品登记 / 库存状态 / 消耗与补货 / 低库存预警 */
(function () {
  'use strict';
  const S = () => Store;
  let filter = 'all';

  function render(el) {
    const st = S();
    const items = st.state().items.filter((it) => filter === 'all' || st.itemStatus(it) === filter);
    const counts = { ok: 0, low: 0, out: 0 };
    st.state().items.forEach((it) => { counts[st.itemStatus(it)]++; });

    el.innerHTML = `
    <div class="view-anim items-view ${st.lowItems().length ? '' : 'no-rem'}">
      <div class="inv-sum">
        <div class="inv-sum-item"><div class="n" style="color:var(--green)">${counts.ok}</div><div class="k">库存充足</div></div>
        <div class="inv-sum-item"><div class="n" style="color:var(--amber)">${counts.low}</div><div class="k">库存偏低</div></div>
        <div class="inv-sum-item"><div class="n" style="color:var(--red)">${counts.out}</div><div class="k">已用完</div></div>
      </div>

      ${st.lowItems().length ? `
      <div class="sec sec-rem">
        <div class="section-title">🚨 补货提醒 <span class="more">${st.lowItems().length} 项待处理</span></div>
        ${st.lowItems().map((it) => `
          <div class="list-item" style="border:1px solid ${it.qty <= 0 ? '#FFD3D3' : '#FFE3B3'}">
            <span class="li-ic" style="background:var(--amber-soft)">${it.icon}</span>
            <div class="li-main">
              <div class="li-title">${UI.esc(it.name)}</div>
              <div class="li-sub">${it.qty <= 0 ? '已用完，需要补货' : `仅剩 ${it.qty}${it.unit}，低于预警线`}</div>
            </div>
            <button class="btn btn-sm" style="background:var(--red-soft);color:var(--red)" data-restock="${it.id}">去补货</button>
          </div>`).join('')}
      </div>` : ''}

      <div class="sec sec-grid">
        <div class="section-title">📦 公共物品 <span class="more">${st.state().items.length} 件</span></div>
        <div class="chip-row">
          <button class="chip ${filter === 'all' ? 'on' : ''}" data-f="all">全部</button>
          <button class="chip ${filter === 'ok' ? 'on' : ''}" data-f="ok">✅ 充足</button>
          <button class="chip ${filter === 'low' ? 'on' : ''}" data-f="low">⚠️ 偏低</button>
          <button class="chip ${filter === 'out' ? 'on' : ''}" data-f="out">🚫 已用完</button>
        </div>
        <div class="inv-grid">
          ${items.map(itemCard).join('')}
        </div>
        <button class="btn btn-outline btn-block" id="btn-add-item" style="margin-top:12px">＋ 登记公共物品</button>
      </div>

      <div class="sec sec-logs">
        <div class="section-title">🕒 最近动态</div>
        <div class="card card-pad">${recentLogs()}</div>
      </div>
    </div>`;

    el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(el); }));
    el.querySelectorAll('[data-detail]').forEach((b) => b.addEventListener('click', () => itemDetail(b.dataset.detail)));
    el.querySelectorAll('[data-restock]').forEach((b) => b.addEventListener('click', () => restockModal(b.dataset.restock)));
    const addBtn = el.querySelector('#btn-add-item');
    if (addBtn) addBtn.addEventListener('click', () => addItem());
  }

  function itemCard(it) {
    const st = S();
    const status = st.itemStatus(it);
    const pct = it.max ? Math.min(100, Math.round((it.qty / it.max) * 100)) : 100;
    const barColor = status === 'out' ? 'var(--red)' : status === 'low' ? 'var(--amber)' : 'var(--green)';
    const owner = st.member(it.ownerId);
    return `
    <div class="inv-card ${status === 'out' ? 'out' : status === 'low' ? 'low' : ''}" data-detail="${it.id}" style="cursor:pointer">
      <div class="ic">${it.icon}</div>
      <div class="nm">${UI.esc(it.name)}</div>
      <div class="qt">剩余 <b>${it.qty}${it.unit}</b> · ${owner ? owner.emoji + ' ' + UI.esc(owner.name) : '—'}</div>
      <div class="inv-bar"><i style="width:${pct}%;background:${barColor}"></i></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="badge ${status === 'ok' ? 'badge-green' : status === 'low' ? 'badge-amber' : 'badge-red'}">${status === 'ok' ? '充足' : status === 'low' ? '偏低' : '已用完'}</span>
        <span style="font-size:11px;color:var(--ink3)">${UI.esc(it.location || '')}</span>
      </div>
    </div>`;
  }

  function recentLogs() {
    const st = S();
    const logs = [];
    st.state().items.forEach((it) => {
      it.consumes.forEach((c) => logs.push({ date: c.date, text: `${st.memberName(c.byId)} 消耗 ${it.icon}${UI.esc(it.name)} ×${c.qty}${it.unit}`, icon: '📉' }));
      it.restocks.forEach((r) => logs.push({ date: r.date, text: `${st.memberName(r.byId)} 补货 ${it.icon}${UI.esc(it.name)} +${r.qty}${it.unit}`, icon: '📥' }));
    });
    logs.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!logs.length) return `<div class="empty" style="padding:12px">暂无记录，登记物品后开始记录消耗</div>`;
    return logs.slice(0, 8).map((l) => `
      <div class="vio-row"><span>${l.icon}</span><span style="flex:1">${l.text}</span><span class="when">${l.date}</span></div>`).join('');
  }

  /* ---------- 消耗 / 补货 ---------- */
  function itemDetail(id) {
    const st = S();
    const it = st.state().items.find((x) => x.id === id);
    if (!it) return;
    const status = st.itemStatus(it);
    const modal = UI.openModal(
      `${it.icon} ${UI.esc(it.name)}`,
      `<div style="display:flex;gap:8px;margin-bottom:14px">
        <span class="badge ${status === 'ok' ? 'badge-green' : status === 'low' ? 'badge-amber' : 'badge-red'}">${status === 'ok' ? '库存充足' : status === 'low' ? '库存偏低' : '已用完'}</span>
        <span class="badge badge-gray">剩余 ${it.qty}${it.unit}</span>
        <span class="badge badge-gray">预警线 ${it.low}${it.unit}</span>
      </div>
      <div style="font-size:13px;color:var(--ink2);margin-bottom:14px">📍 ${UI.esc(it.location || '未设置')} · 持有人 ${st.memberName(it.ownerId)} · ${st.ITEM_CATS[it.cat]?.name || '其他'}</div>
      ${UI.fGroup('消耗数量（-）', `<div style="display:flex;gap:8px"><input class="f-input" id="it-cq" type="number" value="1" style="flex:1"><button class="btn btn-soft" id="it-consume">确认消耗</button></div>`)}
      ${UI.fGroup('补货数量（+）', `<div style="display:flex;gap:8px"><input class="f-input" id="it-rq" type="number" value="${Math.max(1, it.low + 1)}" style="flex:1"><button class="btn btn-green" id="it-restock">确认补货</button></div>`, '💡 补货后记得去「账单」记一笔采购费用，可 AA 分摊。')}
      <div class="section-title" style="margin-top:18px">📜 记录</div>
      <div style="max-height:180px;overflow-y:auto">
        ${(() => {
          const logs = [];
          it.consumes.forEach((c) => logs.push({ date: c.date, text: `${st.memberName(c.byId)} 消耗 ×${c.qty}${it.unit}`, icon: '📉' }));
          it.restocks.forEach((r) => logs.push({ date: r.date, text: `${st.memberName(r.byId)} 补货 +${r.qty}${it.unit}`, icon: '📥' }));
          logs.sort((a, b) => (a.date < b.date ? 1 : -1));
          return logs.length ? logs.map((l) => `<div class="vio-row"><span>${l.icon}</span><span style="flex:1;font-size:12.5px">${l.text}</span><span class="when">${l.date}</span></div>`).join('') : '<div style="color:var(--ink3);font-size:13px;padding:8px 0">暂无记录</div>';
        })()}
      </div>`,
      `<button class="btn btn-soft" data-close>关闭</button><button class="btn" style="background:var(--red-soft);color:var(--red)" id="it-del">删除物品</button>`
    );
    modal.submit('#it-consume', (root) => {
      const q = UI.num('it-cq');
      if (q <= 0) { UI.toast('请输入消耗数量', '⚠️'); return false; }
      st.consumeItem(id, q, '', st.currentUser().id);
      UI.toast(`${it.name} 消耗 ${q}${it.unit}${st.itemStatus(it) !== 'ok' ? '，已触发补货提醒' : ''}`, st.itemStatus(it) !== 'ok' ? '⚠️' : '📉');
      return true;
    });
    modal.submit('#it-restock', (root) => {
      const q = UI.num('it-rq');
      if (q <= 0) { UI.toast('请输入补货数量', '⚠️'); return false; }
      st.restockItem(id, q, st.currentUser().id);
      UI.toast(`${it.name} 补货 +${q}${it.unit}，费用可记入账单 AA`, '📥');
      return true;
    });
    modal.submit('#it-del', (root) => {
      const i = st.state().items.findIndex((x) => x.id === id);
      if (i >= 0) st.state().items.splice(i, 1);
      st.save(); UI.toast('物品已删除', '🗑️');
    });
  }

  function restockModal(id) {
    const st = S();
    const it = st.state().items.find((x) => x.id === id);
    if (!it) return;
    const modal = UI.openModal(
      `📥 补货 · ${UI.esc(it.name)}`,
      UI.fGroup('补货数量', UI.fInput('r-qty', Math.max(1, it.low + 1), '', 'number')) +
      UI.fGroup('费用（元）', UI.fInput('r-cost', '', '选填，填入后可直接记入账单', 'number'), '💡 补货费用自动生成一笔「公共采购」账单，可 AA 分摊。'),
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="r-save">确认补货</button>`
    );
    modal.submit('#r-save', (root) => {
      const q = UI.num('r-qty');
      if (q <= 0) { UI.toast('请输入补货数量', '⚠️'); return false; }
      const cost = UI.num('r-cost');
      st.restockItem(id, q, st.currentUser().id);
      if (cost > 0) {
        const actives = st.activeMembers();
        const shares = {};
        actives.forEach((m) => { shares[m.id] = 0; });
        Object.assign(shares, st.computeShares({ amount: cost, date: st.todayStr(), split: { mode: 'equal' } }));
        st.state().bills.push({
          id: st.uid(), type: 'shop', title: `补货 · ${it.name} ×${q}${it.unit}`, amount: cost,
          payerId: st.currentUser().id, date: st.todayStr(), note: '库存补货自动记账',
          split: { mode: 'equal', periodDays: 30, shares },
        });
      }
      st.save();
      UI.toast(cost > 0 ? `补货完成，费用 ${st.fmtMoney(cost)} 已记入账单` : '补货完成', '📥');
      Router.render();
    });
  }

  /* ---------- 登记物品 ---------- */
  function addItem() {
    const st = S();
    const actives = st.activeMembers();
    const body = `
      ${UI.fGroup('物品名称', UI.fInput('n-name', '', '如：抽纸、垃圾袋'))}
      ${UI.fGroup('图标', UI.fEmojiPick('n-ic', ['🧻', '🧴', '🛍️', '🧺', '🍚', '🛢️', '💧', '🧂', '🧊', '🐱', '🪥', '🧯'], '🧻'))}
      ${UI.fGroup('分类', UI.fSelect('n-cat', Object.keys(st.ITEM_CATS).map((k) => ({ value: k, label: `${st.ITEM_CATS[k].icon} ${st.ITEM_CATS[k].name}` }))))}
      <div style="display:flex;gap:10px">
        <div style="flex:1">${UI.fGroup('数量', UI.fInput('n-qty', '1', '', 'number'))}</div>
        <div style="flex:1">${UI.fGroup('单位', UI.fInput('n-unit', '件', '包/瓶/卷'))}</div>
      </div>
      ${UI.fGroup('补货预警线（低于该数量提醒）', UI.fInput('n-low', '1', '', 'number'))}
      ${UI.fGroup('存放位置', UI.fInput('n-loc', '', '如：厨房抽屉'))}
      ${UI.fGroup('持有人', UI.fMemberPick('n-owner', actives, st.currentUser().id))}
    `;
    const modal = UI.openModal('📦 登记公共物品', body,
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="n-save">保存物品</button>`);
    let icon = '🧻';
    UI.bindEmojiPick('n-ic', (e) => { icon = e; });
    UI.bindMemberPick('n-owner', () => {});
    modal.submit('#n-save', (root) => {
      const name = UI.val('n-name');
      if (!name) { UI.toast('请输入物品名称', '⚠️'); return false; }
      const qty = UI.num('n-qty');
      const low = UI.num('n-low');
      const ownerId = root.querySelector('.member-pick .on')?.dataset.v || st.currentUser().id;
      st.state().items.push({
        id: st.uid(), name, icon, cat: UI.val('n-cat') || 'other', qty, unit: UI.val('n-unit') || '件',
        low, max: Math.max(qty, low * 3, 3), ownerId, location: UI.val('n-loc'), restocks: [], consumes: [],
      });
      st.save(); UI.toast(`${name} 已登记`);
      Router.render();
    });
  }

  window.Views = window.Views || {};
  window.Views.items = { render, addItem };
})();
