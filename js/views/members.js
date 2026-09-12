/* 成员视图：室友管理 / 身份切换 / 数据管理（重置/导出/导入） */
(function () {
  'use strict';
  const S = () => Store;
  const EMOJIS = ['🦌', '🐯', '🐱', '🐻', '🐰', '🦊', '🐶', '🐼', '🐨', '🦁', '🐷', '🐸'];
  const COLORS = ['#FF8A65', '#4DB6AC', '#9575CD', '#64B5F6', '#F06292', '#FFB74D', '#81C784', '#A1887F'];

  function open() {
    const st = S();
    const me = st.currentUser();
    const members = st.state().members;
    const modal = UI.openModal(
      '👥 室友管理',
      `
      <div style="margin-bottom:14px">${members.map((m) => `
        <div class="mem-card" style="${m.id === me.id ? 'border:1.5px solid var(--brand)' : ''}">
          ${UI.avatar(m, 'md')}
          <div class="mem-info">
            <div class="mem-name">${UI.esc(m.name)} ${m.id === me.id ? '<span class="badge badge-amber" style="margin-left:4px">当前身份</span>' : ''}${m.left ? '<span class="badge badge-gray" style="margin-left:4px">已退租</span>' : ''}</div>
            <div class="mem-sub">${m.left ? m.joined + ' ~ ' + m.left : '入住 ' + st.inHomeDays(m) + ' 天'} · ${m.points} 积分 · ${m.joined} 入住</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${m.id !== me.id && !m.left ? `<button class="btn btn-soft btn-sm" data-switch="${m.id}">设为当前</button>` : ''}
            <button class="btn btn-outline btn-sm" data-edit="${m.id}">编辑</button>
            ${!m.left ? `<button class="btn btn-sm" style="background:var(--red-soft);color:var(--red)" data-leave="${m.id}">退租</button>` : ''}
          </div>
        </div>`).join('')}
      </div>
      <button class="btn btn-outline btn-block" id="m-add">＋ 添加室友</button>

      <div class="section-title" style="margin-top:22px">🗄️ 数据管理</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-soft btn-block" id="m-export">📤 导出数据备份（JSON）</button>
        <button class="btn btn-soft btn-block" id="m-import">📥 导入数据备份</button>
        <button class="btn btn-block" style="background:var(--red-soft);color:var(--red)" id="m-reset">🔄 重置为演示数据</button>
      </div>
      <div style="margin-top:18px;font-size:12px;color:var(--ink3);line-height:1.7">
        🏠 合租生活管家 · 纯前端 Demo<br>
        数据仅存储于当前浏览器 localStorage，不会上传。<br>
        <a href="#/" style="color:var(--blue)">← 返回产品介绍页</a>
      </div>
      <input type="file" id="m-file" accept=".json" style="display:none">`,
      ''
    );

    modal.root.querySelectorAll('[data-switch]').forEach((b) => b.addEventListener('click', () => {
      st.state().currentUserId = b.dataset.switch; st.save();
      UI.toast(`已切换身份：${st.memberName(b.dataset.switch)}`, '👤');
      modal.close(); Router.render(); Router.renderHeader();
    }));
    modal.root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editMember(b.dataset.edit)));
    modal.root.querySelectorAll('[data-leave]').forEach((b) => b.addEventListener('click', () => {
      const m = st.member(b.dataset.leave);
      UI.openModal('🚪 退租确认',
        `<p style="font-size:14px;color:var(--ink2)">确认 <b>${UI.esc(m.name)}</b> 退租？</p>
         <p style="font-size:13px;color:var(--ink3);margin-top:8px">退租后：自动退出值日轮值与后续分摊，费用按退租日期精确结算。</p>`,
        `<button class="btn btn-soft" data-close>取消</button><button class="btn" style="background:var(--red-soft);color:var(--red)" id="leave-ok">确认退租</button>`
      ).submit('#leave-ok', () => {
        m.left = st.todayStr(); st.save();
        UI.toast(`${m.name} 已办理退租，账单按天结算`);
        modal.close(); Router.render(); Router.renderHeader();
      });
    }));
    modal.root.querySelector('#m-add').addEventListener('click', () => addMember());
    modal.root.querySelector('#m-export').addEventListener('click', () => { st.exportData(); UI.toast('数据已导出'); });
    modal.root.querySelector('#m-import').addEventListener('click', () => modal.root.querySelector('#m-file').click());
    modal.root.querySelector('#m-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try { st.importData(r.result); UI.toast('数据导入成功'); modal.close(); Router.render(); Router.renderHeader(); }
        catch (err) { UI.toast('导入失败：' + err.message, '⚠️'); }
      };
      r.readAsText(f);
    });
    modal.root.querySelector('#m-reset').addEventListener('click', () => {
      UI.openModal('🔄 重置演示数据', `<p style="font-size:14px;color:var(--ink2)">将清空当前所有数据并恢复为初始演示数据，确定？</p>`,
        `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="reset-ok">确认重置</button>`
      ).submit('#reset-ok', () => {
        st.reset(); UI.toast('已恢复演示数据', '🔄');
        modal.close(); Router.render(); Router.renderHeader();
      });
    });
  }

  function addMember() {
    const st = S();
    let emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    let color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const body = `
      ${UI.fGroup('昵称', UI.fInput('a-name', '', '如：小新'))}
      ${UI.fGroup('头像', UI.fEmojiPick('a-emoji', EMOJIS, emoji))}
      ${UI.fGroup('颜色', `<div class="emoji-pick" id="a-color">${COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}${c === color ? ';outline:2px solid var(--ink)' : ''}"></button>`).join('')}</div>`)}
      ${UI.fGroup('入住日期', UI.fInput('a-joined', st.todayStr(), '', 'date'), '💡 入住日期用于「按天分摊」与值日轮值计算，中途入住自动按天折算费用。')}
    `;
    const modal = UI.openModal('👤 添加室友', body,
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="a-save">添加</button>`);
    UI.bindEmojiPick('a-emoji', (e) => { emoji = e; });
    const cg = modal.root.querySelector('#a-color');
    cg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      cg.querySelectorAll('button').forEach((x) => x.style.outline = 'none');
      b.style.outline = '2px solid var(--ink)';
      color = b.dataset.c;
    });
    modal.submit('#a-save', (root) => {
      const name = UI.val('a-name');
      if (!name) { UI.toast('请输入昵称', '⚠️'); return false; }
      st.state().members.push({
        id: st.uid(), name, emoji, color,
        joined: UI.val('a-joined') || st.todayStr(), left: null, points: 0,
      });
      st.save(); UI.toast(`${name} 已入住，欢迎新室友 🎉`);
      Router.render(); Router.renderHeader();
    });
  }

  function editMember(id) {
    const st = S();
    const m = st.member(id);
    if (!m) return;
    let emoji = m.emoji, color = m.color;
    const body = `
      ${UI.fGroup('昵称', UI.fInput('e-name', m.name))}
      ${UI.fGroup('头像', UI.fEmojiPick('e-emoji', EMOJIS, emoji))}
      ${UI.fGroup('颜色', `<div class="emoji-pick" id="e-color">${COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}${c === color ? ';outline:2px solid var(--ink)' : ''}"></button>`).join('')}</div>`)}
      ${UI.fGroup('入住日期', UI.fInput('e-joined', m.joined, '', 'date'))}
    `;
    const modal = UI.openModal(`✏️ 编辑 · ${UI.esc(m.name)}`, body,
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-primary" id="e-save">保存</button>`);
    UI.bindEmojiPick('e-emoji', (e) => { emoji = e; });
    const cg = modal.root.querySelector('#e-color');
    cg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      cg.querySelectorAll('button').forEach((x) => x.style.outline = 'none');
      b.style.outline = '2px solid var(--ink)';
      color = b.dataset.c;
    });
    modal.submit('#e-save', (root) => {
      const name = UI.val('e-name');
      if (!name) { UI.toast('请输入昵称', '⚠️'); return false; }
      m.name = name; m.emoji = emoji; m.color = color; m.joined = UI.val('e-joined') || m.joined;
      st.save(); UI.toast('已保存');
      Router.render(); Router.renderHeader();
    });
  }

  window.Views = window.Views || {};
  window.Views.membersDrawer = open;
})();
