/* AI 管家 · Provider 双引擎
   已配置 API Key → 调用真实大模型（OpenAI 兼容接口）
   未配置 / 调用失败 → 自动降级为内置规则模板
   Key 仅存本机浏览器 localStorage，绝不写入代码或上传。 */
(function () {
  'use strict';
  const S = () => Store;

  /* ---------- 厂商配置（OpenAI 兼容 chat/completions） ---------- */
  const PROVIDERS = {
    deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    glm: { name: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4-flash' },
    kimi: { name: 'Kimi (Moonshot)', base: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
    openai: { name: 'OpenAI', base: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
    custom: { name: '自定义（OpenAI 兼容）', base: '', model: '' },
  };

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

  /* ---------- 引擎状态 ---------- */
  const hasKey = () => { const a = Store.state().ai || {}; return !!(a.key && a.key.trim()); };
  function engineCfg() {
    const a = Store.state().ai || {};
    const p = PROVIDERS[a.provider] || PROVIDERS.custom;
    return { provider: a.provider || 'deepseek', base: a.baseUrl || p.base, model: a.model || p.model, key: (a.key || '').trim() };
  }
  const engineLabel = () => hasKey() ? `🟢 真实大模型 · ${engineCfg().model || '已配置'}` : '📦 内置模板引擎（未配置 Key）';

  /* ---------- 大模型调用（20 秒超时保护） ---------- */
  async function chat(system, user) {
    const c = engineCfg();
    if (!hasKey() || !c.base || !c.model) return { error: '未配置 API Key' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(c.base, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.key },
        body: JSON.stringify({
          model: c.model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          temperature: 0.7,
        }),
      });
      clearTimeout(timer);
      if (!r.ok) {
        let msg = 'HTTP ' + r.status;
        if (r.status === 401 || r.status === 403) msg += '（API Key 无效或已过期）';
        if (r.status === 429) msg += '（额度不足或限流）';
        return { error: msg };
      }
      const j = await r.json();
      const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!text) return { error: '模型返回为空' };
      return { text: String(text).trim() };
    } catch (e) {
      clearTimeout(timer);
      return { error: '网络错误：' + (e && e.name === 'AbortError' ? '请求超时（20s）' : (e && e.message ? e.message : '无法连接')) };
    }
  }
  function extractJson(text) {
    try { return JSON.parse(text); } catch (e) { /* noop */ }
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* noop */ } }
    return null;
  }

  /* ---------- 主面板 ---------- */
  let tab = 'script';

  function open() {
    const st = S();
    const body = `
      <div class="ai-head">
        <span class="ai-avatar">🤖</span>
        <div style="flex:1">
          <div class="ai-title">AI 管家</div>
          <div class="ai-sub" id="ai-engine-label">${engineLabel()}</div>
        </div>
        <button class="btn btn-soft btn-sm" id="ai-settings-btn">⚙️ 设置</button>
      </div>
      <div class="ai-tabs">
        <button class="ai-tab ${tab === 'script' ? 'on' : ''}" data-t="script">💬 催收话术</button>
        <button class="ai-tab ${tab === 'covenant' ? 'on' : ''}" data-t="covenant">📜 公约起草</button>
        <button class="ai-tab ${tab === 'split' ? 'on' : ''}" data-t="split">🧮 分摊建议</button>
      </div>
      <div id="ai-panel"></div>`;

    const modal = UI.openModal('', body, '');
    modal.root.querySelector('#ai-settings-btn').addEventListener('click', () => openSettings());
    modal.root.querySelectorAll('.ai-tab').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.t;
      modal.root.querySelectorAll('.ai-tab').forEach((x) => x.classList.toggle('on', x === b));
      renderPanel(st);
    }));
    renderPanel(st);
  }

  function renderPanel(st) {
    const panel = document.getElementById('ai-panel');
    if (!panel) return;
    if (tab === 'script') renderScripts(st, panel);
    else if (tab === 'covenant') renderDrafts(st, panel);
    else renderSplit(st, panel);
  }

  /* ---------- 话术 ---------- */
  function answerBlock(tone, text) {
    return `
      <div class="ai-answer">
        <div class="ai-answer-tone">${tone}</div>
        <div class="ai-answer-text">${UI.esc(text)}</div>
        <button class="btn btn-soft btn-sm ai-copy" data-text="${UI.esc(text)}">📋 复制</button>
      </div>`;
  }
  function localScripts(st, me, t) {
    const other = st.member(t.id);
    if (t.dir === 'in') return [
      { tone: '😊 温和', text: `${other.name}～刚看了眼本月账单，你这边还有 ${st.fmtMoney(t.amount)} 需要转给我，不急哈，方便的时候转就行～` },
      { tone: '😄 幽默', text: `📣 账单快递员上线：${other.name} → ${me.name}，${st.fmtMoney(t.amount)}，到付！支持微信/支付宝，谢谢老板 💸` },
      { tone: '📋 正式', text: `【合租账单】${other.name} 你好，本月结算已生成：请将 ${st.fmtMoney(t.amount)} 转账给 ${me.name}，3 日内完成即可，感谢配合。` },
    ];
    return [
      { tone: '🙏 主动', text: `${other.name}～不好意思刚看到结算单，我这边还欠你 ${st.fmtMoney(t.amount)}，现在转给你哈！` },
      { tone: '📋 正式', text: `【合租账单】${other.name} 你好，本月结算显示我需向你支付 ${st.fmtMoney(t.amount)}，确认无误后将尽快转账，谢谢。` },
    ];
  }
  function scriptPrompt(st, me, t) {
    const other = st.member(t.id);
    const scene = t.dir === 'in'
      ? `室友「${other.name}」欠当前用户「${me.name}」${st.fmtMoney(t.amount)}（催收场景）`
      : `当前用户「${me.name}」欠室友「${other.name}」${st.fmtMoney(t.amount)}（主动还款场景）`;
    return {
      system: '你是「合租生活管家」的 AI 管家，帮助合租室友生成得体、自然、不伤感情的账单话术。你说话友好、像个贴心管家。',
      user: `请为以下场景生成 3 条话术，语气分别为「温和」「幽默」「正式」：\n${scene}\n要求：每条不超过 60 字，中文，称呼直接用名字，语气自然不尴尬。\n只返回 JSON：{"scripts":[{"tone":"温和","text":"..."},{"tone":"幽默","text":"..."},{"tone":"正式","text":"..."}]}`,
    };
  }

  function renderScripts(st, panel) {
    const me = st.currentUser();
    const mk = st.monthKey(st.todayStr());
    const stls = st.settlements(mk);
    const oweMe = stls.filter((t) => t.to === me.id && !t.done);
    const iOwe = stls.filter((t) => t.from === me.id && !t.done);
    const targets = oweMe.map((t) => ({ id: t.from, amount: t.amount, dir: 'in' }))
      .concat(iOwe.map((t) => ({ id: t.to, amount: t.amount, dir: 'out' })));

    if (!targets.length) {
      panel.innerHTML = `<div class="ai-block"><div class="ai-answer"><div class="ai-answer-text">本月没有待结算的往来账目，你们的账目非常干净 🎉</div></div></div>`;
      return;
    }
    panel.innerHTML = targets.map((t) => `
      <div class="ai-block" data-script-for="${t.id}">
        ${localScripts(st, me, t).map((l) => answerBlock(l.tone, l.text)).join('')}
      </div>`).join('');

    // 已配置 Key → 后台请求大模型升级话术
    if (hasKey()) {
      targets.forEach(async (t) => {
        const holder = panel.querySelector(`[data-script-for="${t.id}"]`);
        if (!holder) return;
        const p = scriptPrompt(st, me, t);
        const res = await chat(p.system, p.user);
        if (res.text) {
          const j = extractJson(res.text);
          if (j && Array.isArray(j.scripts) && j.scripts.length) {
            const q = t.dir === 'in'
              ? `✨ 大模型生成 · ${st.memberName(t.id)} 欠我 ${st.fmtMoney(t.amount)}`
              : `✨ 大模型生成 · 我欠 ${st.memberName(t.id)} ${st.fmtMoney(t.amount)}`;
            holder.innerHTML = `<div class="ai-q">${q}</div>` + j.scripts.map((l) => answerBlock(l.tone, l.text)).join('');
          }
        }
        // 失败 → 保持本地模板（静默降级）
      });
    }
  }

  /* ---------- 公约起草 ---------- */
  function draftCard(j, tag) {
    return `
      <div class="ai-draft">
        <div class="ai-draft-head">${j.icon || '📜'} ${UI.esc(j.title)} ${tag ? `<span class="badge badge-purple" style="margin-left:6px">${tag}</span>` : ''}</div>
        <div class="ai-draft-body">${UI.esc(j.content)}</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-purple btn-sm" data-draft-go="${UI.esc(j.title)}|${UI.esc(j.content)}">以此发起投票</button>
        </div>
      </div>`;
  }

  function renderDrafts(st, panel) {
    panel.innerHTML = `
      <div class="ai-block">
        <div class="ai-q">✍️ 描述你想要的公约（如：关于厨房卫生），AI 为你起草；或直接选用下方模板 👇</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input class="f-input" id="ai-draft-input" placeholder="例：周末可以带朋友来家里吗" style="flex:1">
          <button class="btn btn-purple" id="ai-draft-btn">AI 起草</button>
        </div>
        <div id="ai-draft-result"></div>
      </div>
      <div class="ai-block">
        <div class="ai-q">📚 社区高频模板（点击即可发起投票）</div>
        ${THEMES.map((th) => `
          <div class="ai-draft">
            <div class="ai-draft-head">${th.icon} ${UI.esc(th.title)}</div>
            <div class="ai-draft-body">${UI.esc(th.content)}</div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn btn-purple btn-sm" data-draft="${th.key}">以此发起投票</button>
            </div>
          </div>`).join('')}
      </div>`;

    const btn = panel.querySelector('#ai-draft-btn');
    const input = panel.querySelector('#ai-draft-input');
    btn.addEventListener('click', async () => {
      const topic = input.value.trim();
      const result = panel.querySelector('#ai-draft-result');
      if (!topic) { UI.toast('请先描述公约主题', '⚠️'); return; }
      result.innerHTML = `<div class="ai-answer"><div class="ai-answer-text">🤖 正在起草…</div></div>`;
      if (hasKey()) {
        const res = await chat(
          '你是「合租生活管家」的 AI 管家，擅长起草合租公约。公约要求：具体、可执行、语气友好、不指责。',
          `请为合租家庭起草一条公约，主题描述：「${topic}」。要求：标题 15 字以内；正文 60-100 字，包含明确的执行标准。只返回 JSON：{"title":"...","content":"..."}`
        );
        if (res.text) {
          const j = extractJson(res.text);
          if (j && j.title && j.content) {
            result.innerHTML = draftCard(j, 'AI 生成');
            return;
          }
        }
        UI.toast(res.error ? 'AI 调用失败，已使用内置模板' : 'AI 返回格式异常，已使用内置模板', '⚠️');
      }
      // 降级：关键词匹配本地模板
      const kw = topic;
      const hit = THEMES.find((th) => kw.includes('安静') && th.key === 'sleep')
        || THEMES.find((th) => kw.includes('卫生') && th.key === 'clean')
        || THEMES.find((th) => (kw.includes('水电') || kw.includes('费用') || kw.includes('燃气')) && th.key === 'fee')
        || THEMES.find((th) => (kw.includes('宠物') || kw.includes('猫') || kw.includes('狗')) && th.key === 'pet')
        || THEMES.find((th) => (kw.includes('朋友') || kw.includes('访客') || kw.includes('过夜')) && th.key === 'guest')
        || THEMES[1];
      result.innerHTML = draftCard(hit, '内置模板');
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
  }

  /* ---------- 分摊建议 ---------- */
  function renderSplit(st, panel) {
    panel.innerHTML = `
      <div class="ai-block">
        <div class="ai-q">选一种账单类型，我给出最公平的分摊方式建议${hasKey() ? '；点「AI 分析」可获得结合我们家情况的深入建议' : ''} 👇</div>
        ${Object.keys(st.BILL_TYPES).map((k) => {
          const t = st.BILL_TYPES[k];
          const sug = SPLIT_SUG[k] || SPLIT_SUG.other;
          return `
          <div class="ai-draft">
            <div class="ai-draft-head">${t.icon} ${t.name} → <b style="color:var(--brand)">${st.SPLIT_NAMES[sug.mode]}</b></div>
            <div class="ai-draft-body" id="reason-${k}">${UI.esc(sug.reason)}</div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn btn-green btn-sm" data-bill="${k}" data-mode="${sug.mode}">按此方式记账</button>
              ${hasKey() ? `<button class="btn btn-soft btn-sm" data-ai-split="${k}">🤖 AI 分析</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  /* ---------- 事件委托 ---------- */
  document.addEventListener('click', (e) => {
    const cp = e.target.closest('.ai-copy');
    if (cp) UI.copyText(cp.dataset.text);

    const dr = e.target.closest('[data-draft]');
    if (dr) {
      const th = THEMES.find((x) => x.key === dr.dataset.draft);
      if (th) { clearModal(); Views.covenant.addCovenant({ title: th.title, content: th.content, cat: th.key === 'fee' ? 'fee' : th.key === 'clean' ? 'clean' : th.key === 'sleep' ? 'sleep' : th.key === 'pet' ? 'pet' : 'other' }); }
    }
    const dg = e.target.closest('[data-draft-go]');
    if (dg) {
      const [title, content] = dg.dataset.draftGo.split('|');
      clearModal();
      Views.covenant.addCovenant({ title: title || '新公约', content: content || '' });
    }
    const bl = e.target.closest('[data-bill]');
    if (bl) { clearModal(); Views.expenses.addBill({ split: bl.dataset.mode }); }

    const as = e.target.closest('[data-ai-split]');
    if (as) {
      const st = S();
      const k = as.dataset.aiSplit;
      const t = st.BILL_TYPES[k];
      const reasonEl = document.getElementById('reason-' + k);
      if (!reasonEl) return;
      reasonEl.textContent = '🤖 正在分析…';
      (async () => {
        const actives = st.activeMembers();
        const res = await chat(
          '你是合租费用分摊专家，建议要公平且贴合实际情况。',
          `合租家庭要记一笔「${t.name}」。成员情况：${actives.map((m) => `${m.name}（入住 ${st.inHomeDays(m)} 天）`).join('、')}。请推荐分摊方式：equal（AA均摊）/ perDay（按入住天数）/ custom（自定义），并给一句 30 字内的理由。只返回 JSON：{"mode":"equal|perDay|custom","reason":"..."}`
        );
        if (res.text) {
          const j = extractJson(res.text);
          if (j && j.mode && j.reason) {
            reasonEl.textContent = '✨ AI：' + j.reason;
            const btn = document.querySelector(`[data-bill="${k}"]`);
            if (btn) { btn.dataset.mode = j.mode; btn.textContent = '按 AI 建议记账'; }
            return;
          }
        }
        reasonEl.textContent = SPLIT_SUG[k] ? SPLIT_SUG[k].reason : SPLIT_SUG.other.reason;
        UI.toast('AI 分析失败，已展示内置建议', '⚠️');
      })();
    }
  });

  function clearModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
  }

  /* ---------- AI 设置 ---------- */
  function openSettings() {
    const st = S();
    const a = st.state().ai || {};
    const body = `
      ${UI.fGroup('模型厂商', UI.fSelect('ai-provider', Object.keys(PROVIDERS).map((k) => ({ value: k, label: PROVIDERS[k].name })), a.provider || 'deepseek'))}
      ${UI.fGroup('接口地址', UI.fInput('ai-base', a.baseUrl || PROVIDERS[a.provider]?.base || '', 'https://api.xxx.com/chat/completions'))}
      ${UI.fGroup('模型名称', UI.fInput('ai-model', a.model || PROVIDERS[a.provider]?.model || '', '如 deepseek-chat'))}
      ${UI.fGroup('API Key', `<input class="f-input" id="ai-key" type="password" value="${UI.esc(a.key || '')}" placeholder="sk-...">`, '🔒 Key 仅保存在你本机浏览器 localStorage，不会上传到任何服务器；不配置时自动使用内置模板引擎。')}
      <div class="ai-sec-note">💡 国内推荐 <b>DeepSeek</b>（deepseek-chat，价格极低）或 <b>智谱 GLM</b>（glm-4-flash 有免费额度）。填写后 AI 管家的三个能力都将由真实大模型生成。</div>`;
    const modal = UI.openModal('⚙️ AI 设置', body,
      `<button class="btn btn-soft" data-close>取消</button><button class="btn btn-soft" id="ai-test">测试连接</button><button class="btn btn-primary" id="ai-save">保存</button>`);
    const provSel = modal.root.querySelector('#ai-provider');
    provSel.addEventListener('change', () => {
      const p = PROVIDERS[provSel.value];
      modal.root.querySelector('#ai-base').value = p ? p.base : '';
      modal.root.querySelector('#ai-model').value = p ? p.model : '';
    });
    modal.root.querySelector('#ai-test').addEventListener('click', async () => {
      saveCfg(modal.root);
      const btn = modal.root.querySelector('#ai-test');
      btn.textContent = '测试中…';
      const res = await chat('你是合租生活管家 AI。', '请只回复四个字：连接成功');
      btn.textContent = '测试连接';
      if (res.text) UI.toast('✅ 连接成功：' + res.text.slice(0, 12));
      else UI.toast('连接失败：' + (res.error || '未知错误'), '⚠️');
    });
    modal.submit('#ai-save', (root) => {
      saveCfg(root);
      UI.toast('AI 设置已保存（仅存本机）', '✅');
      const label = document.getElementById('ai-engine-label');
      if (label) label.textContent = engineLabel();
    });
  }
  function saveCfg(root) {
    const st = S();
    st.state().ai = st.state().ai || {};
    const a = st.state().ai;
    a.provider = UI.val('ai-provider') || 'deepseek';
    a.baseUrl = UI.val('ai-base');
    a.model = UI.val('ai-model');
    a.key = UI.val('ai-key');
    st.save();
  }

  window.Views = window.Views || {};
  window.Views.ai = open;
  window.Views.aiSettings = openSettings;
})();
