/* 总览视图：数字优先分区卡片流
   结构：问候 → 提醒横幅 → 本月账单大数字 → 今日待办统计 → 快捷入口
        → AI管家 → 今日值日 → 结算待办 → 库存预警 → 趋势 → 家动态 → 最近账单 */
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
    const undoneSettle = stls.filter((t) => !t.done).length;
    const votingCovs = st.state().covenants.filter((c) => c.status === 'voting' && !c.votes[me.id]).length;
    const billCount = st.monthBills(mk).length;

    el.innerHTML = `
    <div class="view-anim">
      <div class="ov-greet">${greet}，${st.memberName(me.id)} 👋<small>${st.state().home.name}</small></div>

      ${st.allReminders().length ? `
      <div class="rem-banner" id="rem-banner">
        <span class="rb-ic">🔔</span>
        <div class="rb-tx">你有 <b>${st.allReminders().length}</b> 条待办提醒（值日 / 库存 / 结算 / 投票）</div>
        <button class="rb-go">查看 ›</button>
      </div>` : ''}

      <div class="ov-hero" data-go="expenses" style="cursor:pointer">
        <div class="label">本月支出 · ${mk} <span style="float:right">${actives.length} 人共住</span></div>
        <div class="amount"><span class="ov-amount-num" data-target="${total}">0</span><small> 人均 ${st.fmtMoney(perCap)}</small></div>
        <div class="ov-hero-row">
          <span>${flow.net >= 0 ? '我的待收' : '我的待付'} <b class="${flow.net >= 0 ? 'up' : 'down'}">${flow.net >= 0 ? '+' : '-'} ${st.fmtMoney(Math.abs(flow.net))}</b></span>
          <span style="opacity:.9">结算中心 →</span>
        </div>
      </div>

      <div class="ov-today">
        <div class="ov-today-title">📌 今日待办 <span class="more">点击直达处理</span></div>
        <div class="ov-today-grid">
          <button class="ov-today-cell" data-go="chores"><b class="${tds.filter((t) => !t.done).length ? 'hot' : ''}">${tds.filter((t) => !t.done).length}</b><span>🧹 值日待打卡</span></button>
          <button class="ov-today-cell" data-go="items"><b class="${lows.length ? 'hot' : ''}">${lows.length}</b><span>📦 物品待补货</span></button>
          <button class="ov-today-cell" data-go="expenses"><b class="${undoneSettle ? 'hot' : ''}">${undoneSettle}</b><span>💸 账单待结算</span></button>
          <button class="ov-today-cell" data-go="covenant"><b class="${votingCovs ? 'hot' : ''}">${votingCovs}</b><span>🗳️ 公约待投票</span></button>
        </div>
      </div>

      <div class="ov-grid">
        <button class="ov-quick" data-go="addBill"><span class="qi">💸</span>记一笔<span class="qsub">本月 ${billCount} 笔</span></button>
        <button class="ov-quick" data-go="chores"><span class="qi">🧹</span>今日值日${tds.filter((t) => !t.done).length ? `<span class="qbadge">${tds.filter((t) => !t.done).length}</span>` : ''}<span class="qsub">🔥 ${st.houseStreak()} 天</span></button>
        <button class="ov-quick" data-go="items"><span class="qi">📦</span>补货提醒${lows.length ? `<span class="qbadge">${lows.length}</span>` : ''}<span class="qsub">${st.state().items.length} 件在管</span></button>
        <button class="ov-quick" data-go="addCovenant"><span class="qi">📜</span>发起公约${votingCovs ? `<span class="qbadge">${votingCovs}</span>` : ''}<span class="qsub">${st.state().covenants.length} 条公约</span></button>
      </div>

      <div class="ai-banner" id="ai-banner">
        <span class="ai-banner-ic">🤖</span>
        <div class="ai-banner-tx">
          <b>AI 管家</b>
          <span>帮我写催收话术 · 起草公约 · 建议分摊方式</span>
        </div>
        <button class="ai-banner-go">试试 ›</button>
      </div>

      <div class="sec">
        <div class="section-title">🧹 今日值日 <span class="more">${tds.length ? tds.filter((t) => !t.done).length + ' 项待完成' : '今天无值日任务'}</span></div>
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
        : `<div class="card card-pad empty" style="padding:24px"><span class="empty-ic" style="font-size:32px">🎉</span>今天没有值日任务，享受休息日～</div>`}
      </div>

      <div class="sec">
        <div class="section-title">🤝 结算待办 <span class="more">${undoneSettle ? undoneSettle + ' 笔未结清' : '本月已结清'}</span></div>
        ${stls.length ? stls.slice(0, 3).map((t) => `
          <div class="settle-line card card-pad" style="margin-bottom:8px;padding:10px 14px">
            ${UI.avatar(st.member(t.from), 'sm')}
            <span><span class="who">${st.memberName(t.from)}</span> → ${UI.avatar(st.member(t.to), 'sm')} <span class="who">${st.memberName(t.to)}</span></span>
            <span class="amt">${st.fmtMoney(t.amount)}</span>
            <button class="done-btn ${t.done ? 'is-done' : ''}" data-set="${t.key}">${t.done ? '已结清' : '标记已还'}</button>
          </div>`).join('')
        : `<div class="card card-pad empty" style="padding:24px"><span class="empty-ic" style="font-size:32px">🤝</span>暂无待结算账单，去记一笔吧</div>`}
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
        : `<div class="card card-pad empty" style="padding:24px"><span class="empty-ic" style="font-size:32px">📦</span>公共物品库存充足</div>`}
      </div>

      <div class="sec">
        <div class="section-title">📈 近 6 个月支出</div>
        <div class="card card-pad">
          <div class="bar-chart">${renderBars()}</div>
        </div>
      </div>

      <div class="sec">
        <div class="section-title">🏡 家动态 <span class="more">共同生活的每件小事都值得被记录</span></div>
        <div class="card card-pad feed-card">
          ${st.feed(6).map((ev) => `
            <div class="feed-row">
              <span class="feed-ic" style="background:${feedColor(ev.type)}">${ev.icon}</span>
              <div class="feed-tx">${UI.esc(ev.text)}</div>
              <div class="feed-date">${ev.date.slice(5)}</div>
            </div>`).join('')}
          <div class="f-hint" style="margin-top:8px">💡 家动态是「合租社区」的内容沉淀：账清、事明，日子都看得见。</div>
        </div>
      </div>

      <div class="sec">
        <div class="section-title">🧾 最近账单 <span class="more" data-go="expenses" style="cursor:pointer">查看全部 →</span></div>
        ${st.state().bills.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3).map(billRow).join('')}
      </div>
    </div>`;

    // 金额滚动动效
    const numEl = el.querySelector('.ov-amount-num');
    if (numEl) {
      const target = parseFloat(numEl.dataset.target) || 0;
      const start = performance.now();
      const dur = 650;
      const step = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        numEl.textContent = st.fmtMoney(target * ease);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    // 事件
    const banner = el.querySelector('#rem-banner');
    if (banner) banner.addEventListener('click', () => Views.reminders());
    const ai = el.querySelector('#ai-banner');
    if (ai) ai.addEventListener('click', () => Views.ai());
    el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
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

  function feedColor(type) {
    return type === 'bill' ? '#E6F7F2' : type === 'chore' ? '#E9F1FF' : type === 'stock' ? '#FFF6E5' : '#F2EFFF';
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
