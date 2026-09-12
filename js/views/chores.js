/* 值日视图：今日值日打卡 / 本周排班 / 任务管理 / 积分榜 */
(function () {
  'use strict';
  const S = () => Store;

  function render(el) {
    const st = S();
    const me = st.currentUser();
    const tds = st.todayDuties();
    const week = st.weekPlan();
    const ranked = st.activeMembers().slice().sort((a, b) => b.points - a.points);
    const myRank = ranked.findIndex((m) => m.id === me.id) + 1;

    el.innerHTML = `
    <div class="view-anim">
      <div class="duty-hero">
        <div class="dh-title">📅 ${st.WEEK_CN[new Date().getDay()]} · ${st.todayStr()} · 🔥 全屋连续值日 <b>${st.houseStreak()}</b> 天</div>
        <div class="dh-name">今日值日 ${tds.length ? '· ' + tds.filter((t) => !t.done).length + ' 项待完成' : '· 无任务'}</div>
        ${tds.length ? tds.map((t) => `
          <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.16);border-radius:12px;padding:10px 12px;margin-bottom:8px">
            <span style="font-size:18px">${t.chore.icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700">${UI.esc(t.chore.title)}</div>
              <div style="font-size:11.5px;opacity:.85">值日人：${UI.esc(st.memberName(t.memberId))} · +${t.chore.points} 积分${t.memberId === me.id ? '（轮到你啦）' : ''}</div>
            </div>
            ${t.done
              ? `<span style="font-size:12px;font-weight:700;background:rgba(255,255,255,.3);padding:5px 10px;border-radius:8px">已完成 ✓</span>`
              : `<div style="display:flex;gap:6px">
                  <button class="btn btn-sm" style="background:#fff;color:#2E86AB" data-do="${t.chore.id}">${t.memberId === me.id ? '打卡 ✓' : '代打卡'}</button>
                  ${t.memberId === me.id ? `<button class="btn btn-sm" style="background:rgba(255,255,255,.25);color:#fff" data-leave="${t.chore.id}">请假</button>` : ''}
                </div>`}
          </div>`).join('')
        : `<div style="background:rgba(255,255,255,.16);border-radius:12px;padding:14px;text-align:center">🎉 今天没有值日任务，好好休息～</div>`}
      </div>

      <div class="sec">
        <div class="section-title">🗓️ 本周排班</div>
        <div class="week-strip">
          ${week.map((d) => {
            const dd = st.parse(d.date);
            const isToday = d.date === st.todayStr();
            return `
            <div class="week-day ${isToday ? 'today' : ''}">
              <div class="wd-title">${isToday ? '今天' : st.WEEK_CN[dd.getDay()]} <span style="color:var(--ink3);font-weight:500;font-size:11px">${(dd.getMonth() + 1) + '/' + dd.getDate()}</span></div>
              ${d.duties.length ? d.duties.map((x) => `
                <div class="wd-item" style="${x.done ? 'opacity:.5' : ''}">${x.done ? '✅' : x.chore.icon} ${UI.esc(st.memberName(x.memberId))}</div>`).join('')
              : `<div class="wd-item" style="color:var(--ink3)">— 休息 —</div>`}
            </div>`;
          }).join('')}
        </div>
        <div class="f-hint" style="padding-left:4px">💡 系统按成员顺序自动轮值；成员退租后自动从轮值名单中移除。</div>
      </div>

      <div class="sec">
        <div class="section-title">📋 值日任务 <span class="more">${st.state().chores.length} 项</span></div>
        ${st.state().chores.map(choreRow).join('')}
        <button class="btn btn-outline btn-block" id="btn-add-chore">＋ 添加值日任务</button>
      </div>

      <div class="sec">
        <div class="section-title">🏆 积分榜 <span class="more">我的排名：#${myRank}</span></div>
        ${ranked.map((m, i) => `
          <div class="rank-row">
            <span class="rank-no ${i === 0 ? 'no1' : i === 1 ? 'no2' : i === 2 ? 'no3' : ''}">${i + 1}</span>
            ${UI.avatar(m, 'md')}
            <div class="li-main">
              <div class="li-title">${UI.esc(m.name)}</div>
              <div class="li-sub">入住 ${st.inHomeDays(m)} 天</div>
            </div>
            <span class="rank-pts">${m.points} 分</span>
          </div>`).join('')}
        <div class="f-hint" style="padding-left:4px">💡 完成打卡即可获得对应积分；积分可在室友间互相激励，未来可兑换「免值日券」。</div>
      </div>
    </div>`;

    el.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', () => {
      const r = st.doChore(b.dataset.do, st.currentUser().id);
      if (r) UI.toast(`${st.memberName(r.assignee)} +${r.points} 积分${r.assignee !== st.currentUser().id ? '（代打卡）' : ''}`, '🎉');
      render(el);
    }));
    el.querySelectorAll('[data-leave]').forEach((b) => b.addEventListener('click', () => {
      st.requestLeave(b.dataset.leave, st.currentUser().id);
      UI.toast('已请假，任务自动顺延给下一位值日人 🙏');
      render(el);
    }));
    const addBtn = el.querySelector('#btn-add-chore');
    if (addBtn) addBtn.addEventListener('click', () => addChore());
  }

  function freqLabel(c) {
    if (c.monthly) return '每月 1 日';
    if (c.weekdays.length === 7) return '每天';
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    return '每周 ' + c.weekdays.map((w) => names[w]).join('、');
  }

  function choreRow(c) {
    const st = S();
    const next = st.nextDuty(c);
    const doneCount = c.history.length;
    return `
    <div class="list-item">
      <span class="li-ic" style="background:#E9F1FF">${c.icon}</span>
      <div class="li-main">
        <div class="li-title">${UI.esc(c.title)}</div>
        <div class="li-sub">${freqLabel(c)} · 已完成 ${doneCount} 次 · +${c.points} 分/次</div>
      </div>
      <div class="li-right">
        <div class="li-tag" style="font-weight:700;color:var(--blue)">下次 ${next ? next.date.slice(5) : '—'}</div>
        <div class="li-tag">${next ? st.memberName(next.memberId) : '—'} 值日</div>
      </div>
    </div>`;
  }

  /* ---------- 添加任务 ---------- */
  function addChore() {
    const st = S();
    const actives = st.activeMembers();
    const DOW = [
      { v: '1', l: '周一' }, { v: '2', l: '周二' }, { v: '3', l: '周三' }, { v: '4', l: '周四' },
      { v: '5', l: '周五' }, { v: '6', l: '周六' }, { v: '0', l: '周日' },
    ];
    const body = `
      ${UI.fGroup('任务名称', UI.fInput('c-title', '', '如：客厅拖地'))}
      ${UI.fGroup('图标', UI.fEmojiPick('c-ic', ['🧹', '🍳', '🚿', '🗑️', '🧊', '🪴', '🧺', '🛋️', '🚽', '🐱'], '🧹'))}
      ${UI.fGroup('频率', UI.fSeg('c-freq', [{ value: 'daily', label: '每天' }, { value: 'weekly', label: '每周几天' }, { value: 'monthly', label: '每月1日' }], 'weekly'))}
      <div id="c-dow" class="f-group">
        <label class="f-label">选择星期</label>
        <div class="chip-row" id="c-dow-row">${DOW.map((d) => `<button type="button" class="chip" data-w="${d.v}">${d.l}</button>`).join('')}</div>
      </div>
      ${UI.fGroup('每次积分', UI.fInput('c-pts', '5', '', 'number'))}
      ${UI.fGroup('轮值顺序（按顺序自动轮换）', UI.fMemberPick('c-rot', actives, null))}
    `;
    const modal = UI.openModal('🧹 添加值日任务', body,
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="c-save">保存任务</button>`);

    const picked = new Set();
    modal.root.querySelectorAll('#c-dow-row .chip').forEach((ch) => ch.addEventListener('click', () => {
      const w = ch.dataset.w;
      if (picked.has(w)) { picked.delete(w); ch.classList.remove('on'); } else { picked.add(w); ch.classList.add('on'); }
    }));
    let freq = 'weekly';
    UI.bindSeg('c-freq', (v) => {
      freq = v;
      document.getElementById('c-dow').style.display = v === 'weekly' ? 'block' : 'none';
    });
    let icon = '🧹';
    UI.bindEmojiPick('c-ic', (e) => { icon = e; });
    UI.bindMemberPick('c-rot', () => {});

    modal.submit('#c-save', (root) => {
      const title = UI.val('c-title');
      if (!title) { UI.toast('请输入任务名称', '⚠️'); return false; }
      let weekdays = [];
      if (freq === 'daily') weekdays = [0, 1, 2, 3, 4, 5, 6];
      else if (freq === 'weekly') weekdays = Array.from(picked).map(Number);
      if (freq === 'weekly' && !weekdays.length) { UI.toast('请选择至少一个星期', '⚠️'); return false; }
      const rotEl = root.querySelector('.member-pick');
      const rotation = actives.map((m) => m.id); // 默认按成员顺序
      st.state().chores.push({
        id: st.uid(), title, area: '', icon, weekdays, monthly: freq === 'monthly',
        points: UI.num('c-pts') || 5, rotation, start: st.todayStr(), history: [],
      });
      st.save(); UI.toast('值日任务已创建，明天起自动排班');
      Router.render();
    });
  }

  window.Views = window.Views || {};
  window.Views.chores = { render, addChore };
})();
