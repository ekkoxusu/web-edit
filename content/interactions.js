// 交互核心：hover 高亮、点选、拖拽移动、8向缩放、双击文字编辑、删除/复制/父级选择、键盘操作。
// 所有监听挂 document 捕获阶段，先于页面自身脚本；点击扩展 UI（shadow 宿主）时放行。
WE.interactions = (function () {
  var hoverPending = false;      // mousemove rAF 节流标志
  var didDrag = false;           // 抑制拖拽结束后误触发的 click
  var editBeforeText = null;     // 文字编辑前的文本（未变化则回滚历史记录）
  var savedUserSelect = '';

  // 事件目标是否为扩展自身 UI（shadow 内事件对外 target 为宿主元素）
  function isUiTarget(e) {
    return WE.ui.getHost() && e.target === WE.ui.getHost();
  }

  // 过滤可选目标：跳过文档根/body 与不可见元素
  function pickTarget(e) {
    if (isUiTarget(e)) return null;
    var t = e.target;
    if (!t || !t.tagName) return null;
    if (t === document.documentElement || t === document.body) return null;
    var tag = t.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'noscript' || tag === 'head') return null;
    return t;
  }

  // ---- 悬停高亮（rAF 节流）----
  function onMouseMove(e) {
    if (WE.state === 'dragging' || WE.state === 'resizing') return;
    if (hoverPending) return;
    hoverPending = true;
    requestAnimationFrame(function () {
      hoverPending = false;
      var st = WE.state;
      if (st === 'off' || st === 'dragging' || st === 'resizing' || st === 'editing') { WE.ui.hideHover(); return; }
      var t = pickTarget(e);
      if (!t || t === WE.selected) { WE.ui.hideHover(); return; }
      WE.ui.showHover(t);
    });
  }

  // ---- 点击：选中 / 切换 / 取消 ----
  function onClick(e) {
    if (WE.state === 'off') return;
    if (didDrag) { didDrag = false; WE.eat(e); return; }  // 刚结束拖拽，吃掉 click
    if (isUiTarget(e)) return;                              // UI 内部交互放行
    WE.eat(e);                                              // 拦截链接跳转等页面行为
    if (WE.state === 'editing') return;
    var t = pickTarget(e);
    if (t) WE.ui.select(t);
    else WE.ui.deselect();                                  // 点空白处取消选中
  }

  // ---- 双击：进入文字编辑 ----
  function onDblClick(e) {
    if (WE.state === 'off' || isUiTarget(e)) return;
    var t = pickTarget(e);
    WE.eat(e);
    if (t) startTextEdit(t);
  }

  // ---- pointerdown：选中元素拖拽 / 手柄缩放 ----
  function onPointerDown(e) {
    if (WE.state === 'off') return;
    if (isUiTarget(e)) {
      // composedPath 取 shadow 内真实元素，判断是否点了缩放手柄
      var inner = e.composedPath()[0];
      var handle = inner && inner.closest ? inner.closest('.handle') : null;
      if (handle && WE.selected) startResize(e, handle.getAttribute('data-dir'));
      return;  // 手柄外的 UI 交互（按钮/面板）放行
    }
    if (WE.state === 'editing') return;
    var t = pickTarget(e);
    if (t && t === WE.selected) startDrag(e, t);
  }

  // 拖拽期间禁用 iframe 命中，避免指针事件落入 iframe 导致拖拽冻结；结束后恢复原值
  var savedIframePE = [];
  function disableIframes() {
    savedIframePE = [];
    document.querySelectorAll('iframe').forEach(function (f) {
      savedIframePE.push([f, f.style.pointerEvents]);
      f.style.pointerEvents = 'none';
    });
  }
  function restoreIframes() {
    savedIframePE.forEach(function (p) { p[0].style.pointerEvents = p[1]; });
    savedIframePE = [];
  }

  // 拖拽移动：位移写入独立 translate 属性；移动超过 3px 才视为拖拽并记历史
  function startDrag(e, el) {
    var startX = e.clientX, startY = e.clientY;
    var base = WE.getTranslate(el);
    var started = false;
    WE.eat(e);

    function onMove(ev) {
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!started) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        started = true;
        WE.state = 'dragging';
        WE.history.before();
        WE.ui.setBusy(true);
        disableIframes();
      }
      ev.preventDefault();
      WE.setTranslate(el, base.x + dx, base.y + dy);
    }
    function stop() {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', stop, true);
      document.removeEventListener('pointercancel', stop, true);
      restoreIframes();
      if (started) {
        WE.state = 'selected';
        WE.ui.setBusy(false);
        WE.ui.syncNow();
        didDrag = true;               // click 紧随 pointerup 同步派发，此标志可靠
        setTimeout(function () { didDrag = false; }, 50);
      }
    }
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', stop, true);
    document.addEventListener('pointercancel', stop, true);
  }

  // 8 向缩放：e/s/w/n 组合调宽高；w/n 方向用 translate 补偿保持对边静止；角手柄 Shift 等比
  function startResize(e, dir) {
    var el = WE.selected;
    WE.eat(e);
    var startX = e.clientX, startY = e.clientY;
    var cs = getComputedStyle(el);
    var startW = WE.px(cs.width), startH = WE.px(cs.height);
    var base = WE.getTranslate(el);
    var east = dir.indexOf('e') >= 0, west = dir.indexOf('w') >= 0;
    var south = dir.indexOf('s') >= 0, north = dir.indexOf('n') >= 0;
    var started = false;

    function onMove(ev) {
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!started) {
        // 3px 门槛：单纯点一下手柄不产生记录与 DOM 变更
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        started = true;
        // inline 元素 width/height 不生效，先转 inline-block
        if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
        WE.history.before();
        WE.state = 'resizing';
        WE.ui.setBusy(true);
        disableIframes();
      }
      var w = startW, h = startH, tx = base.x, ty = base.y;
      var corner = (east || west) && (south || north);

      if (corner && ev.shiftKey) {
        // 角手柄等比：以水平位移驱动缩放比例
        var scale = Math.max(8 / startW, (startW + dx * (east ? 1 : -1)) / startW);
        w = startW * scale;
        h = startH * scale;
      } else {
        if (east) w = startW + dx;
        if (west) { w = startW - dx; tx = base.x + dx; }
        if (south) h = startH + dy;
        if (north) { h = startH - dy; ty = base.y + dy; }
      }
      w = WE.clamp(w, 8, 100000);
      h = WE.clamp(h, 8, 100000);
      if (corner && ev.shiftKey) {
        // 等比模式下按最终尺寸补偿 w/n，保持对边静止
        if (west) tx = base.x + (startW - w);
        if (north) ty = base.y + (startH - h);
      }
      ev.preventDefault();
      el.style.width = Math.round(w) + 'px';
      el.style.height = Math.round(h) + 'px';
      WE.setTranslate(el, tx, ty);
    }
    function stop() {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', stop, true);
      document.removeEventListener('pointercancel', stop, true);
      restoreIframes();
      if (started) {
        WE.state = 'selected';
        WE.ui.setBusy(false);
        WE.ui.syncNow();
        didDrag = true;
        setTimeout(function () { didDrag = false; }, 50);
      }
    }
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', stop, true);
    document.addEventListener('pointercancel', stop, true);
  }

  // ---- 文字编辑 ----
  function startTextEdit(el) {
    if (WE.state === 'editing') return;
    if (WE.selected !== el) WE.ui.select(el);
    WE.history.before();
    editBeforeText = el.innerText;
    el.contentEditable = 'plaintext-only';            // 优先纯文本编辑
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.style.userSelect = 'text';                     // 覆盖编辑模式的全局禁选
    el.focus();
    WE.state = 'editing';
    WE.ui.setBusy(true);
  }

  // 结束编辑：移除属性避免污染导出；文本未变化则回滚快照
  function finishTextEdit() {
    var el = WE.selected;
    if (WE.state !== 'editing' || !el) return;
    WE.state = 'selected';          // 先改状态：blur 触发的 focusout 重入会被守卫拦截
    el.removeAttribute('contenteditable');
    el.style.userSelect = '';
    el.blur();
    WE.ui.setBusy(false);
    if (editBeforeText !== null && el.innerText === editBeforeText) WE.history.dropLast();
    editBeforeText = null;
  }

  // editable 失焦即收尾（焦点移到元素外时）
  function onFocusOut(e) {
    if (WE.state === 'editing' && WE.selected && !WE.selected.contains(e.relatedTarget)) {
      finishTextEdit();
    }
  }

  // ---- 元素操作（工具栏/键盘入口）----
  function remove(el) {
    WE.history.before();
    WE.ui.deselect();
    el.remove();
  }

  function duplicate(el) {
    WE.history.before();
    var copy = el.cloneNode(true);
    var t = WE.getTranslate(el);
    WE.setTranslate(copy, t.x + 14, t.y + 14);        // 副本偏移一点便于识别
    el.after(copy);
    WE.ui.select(copy);
  }

  function selectParent(el) {
    var p = el.parentElement;
    if (!p || p === document.body || p === document.documentElement) {
      WE.ui.toast('已是最外层可选中元素');
      return;
    }
    WE.ui.select(p);
  }

  // ---- 键盘 ----
  function onKeyDown(e) {
    if (WE.state === 'off') return;
    var mod = e.ctrlKey || e.metaKey;

    // Ctrl/Cmd+S 保存写回（编辑/拖拽中同样生效）
    if (mod && e.key.toLowerCase() === 's') {
      WE.eat(e);
      WE.saver.save(false);
      return;
    }
    if (WE.state === 'editing') {
      // Esc 结束文字编辑；其余按键放行（含原生 undo）
      if (e.key === 'Escape') { WE.eat(e); finishTextEdit(); }
      return;
    }
    if (WE.state === 'dragging' || WE.state === 'resizing') {
      WE.eat(e);                                       // 指针操作进行中屏蔽其余按键，避免双写入方冲突
      return;
    }

    if (mod && e.key.toLowerCase() === 'z') {
      WE.eat(e);
      if (e.shiftKey) WE.history.redo(); else WE.history.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') { WE.eat(e); WE.history.redo(); return; }

    if (e.key === 'Escape') {
      if (WE.state === 'selected') WE.ui.deselect();
      else if (WE.state === 'hover') WE.disable();    // 连按 Esc 逐级退出
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && WE.selected) {
      WE.eat(e);
      remove(WE.selected);
      return;
    }
    // 方向键微调位置，Shift 放大步长；连续按键防抖合并为一条记录
    if (WE.selected && e.key.indexOf('Arrow') === 0) {
      WE.eat(e);
      var step = e.shiftKey ? 10 : 1;
      var t = WE.getTranslate(WE.selected);
      if (e.key === 'ArrowLeft') t.x -= step;
      if (e.key === 'ArrowRight') t.x += step;
      if (e.key === 'ArrowUp') t.y -= step;
      if (e.key === 'ArrowDown') t.y += step;
      WE.debouncedBefore();
      WE.setTranslate(WE.selected, t.x, t.y);
      WE.ui.syncNow();
    }
  }

  // 阻止图片等原生拖拽
  function onDragStart(e) {
    if (WE.state !== 'off' && !isUiTarget(e)) WE.eat(e);
  }

  // ---- 挂载/卸载（编辑模式开关时调用）----
  function attach() {
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('dblclick', onDblClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('dragstart', onDragStart, true);
    savedUserSelect = document.documentElement.style.userSelect || '';
    document.documentElement.style.userSelect = 'none';   // 编辑模式禁止文本选择（editable 内另行放开）
  }

  function detach() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('dblclick', onDblClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('focusout', onFocusOut, true);
    document.removeEventListener('dragstart', onDragStart, true);
    document.documentElement.style.userSelect = savedUserSelect;
  }

  return {
    attach: attach,
    detach: detach,
    startTextEdit: startTextEdit,
    finishTextEdit: finishTextEdit,
    remove: remove,
    duplicate: duplicate,
    selectParent: selectParent,
  };
})();
