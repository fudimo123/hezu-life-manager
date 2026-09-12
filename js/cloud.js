/* 云同步引擎 · 社区属性 P0
   - 创建/加入「共享之家」（6 位邀请码）
   - 本地变更防抖推送（乐观锁 baseVersion，409 时以服务端为准合并）
   - 轮询增量拉取（每 6 秒），在线状态心跳（每 20 秒）
   - 同步状态供 UI 展示 */
(function () {
  'use strict';
  const API = 'https://hezu-ai-proxy.fudimo123.deno.net';

  let pushTimer = null;
  let pollTimer = null;
  let pingTimer = null;
  let syncInProgress = false;

  const state = () => Store.state();
  const cfg = () => state().cloud || {};
  const isJoined = () => !!cfg().homeId;

  window.Cloud = {
    status: { joined: false, online: [], lastSync: 0, version: 0, error: '' },
    isJoined,
    createHome, joinHome, leaveHome, onLocalChange, start, stop, adopt, ping,
  };

  async function api(path, opts) {
    const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json' } });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, json: j };
  }

  // 同步数据不含设备私有字段（身份/AI 配置）
  function cleanState(s) {
    const c = JSON.parse(JSON.stringify(s));
    delete c.cloud; delete c.ai; delete c.currentUserId; delete c.v;
    return c;
  }

  /* ---------- 创建共享之家 ---------- */
  async function createHome() {
    const res = await api('/api/home', { method: 'POST', body: JSON.stringify({ state: cleanState(state()) }) });
    if (res.json.ok) {
      const s = state();
      s.cloud = { homeId: res.json.homeId, code: res.json.code, version: res.json.version, lastSync: Date.now(), joinedAt: Date.now() };
      syncInProgress = true;
      Store.save();
      syncInProgress = false;
      window.Cloud.status.joined = true;
      start();
      UI.toast('🏠 共享之家已创建！邀请码 ' + res.json.code, '🏠');
      return true;
    }
    UI.toast('创建失败：' + (res.json.error || '网络错误'), '⚠️');
    return false;
  }

  /* ---------- 邀请码加入 ---------- */
  async function joinHome(code) {
    const res = await api('/api/home/join', { method: 'POST', body: JSON.stringify({ code }) });
    if (res.json.ok) {
      adopt(res.json.state, res.json.version, code, res.json.homeId);
      UI.toast('🎉 已加入共享之家！数据已同步', '🏠');
      return true;
    }
    UI.toast('加入失败：' + (res.json.error || '网络错误'), '⚠️');
    return false;
  }

  /* ---------- 采用远端状态（保留本机身份与 AI 配置） ---------- */
  function adopt(remote, version, code, homeId) {
    syncInProgress = true;
    const s = state();
    const keep = { currentUserId: s.currentUserId, ai: s.ai };
    const merged = Object.assign({}, remote, keep);
    merged.v = 1;
    merged.cloud = {
      homeId: homeId || cfg().homeId,
      code: code || cfg().code,
      version,
      lastSync: Date.now(),
      joinedAt: cfg().joinedAt || Date.now(),
    };
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, merged);
    Store.save();
    syncInProgress = false;
    window.Cloud.status.joined = true;
    window.Cloud.status.version = version;
    window.Cloud.status.lastSync = Date.now();
    if (window.Router) { Router.render(); Router.renderHeader(); }
    start(); // 加入/合并后确保轮询与心跳在跑
  }

  /* ---------- 本地变更 → 防抖推送 ---------- */
  function onLocalChange() {
    if (syncInProgress || !isJoined()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 900);
  }

  async function pushNow() {
    if (syncInProgress || !isJoined()) return;
    const s = state();
    const c = cfg();
    try {
      const res = await api('/api/home/' + c.homeId, {
        method: 'PUT', body: JSON.stringify({ state: cleanState(s), baseVersion: c.version }),
      });
      if (res.json.ok) {
        c.version = res.json.version;
        c.lastSync = Date.now();
        window.Cloud.status.version = c.version;
        window.Cloud.status.lastSync = c.lastSync;
        window.Cloud.status.error = '';
        syncInProgress = true; Store.save(); syncInProgress = false;
      } else if (res.status === 409 && res.json.state) {
        window.Cloud.status.error = '检测到其他设备更新，已合并';
        adopt(res.json.state, res.json.version);
      } else {
        window.Cloud.status.error = res.json.error || '同步失败';
      }
    } catch (e) {
      window.Cloud.status.error = '网络不可达';
    }
  }

  /* ---------- 轮询 + 心跳 ---------- */
  async function poll() {
    if (!isJoined() || syncInProgress) return;
    const c = cfg();
    try {
      const res = await api('/api/home/' + c.homeId + '?since=' + c.version);
      if (res.json.ok) {
        window.Cloud.status.online = res.json.online || [];
        window.Cloud.status.error = '';
        if (res.json.changed) adopt(res.json.state, res.json.version);
      }
    } catch (e) {
      window.Cloud.status.error = '网络不可达';
    }
  }

  function ping() {
    if (!isJoined()) return;
    const s = state();
    api('/api/home/' + cfg().homeId + '/ping', { method: 'POST', body: JSON.stringify({ memberId: s.currentUserId }) }).catch(() => {});
  }

  function start() {
    stop();
    if (!isJoined()) return;
    window.Cloud.status.joined = true;
    pollTimer = setInterval(poll, 6000);
    pingTimer = setInterval(ping, 20000);
    poll();
    ping();
  }

  function stop() {
    clearInterval(pollTimer); clearInterval(pingTimer); clearTimeout(pushTimer);
    window.Cloud.status.joined = isJoined();
  }

  /* ---------- 退出共享之家 ---------- */
  function leaveHome() {
    const s = state();
    s.cloud = { homeId: '', code: '', version: 0, lastSync: 0, joinedAt: 0 };
    Store.save();
    stop();
    window.Cloud.status = { joined: false, online: [], lastSync: 0, version: 0, error: '' };
    UI.toast('已退出共享之家（本机数据保留）', '👋');
  }
})();
