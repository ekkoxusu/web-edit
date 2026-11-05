// Shadow DOM UI：悬停高亮框、选中框+8向手柄、元素工具栏、顶部悬浮条、toast。
// 宿主 fixed 全屏且 pointer-events:none，仅可交互子元素（手柄/工具栏/顶栏/面板）开启事件接收。
WE.ui = (function () {
  var host = null, root = null, els = {}, rafId = 0, toastTimer = 0;

  var CSS = [
    ':host { all: initial }',
    '* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }',

    // 悬停高亮框 + 信息标签
    '.hover-box { position: fixed; pointer-events: none; border: 1.5px solid rgba(79,107,255,.85); background: rgba(79,107,255,.08); z-index: 2147483646; }',
    '.hover-label { position: fixed; left: 0; top: 0; pointer-events: none; background: #4f6bff; color: #fff; font-size: 11px; line-height: 1; padding: 4px 6px; border-radius: 3px; white-space: nowrap; z-index: 2147483646; transform: translateY(-100%); }',

    // 选中框 + 尺寸标签 + 8 向手柄
    '.sel-box { position: fixed; pointer-events: none; border: 1.5px solid #4f6bff; z-index: 2147483646; }',
    '.sel-label { position: fixed; left: 0; top: 0; pointer-events: none; background: #4f6bff; color: #fff; font-size: 11px; line-height: 1; padding: 4px 6px; border-radius: 3px; white-space: nowrap; z-index: 2147483647; transform: translateY(-100%); font-variant-numeric: tabular-nums; }',
    '.handle { position: absolute; width: 9px; height: 9px; background: #fff; border: 1.5px solid #4f6bff; border-radius: 2px; pointer-events: auto; z-index: 2147483647; }',
    '.handle[data-dir="nw"] { left: -5px; top: -5px; cursor: nwse-resize; }',
    '.handle[data-dir="n"]  { left: 50%; margin-left: -5px; top: -5px; cursor: ns-resize; }',
    '.handle[data-dir="ne"] { right: -5px; top: -5px; cursor: nesw-resize; }',
    '.handle[data-dir="e"]  { right: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }',
    '.handle[data-dir="se"] { right: -5px; bottom: -5px; cursor: nwse-resize; }',
    '.handle[data-dir="s"]  { left: 50%; margin-left: -5px; bottom: -5px; cursor: ns-resize; }',
    '.handle[data-dir="sw"] { left: -5px; bottom: -5px; cursor: nesw-resize; }',
    '.handle[data-dir="w"]  { left: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }',

    // 元素工具栏（跟随选中框下方）
    '.toolbar { position: fixed; left: 0; top: 0; display: none; gap: 2px; background: #1f2330; border: 1px solid #3a4155; border-radius: 8px; padding: 4px; box-shadow: 0 4px 16px rgba(0,0,0,.3); z-index: 2147483647; }',
    '.toolbar button { pointer-events: auto; background: none; border: none; color: #cdd3e1; font-size: 13px; padding: 5px 8px; border-radius: 5px; cursor: pointer; line-height: 1; }',
    '.toolbar button:hover { background: #333a4d; color: #fff; }',
    '.toolbar button.active { background: #4f6bff; color: #fff; }',

    // 顶部悬浮条（编辑模式常驻右上角）
    '.topbar { position: fixed; top: 12px; right: 12px; display: none; align-items: center; gap: 2px; background: #1f2330; border: 1px solid #3a4155; border-radius: 10px; padding: 6px 8px; box-shadow: 0 4px 16px rgba(0,0,0,.35); z-index: 2147483647; pointer-events: auto; }',
    '.topbar .brand { color: #fff; font-size: 12px; font-weight: 600; padding: 0 8px 0 4px; display: flex; align-items: center; gap: 5px; }',
    '.topbar .brand i { width: 8px; height: 8px; border-radius: 50%; background: #4f6bff; display: inline-block; }',
    '.topbar button { background: none; border: none; color: #cdd3e1; font-size: 13px; padding: 5px 8px; border-radius: 5px; cursor: pointer; line-height: 1; }',
    '.topbar button:hover { background: #333a4d; color: #fff; }',
    '.topbar button:disabled { opacity: .35; cursor: default; }',
    '.topbar button:disabled:hover { background: none; color: #cdd3e1; }',
    '.topbar .sep { width: 1px; height: 16px; background: #3a4155; margin: 0 4px; }',
    '.topbar .save { color: #7ee2a8; font-size: 12px; font-weight: 600; }',
    '.topbar .save:hover { background: #2a3f33; color: #9ff0bd; }',

    // toast
    '.toast { position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%); background: #1f2330; color: #e8ebf2; font-size: 13px; padding: 9px 16px; border-radius: 8px; border: 1px solid #3a4155; box-shadow: 0 4px 16px rgba(0,0,0,.4); opacity: 0; transition: opacity .18s; pointer-events: none; z-index: 2147483647; }',
    '.toast.show { opacity: 1; }',

    // 样式面板容器（内容由 style-panel.js 填充）
    '.panel-host { position: fixed; top: 64px; right: 12px; width: 248px; max-height: calc(100vh - 90px); overflow-y: auto; background: #1f2330; border: 1px solid #3a4155; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.4); z-index: 2147483647; display: none; pointer-events: auto; font-size: 12px; color: #cdd3e1; }',
  ].join('\n');

  // 构建宿主与 Shadow DOM（幂等：仅在宿主不在文档中时重建）
  function ensure() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'we-host';
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + CSS + '</style>'
      + '<div class="hover-box" hidden></div><div class="hover-label" hidden></div>'
      + '<div class="sel-box" hidden>'
      + '  <div class="handle" data-dir="nw"></div><div class="handle" data-dir="n"></div>'
      + '  <div class="handle" data-dir="ne"></div><div class="handle" data-dir="e"></div>'
      + '  <div class="handle" data-dir="se"></div><div class="handle" data-dir="s"></div>'
      + '  <div class="handle" data-dir="sw"></div><div class="handle" data-dir="w"></div>'
      + '</div>'
      + '<div class="sel-label" hidden></div>'
      + '<div class="toolbar"></div>'
      + '<div class="topbar">'
      + '  <span class="brand"><i></i>Web Edit</span>'
      + '  <button data-act="undo" title="撤销 (Ctrl+Z)">⟲</button>'
      + '  <button data-act="redo" title="重做 (Ctrl+Shift+Z)">⟳</button>'
      + '  <span class="sep"></span>'
      + '  <button data-act="save" class="save" title="保存写回 (Ctrl+S)">保存</button>'
      + '  <button data-act="saveas" title="另存为">另存</button>'
      + '  <span class="sep"></span>'
      + '  <button data-act="exit" title="退出编辑模式 (Esc)">✕</button>'
      + '</div>'
      + '<div class="panel-host"></div>'
      + '<div class="toast"></div>';
    (document.body || document.documentElement).appendChild(host);

    els = {
      hoverBox: root.querySelector('.hover-box'),
      hoverLabel: root.querySelector('.hover-label'),
      selBox: root.querySelector('.sel-box'),
      selLabel: root.querySelector('.sel-label'),
      toolbar: root.querySelector('.toolbar'),
      topbar: root.querySelector('.topbar'),
      panelHost: root.querySelector('.panel-host'),
      toast: root.querySelector('.toast'),
    };
    bindTopbar();
    // history 恢复 DOM 后重建 host 时，按当前模式恢复顶栏显示（内联样式随旧节点丢失）
    if (WE.state !== 'off') els.topbar.style.display = 'flex';
  }

  // 顶部条按钮：撤销/重做/保存/另存/退出；工具栏动作点击委托
  function bindTopbar() {
    els.topbar.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      if (act === 'undo') WE.history.undo();
      else if (act === 'redo') WE.history.redo();
      else if (act === 'save') WE.saver.save(false);
      else if (act === 'saveas') WE.saver.save(true);
      else if (act === 'exit') WE.disable();
    });
    // 工具栏点击委托（在 shadow 内部，不会冒泡到页面）
    root.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.toolbar button');
      if (t) toolbarAction(t.getAttribute('data-act'));
    });
  }

  function destroy() {
    stopSync();
    if (host) host.remove();
    hideHover();
  }

  // ---- 悬停高亮 ----
  function showHover(el) {
    var r = el.getBoundingClientRect();
    els.hoverBox.hidden = false;
    els.hoverBox.style.left = r.left + 'px';
    els.hoverBox.style.top = r.top + 'px';
    els.hoverBox.style.width = r.width + 'px';
    els.hoverBox.style.height = r.height + 'px';
    els.hoverLabel.hidden = false;
    els.hoverLabel.textContent = describe(el);
    // 标签贴高亮框左上角（越界时移到框内）
    if (r.top < 22) {
      els.hoverLabel.style.transform = 'none';
      els.hoverLabel.style.top = r.top + 2 + 'px';
    } else {
      els.hoverLabel.style.transform = 'translateY(-100%)';
      els.hoverLabel.style.top = r.top - 2 + 'px';
    }
    els.hoverLabel.style.left = r.left + 'px';
  }

  function hideHover() {
    if (!els.hoverBox) return;
    els.hoverBox.hidden = true;
    els.hoverLabel.hidden = true;
  }

  // 元素描述：tag#id.class · WxH
  function describe(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    var cls = el.className && typeof el.className === 'string' ? el.classList[0] : '';
    if (cls) s += '.' + cls;
    return s;
  }

  // ---- 选中框 ----
  function select(el) {
    ensure();
    WE.selected = el;
    if (WE.state !== 'editing') WE.state = 'selected';
    hideHover();                    // 选中后收起悬停高亮，避免与选中框重叠
    els.selBox.hidden = false;
    els.selLabel.hidden = false;
    renderToolbar();
    startSync();
    syncNow();
    WE.stylePanel.refresh(el);
  }

  function deselect() {
    if (!els.selBox) return;
    WE.selected = null;
    if (WE.state !== 'off') WE.state = 'hover';
    els.selBox.hidden = true;
    els.selLabel.hidden = true;
    els.toolbar.style.display = 'none';
    stopSync();
    WE.stylePanel.refresh(null);
  }

  // 工具栏按钮组（选中后显示）
  function renderToolbar() {
    els.toolbar.innerHTML = '';
    var btns = [
      ['✏️', '编辑文字', 'text'],
      ['🎨', '样式面板', 'style'],
      ['⧉', '复制元素', 'dup'],
      ['⬆', '选择父级', 'parent'],
      ['🗑', '删除元素', 'del'],
    ];
    btns.forEach(function (b) {
      var btn = document.createElement('button');
      btn.textContent = b[0];
      btn.title = b[1];
      btn.setAttribute('data-act', b[2]);
      els.toolbar.appendChild(btn);
    });
    els.toolbar.style.display = 'flex';
  }

  // 工具栏动作分发（由 interactions 提供 capability）
  function toolbarAction(act) {
    var el = WE.selected;
    if (!el) return;
    if (act === 'text') WE.interactions.startTextEdit(el);
    else if (act === 'style') WE.stylePanel.toggle();
    else if (act === 'dup') WE.interactions.duplicate(el);
    else if (act === 'parent') WE.interactions.selectParent(el);
    else if (act === 'del') WE.interactions.remove(el);
  }

  // rAF 循环：选中期间持续同步选中框/工具栏位置（元素被拖拽缩放时自动跟随）
  function startSync() {
    if (rafId) return;
    (function loop() {
      rafId = requestAnimationFrame(loop);
      syncNow();
    })();
  }

  function stopSync() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // 立即同步选中框、标签、工具栏到元素当前矩形
  function syncNow() {
    var el = WE.selected;
    if (!el || !els.selBox) return;
    var r = el.getBoundingClientRect();
    els.selBox.style.left = r.left + 'px';
    els.selBox.style.top = r.top + 'px';
    els.selBox.style.width = r.width + 'px';
    els.selBox.style.height = r.height + 'px';
    els.selLabel.textContent = describe(el) + ' · ' + Math.round(r.width) + '×' + Math.round(r.height);

    // 标签贴选中框左上，放不下时收进框内
    var ly = r.top >= 22 ? r.top - 2 : r.top + 2;
    els.selLabel.style.transform = r.top >= 22 ? 'translateY(-100%)' : 'none';
    els.selLabel.style.left = r.left + 'px';
    els.selLabel.style.top = ly + 'px';

    // 工具栏贴选中框下方，越界则放上方
    var th = els.toolbar.offsetHeight || 34;
    var ty = r.bottom + th + 8 < innerHeight ? r.bottom + 8 : r.top - th - 8;
    if (ty < 0) ty = 4;
    els.toolbar.style.left = r.left + 'px';
    els.toolbar.style.top = ty + 'px';
  }

  // 拖拽/缩放期间隐藏工具栏，避免遮挡与误点
  function setBusy(on) {
    els.toolbar.style.visibility = on ? 'hidden' : 'visible';
  }

  function showTopbar() { ensure(); els.topbar.style.display = 'flex'; refreshHistoryBtns(); }
  function hideTopbar() { if (els.topbar) els.topbar.style.display = 'none'; }

  // 撤销/重做按钮可用态
  function refreshHistoryBtns() {
    if (!els.topbar) return;
    els.topbar.querySelector('[data-act="undo"]').disabled = !WE.history.canUndo();
    els.topbar.querySelector('[data-act="redo"]').disabled = !WE.history.canRedo();
  }

  function toast(msg) {
    ensure();
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2000);
  }

  WE.bus.on('history-change', refreshHistoryBtns);

  return {
    // host/root 惰性创建，须以函数获取（history 恢复 DOM 后会重建）
    getHost: function () { return host; },
    getRoot: function () { return root; },
    ensure: ensure,
    destroy: destroy,
    showHover: showHover,
    hideHover: hideHover,
    select: select,
    deselect: deselect,
    syncNow: syncNow,
    setBusy: setBusy,
    showTopbar: showTopbar,
    hideTopbar: hideTopbar,
    toast: toast,
    panelHost: function () { ensure(); return els.panelHost; },
  };
})();
