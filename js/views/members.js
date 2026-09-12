/* 成员视图：室友管理 / 身份切换 / 数据管理（重置/导出/导入） */
(function () {
  'use strict';
  const S = () => Store;
  const EMOJIS = ['🦌', '🐯', '🐱', '🐻', '🐰', '🦊', '🐶', '🐼', '🐨', '🦁', '🐷', '🐸'];
  const COLORS = ['#FF8A65', '#4DB6AC', '#9575CD', '#64B5F6', '#F06292', '#FFB74D', '#81C784', '#A1887F'];
  const TAG_OPTS = {
    sleep: ['早睡早起', '晚睡', '熬夜党', '随缘'],
    clean: ['爱整洁', '随性', '轻度洁癖'],
    pet: ['无', '有猫', '有狗', '其他宠物'],
    smoke: ['不烟不酒', '偶尔小酌', '抽烟'],
    social: ['偏i人', '偏e人', '介于两者'],
  };

  function open() {
    const st = S();
    const me = st.currentUser();
    const members = st.state().members;
    const modal = UI.openModal(
      '👥 室友管理',
      `
      <div class="f-hint" style="margin:-6px 0 12px">🤝 生活标签 + 合拍指数：借鉴 Wellcee 找室友标签体系，新室友入住前可先看画像评估是否同频。</div>
      <div style="margin-bottom:14px">${members.map((m) => {
        const cp = m.id !== me.id ? st.compatScore(me.id, m.id) : null;
        return `
        <div class="mem-card" style="${m.id === me.id ? 'border:1.5px solid var(--brand)' : ''}">
          ${UI.avatar(m, 'md')}
          <div class="mem-info">
            <div class="mem-name">${UI.esc(m.name)} ${m.id === me.id ? '<span class="badge badge-amber" style="margin-left:4px">当前身份</span>' : ''}${m.left ? '<span class="badge badge-gray" style="margin-left:4px">已退租</span>' : ''}</div>
            <div class="mem-sub">${m.left ? m.joined + ' ~ ' + m.left : '入住 ' + st.inHomeDays(m) + ' 天'} · ${m.points} 积分</div>
            <div class="mem-tags">
              ${Object.values(m.tags || {}).filter((t) => t && t !== '—').slice(0, 3).map((t) => `<span class="tag-chip">${UI.esc(t)}</span>`).join('')}
              ${cp !== null ? `<span class="tag-chip compat ${cp >= 60 ? 'hi' : cp >= 40 ? 'mid' : ''}">🤝 与我合拍 ${cp}%</span>` : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${m.id !== me.id && !m.left ? `<button class="btn btn-soft btn-sm" data-switch="${m.id}">设为当前</button>` : ''}
            <button class="btn btn-outline btn-sm" data-edit="${m.id}">编辑</button>
            ${!m.left ? `<button class="btn btn-sm" style="background:var(--red-soft);color:var(--red)" data-leave="${m.id}">退租</button>` : ''}
          </div>
        </div>`;
      }).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" id="m-add" style="flex:1">＋ 添加室友</button>
        <button class="btn btn-purple" id="m-recruit" style="flex:1">🤝 找室友评估</button>
      </div>

      <div class="section-title" style="margin-top:22px">🏠 共享之家（云同步）</div>
      <div id="cloud-panel"></div>
      <button class="btn btn-outline btn-block" id="m-add">＋ 添加室友</button>

      <div class="section-title" style="margin-top:22px">🗄️ 数据与设置</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-soft btn-block" id="m-ai">🤖 AI 管家设置（接入真实大模型）</button>
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
      const ls = st.leaveSettlement(m.id);
      UI.openModal('🚪 退租确认',
        `<p style="font-size:14px;color:var(--ink2)">确认 <b>${UI.esc(m.name)}</b> 退租？</p>
         <p style="font-size:13px;color:var(--ink3);margin-top:8px">退租后：自动退出值日轮值与后续分摊，费用按退租日期精确结算。</p>
         <div class="leave-settle">
           <div><span>押金份额</span><b>+ ${st.fmtMoney(ls.share)}</b></div>
           <div><span>未结清欠款</span><b style="color:var(--red)">- ${st.fmtMoney(ls.debt)}</b></div>
           <div class="ls-total"><span>应退金额</span><b>${st.fmtMoney(ls.refund)}</b></div>
         </div>`,
        `<button class="btn btn-soft" data-close>取消</button><button class="btn" style="background:var(--red-soft);color:var(--red)" id="leave-ok">确认退租</button>`
      ).submit('#leave-ok', () => {
        m.left = st.todayStr(); st.save();
        UI.toast(`${m.name} 已办理退租，清算单：应退 ${st.fmtMoney(st.leaveSettlement(m.id).refund)}`);
        modal.close(); Router.render(); Router.renderHeader();
      });
    }));
    modal.root.querySelector('#m-add').addEventListener('click', () => addMember());
    modal.root.querySelector('#m-recruit').addEventListener('click', () => Views.recruit());
    modal.root.querySelector('#m-ai').addEventListener('click', () => Views.aiSettings());
    renderCloudPanel(modal.root.querySelector('#cloud-panel'), modal);
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

  /* ---------- 共享之家（云同步）面板 ---------- */
  function renderCloudPanel(el, modal) {
    if (!el) return;
    const st = S();
    const joined = Cloud.isJoined();
    if (!joined) {
      el.innerHTML = `
        <div class="cloud-card">
          <p class="cloud-desc">把家搬上云端：室友输入邀请码加入后，<b>账本 · 值日 · 库存 · 公约实时共享</b>，谁记的账大家都能看到。</p>
          <button class="btn btn-primary btn-block" id="c-create">🏠 创建共享之家</button>
          <div style="display:flex;gap:6px;margin-top:8px">
            <input class="f-input" id="c-code" placeholder="输入 6 位邀请码" maxlength="6" style="text-transform:uppercase;flex:1">
            <button class="btn btn-green" id="c-join">加入</button>
          </div>
        </div>`;
      el.querySelector('#c-create').addEventListener('click', async () => { await Cloud.createHome(); renderCloudPanel(el, modal); Router.renderHeader(); });
      const joinBtn = el.querySelector('#c-join');
      const codeInput = el.querySelector('#c-code');
      const doJoin = async () => {
        const code = codeInput.value.trim().toUpperCase();
        if (code.length !== 6) { UI.toast('请输入 6 位邀请码', '⚠️'); return; }
        const okr = await Cloud.joinHome(code);
        if (okr) { modal.close(); Router.render(); Router.renderHeader(); }
      };
      joinBtn.addEventListener('click', doJoin);
      codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
      return;
    }
    const c = st.state().cloud;
    const online = Cloud.status.online || [];
    const inviteLink = 'https://fudimo123.github.io/hezu-life-manager/#/app?join=' + c.code;
    el.innerHTML = `
      <div class="cloud-card joined">
        <div class="cloud-code-row">
          <span class="cloud-label">邀请码</span>
          <b>${UI.esc(c.code)}</b>
          <button class="btn btn-soft btn-sm" id="c-copy">复制邀请链接</button>
        </div>
        <div class="cloud-status-row">
          <span>🟢 已连接 · 版本 v${c.version}</span>
          <span>${Cloud.status.error ? '⚠️ ' + UI.esc(Cloud.status.error) : (c.lastSync ? (Math.round((Date.now() - c.lastSync) / 1000) + 's 前同步') : '')}</span>
        </div>
        <div class="cloud-online">
          在线成员：${online.length
            ? online.map((id) => { const m = st.member(id); return m ? m.emoji + ' ' + UI.esc(m.name) : ''; }).filter(Boolean).join(' · ')
            : '暂无其他设备在线'}
        </div>
        <button class="btn btn-block" style="background:var(--red-soft);color:var(--red);margin-top:8px" id="c-leave">退出共享之家</button>
      </div>`;
    el.querySelector('#c-copy').addEventListener('click', () => UI.copyText('🏠 邀请你加入我们的合租生活管家共享之家，邀请码：' + c.code + '，或直接打开链接加入：' + inviteLink));
    el.querySelector('#c-leave').addEventListener('click', () => {
      UI.openModal('👋 退出共享之家', '<p style="font-size:14px;color:var(--ink2)">退出后本机数据保留，但不再与云端同步。确定退出？</p>',
        `<button class="btn btn-soft" data-close>取消</button><button class="btn" style="background:var(--red-soft);color:var(--red)" id="c-leave-ok">确认退出</button>`
      ).submit('#c-leave-ok', () => { Cloud.leaveHome(); renderCloudPanel(el, modal); Router.renderHeader(); });
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
    const tags = m.tags || { sleep: '随缘', clean: '随性', pet: '无', smoke: '不烟不酒', social: '介于两者' };
    const body = `
      ${UI.fGroup('昵称', UI.fInput('e-name', m.name))}
      ${UI.fGroup('头像', UI.fEmojiPick('e-emoji', EMOJIS, emoji))}
      ${UI.fGroup('颜色', `<div class="emoji-pick" id="e-color">${COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}${c === color ? ';outline:2px solid var(--ink)' : ''}"></button>`).join('')}</div>`)}
      ${UI.fGroup('入住日期', UI.fInput('e-joined', m.joined, '', 'date'))}
      <div style="font-size:13px;font-weight:800;margin:16px 0 10px">🏷️ 生活习惯标签 <span style="color:var(--ink3);font-weight:500;font-size:11.5px">（用于室友画像与合拍指数）</span></div>
      ${Object.keys(st.TAG_DIMS).map((k) => UI.fGroup(st.TAG_DIMS[k], UI.fSelect('t-' + k, TAG_OPTS[k].map((v) => ({ value: v, label: v })), tags[k] || TAG_OPTS[k][0]))).join('')}
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
      m.tags = {};
      Object.keys(st.TAG_DIMS).forEach((k) => { m.tags[k] = UI.val('t-' + k) || tags[k]; });
      st.save(); UI.toast('已保存，合拍指数已更新');
      Router.render(); Router.renderHeader();
    });
  }

  window.Views = window.Views || {};
  window.Views.membersDrawer = open;
})();
