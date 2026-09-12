/* ============================================================
   合租生活管家 · 数据层 store.js
   数据模型 + 演示数据 + 核心算法（分摊/结算/轮值/库存/投票）
   数据持久化于 localStorage（key: hezu-life-v1）
============================================================ */
(function () {
  'use strict';

  const KEY = 'hezu-life-v1';

  /* ---------- 基础工具 ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const todayStr = () => fmtDate(today());
  const daysAgo = (n) => { const d = today(); d.setDate(d.getDate() - n); return fmtDate(d); };
  const daysAfter = (n) => { const d = today(); d.setDate(d.getDate() + n); return fmtDate(d); };
  const dateAdd = (dateStr, n) => { const d = parse(dateStr); d.setDate(d.getDate() + n); return fmtDate(d); };
  const monthAgoFirst = (k) => { const d = today(); d.setDate(1); d.setMonth(d.getMonth() - k); return fmtDate(d); };
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const monthKey = (dateStr) => dateStr.slice(0, 7);
  const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);
  const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const fmtMoney = (n) => '¥' + (Math.round(n * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- 分类元数据 ---------- */
  const BILL_TYPES = {
    rent: { name: '房租', icon: '🏠', color: '#FFF1EA' },
    elec: { name: '电费', icon: '⚡', color: '#FFF9E0' },
    water: { name: '水费', icon: '💧', color: '#E9F1FF' },
    gas: { name: '燃气费', icon: '🔥', color: '#FFF0E8' },
    net: { name: '宽带', icon: '🌐', color: '#EDF7FF' },
    shop: { name: '公共采购', icon: '🛒', color: '#E6F7F2' },
    other: { name: '其他', icon: '🧾', color: '#F0F2F5' },
  };
  const SPLIT_NAMES = { equal: 'AA 均摊', perDay: '按入住天数', custom: '自定义' };
  const COV_CATS = {
    fee: { name: '费用', icon: '💰' },
    clean: { name: '卫生', icon: '🧹' },
    sleep: { name: '作息', icon: '🌙' },
    pet: { name: '宠物', icon: '🐾' },
    other: { name: '其他', icon: '📌' },
  };
  const ITEM_CATS = {
    kitchen: { name: '厨房', icon: '🍳' },
    bath: { name: '卫生间', icon: '🚿' },
    living: { name: '客厅', icon: '🛋️' },
    other: { name: '其他', icon: '📦' },
  };

  /* ---------- 状态 ---------- */
  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.v === 1 && s.members) return s; }
    } catch (e) { /* ignore */ }
    return null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('save fail', e); } }
  function reset() { state = seed(); save(); }

  /* ---------- 演示数据 ---------- */
  function seed() {
    const members = [
      { id: 'm1', name: '小鹿', emoji: '🦌', color: '#FF8A65', joined: daysAgo(200), left: null, points: 86 },
      { id: 'm2', name: '阿凯', emoji: '🐯', color: '#4DB6AC', joined: daysAgo(180), left: null, points: 64 },
      { id: 'm3', name: 'Momo', emoji: '🐱', color: '#9575CD', joined: daysAgo(150), left: null, points: 102 },
      { id: 'm4', name: '大熊', emoji: '🐻', color: '#64B5F6', joined: daysAgo(20), left: null, points: 18 },
    ];

    const bills = [
      // 本月
      { id: uid(), type: 'rent', title: '本月房租', amount: 6800, payerId: 'm1', date: monthAgoFirst(0), split: { mode: 'equal', periodDays: 30, shares: { m1: 1700, m2: 1700, m3: 1700, m4: 1700 } }, note: '押一付三，本期第三个月' },
      { id: uid(), type: 'net', title: '宽带月租', amount: 200, payerId: 'm1', date: daysAgo(12), split: { mode: 'equal', periodDays: 30, shares: { m1: 50, m2: 50, m3: 50, m4: 50 } }, note: '联通 300M' },
      { id: uid(), type: 'elec', title: '8月电费', amount: 386.5, payerId: 'm2', date: daysAgo(8), split: { mode: 'equal', periodDays: 30, shares: { m1: 96.63, m2: 96.63, m3: 96.63, m4: 96.61 } }, note: '' },
      { id: uid(), type: 'water', title: '水费（含热水）', amount: 142, payerId: 'm3', date: daysAgo(6), split: { mode: 'perDay', periodDays: 30, shares: { m1: 38.73, m2: 38.73, m3: 38.73, m4: 25.81 } }, note: '大熊按入住天数分摊' },
      { id: uid(), type: 'gas', title: '燃气费', amount: 96, payerId: 'm4', date: daysAgo(4), split: { mode: 'equal', periodDays: 30, shares: { m1: 24, m2: 24, m3: 24, m4: 24 } }, note: '' },
      { id: uid(), type: 'shop', title: '公共采购（纸抽+洗洁精）', amount: 58.9, payerId: 'm3', date: daysAgo(2), split: { mode: 'equal', periodDays: 30, shares: { m1: 14.73, m2: 14.73, m3: 14.72, m4: 14.72 } }, note: '补货，可计入账单' },
      // 历史月份（用于趋势图）
      { id: uid(), type: 'rent', title: '上月房租', amount: 6800, payerId: 'm1', date: monthAgoFirst(1), split: { mode: 'equal', periodDays: 30, shares: { m1: 2266.67, m2: 2266.67, m3: 2266.66 } }, note: '历史账单' },
      { id: uid(), type: 'elec', title: '上月水电燃气', amount: 610, payerId: 'm2', date: daysAgo(35), split: { mode: 'equal', periodDays: 30, shares: { m1: 203.34, m2: 203.33, m3: 203.33 } }, note: '历史账单' },
      { id: uid(), type: 'rent', title: '房租', amount: 6800, payerId: 'm1', date: monthAgoFirst(2), split: { mode: 'equal', periodDays: 30, shares: { m1: 2266.67, m2: 2266.67, m3: 2266.66 } }, note: '历史账单' },
      { id: uid(), type: 'elec', title: '水电燃气', amount: 585, payerId: 'm3', date: monthAgoFirst(2), split: { mode: 'equal', periodDays: 30, shares: { m1: 195, m2: 195, m3: 195 } }, note: '历史账单' },
      { id: uid(), type: 'rent', title: '房租', amount: 6800, payerId: 'm2', date: monthAgoFirst(3), split: { mode: 'equal', periodDays: 30, shares: { m1: 2266.67, m2: 2266.67, m3: 2266.66 } }, note: '历史账单' },
      { id: uid(), type: 'elec', title: '水电燃气', amount: 592, payerId: 'm1', date: monthAgoFirst(3), split: { mode: 'equal', periodDays: 30, shares: { m1: 197.34, m2: 197.33, m3: 197.33 } }, note: '历史账单' },
      { id: uid(), type: 'rent', title: '房租', amount: 6800, payerId: 'm3', date: monthAgoFirst(4), split: { mode: 'equal', periodDays: 30, shares: { m1: 2266.67, m2: 2266.67, m3: 2266.66 } }, note: '历史账单' },
      { id: uid(), type: 'elec', title: '水电燃气', amount: 566, payerId: 'm2', date: monthAgoFirst(4), split: { mode: 'equal', periodDays: 30, shares: { m1: 188.67, m2: 188.67, m3: 188.66 } }, note: '历史账单' },
      { id: uid(), type: 'rent', title: '房租', amount: 6800, payerId: 'm1', date: monthAgoFirst(5), split: { mode: 'equal', periodDays: 30, shares: { m1: 2266.67, m2: 2266.67, m3: 2266.66 } }, note: '历史账单' },
      { id: uid(), type: 'elec', title: '水电燃气', amount: 605, payerId: 'm3', date: monthAgoFirst(5), split: { mode: 'equal', periodDays: 30, shares: { m1: 201.67, m2: 201.67, m3: 201.66 } }, note: '历史账单' },
    ];

    const chores = [
      { id: uid(), title: '客厅吸尘 + 拖地', area: '客厅', icon: '🧹', weekdays: [1, 4], monthly: false, points: 5, rotation: ['m1', 'm2', 'm3', 'm4'], start: daysAgo(45), history: [] },
      { id: uid(), title: '厨房台面 + 水槽', area: '厨房', icon: '🍳', weekdays: [0, 2, 5], monthly: false, points: 6, rotation: ['m4', 'm3', 'm2', 'm1'], start: daysAgo(45), history: [] },
      { id: uid(), title: '卫生间清洁', area: '卫生间', icon: '🚿', weekdays: [3], monthly: false, points: 8, rotation: ['m2', 'm1', 'm4', 'm3'], start: daysAgo(45), history: [] },
      { id: uid(), title: '倒垃圾', area: '全屋', icon: '🗑️', weekdays: [0, 1, 2, 3, 4, 5, 6], monthly: false, points: 2, rotation: ['m3', 'm4', 'm1', 'm2'], start: daysAgo(20), history: [] },
      { id: uid(), title: '冰箱清理（每月 1 日）', area: '厨房', icon: '🧊', weekdays: [], monthly: true, points: 10, rotation: ['m1', 'm2', 'm3', 'm4'], start: daysAgo(60), history: [] },
    ];

    const items = [
      { id: uid(), name: '抽纸', icon: '🧻', cat: 'living', qty: 2, unit: '包', low: 2, max: 6, ownerId: 'm1', location: '客厅电视柜', restocks: [], consumes: [] },
      { id: uid(), name: '洗洁精', icon: '🧴', cat: 'kitchen', qty: 1, unit: '瓶', low: 1, max: 3, ownerId: 'm3', location: '厨房水槽下', restocks: [], consumes: [] },
      { id: uid(), name: '垃圾袋', icon: '🛍️', cat: 'kitchen', qty: 0, unit: '卷', low: 1, max: 4, ownerId: 'm2', location: '厨房抽屉', restocks: [], consumes: [] },
      { id: uid(), name: '洗衣液', icon: '🧺', cat: 'bath', qty: 5, unit: '桶', low: 2, max: 5, ownerId: 'm3', location: '卫生间置物架', restocks: [], consumes: [] },
      { id: uid(), name: '大米', icon: '🍚', cat: 'kitchen', qty: 3, unit: '斤', low: 3, max: 10, ownerId: 'm2', location: '厨房米箱', restocks: [], consumes: [] },
      { id: uid(), name: '食用油', icon: '🛢️', cat: 'kitchen', qty: 2, unit: '桶', low: 1, max: 2, ownerId: 'm4', location: '厨房橱柜', restocks: [], consumes: [] },
      { id: uid(), name: '猫砂', icon: '🐱', cat: 'other', qty: 2, unit: '袋', low: 3, max: 6, ownerId: 'm3', location: '阳台储物箱', restocks: [], consumes: [] },
      { id: uid(), name: '矿泉水', icon: '💧', cat: 'other', qty: 12, unit: '瓶', low: 6, max: 24, ownerId: 'm1', location: '储物间', restocks: [], consumes: [] },
    ];
    // 演示消耗/补货记录
    items[0].consumes = [{ date: daysAgo(3), qty: 1, byId: 'm3' }, { date: daysAgo(8), qty: 1, byId: 'm1' }];
    items[2].consumes = [{ date: daysAgo(2), qty: 1, byId: 'm2' }, { date: daysAgo(9), qty: 1, byId: 'm4' }];
    items[2].restocks = [{ date: daysAgo(15), qty: 4, byId: 'm2' }];
    items[6].consumes = [{ date: daysAgo(5), qty: 1, byId: 'm3' }];

    const covenants = [
      {
        id: uid(), title: '23:00 后保持安静', cat: 'sleep', icon: '🌙', status: 'active',
        content: '23:00 后公共区域与房间内不进行外放、大声通话；特殊情况提前在群里说明。',
        votes: { m1: 'agree', m2: 'agree', m3: 'agree', m4: 'agree' },
        signatures: ['m1', 'm2', 'm3', 'm4'], createdBy: 'm1', date: daysAgo(30),
        violations: [{ date: daysAgo(6), memberId: 'm4', note: '深夜 12 点打游戏外放' }],
      },
      {
        id: uid(), title: '公共区域值日打卡制', cat: 'clean', icon: '🧹', status: 'active',
        content: '按系统排班执行公共区域值日，完成后当日打卡；连续 3 次未打卡者请全屋奶茶。',
        votes: { m1: 'agree', m2: 'agree', m3: 'agree', m4: 'agree' },
        signatures: ['m1', 'm2', 'm3', 'm4'], createdBy: 'm3', date: daysAgo(28),
        violations: [],
      },
      {
        id: uid(), title: '水电均摊、燃气按天计费', cat: 'fee', icon: '💰', status: 'active',
        content: '水电宽带 AA 均摊；燃气费按入住天数折算；公共采购凭小票记账，月底统一结算。',
        votes: { m1: 'agree', m2: 'agree', m3: 'agree', m4: 'agree' },
        signatures: ['m1', 'm2', 'm3', 'm4'], createdBy: 'm1', date: daysAgo(25),
        violations: [],
      },
      {
        id: uid(), title: '养宠物需全体同意', cat: 'pet', icon: '🐾', status: 'voting',
        content: '新宠物入住前须发起公约投票，全体室友同意后方可入住；宠物不得进入他人房间。',
        votes: { m1: 'agree', m2: 'reject', m3: 'agree' },
        signatures: [], createdBy: 'm4', date: daysAgo(3),
        violations: [],
      },
      {
        id: uid(), title: '每周五晚客厅电影日', cat: 'other', icon: '🎬', status: 'active',
        content: '每周五 21:00 客厅观影，片单轮流出；不强制参加，参加者自备零食可共享。',
        votes: { m1: 'agree', m2: 'agree', m3: 'agree', m4: 'agree' },
        signatures: ['m1', 'm2', 'm3'], createdBy: 'm3', date: daysAgo(20),
        violations: [],
      },
    ];

    const s = {
      v: 1,
      home: { name: '望京西园 3 号楼 802', address: '北京市朝阳区望京街道' },
      currentUserId: 'm1',
      members, bills, chores, items, covenants,
      settled: {},
    };
    // 生成值日历史（过去 14 天，除今天）：保证与轮值算法一致
    for (const c of chores) {
      for (let n = 14; n >= 1; n--) {
        const d = new Date(); d.setDate(d.getDate() - n);
        if (isDueOn(c, d)) {
          c.history.push({ date: fmtDate(d), memberId: assigneeOn(c, fmtDate(d)), doneBy: assigneeOn(c, fmtDate(d)) });
        }
      }
    }
    return s;
  }

  /* ---------- 成员 ---------- */
  const member = (id) => state.members.find((m) => m.id === id);
  const membersAt = (dateStr) => state.members.filter((m) => m.joined <= dateStr && (!m.left || m.left > dateStr));
  const activeMembers = () => membersAt(todayStr());
  const currentUser = () => member(state.currentUserId) || activeMembers()[0];
  const memberName = (id) => { const m = member(id); return m ? m.name : '已退租'; };
  const inHomeDays = (m) => diffDays(todayStr(), m.joined) + 1;

  /* ---------- 账单：分摊算法 ---------- */
  // 按成员在账单周期内的入住天数计算分摊
  function computeShares(bill) {
    const active = membersAt(bill.date);
    const shares = {};
    if (!active.length) return shares;
    if (bill.split.mode === 'equal') {
      const each = bill.amount / active.length;
      let rest = bill.amount;
      active.forEach((m, i) => { shares[m.id] = i === active.length - 1 ? round2(rest) : round2(each); rest -= round2(each); });
    } else if (bill.split.mode === 'perDay') {
      const end = bill.date, start = dateAdd(bill.date, -(bill.split.periodDays || 30)); // 周期起点（相对账单日期）
      let totalDays = 0;
      const daysMap = {};
      active.forEach((m) => {
        const from = m.joined > start ? m.joined : start;
        const d = diffDays(end, from) + 1;
        daysMap[m.id] = d; totalDays += d;
      });
      let rest = bill.amount;
      active.forEach((m, i) => {
        shares[m.id] = i === active.length - 1 ? round2(rest) : round2(bill.amount * daysMap[m.id] / totalDays);
        rest -= shares[m.id];
      });
    } else { // custom
      Object.keys(bill.split.shares || {}).forEach((k) => { shares[k] = round2(bill.split.shares[k]); });
    }
    return shares;
  }
  const round2 = (n) => Math.round(n * 100) / 100;

  // 成员某月收支
  function memberFlow(memberId, mk) {
    let paid = 0, owed = 0;
    state.bills.forEach((b) => {
      if (monthKey(b.date) !== mk) return;
      // 使用记账时确定的分摊份额（结算依据）
      const shares = b.split.shares && Object.keys(b.split.shares).length ? b.split.shares : computeShares(b);
      if (b.payerId === memberId) paid += b.amount;
      owed += shares[memberId] || 0;
    });
    return { paid: round2(paid), owed: round2(owed), net: round2(paid - owed) };
  }
  const monthBills = (mk) => state.bills.filter((b) => monthKey(b.date) === mk).sort((a, b) => (a.date < b.date ? 1 : -1));
  const monthTotal = (mk) => round2(monthBills(mk).reduce((s, b) => s + b.amount, 0));

  // 结算中心：本月净额 → 债务匹配，生成「谁转给谁」
  function settlements(mk) {
    const flows = {};
    activeMembers().forEach((m) => { flows[m.id] = memberFlow(m.id, mk); });
    const creditors = [], debtors = [];
    Object.keys(flows).forEach((id) => {
      if (flows[id].net > 0.01) creditors.push({ id, amt: flows[id].net });
      else if (flows[id].net < -0.01) debtors.push({ id, amt: -flows[id].net });
    });
    creditors.sort((a, b) => b.amt - a.amt);
    debtors.sort((a, b) => b.amt - a.amt);
    const list = [];
    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const amt = round2(Math.min(creditors[i].amt, debtors[j].amt));
      list.push({ from: debtors[j].id, to: creditors[i].id, amount: amt });
      creditors[i].amt = round2(creditors[i].amt - amt);
      debtors[j].amt = round2(debtors[j].amt - amt);
      if (creditors[i].amt < 0.01) i++;
      if (debtors[j].amt < 0.01) j++;
    }
    return list.map((t) => {
      const k = `${mk}|${t.from}|${t.to}`;
      return { ...t, key: k, done: !!state.settled[k] };
    });
  }
  function markSettled(key, done) { state.settled[key] = done; save(); }

  /* ---------- 值日：轮值算法 ---------- */
  function isDueOn(chore, date) {
    if (chore.monthly) return date.getDate() === 1;
    return chore.weekdays.includes(date.getDay());
  }
  // 从 start 到 date 之间（含）的应值日次数
  function occurrenceIndex(chore, dateStr) {
    const end = parse(dateStr), start = parse(chore.start);
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      if (isDueOn(chore, d)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }
  function assigneeOn(chore, dateStr) {
    const active = membersAt(dateStr).map((m) => m.id);
    const rot = chore.rotation.filter((id) => active.includes(id));
    if (!rot.length) return null;
    const idx = occurrenceIndex(chore, dateStr) - 1;
    return rot[((idx % rot.length) + rot.length) % rot.length];
  }
  function nextDuty(chore) {
    for (let n = 0; n < 70; n++) {
      const ds = daysAfter(n);
      if (isDueOn(chore, parse(ds))) return { date: ds, memberId: assigneeOn(chore, ds) };
    }
    return null;
  }
  function todayDuties() {
    const ts = todayStr();
    return state.chores
      .filter((c) => isDueOn(c, today()))
      .map((c) => ({ chore: c, memberId: assigneeOn(c, ts), done: c.history.some((h) => h.date === ts) }));
  }
  function weekPlan() {
    const plan = [];
    for (let n = 0; n < 7; n++) {
      const ds = daysAfter(n);
      const duties = state.chores
        .filter((c) => isDueOn(c, parse(ds)))
        .map((c) => ({ chore: c, memberId: assigneeOn(c, ds), done: c.history.some((h) => h.date === ds) }));
      plan.push({ date: ds, duties });
    }
    return plan;
  }
  function doChore(choreId, byId) {
    const c = state.chores.find((x) => x.id === choreId);
    if (!c) return null;
    const ts = todayStr();
    const assignee = assigneeOn(c, ts);
    c.history.push({ date: ts, memberId: assignee, doneBy: byId });
    if (assignee) { const m = member(assignee); if (m) m.points += c.points; }
    save();
    return { chore: c, assignee, points: c.points };
  }

  /* ---------- 物品 ---------- */
  const itemStatus = (it) => (it.qty <= 0 ? 'out' : it.qty <= it.low ? 'low' : 'ok');
  const lowItems = () => state.items.filter((it) => itemStatus(it) !== 'ok');
  function consumeItem(itemId, qty, note, byId) {
    const it = state.items.find((x) => x.id === itemId);
    if (!it) return;
    it.qty = round2(Math.max(0, it.qty - qty));
    it.consumes.push({ date: todayStr(), qty, byId, note: note || '' });
    save();
  }
  function restockItem(itemId, qty, byId) {
    const it = state.items.find((x) => x.id === itemId);
    if (!it) return;
    it.qty = round2(it.qty + qty);
    it.restocks.push({ date: todayStr(), qty, byId });
    save();
  }

  /* ---------- 公约 ---------- */
  function covProgress(cov) {
    const total = activeMembers().length;
    let yes = 0, no = 0, voted = 0;
    Object.values(cov.votes).forEach((v) => { if (v === 'agree') yes++; if (v === 'reject') no++; voted++; });
    return { total, yes, no, voted, yesPct: voted ? Math.round((yes / voted) * 100) : 0 };
  }
  function voteCov(covId, memberId, choice) {
    const cov = state.covenants.find((c) => c.id === covId);
    if (!cov) return;
    cov.votes[memberId] = choice;
    const p = covProgress(cov);
    if (p.voted >= p.total && cov.status === 'voting') {
      cov.status = p.yes >= Math.ceil(p.total * 0.6) ? 'active' : 'rejected';
    }
    save();
    return cov;
  }
  function signCov(covId, memberId) {
    const cov = state.covenants.find((c) => c.id === covId);
    if (!cov) return;
    if (!cov.signatures.includes(memberId)) cov.signatures.push(memberId);
    save();
  }
  function addViolation(covId, memberId, note) {
    const cov = state.covenants.find((c) => c.id === covId);
    if (!cov) return;
    cov.violations.push({ date: todayStr(), memberId, note: note || '未填写说明' });
    save();
  }

  /* ---------- 数据管理 ---------- */
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hezu-life-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function importData(json) {
    const s = JSON.parse(json);
    if (!s || !s.members) throw new Error('文件格式不正确');
    s.v = 1; state = s; save();
  }

  state = load() || seed();
  if (!load()) save();

  window.Store = {
    state: () => state,
    save, reset, seed,
    todayStr, daysAgo, daysAfter, parse, fmtDate, fmtMoney, monthKey, diffDays, WEEK_CN,
    BILL_TYPES, SPLIT_NAMES, COV_CATS, ITEM_CATS,
    member, membersAt, activeMembers, currentUser, memberName, inHomeDays,
    computeShares, memberFlow, monthBills, monthTotal, settlements, markSettled,
    isDueOn, occurrenceIndex, assigneeOn, nextDuty, todayDuties, weekPlan, doChore,
    itemStatus, lowItems, consumeItem, restockItem,
    covProgress, voteCov, signCov, addViolation,
    exportData, importData, uid, round2,
  };
})();
