/* ============================================================
   合租生活管家 · UI 基础层 ui.js
   渲染工具 / Toast / Modal / 表单控件
============================================================ */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---------- 头像 ---------- */
  function avatar(member, size = 'md') {
    if (!member) return '<span class="avatar avatar-' + size + '" style="background:#E3E7EE">👤</span>';
    return `<span class="avatar avatar-${size}" style="background:${member.color}" title="${esc(member.name)}">${member.emoji}</span>`;
  }
  function avatarStack(members, size = 'sm') {
    return `<span class="avatar-stack">${members.map((m) => avatar(m, size)).join('')}</span>`;
  }

  /* ---------- Toast ---------- */
  function toast(msg, icon = '✅') {
    let root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }

  /* ---------- Modal ---------- */
  function openModal(title, bodyHTML, actionsHTML = '') {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal-sheet">
          <div class="modal-title"><span>${title}</span><button class="modal-close" data-close>✕</button></div>
          <div class="modal-body">${bodyHTML}</div>
          <div class="modal-actions">${actionsHTML}</div>
        </div>
      </div>`;
    const bd = root.querySelector('#modal-backdrop');
    const close = () => { root.innerHTML = ''; };
    bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
    root.querySelector('[data-close]').addEventListener('click', close);
    return {
      root: bd.querySelector('.modal-sheet'),
      close,
      submit: (btnSel, fn) => {
        const btn = bd.querySelector(btnSel);
        if (btn) btn.addEventListener('click', () => { const r = fn(bd); if (r !== false) close(); });
      },
    };
  }

  /* ---------- 表单控件 ---------- */
  function fGroup(label, controlHTML, hint = '') {
    return `<div class="f-group"><label class="f-label">${label}</label>${controlHTML}${hint ? `<div class="f-hint">${hint}</div>` : ''}</div>`;
  }
  function fInput(id, value = '', placeholder = '', type = 'text') {
    return `<input class="f-input" id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
  }
  function fTextarea(id, value = '', placeholder = '') {
    return `<textarea class="f-textarea" id="${id}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
  }
  function fSelect(id, options) {
    return `<select class="f-select" id="${id}">${options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`;
  }
  function fSeg(id, options, current) {
    return `<div class="seg-group" id="${id}">${options.map((o) => `<button type="button" class="seg${o.value === current ? ' on' : ''}" data-v="${esc(o.value)}">${esc(o.label)}</button>`).join('')}</div>`;
  }
  function bindSeg(id, onChange) {
    const g = document.getElementById(id);
    if (!g) return;
    g.addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (!b) return;
      g.querySelectorAll('.seg').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(b.dataset.v);
    });
  }
  function fEmojiPick(id, emojis, current) {
    return `<div class="emoji-pick" id="${id}">${emojis.map((e) => `<button type="button" class="${e === current ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>`;
  }
  function bindEmojiPick(id, onChange) {
    const g = document.getElementById(id);
    if (!g) return;
    g.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      g.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(b.dataset.e);
    });
  }
  function fMemberPick(id, members, current, multi = false) {
    return `<div class="member-pick" id="${id}">${members.map((m) => `<button type="button" class="${current === m.id ? 'on' : ''}" data-v="${esc(m.id)}">${m.emoji} ${esc(m.name)}</button>`).join('')}</div>`;
  }
  function bindMemberPick(id, onChange) {
    const g = document.getElementById(id);
    if (!g) return;
    g.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      g.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(b.dataset.v);
    });
  }
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function num(id) { const v = parseFloat(val(id)); return isNaN(v) ? 0 : v; }

  window.UI = {
    esc, avatar, avatarStack, toast,
    openModal, fGroup, fInput, fTextarea, fSelect, fSeg, bindSeg,
    fEmojiPick, bindEmojiPick, fMemberPick, bindMemberPick, val, num,
  };
})();
