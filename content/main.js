// 入口：编辑模式开关与消息路由（popup 按钮与快捷键均发 toggle-edit 消息到此处）
(function () {

  // 激活编辑模式：挂 UI、开顶栏、绑交互
  WE.enable = function () {
    if (WE.state !== 'off') return;
    WE.ui.ensure();
    WE.ui.showTopbar();
    WE.interactions.attach();
    WE.state = 'hover';
    document.documentElement.style.cursor = 'crosshair';
  };

  // 关闭编辑模式：收尾文字编辑与选中，卸载 UI 与监听
  WE.disable = function () {
    if (WE.state === 'off') return;
    if (WE.state === 'editing') WE.interactions.finishTextEdit();
    WE.interactions.detach();
    WE.ui.deselect();
    WE.ui.destroy();
    WE.stylePanel.reset();          // 面板随宿主销毁，重置状态以便重新进入后重建
    WE.state = 'off';
    document.documentElement.style.cursor = '';
  };

  WE.toggle = function () {
    if (WE.state === 'off') WE.enable(); else WE.disable();
  };

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === 'toggle-edit') {
      WE.toggle();
      sendResponse({ on: WE.state !== 'off' });
    } else if (msg.type === 'get-state') {
      sendResponse({ on: WE.state !== 'off' });
    }
  });
})();
