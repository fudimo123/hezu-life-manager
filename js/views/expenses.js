/* 账单视图：记账（三种分摊）/ 月度切换 / 对账确认 / 结算中心+催收话术 / 押金清算 / 统计 */
(function () {
  'use strict';
  const S = () => Store;
  let filter = 'all';
  let curMonth = Store.monthKey(Store.todayStr());

  function shiftMonth(delta) {
    const [y, m] = curMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    curMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  const curMonthKey = () => Store.monthKey(Store.todayStr());

  function render(el) {
    const st = S();
    const mk = curMonth;
    const isCur = mk === curMonthKey();
    const me = st.currentUser();
    const flow = st.memberFlow(me.id, mk);
    const total = st.monthTotal(mk);
    const bills = st.monthBills(mk).filter((b) => filter === 'all' || b.type === filter);
    const stls = st.settlements(mk);

    el.innerHTML = `
    <div class="view-anim">
      <div class="month-switch">
        <button data-m="-1">‹</button>
        <div class="ms-label">${mk}<span>${isCur ? '本月' : '历史月'}</span></div>
        <button data-m="1" ${isCur ? 'disabled style="opacity:.3"' : ''}>›</button>
      </div>

      <div class="exp-sum">
        <div class="exp-sum-card"><div class="k">本月支出</div><div class="v">${st.fmtMoney(total)}</div></div>
        <div class="exp-sum-card"><div class="k">我的待付</div><div class="v ${flow.net < 0 ? 'red' : ''}">${flow.net < 0 ? st.fmtMoney(-flow.net) : '¥0.00'}</div></div>
        <div class="exp-sum-card"><div class="k">我的待收</div><div class="v ${flow.net > 0 ? 'green' : ''}">${flow.net > 0 ? st.fmtMoney(flow.net) : '¥0.00'}</div></div>
      </div>

      ${isCur ? `
      <div class="sec">
        <div class="section-title">🤝 结算中心 <span class="more">${stls.filter((t) => !t.done).length} 笔未结清</span></div>
        <div class="settle-card">
          ${stls.length ? stls.map((t) => `
            <div class="settle-line">
              <span class="who">${st.memberName(t.from)}</span>
              <span style="color:var(--ink3)">转给</span>
              <span class="who">${st.memberName(t.to)}</span>
              <span class="amt">${st.fmtMoney(t.amount)}</span>
              <button class="done-btn ${t.done ? 'is-done' : ''}" data-set="${t.key}">${t.done ? '已结清 ✓' : '标记已还'}</button>
            </div>
            <div class="settle-tools" data-copy="${t.key}">
              <button class="copy-btn">✉️ 复制催收话术</button>
            </div>`).join('')
          : `<div class="empty" style="padding:18px"><span class="empty-ic" style="font-size:28px">🎉</span>本月无待结算账单</div>`}
          <div class="f-hint" style="margin-top:8px">💡 系统计算每人「垫付 − 应摊」净额，生成最少笔数转账方案；催收话术以系统口吻发出，不尴尬。</div>
        </div>
      </div>` : ''}

      <div class="sec">
        <div class="section-title">🧾 账单明细 <span class="more">${bills.length} 笔</span></div>
        <div class="chip-row">
          <button class="chip ${filter === 'all' ? 'on' : ''}" data-f="all">全部</button>
          ${Object.keys(st.BILL_TYPES).map((k) => `<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${st.BILL_TYPES[k].icon} ${st.BILL_TYPES[k].name}</button>`).join('')}
        </div>
        ${bills.length ? bills.map(billRow).join('')
          : `<div class="card card-pad empty"><span class="empty-ic">🧾</span>该分类下暂无账单</div>`}
      </div>

      <div class="sec">
        <div class="section-title">📊 本月分类占比</div>
        <div class="card card-pad">${categoryBreakdown(mk)}</div>
      </div>

      <div class="sec">
        <div class="section-title">📈 近 6 个月趋势</div>
        <div class="card card-pad"><div class="bar-chart">${bars()}</div></div>
      </div>

      ${depositCard()}
    </div>`;

    el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { shiftMonth(parseInt(b.dataset.m, 10)); render(el); }));
    el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(el); }));
    el.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
      const t = st.settlements(mk).find((x) => x.key === b.dataset.set);
      st.markSettled(b.dataset.set, !t.done);
      UI.toast(t.done ? '已标记结清' : '已恢复待结清');
      render(el);
    }));
    el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
      const t = st.settlements(mk).find((x) => x.key === b.dataset.copy);
      if (t) UI.copyText(`【合租账单 · ${st.state().home.name}】${st.memberName(t.from)} 你好～本月账单已结算，你需转给 ${st.memberName(t.to)} ${st.fmtMoney(t.amount)}，方便时转一下就好，谢谢～ 🙏`);
    }));
    el.querySelectorAll('[data-detail]').forEach((b) => b.addEventListener('click', () => billDetail(b.dataset.detail)));
    const dep = el.querySelector('#deposit-card');
    if (dep) {
      dep.querySelectorAll('[data-add-ded]').forEach((b) => b.addEventListener('click', addDeductionModal));
      dep.querySelectorAll('[data-ded-del]').forEach((b) => b.addEventListener('click', () => {
        const i = st.state().deposit.deductions.findIndex((x) => x.id === b.dataset.dedDel);
        if (i >= 0) st.state().deposit.deductions.splice(i, 1);
        st.save(); UI.toast('扣款记录已删除'); render(el);
      }));
    }
  }

  function billRow(b) {
    const st = S();
    const t = st.BILL_TYPES[b.type] || st.BILL_TYPES.other;
    const myShare = b.split.shares[st.currentUser().id] || 0;
    const cf = st.billConfirm(b);
    return `
    <div class="bill-row" data-detail="${b.id}" style="cursor:pointer">
      <span class="bill-type-ic" style="background:${t.color}">${t.icon}</span>
      <div class="li-main">
        <div class="li-title">${UI.esc(b.title)}</div>
        <div class="li-sub">${b.date} · ${st.memberName(b.payerId)} 垫付 <span class="split-tag">${st.SPLIT_NAMES[b.split.mode]}</span>
          ${cf.total ? `<span class="confirm-tag ${cf.confirmed ? 'ok' : ''}">${cf.confirmed ? '✓ 已对账' : `对账 ${cf.done}/${cf.total}`}</span>` : ''}
        </div>
      </div>
      <div class="li-right">
        <div class="li-amount">${st.fmtMoney(b.amount)}</div>
        <div class="li-tag">我摊 ${st.fmtMoney(myShare)}</div>
      </div>
    </div>`;
  }

  function categoryBreakdown(mk) {
    const st = S();
    const total = st.monthTotal(mk) || 1;
    const sums = {};
    st.monthBills(mk).forEach((b) => { sums[b.type] = (sums[b.type] || 0) + b.amount; });
    const rows = Object.keys(sums).sort((a, b) => sums[b] - sums[a]);
    if (!rows.length) return `<div class="empty" style="padding:14px">本月暂无账单</div>`;
    const colors = ['#FF6A3D', '#0EA47A', '#3B82F6', '#7C5CF0', '#F5A623', '#22B8CF', '#98A0AE'];
    return rows.map((k, i) => {
      const t = st.BILL_TYPES[k] || st.BILL_TYPES.other;
      const pct = Math.round((sums[k] / total) * 100);
      return `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;font-size:13px">
        <span style="width:18px;text-align:center">${t.icon}</span>
        <span style="flex:1;font-weight:600">${t.name}</span>
        <span style="width:74px;text-align:right;color:var(--ink2)">${st.fmtMoney(sums[k])}</span>
        <span style="width:38px;text-align:right;font-weight:800">${pct}%</span>
        <span style="width:90px;height:8px;background:#F0F2F5;border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:${colors[i % colors.length]};border-radius:4px"></i></span>
      </div>`;
    }).join('');
  }

  function bars() {
    const st = S();
    let max = 0;
    const cols = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k);
      const mks = st.fmtDate(d).slice(0, 7);
      const v = st.monthTotal(mks);
      max = Math.max(max, v);
      cols.push({ mks, v });
    }
    return cols.map((c) => `
      <div class="bar-col">
        <div class="bar${c.v === 0 ? ' dim' : ''}" style="height:${max ? Math.max(3, (c.v / max) * 88) : 3}px" title="${c.mks} ${st.fmtMoney(c.v)}"></div>
        <label>${c.mks.slice(2)}月</label>
      </div>`).join('');
  }

  /* ---------- 押金清算 ---------- */
  function depositCard() {
    const st = S();
    const dep = st.state().deposit;
    const remain = st.depositRemain();
    return `
    <div class="sec">
      <div class="section-title">🏦 押金清算 <span class="more">${UI.esc(dep.landlord)}</span></div>
      <div class="deposit-card" id="deposit-card">
        <div class="dep-head">
          <div><div class="dep-k">押金总额</div><div class="dep-v">${st.fmtMoney(dep.amount)}</div></div>
          <div><div class="dep-k">人均份额</div><div class="dep-v">${st.fmtMoney(st.depositShare())}</div></div>
          <div><div class="dep-k">剩余可退</div><div class="dep-v" style="color:var(--green)">${st.fmtMoney(remain)}</div></div>
        </div>
        <div class="dep-note">📝 ${UI.esc(dep.note)}</div>
        <div style="font-size:13px;font-weight:700;margin:12px 0 6px">扣款记录（${dep.deductions.length}）</div>
        ${dep.deductions.map((d) => `
          <div class="vio-row">
            <span>💸</span><span style="flex:1">${UI.esc(d.title)}</span>
            <span class="amt" style="color:var(--red);font-weight:700;margin-right:8px">- ${st.fmtMoney(d.amount)}</span>
            <button class="btn btn-soft btn-sm" data-ded-del="${d.id}">删除</button>
          </div>`).join('')}
        ${!dep.deductions.length ? '<div style="font-size:12.5px;color:var(--ink3);padding:6px 0">暂无扣款，押金完整可退</div>' : ''}
        <button class="btn btn-outline btn-block" data-add-ded style="margin-top:10px">＋ 添加押金扣款</button>
        <div class="f-hint" style="margin-top:8px">💡 室友退租时，系统自动计算「押金份额 − 未结清欠款 = 应退金额」，避免散伙纠纷。</div>
      </div>
    </div>`;
  }
  function addDeductionModal() {
    const st = S();
    const modal = UI.openModal('💸 添加押金扣款',
      UI.fGroup('扣款说明', UI.fInput('d-title', '', '如：墙面修补')) +
      UI.fGroup('金额（元）', UI.fInput('d-amount', '', '0.00', 'number')),
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="d-save">保存</button>`);
    modal.submit('#d-save', (root) => {
      const title = UI.val('d-title');
      const amt = UI.num('d-amount');
      if (!title || amt <= 0) { UI.toast('请填写说明与金额', '⚠️'); return false; }
      st.addDeduction(title, amt);
      UI.toast('扣款已记录');
      Router.render();
    });
  }

  /* ---------- 记一笔 ---------- */
  function addBill(preset = {}) {
    const st = S();
    const actives = st.activeMembers();
    const me = st.currentUser();
    let splitMode = preset.split || 'equal';
    const body = `
      ${UI.fGroup('类型', UI.fSelect('b-type', Object.keys(st.BILL_TYPES).map((k) => ({ value: k, label: `${st.BILL_TYPES[k].icon} ${st.BILL_TYPES[k].name}` }))))}
      ${UI.fGroup('标题', UI.fInput('b-title', preset.title || '', '如：8月电费'))}
      ${UI.fGroup('金额（元）', UI.fInput('b-amount', preset.amount || '', '0.00', 'number'))}
      ${UI.fGroup('垫付人', UI.fMemberPick('b-payer', actives, preset.payer || me.id))}
      ${UI.fGroup('日期', UI.fInput('b-date', st.todayStr(), '', 'date'))}
      ${UI.fGroup('分摊方式', UI.fSeg('b-split', [
        { value: 'equal', label: 'AA 均摊' }, { value: 'perDay', label: '按入住天数' }, { value: 'custom', label: '自定义' },
      ], splitMode), '按入住天数：按账单周期内各室友实际入住天数折算，新人/退租自动按天算。')}
      <div id="b-perday" style="display:${splitMode === 'perDay' ? 'block' : 'none'}">
        ${UI.fGroup('计费周期（天）', UI.fInput('b-period', '30', '', 'number'))}
      </div>
      <div id="b-custom" style="display:${splitMode === 'custom' ? 'block' : 'none'}">
        <div class="f-group">
          <label class="f-label">每人分摊金额（元）<button type="button" class="btn btn-soft btn-sm" id="b-equalize" style="float:right">一键均分</button></label>
          <div id="b-shares">${actives.map((m) => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <span style="width:72px;font-size:13px">${m.emoji} ${UI.esc(m.name)}</span>
              <input class="f-input" id="share-${m.id}" type="number" value="0" style="padding:7px 10px">
            </div>`).join('')}</div>
        </div>
      </div>
      ${UI.fGroup('备注', UI.fInput('b-note', '', '选填'))}
    `;
    const modal = UI.openModal('💸 记一笔', body,
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="b-save">保存账单</button>`);

    UI.bindSeg('b-split', (v) => {
      splitMode = v;
      document.getElementById('b-perday').style.display = v === 'perDay' ? 'block' : 'none';
      document.getElementById('b-custom').style.display = v === 'custom' ? 'block' : 'none';
    });
    UI.bindMemberPick('b-payer', () => {});
    const eqBtn = modal.root.querySelector('#b-equalize');
    if (eqBtn) eqBtn.addEventListener('click', () => {
      const amt = UI.num('b-amount');
      const each = actives.length ? (amt / actives.length).toFixed(2) : '0.00';
      actives.forEach((m) => { const i = modal.root.querySelector('#share-' + m.id); if (i) i.value = each; });
    });
    modal.submit('#b-save', (root) => {
      const amount = UI.num('b-amount');
      if (!amount || amount <= 0) { UI.toast('请输入有效金额', '⚠️'); return false; }
      const type = UI.val('b-type') || 'other';
      const title = UI.val('b-title') || st.BILL_TYPES[type].name;
      const bill = {
        id: st.uid(), type, title, amount, payerId: root.querySelector('.member-pick .on')?.dataset.v || me.id,
        date: UI.val('b-date') || st.todayStr(), note: UI.val('b-note'),
        split: { mode: splitMode, periodDays: parseInt(UI.val('b-period'), 10) || 30, shares: {} },
      };
      if (splitMode === 'custom') {
        actives.forEach((m) => { bill.split.shares[m.id] = UI.num('share-' + m.id); });
        const sum = Object.values(bill.split.shares).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - amount) > 0.01) { UI.toast(`分摊合计 ${st.fmtMoney(sum)} 与总额不符`, '⚠️'); return false; }
      } else {
        Object.assign(bill.split.shares, st.computeShares(bill));
      }
      st.state().bills.push(bill); st.save();
      curMonth = st.monthKey(bill.date);
      UI.toast(`已记 ${title} ${st.fmtMoney(amount)}`);
      Router.render();
    });
  }

  /* ---------- 账单详情（含对账确认） ---------- */
  function billDetail(id) {
    const st = S();
    const b = st.state().bills.find((x) => x.id === id);
    if (!b) return;
    const t = st.BILL_TYPES[b.type] || st.BILL_TYPES.other;
    const me = st.currentUser();
    const cf = st.billConfirm(b);
    const rows = Object.keys(b.split.shares).map((mid) => {
      const m = st.member(mid);
      return `<div class="settle-line"><span>${m ? m.emoji + ' ' + UI.esc(m.name) : '已退租'}</span>${b.payerId === mid ? '<span class="badge badge-amber" style="margin-left:6px">垫付人</span>' : ''}<span class="amt">${st.fmtMoney(b.split.shares[mid])}</span></div>`;
    }).join('');
    const modal = UI.openModal(
      `${t.icon} ${UI.esc(b.title)}`,
      `<div style="font-size:24px;font-weight:800;margin-bottom:4px">${st.fmtMoney(b.amount)}</div>
       <div style="font-size:12.5px;color:var(--ink3);margin-bottom:6px">${b.date} · ${st.memberName(b.payerId)} 垫付 · ${st.SPLIT_NAMES[b.split.mode]}${b.note ? ' · ' + UI.esc(b.note) : ''}</div>
       <div style="font-size:12.5px;margin-bottom:14px">
         ${cf.total ? `<span class="badge ${cf.confirmed ? 'badge-green' : 'badge-gray'}" style="margin-right:6px">${cf.confirmed ? '✓ 全员已对账' : `对账 ${cf.done}/${cf.total}`}</span>` : ''}
         <span style="color:var(--ink3)">室友确认账单无误后视为对账完成</span>
       </div>
       ${rows}`,
      `<button class="btn btn-soft" data-close>关闭</button>
       ${b.payerId !== me.id && cf.total ? `<button class="btn ${cf.mine ? 'btn-soft' : 'btn-green'}" id="b-confirm">${cf.mine ? '取消确认' : '✓ 确认对账'}</button>` : ''}
       <button class="btn" style="background:var(--red-soft);color:var(--red)" id="b-del">删除</button>`
    );
    const cBtn = modal.root.querySelector('#b-confirm');
    if (cBtn) cBtn.addEventListener('click', () => {
      const arr = st.confirmBill(id, me.id);
      UI.toast(arr.includes(me.id) ? '已确认对账 ✓' : '已取消确认');
      Router.render();
    });
    modal.submit('#b-del', (root) => {
      const i = st.state().bills.findIndex((x) => x.id === id);
      if (i >= 0) st.state().bills.splice(i, 1);
      st.save(); UI.toast('账单已删除', '🗑️'); Router.render();
    });
  }

  window.Views = window.Views || {};
  window.Views.expenses = { render, addBill };
})();
