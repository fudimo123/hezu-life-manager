/* AI 管家：催收/还款话术生成 · 公约草案起草 · 智能分摊建议
   说明：Demo 版使用本地规则引擎模拟 AI 推理（无后端依赖），
   线上版可替换为真实大模型 API。 */
(function () {
  'use strict';
  const S = () => Store;

  const THEMES = [
    { key: 'sleep', icon: '🌙', title: '23:00 后保持安静', content: '23:00 后公共区域与房间内不进行外放、大声通话；需要加班或游戏请佩戴耳机；特殊情况提前在群里说明。' },
    { key: 'clean', icon: '🧹', title: '公共区域值日打卡制', content: '按系统排班执行公共区域值日，完成后当日打卡；连续 3 次未打卡者请全屋奶茶；请假需提前与下一位值日人换班。' },
    { key: 'fee', icon: '💰', title: '水电均摊、燃气按天计费', content: '水电宽带 AA 均摊；燃气费按入住天数折算；公共采购凭小票记账，月底统一结算；大额支出（>200 元）需先群内确认。' },
    { key: 'pet', icon: '🐾', title: '养宠物需全体同意', content: '新宠物入住前须发起公约投票，全体室友同意后方可入住；宠物不得进入他人房间；公共区域毛发由宠物主人负责清理。' },
    { key: 'guest', icon: '🚪', title: '访客与过夜管理', content: '带访客回家需提前在群里告知；访客连续过夜不超过 3 晚；访客造成公共区域问题由邀请人负责。' },
  ];
  const SPLIT_SUG = {
    rent: { mode: 'equal', reason: '房租通常按房间均摊；若房间大小差异大，建议改用「自定义」按面积折算。' },
    elec: { mode: 'perDay', reason: '电费与在住天数强相关，按入住天数折算最公平——新人或退租当月谁也不吃亏。' },
    water: { mode: 'perDay', reason: '水费建议按天折算，出差多、回家少的成员不再「白摊」。' },
    gas: { mode: 'perDay', reason: '燃气费与做饭频率相关，按天分摊最合理。' },
    net: { mode: 'equal', reason: '宽带是固定费用，与用量无关，AA 均摊最省心。' },
    shop: { mode: 'equal', reason: '公共采购人人受益，AA 均摊即可；若某人有专属物品可自定义扣除。' },
    other: { mode: 'equal', reason: '默认 AA 均摊，特殊情况再用自定义比例。' },
  };

  let tab = 'script';

  function open() {
    const st = S();
    const me = st.currentUser();
    const mk = st.monthKey(st.todayStr());
    const stls = st.settlements(mk);
    const oweMe = stls.filter((t) => t.to === me.id && !t.done);
    const iOwe = stls.filter((t) => t.from === me.id && !t.done);
    const targets = oweMe.map((t) => ({ id: t.from, amount: t.amount, dir: 'in' }))
      .concat(iOwe.map((t) => ({ id: t.to, amount: t.amount, dir: 'out' })));

    const body = `
      <div class="ai-head">
        <span class="ai-avatar">🤖</span>
        <div>
          <div class="ai-title">AI 管家</div>
          <div class="ai-sub">读懂你的家，帮你说出难开口的话 · 模拟 AI 演示（本地规则引擎）</div>
        </div>
      </div>
      <div class="ai-tabs">
        <button class="ai-tab ${tab === 'script' ? 'on' : ''}" data-t="script">💬 催收话术</button>
        <button class="ai-tab ${tab === 'covenant' ? 'on' : ''}" data-t="covenant">📜 公约起草</button>
        <button class="ai-tab ${tab === 'split' ? 'on' : ''}" data-t="split">🧮 分摊建议</button>
      </div>
      <div id="ai-panel">${renderPanel(st, me, targets)}</div>`;

    const modal = UI.openModal('', body, '');
    const sheet = modal.root.closest('.modal-sheet');
    sheet.querySelector('.modal-title').innerHTML = '<span></span><button class="modal-close" data-close>✕</button>';
    modal.root.querySelectorAll('.ai-tab').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.t;
      modal.root.querySelectorAll('.ai-tab').forEach((x) => x.classList.toggle('on', x === b));
      modal.root.querySelector('#ai-panel').innerHTML = renderPanel(st, me, targets);
    }));
  }

  function renderPanel(st, me, targets) {
    if (tab === 'script') return renderScripts(st, me, targets);
    if (tab === 'covenant') return renderDrafts(st);
    return renderSplit(st);
  }

  /* ---------- 话术 ---------- */
  function renderScripts(st, me, targets) {
    const mk = st.monthKey(st.todayStr());
    if (!targets.length) return bubble('ai', '本月没有待结算的往来账目，你们的账目非常干净 🎉');
    return targets.map((t) => {
      const other = st.member(t.id);
      const lines = t.dir === 'in'
        ? [
          { tone: '😊 温和', text: `${other.name}～刚看了眼本月账单，你这边还有 ${st.fmtMoney(t.amount)} 需要转给我，不急哈，方便的时候转就行～` },
          { tone: '😄 幽默', text: `📣 账单快递员上线：${other.name} → ${me.name}，${st.fmtMoney(t.amount)}，到付！支持微信/支付宝，谢谢老板 💸` },
          { tone: '📋 正式', text: `【合租账单】${other.name} 你好，本月结算已生成：请将 ${st.fmtMoney(t.amount)} 转账给 ${me.name}，3 日内完成即可，感谢配合。` },
        ]
        : [
          { tone: '🙏 主动', text: `${other.name}～不好意思刚看到结算单，我这边还欠你 ${st.fmtMoney(t.amount)}，现在转给你哈！` },
          { tone: '📋 正式', text: `【合租账单】${other.name} 你好，本月结算显示我需向你支付 ${st.fmtMoney(t.amount)}，确认无误后将尽快转账，谢谢。` },
        ];
      return `
        <div class="ai-block">
          <div class="ai-q">${t.dir === 'in' ? `催收话术：${other.name} 欠我 ${st.fmtMoney(t.amount)}` : `还款话术：我欠 ${other.name} ${st.fmtMoney(t.amount)}`}</div>
          ${lines.map((l) => `
            <div class="ai-answer">
              <div class="ai-answer-tone">${l.tone}</div>
              <div class="ai-answer-text">${UI.esc(l.text)}</div>
              <button class="btn btn-soft btn-sm ai-copy" data-text="${UI.esc(l.text)}">📋 复制</button>
            </div>`).join('')}
        </div>`;
    }).join('');
  }

  /* ---------- 公约起草 ---------- */
  function renderDrafts(st) {
    return `
      <div class="ai-block">
        <div class="ai-q">我根据全网合租公约高频主题，整理了 5 个模板，选一个生成正式草案 👇</div>
        ${THEMES.map((th) => `
          <div class="ai-draft">
            <div class="ai-draft-head">${th.icon} ${UI.esc(th.title)}</div>
            <div class="ai-draft-body">${UI.esc(th.content)}</div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn btn-purple btn-sm" data-draft="${th.key}">以此发起投票</button>
            </div>
          </div>`).join('')}
      </div>`;
  }

  /* ---------- 分摊建议 ---------- */
  function renderSplit(st) {
    return `
      <div class="ai-block">
        <div class="ai-q">选一种账单类型，我给出最公平的分摊方式建议 👇</div>
        ${Object.keys(st.BILL_TYPES).map((k) => {
          const t = st.BILL_TYPES[k];
          const sug = SPLIT_SUG[k] || SPLIT_SUG.other;
          return `
          <div class="ai-draft">
            <div class="ai-draft-head">${t.icon} ${t.name} → <b style="color:var(--brand)">${st.SPLIT_NAMES[sug.mode]}</b></div>
            <div class="ai-draft-body">${UI.esc(sug.reason)}</div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn btn-green btn-sm" data-bill="${k}" data-mode="${sug.mode}">按此方式记账</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  /* ---------- 事件绑定 ---------- */
  document.addEventListener('click', (e) => {
    const cp = e.target.closest('.ai-copy');
    if (cp) UI.copyText(cp.dataset.text);
    const dr = e.target.closest('[data-draft]');
    if (dr) {
      const th = THEMES.find((x) => x.key === dr.dataset.draft);
      if (th) {
        const root = dr.closest('#modal-root');
        if (root) root.innerHTML = '';
        Views.covenant.addCovenant({ title: th.title, content: th.content, cat: th.key === 'fee' ? 'fee' : th.key === 'clean' ? 'clean' : th.key === 'sleep' ? 'sleep' : th.key === 'pet' ? 'pet' : 'other' });
      }
    }
    const bl = e.target.closest('[data-bill]');
    if (bl) {
      const root = bl.closest('#modal-root');
      if (root) root.innerHTML = '';
      Views.expenses.addBill({ split: bl.dataset.mode });
    }
  });

  function bubble(who, text) {
    return `<div class="ai-block"><div class="ai-answer"><div class="ai-answer-text">${UI.esc(text)}</div></div></div>`;
  }

  window.Views = window.Views || {};
  window.Views.ai = open;
})();
