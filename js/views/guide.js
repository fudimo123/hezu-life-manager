/* 功能地图：全部入口与功能一目了然（新手引导） */
(function () {
  'use strict';

  const ENTRIES = [
    { icon: '🏠', name: '总览', path: '底部导航第 1 个', desc: '今日待办聚合 · 本月账单大数字 · 库存预警 · 家动态' },
    { icon: '💰', name: '账单', path: '底部导航第 2 个', desc: '记一笔（AA/按天/自定义）· 月度切换 · 结算中心 · 押金清算' },
    { icon: '🧹', name: '值日', path: '底部导航第 3 个', desc: '今日打卡 · 本周排班 · 请假顺延 · 积分榜' },
    { icon: '📦', name: '物品', path: '底部导航第 4 个', desc: '库存状态 · 消耗记录 · 一键补货（自动入账）' },
    { icon: '📜', name: '公约', path: '底部导航第 5 个', desc: '发起公约 · 在线投票 · 签署确认 · 违约留痕' },
    { icon: '🔔', name: '提醒中心', path: '顶部铃铛', desc: '值日/库存/结算/投票/违约 五类提醒聚合，点击直达处理' },
    { icon: '🤖', name: 'AI 管家', path: '总览页紫色横幅', desc: '催收话术生成 · 公约草案起草 · 智能分摊建议' },
    { icon: '👥', name: '成员管理', path: '顶部头像', desc: '生活标签与合拍指数 · 入住/退租 · 身份切换 · 数据备份' },
    { icon: '＋', name: '快捷操作', path: '右下角悬浮按钮', desc: '随页面切换：记账 / 加任务 / 登记物品 / 发起公约' },
  ];

  function open() {
    const body = `
      <div class="guide-steps">
        <div class="guide-step"><b>1</b><span>顶部看提醒<br>有红点就处理</span></div><i>→</i>
        <div class="guide-step"><b>2</b><span>底部进模块<br>各司其职</span></div><i>→</i>
        <div class="guide-step"><b>3</b><span>右下角快捷<br>30 秒完成操作</span></div>
      </div>
      <div class="section-title" style="margin:16px 0 8px;font-size:14px">🗺️ 全部入口</div>
      ${ENTRIES.map((e) => `
        <div class="guide-row">
          <span class="guide-ic">${e.icon}</span>
          <div class="li-main">
            <div class="li-title">${e.name} <span class="guide-path">${e.path}</span></div>
            <div class="li-sub">${e.desc}</div>
          </div>
        </div>`).join('')}
      <div class="f-hint" style="margin-top:10px">💡 任何页面点顶部「？」都可以重新打开这张功能地图。</div>`;
    UI.openModal('🗺️ 功能地图', body, '');
  }

  window.Views = window.Views || {};
  window.Views.guide = open;
})();
