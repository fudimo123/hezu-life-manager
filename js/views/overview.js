/* 总览视图：本月账单 / 今日值日 / 库存预警 / 结算待办 / 趋势图 */
(function () {
  'use strict';
  const S = () => Store;

  function render(el) {
    const st = S();
    const me = st.currentUser();
    const mk = st.monthKey(st.todayStr());
    const total = st.monthTotal(mk);
    const actives = st.activeMembers();
    const perCap = total / (actives.length || 1);
    const flow = st.memberFlow(me.id, mk);
    const hour = new Date().getHours();
    const greet = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    const tds = st.todayDuties();
    const lows = st.lowItems();
    const stls = st.settlements(mk);
    const undone = stls.filter((t) => !t.done);

    el.innerHTML = `
    <div class="view-anim">
      <div class="ov-greet">${greet}，${st.memberName(me.id)} 👋<small>${st.home.name}</small></div>

      ${st.allReminders().length ? `
      <div class="rem-banner" id="rem-banner">
        <span class="rb-ic">🔔</span>
        <div class="rb-tx">你有 <b>${st.allReminders().length}</b> 条待办提醒（值日 / 库存 / 结算 / 投票）</div>
        <button class="rb-go">查看 ›</button>
      </div>` : ''}

      <div class="ov-hero">
        <div class="label">本月支出 · ${mk}</div>
        <div class="amount">${st.fmtMoney(total)}<small> / ${actives.length} 人</small></div>
        <div class="ov-hero-row">
          <span>人均分摊 <b>${st.fmtMoney(perCap)}</b></span>
          ${flow.net >= 0
            ? `<span>我的待收 <b class="up">+ ${st.fmtMoney(flow.net)}</b></span>`
            : `<span>我的待付 <b class="down">- ${st.fmtMoney(-flow.net)}</b></span>`}
        </div>
      </div>

      <div class="ov-grid">
        <button class="ov-quick" data-go="addBill"><span class="qi">💸</span>记一笔</button>
        <button class="ov-quick" data-go="chores"><span class="qi">🧹</span>今日值日${tds.length ? `<span class="qbadge">${tds.filter((t) => !t.done).length}</span>` : ''}</button>
        <button class="ov-quick" data-go="items"><span class="qi">📦</span>补货提醒${lows.length ? `<span class="qbadge">${lows.length}</span>` : ''}</button>
        <button class="ov-quick" data-go="addCovenant"><span class="qi">📜</span>发起公约</button>
      </div>

      <div class="sec">
        <div class="section-title">🧹 今日值日 <span class="more">🔥 全屋连续 ${st.houseStreak()} 天 · ${tds.length ? tds.filter((t) => !t.done).length + ' 项待完成' : '今天无值日任务'}</span></div>
        ${tds.length ? tds.map((t) => `
          <div class="duty-task ${t.done ? 'done' : ''}">
            <span class="li-ic" style="background:#E9F1FF">${t.chore.icon}</span>
            <div class="li-main">
              <div class="li-title">${UI.esc(t.chore.title)}</div>
              <div class="li-sub">值日人：${UI.esc(st.memberName(t.memberId))} · +${t.chore.points} 积分</div>
            </div>
            ${t.done
              ? `<span class="badge badge-green">已完成 ✓</span>`
              : `<button class="btn btn-green btn-sm" data-do="${t.chore.id}">打卡</button>`}
          </div>`).join('')
        : `<div class="card card-pad empty"><span class="empty-ic">🎉</span>今天没有值日任务，享受休息日～</div>`}
      </div>

      <div class="sec">
        <div class="section-title">🤝 结算待办 <span class="more">${undone.length ? undone.length + ' 笔未结清' : '本月已结清'}</span></div>
        ${stls.length ? stls.slice(0, 4).map((t) => `
          <div class="settle-line">
            ${UI.avatar(st.member(t.from), 'sm')}
            <span><span class="who">${st.memberName(t.from)}</span> → ${UI.avatar(st.member(t.to), 'sm')} <span class="who">${st.memberName(t.to)}</span></span>
            <span class="amt">${st.fmtMoney(t.amount)}</span>
            <button class="done-btn ${t.done ? 'is-done' : ''}" data-set="${t.key}">${t.done ? '已结清' : '标记已还'}</button>
          </div>`).join('')
        : `<div class="card card-pad empty"><span class="empty-ic">🤝</span>暂无待结算账单，去记一笔吧</div>`}
        <button class="btn btn-outline btn-block" data-go="expenses" style="margin-top:8px">进入结算中心 →</button>
      </div>

      <div class="sec">
        <div class="section-title">🚨 库存预警 <span class="more">${lows.length} 项</span></div>
        ${lows.length ? lows.map((it) => `
          <div class="list-item">
            <span class="li-ic" style="background:#FFF6E5">${it.icon}</span>
            <div class="li-main">
              <div class="li-title">${UI.esc(it.name)}</div>
              <div class="li-sub">剩余 ${it.qty}${it.unit} · ${UI.esc(it.location || '未设置位置')}</div>
            </div>
            ${it.qty <= 0 ? `<span class="badge badge-red">已用完</span>` : `<span class="badge badge-amber">偏低</span>`}
          </div>`).join('')
        : `<div class="card card-pad empty"><span class="empty-ic">📦</span>公共物品库存充足</div>`}
      </div>

      <div class="sec">
        <div class="section-title">📈 近 6 个月支出</div>
        <div class="card card-pad">
          <div class="bar-chart">${renderBars()}</div>
        </div>
      </div>

      <div class="sec">
        <div class="section-title">🧾 最近账单 <span class="more" data-go="expenses" style="cursor:pointer">查看全部 →</span></div>
        ${st.state().bills.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3).map(billRow).join('')}
      </div>
    </div>`;

    // 事件
    const banner = el.querySelector('#rem-banner');
    if (banner) banner.addEventListener('click', () => Views.reminders());
    el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.go;
      if (g === 'addBill') Views.expenses.addBill();
      else if (g === 'addCovenant') Views.covenant.addCovenant();
      else Router.go(g);
    }));
    el.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', () => {
      const r = st.doChore(b.dataset.do, st.currentUser().id);
      if (r) UI.toast(`${r.chore.title} 打卡成功，${st.memberName(r.assignee)} +${r.points} 积分`, '🎉');
      Router.render();
    }));
    el.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
      const t = st.settlements(st.monthKey(st.todayStr())).find((x) => x.key === b.dataset.set);
      st.markSettled(b.dataset.set, !t.done);
      UI.toast(t.done ? '已标记结清' : '已恢复待结清');
      Router.render();
    }));
  }

  function renderBars() {
    const st = S();
    const cols = [];
    let max = 0;
    for (let k = 5; k >= 0; k--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k);
      const mk = st.fmtDate(d).slice(0, 7);
      const v = st.monthTotal(mk);
      max = Math.max(max, v);
      cols.push({ mk, v });
    }
    return cols.map((c) => `
      <div class="bar-col">
        <div class="bar${c.v === 0 ? ' dim' : ''}" style="height:${max ? Math.max(3, (c.v / max) * 88) : 3}px" title="${c.mk} ${st.fmtMoney(c.v)}"></div>
        <label>${c.mk.slice(2)}月</label>
      </div>`).join('');
  }

  function billRow(b) {
    const st = S();
    const t = st.BILL_TYPES[b.type] || st.BILL_TYPES.other;
    return `
    <div class="bill-row">
      <span class="bill-type-ic" style="background:${t.color}">${t.icon}</span>
      <div class="li-main">
        <div class="li-title">${UI.esc(b.title)}</div>
        <div class="li-sub">${b.date} · ${st.memberName(b.payerId)} 垫付 · ${st.SPLIT_NAMES[b.split.mode]}</div>
      </div>
      <div class="li-right"><div class="li-amount">${st.fmtMoney(b.amount)}</div><div class="li-tag">我摊 ${st.fmtMoney(b.split.shares[st.currentUser().id] || 0)}</div></div>
    </div>`;
  }

  window.Views = window.Views || {};
  window.Views.overview = { render };
})();
