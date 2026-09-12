/* 公约视图：发起公约 / 在线投票 / 签署确认 / 违约记录 */
(function () {
  'use strict';
  const S = () => Store;
  let filter = 'all';

  function render(el) {
    const st = S();
    const me = st.currentUser();
    const covs = st.state().covenants.filter((c) => filter === 'all' || c.status === filter || c.cat === filter || (filter === 'mine' && (c.createdBy === me.id || c.votes[me.id])));
    const counts = { voting: 0, active: 0 };
    st.state().covenants.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });

    el.innerHTML = `
    <div class="view-anim cov-view">
      <div class="plaza-banner" id="plaza-banner">
        <span class="pb-ic">🏛️</span>
        <div class="pb-tx"><b>公约广场</b><span>采用社区热门公约 · 分享你家的好公约</span></div>
        <button class="pb-go">进入 ›</button>
      </div>
      <div class="sec sec-list">
        <div class="section-title">📜 我们的公约 <span class="more">${st.state().covenants.length} 条</span></div>
        <div class="chip-row cov-chips">
          <button class="chip ${filter === 'all' ? 'on' : ''}" data-f="all">全部</button>
          <button class="chip ${filter === 'active' ? 'on' : ''}" data-f="active">✅ 生效中 ${counts.active || ''}</button>
          <button class="chip ${filter === 'voting' ? 'on' : ''}" data-f="voting">🗳️ 投票中 ${counts.voting || ''}</button>
          <button class="chip ${filter === 'mine' ? 'on' : ''}" data-f="mine">与我相关</button>
        </div>
        ${covs.map(covCard).join('')}
        ${!covs.length ? `<div class="card card-pad empty"><span class="empty-ic">📜</span>该分类下暂无公约</div>` : ''}
        <button class="btn btn-outline btn-block" id="btn-add-cov" style="margin-top:4px">＋ 发起新公约</button>
      </div>
      <div class="cov-side">
        <div class="cov-stats">
          <div><b>${counts.active || 0}</b><span>已生效</span></div>
          <div><b>${counts.voting || 0}</b><span>投票中</span></div>
          <div><b>${st.state().covenants.reduce((s, c) => s + (c.signatures ? c.signatures.length : 0), 0)}</b><span>签署人次</span></div>
        </div>
        <div class="section-title" style="font-size:14px;margin:16px 0 8px">🗂️ 分类筛选</div>
        <div class="cov-filter-list">
          <button class="cov-fbtn ${filter === 'all' ? 'on' : ''}" data-f="all">📜 全部公约</button>
          ${Object.keys(st.COV_CATS).map((k) => `<button class="cov-fbtn ${filter === k ? 'on' : ''}" data-f="${k}">${st.COV_CATS[k].icon} ${st.COV_CATS[k].name}</button>`).join('')}
          <button class="cov-fbtn ${filter === 'mine' ? 'on' : ''}" data-f="mine">⭐ 与我相关</button>
        </div>
        <div class="plaza-mini" id="plaza-mini">
          <span class="pm-ic">🏛️</span>
          <div class="pm-tx"><b>公约广场</b><span>7+ 社区高频模板 · 支持分享</span></div>
          <button class="pm-go">进入 ›</button>
        </div>
        <button class="btn btn-purple btn-block" id="btn-add-cov2">＋ 发起新公约</button>
        <div class="f-hint" style="margin-top:10px">💡 公约经在线投票（≥60% 同意）后生效；生效后全员签署确认，违约行为将被记录留痕。</div>
      </div>
    </div>`;

    el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(el); }));
    const plaza = el.querySelector('#plaza-banner');
    if (plaza) plaza.addEventListener('click', () => Views.plaza());
    const plazaMini = el.querySelector('#plaza-mini');
    if (plazaMini) plazaMini.addEventListener('click', () => Views.plaza());
    const add2 = el.querySelector('#btn-add-cov2');
    if (add2) add2.addEventListener('click', () => addCovenant());
    el.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => {
      const cov = st.voteCov(b.dataset.vote, me.id, b.dataset.choice);
      if (cov) UI.toast(cov.status === 'active' ? '🎉 公约已生效！' : cov.status === 'rejected' ? '投票结束，公约未通过' : '投票成功');
      render(el);
    }));
    el.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => {
      st.signCov(b.dataset.sign, me.id);
      UI.toast('签署成功，承诺已记录 ✍️');
      render(el);
    }));
    el.querySelectorAll('[data-vio]').forEach((b) => b.addEventListener('click', () => addViolation(b.dataset.vio)));
    const addBtn = el.querySelector('#btn-add-cov');
    if (addBtn) addBtn.addEventListener('click', () => addCovenant());
  }

  function covCard(c) {
    const st = S();
    const me = st.currentUser();
    const cat = st.COV_CATS[c.cat] || st.COV_CATS.other;
    const p = st.covProgress(c);
    const statusBadge = c.status === 'active' ? '<span class="badge badge-green">已生效</span>'
      : c.status === 'voting' ? '<span class="badge badge-amber">投票中</span>'
      : '<span class="badge badge-gray">未通过</span>';
    const myVote = c.votes[me.id];
    const signed = c.signatures.includes(me.id);

    let voteArea = '';
    if (c.status === 'voting') {
      voteArea = `
        <div class="vote-bar">
          <span class="yes" style="width:${p.voted ? (p.yes / p.voted) * 100 : 0}%"></span>
          <span class="no" style="width:${p.voted ? (p.no / p.voted) * 100 : 0}%"></span>
        </div>
        <div style="font-size:12px;color:var(--ink3);margin-bottom:10px">已投 ${p.voted}/${p.total} 人 · 赞成 ${p.yes} · 反对 ${p.no}${p.voted === p.total ? ' · 需 ≥60% 赞成生效' : ''}</div>
        ${myVote
          ? `<div style="font-size:13px;font-weight:700;color:${myVote === 'agree' ? 'var(--green)' : 'var(--red)'}">我已投：${myVote === 'agree' ? '赞成 ✓' : '反对 ✗'}</div>`
          : `<div class="vote-btns">
              <button class="yes-btn ${myVote === 'agree' ? 'voted' : ''}" data-vote="${c.id}" data-choice="agree">👍 赞成</button>
              <button class="no-btn" data-vote="${c.id}" data-choice="reject">👎 反对</button>
            </div>`}`;
    }

    const vioRows = c.violations.length ? `
      <div style="margin-top:12px;border-top:1px solid var(--line);padding-top:8px">
        <div style="font-size:12.5px;font-weight:700;color:var(--red);margin-bottom:4px">⚠️ 违约记录（${c.violations.length}）</div>
        ${c.violations.slice().reverse().map((v) => `
          <div class="vio-row"><span>🚫</span><span style="flex:1">${st.memberName(v.memberId)} · ${UI.esc(v.note)}</span><span class="when">${v.date}</span></div>`).join('')}
      </div>` : '';

    const catColor = { fee: '#0EA47A', clean: '#2E86AB', sleep: '#7C5CF0', pet: '#F5A623', other: '#98A0AE' }[c.cat] || '#98A0AE';
    return `
    <div class="cov-card" style="border-left:4px solid ${catColor}">
      <div class="cov-top">
        <span class="cov-ic">${c.icon || cat.icon}</span>
        <div class="cov-title">${UI.esc(c.title)}</div>
        ${statusBadge}
      </div>
      <div class="cov-content">${UI.esc(c.content)}</div>
      <div class="cov-meta">
        <span>${cat.icon} ${cat.name}</span>
        <span>发起人：${st.memberName(c.createdBy)}</span>
        <span>${c.date}</span>
        <span>签署 ${c.signatures.length}/${p.total} 人</span>
      </div>
      ${voteArea}
      ${c.status === 'active' ? `
        <div style="display:flex;gap:8px;margin-top:12px">
          ${signed
            ? `<span class="badge badge-green" style="padding:6px 12px">我已签署 ✍️</span>`
            : `<button class="btn btn-purple btn-sm" data-sign="${c.id}">✍️ 签署确认</button>`}
          <button class="btn btn-soft btn-sm" data-vio="${c.id}">🚫 记一次违约</button>
        </div>` : ''}
      ${vioRows}
    </div>`;
  }

  /* ---------- 发起公约（支持 AI 模板预填） ---------- */
  function addCovenant(preset = {}) {
    const st = S();
    const body = `
      ${UI.fGroup('公约标题', UI.fInput('v-title', preset.title || '', '如：23:00 后保持安静'))}
      ${UI.fGroup('分类', UI.fSelect('v-cat', Object.keys(st.COV_CATS).map((k) => ({ value: k, label: `${st.COV_CATS[k].icon} ${st.COV_CATS[k].name}` })), preset.cat || 'other'))}
      ${UI.fGroup('公约内容', UI.fTextarea('v-content', preset.content || '', '写清楚约定内容与执行标准，越具体越好'))}
    `;
    const modal = UI.openModal(preset.title ? '📜 发起公约 · AI 已起草' : '📜 发起新公约', body,
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-purple" id="v-save">发起投票</button>`);
    modal.submit('#v-save', (root) => {
      const title = UI.val('v-title');
      const content = UI.val('v-content');
      if (!title || !content) { UI.toast('请填写标题与内容', '⚠️'); return false; }
      st.state().covenants.push({
        id: st.uid(), title, cat: UI.val('v-cat') || 'other', icon: (st.COV_CATS[UI.val('v-cat')] || st.COV_CATS.other).icon,
        content, status: 'voting', votes: { [st.currentUser().id]: 'agree' }, signatures: [],
        createdBy: st.currentUser().id, date: st.todayStr(), violations: [],
      });
      st.save(); UI.toast('公约已发起，等待室友投票 🗳️');
      Router.render();
    });
  }

  /* ---------- 记违约 ---------- */
  function addViolation(covId) {
    const st = S();
    const cov = st.state().covenants.find((c) => c.id === covId);
    if (!cov) return;
    const actives = st.activeMembers();
    const body = `
      ${UI.fGroup('违约人', UI.fMemberPick('x-member', actives, null))}
      ${UI.fGroup('违约说明', UI.fTextarea('x-note', '', '如：23:40 仍在大声外放'))}
    `;
    const modal = UI.openModal(`🚫 记录违约 · ${UI.esc(cov.title)}`, body,
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="x-save">记录</button>`);
    UI.bindMemberPick('x-member', () => {});
    modal.submit('#x-save', (root) => {
      const mid = root.querySelector('.member-pick .on')?.dataset.v;
      if (!mid) { UI.toast('请选择违约人', '⚠️'); return false; }
      st.addViolation(covId, mid, UI.val('x-note'));
      UI.toast('违约记录已留痕');
      Router.render();
    });
  }

  window.Views = window.Views || {};
  window.Views.covenant = { render, addCovenant };
})();
