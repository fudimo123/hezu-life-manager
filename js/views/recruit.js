/* 找室友 · 准入评估 · 社区属性 P3
   输入候选人生活标签 → 生成合拍报告（与每位成员对比 + 冲突点）
   → AI 评估意见 → 建议公约（一键发起） → 一键邀请入住 */
(function () {
  'use strict';
  const S = () => Store;
  const TAG_OPTS = {
    sleep: ['早睡早起', '晚睡', '熬夜党', '随缘'],
    clean: ['爱整洁', '随性', '轻度洁癖'],
    pet: ['无', '有猫', '有狗', '其他宠物'],
    smoke: ['不烟不酒', '偶尔小酌', '抽烟'],
    social: ['偏i人', '偏e人', '介于两者'],
  };
  const DIM_LABEL = { sleep: '作息', clean: '卫生', pet: '宠物', smoke: '烟酒', social: '社交' };
  // 冲突维度 → 建议公约模板
  const CONFLICT_COV = {
    sleep: { icon: '🌙', title: '23:00 后保持安静', content: '23:00 后公共区域与房间内不进行外放、大声通话；需要加班或游戏请佩戴耳机；特殊情况提前在群里说明。', cat: 'sleep' },
    clean: { icon: '🧹', title: '公共区域值日打卡制', content: '按系统排班执行公共区域值日，完成后当日打卡；连续 3 次未打卡者请全屋奶茶。', cat: 'clean' },
    pet: { icon: '🐾', title: '养宠物需全体同意', content: '新宠物入住前须发起公约投票，全体室友同意后方可入住；宠物不得进入他人房间。', cat: 'pet' },
    social: { icon: '🚪', title: '访客与聚会管理', content: '带访客回家需提前在群里告知；聚会尽量安排在公共区域，结束后共同清理。', cat: 'other' },
    smoke: { icon: '🚭', title: '室内禁烟公约', content: '室内公共区域全面禁烟；吸烟请到阳台或楼下，烟蒂不乱丢。', cat: 'other' },
  };
  const POLAR = {
    sleep: [['早睡早起', '熬夜党'], ['早睡早起', '晚睡']],
    clean: [['爱整洁', '随性'], ['轻度洁癖', '随性']],
    smoke: [['不烟不酒', '抽烟'], ['偶尔小酌', '抽烟']],
  };

  function open() {
    const st = S();
    const body = `
      <div class="recruit-head">
        <div class="recruit-title">🤝 找室友 · 准入评估</div>
        <div class="recruit-sub">输入候选室友的生活习惯，生成与现有成员的合拍报告与 AI 评估意见</div>
      </div>
      ${UI.fGroup('昵称', UI.fInput('r-name', '', '如：小新'))}
      ${Object.keys(TAG_OPTS).map((k) => UI.fGroup(DIM_LABEL[k] + '偏好', UI.fSelect('r-' + k, TAG_OPTS[k].map((v) => ({ value: v, label: v })), TAG_OPTS[k][0]))).join('')}
      ${UI.fGroup('预算（元/月，选填）', UI.fInput('r-budget', '', '如：2500', 'number'))}
      ${UI.fGroup('期望入住日期（选填）', UI.fInput('r-movein', '', '', 'date'))}
      <div id="r-report"></div>`;
    const modal = UI.openModal('', body,
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="r-eval">生成评估报告</button>`);

    modal.root.querySelector('#r-eval').addEventListener('click', async () => {
      const name = UI.val('r-name').trim();
      if (!name) { UI.toast('请先输入昵称', '⚠️'); return; }
      const tags = {};
      Object.keys(TAG_OPTS).forEach((k) => { tags[k] = UI.val('r-' + k); });
      const budget = UI.val('r-budget');
      const movein = UI.val('r-movein');
      const report = modal.root.querySelector('#r-report');
      report.innerHTML = `<div class="ai-answer"><div class="ai-answer-text">🤖 正在生成评估报告…</div></div>`;

      // 与每位成员对比
      const members = st.activeMembers();
      const rows = members.map((m) => {
        const same = Object.keys(tags).filter((k) => m.tags && m.tags[k] && m.tags[k] === tags[k]);
        const compat = Math.round((same.length / Object.keys(tags).length) * 100);
        const diffs = Object.keys(tags).filter((k) => m.tags && m.tags[k] && m.tags[k] !== tags[k])
          .map((k) => `${DIM_LABEL[k]}：${m.tags[k]} vs ${tags[k]}`);
        const polar = Object.keys(tags).filter((k) => {
          const pair = POLAR[k] || [];
          return pair.some(([a, b]) => (m.tags[k] === a && tags[k] === b) || (m.tags[k] === b && tags[k] === a));
        });
        return { m, compat, diffs, polar };
      });
      const avg = Math.round(rows.reduce((s, r) => s + r.compat, 0) / (rows.length || 1));
      const conflictDims = Array.from(new Set(rows.flatMap((r) => r.polar)));

      // AI 评估意见（失败则本地兜底）
      let ai = null;
      if (window.Views.aiAsk) {
        const res = await window.Views.aiAsk('evaluate', {
          tags: Object.keys(tags).map((k) => `${DIM_LABEL[k]}：${tags[k]}`).join('，'),
          context: members.map((m) => `${m.name}（${Object.entries(m.tags || {}).map(([k, v]) => DIM_LABEL[k] + '：' + v).join('，')}）`).join('；'),
        });
        if (res.data && res.data.summary) ai = res.data;
      }
      if (!ai) {
        ai = {
          summary: conflictDims.length ? `生活习惯存在 ${conflictDims.length} 个维度的差异，建议入住前达成书面共识。` : '生活习惯与现有成员高度契合，可直接进入入住流程。',
          risks: conflictDims.slice(0, 2).map((k) => `${DIM_LABEL[k]}差异可能带来磨合成本`),
          suggestions: conflictDims.slice(0, 2).map((k) => `提前约定${DIM_LABEL[k]}相关规则`),
        };
      }

      report.innerHTML = `
        <div class="r-score-card">
          <div class="r-score-num">${avg}</div>
          <div class="r-score-label">综合合拍指数</div>
          <div class="r-score-bar"><i style="width:${avg}%"></i></div>
        </div>
        <div class="section-title" style="margin-top:16px;font-size:14px">与现有成员对比</div>
        ${rows.map((r) => `
          <div class="r-row">
            ${UI.avatar(r.m, 'sm')}
            <div style="flex:1;min-width:0">
              <div style="font-size:13.5px;font-weight:700">${UI.esc(r.m.name)} · 合拍 ${r.compat}%</div>
              <div style="font-size:11.5px;color:var(--ink3)">${r.diffs.length ? r.diffs.join('；') : '各维度完全一致 ✨'}</div>
            </div>
          </div>`).join('')}
        <div class="section-title" style="margin-top:16px;font-size:14px">🤖 AI 评估意见</div>
        <div class="ai-answer"><div class="ai-answer-text">${UI.esc(ai.summary)}</div></div>
        ${ai.risks && ai.risks.length ? `<div class="r-tags">${ai.risks.map((x) => `<span class="tag-chip" style="background:var(--amber-soft);color:#C77D0A">⚠️ ${UI.esc(x)}</span>`).join('')}</div>` : ''}
        ${ai.suggestions && ai.suggestions.length ? `<div class="r-tags">${ai.suggestions.map((x) => `<span class="tag-chip" style="background:var(--green-soft);color:var(--green)">💡 ${UI.esc(x)}</span>`).join('')}</div>` : ''}
        ${conflictDims.length ? `
        <div class="section-title" style="margin-top:16px;font-size:14px">建议提前约定的公约</div>
        ${conflictDims.map((k) => {
          const cov = CONFLICT_COV[k] || CONFLICT_COV.clean;
          return `<div class="r-cov"><span>${cov.icon} ${UI.esc(cov.title)}</span><button class="btn btn-purple btn-sm" data-cov-go="${UI.esc(cov.title)}|${UI.esc(cov.content)}|${cov.cat}">发起</button></div>`;
        }).join('')}` : ''}
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-soft" data-close style="flex:1">暂不邀请</button>
          <button class="btn btn-primary" id="r-invite" style="flex:1">🤝 邀请入住</button>
        </div>`;

      report.querySelector('#r-invite').addEventListener('click', () => {
        const id = st.uid();
        st.state().members.push({
          id, name, emoji: '🧑‍🤝‍🧑', color: '#F59E0B', joined: movein || st.todayStr(), left: null, points: 0, tags,
        });
        if (budget) { /* 预算暂存到备注 */ }
        st.save();
        UI.toast(`${name} 已入住，欢迎新室友 🎉`);
        modal.close();
        Router.render(); Router.renderHeader();
      });
    });
  }

  // 委托：建议公约一键发起
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cov-go]');
    if (b) {
      const [title, content, cat] = b.dataset.covGo.split('|');
      const root = document.getElementById('modal-root');
      if (root) root.innerHTML = '';
      Views.covenant.addCovenant({ title: title || '新公约', content: content || '', cat: cat || 'other' });
    }
  });

  window.Views = window.Views || {};
  window.Views.recruit = open;
})();
