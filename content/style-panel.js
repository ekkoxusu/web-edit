// 样式编辑面板：选中元素后可打开，编辑常用 CSS 属性（写内联样式，导出时自然保留）。
// 连续修改通过防抖合并为一条撤销记录。
WE.stylePanel = (function () {
  var el = null;          // 当前编辑的目标元素
  var visible = false;
  var built = false;
  var inputs = {};        // name -> input 元素

  var PANEL_CSS = [
    '.wp { padding: 10px 12px 12px; }',
    '.wp h3 { font-size: 12px; color: #fff; margin: 10px 0 8px; font-weight: 600; }',
    '.wp h3:first-child { margin-top: 2px; }',
    '.wp .row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }',
    '.wp .row label { flex: 0 0 64px; color: #9aa3b5; }',
    '.wp input[type="number"] { width: 100%; min-width: 0; background: #151924; border: 1px solid #3a4155; color: #e8ebf2; border-radius: 5px; padding: 4px 6px; font-size: 12px; }',
    '.wp input[type="color"] { width: 30px; height: 24px; padding: 0 2px; background: #151924; border: 1px solid #3a4155; border-radius: 5px; cursor: pointer; }',
    '.wp .hex { flex: 1; background: #151924; border: 1px solid #3a4155; color: #9aa3b5; border-radius: 5px; padding: 4px 6px; font-size: 11px; }',
    '.wp select { flex: 1; background: #151924; border: 1px solid #3a4155; color: #e8ebf2; border-radius: 5px; padding: 4px; font-size: 12px; }',
    '.wp .seg { display: flex; gap: 2px; flex: 1; }',
    '.wp .seg button { flex: 1; background: #151924; border: 1px solid #3a4155; color: #9aa3b5; border-radius: 5px; padding: 3px 0; font-size: 12px; cursor: pointer; }',
    '.wp .seg button.on { background: #4f6bff; border-color: #4f6bff; color: #fff; }',
    '.wp .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; flex: 1; }',
    '.wp .grid4 input { width: 100%; min-width: 0; }',
  ].join('\n');

  // 面板字段定义：name、行类型、读取 computed、写内联样式
  function build() {
    var host = WE.ui.panelHost();
    var style = document.createElement('style');
    style.textContent = PANEL_CSS;
    host.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'wp';
    wrap.innerHTML =
      '<h3>文字</h3>'
      + '<div class="row"><label>颜色</label><input type="color" data-f="color"><span class="hex" data-hex="color"></span></div>'
      + '<div class="row"><label>字号(px)</label><input type="number" step="1" min="0" data-f="font-size"></div>'
      + '<div class="row"><label>字重</label><select data-f="font-weight">'
      + [300, 400, 500, 600, 700].map(function (w) { return '<option>' + w + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="row"><label>样式</label><div class="seg">'
      + '<button data-f="italic" data-v="italic" title="斜体"><i>I</i></button>'
      + '<button data-f="align" data-v="left" title="左对齐">⇤</button>'
      + '<button data-f="align" data-v="center" title="居中">≡</button>'
      + '<button data-f="align" data-v="right" title="右对齐">⇥</button>'
      + '</div></div>'
      + '<h3>背景</h3>'
      + '<div class="row"><label>颜色</label><input type="color" data-f="background-color"><span class="hex" data-hex="background-color"></span></div>'
      + '<h3>盒子 (px)</h3>'
      + '<div class="row"><label>外边距</label><div class="grid4">'
      + ['margin-top', 'margin-right', 'margin-bottom', 'margin-left']
        .map(function (p) { return '<input type="number" step="1" data-f="' + p + '" title="' + p + '">'; }).join('')
      + '</div></div>'
      + '<div class="row"><label>内边距</label><div class="grid4">'
      + ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']
        .map(function (p) { return '<input type="number" step="1" data-f="' + p + '" title="' + p + '">'; }).join('')
      + '</div></div>'
      + '<div class="row"><label>圆角</label><input type="number" step="1" min="0" data-f="border-radius"></div>';
    host.appendChild(wrap);

    // 收集输入控件并统一监听
    host.querySelectorAll('[data-f]').forEach(function (node) {
      var name = node.getAttribute('data-f');
      (inputs[name] = inputs[name] || []).push(node);
      if (node.tagName === 'INPUT' || node.tagName === 'SELECT') {
        node.addEventListener('input', function () { apply(name, node.value); });
      } else {
        node.addEventListener('click', function () { toggleSeg(name, node.getAttribute('data-v')); });
      }
    });
    built = true;
  }

  // 分段按钮（斜体/对齐）当前取值
  function segValue(name) {
    var on = (inputs[name] || []).filter(function (b) { return b.classList.contains('on'); })[0];
    return on ? on.getAttribute('data-v') : '';
  }

  // 点击分段按钮：互斥选中并应用（斜体为开关）
  function toggleSeg(name, value) {
    if (name === 'italic') {
      var on = segValue(name) === 'italic';
      inputs[name].forEach(function (b) { b.classList.toggle('on', !on); });
      apply(name, on ? 'normal' : 'italic');
      return;
    }
    inputs[name].forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === value); });
    apply(name, value);
  }

  // 把字段值写入元素内联样式，并同步选中框
  function apply(name, value) {
    if (!el) return;
    WE.debouncedBefore();                            // 连续输入合并为一条撤销记录
    if (name === 'color' || name === 'background-color') {
      el.style[name] = value;
      var hexBox = inputs[name] && WE.ui.getRoot().querySelector('[data-hex="' + name + '"]');
      if (hexBox) hexBox.textContent = value;
    } else if (name === 'font-size' || name === 'border-radius') {
      el.style[name] = Math.max(0, parseFloat(value) || 0) + 'px';
    } else if (name === 'margin-top' || name === 'margin-right' || name === 'margin-bottom'
        || name === 'margin-left' || name === 'padding-top' || name === 'padding-right'
        || name === 'padding-bottom' || name === 'padding-left') {
      el.style[name] = (parseFloat(value) || 0) + 'px';
    } else if (name === 'italic') {
      el.style.fontStyle = value;
    } else if (name === 'align') {
      el.style.textAlign = value;
    } else {
      el.style[name] = value;                        // font-weight
    }
    WE.ui.syncNow();
  }

  // 从 computed style 读值填充面板（斜体/对齐按钮置高亮）
  function refresh(target) {
    // undo/redo 或重开编辑模式会重建 UI 宿主，旧面板节点脱链，检测后重建
    if (built && (!inputs['color'] || !inputs['color'][0] || !inputs['color'][0].isConnected)) {
      built = false;
      inputs = {};
    }
    if (!built && target) build();
    el = target;
    if (!target) {
      if (built) WE.ui.panelHost().style.display = 'none';
      return;
    }
    var cs = getComputedStyle(target);
    var setVal = function (name, v) { (inputs[name] || []).forEach(function (n) { if (n.value !== undefined) n.value = v; }); };
    setVal('color', WE.toHex(cs.color));
    var hexColor = WE.ui.getRoot().querySelector('[data-hex="color"]');
    if (hexColor) hexColor.textContent = WE.toHex(cs.color);
    setVal('font-size', Math.round(WE.px(cs.fontSize)));
    setVal('font-weight', String(Math.round(parseFloat(cs.fontWeight) / 100) * 100));
    var fwSel = inputs['font-weight'][0];   // computed 值不在选项列表（如 800）时回退 400
    if (fwSel && fwSel.value === '') fwSel.value = '400';
    inputs['italic'].forEach(function (b) { b.classList.toggle('on', cs.fontStyle === 'italic'); });
    var align = cs.textAlign === 'start' ? 'left' : cs.textAlign;
    inputs['align'].forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === align); });
    setVal('background-color', cs.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#ffffff' : WE.toHex(cs.backgroundColor));
    var hexBg = WE.ui.getRoot().querySelector('[data-hex="background-color"]');
    if (hexBg) hexBg.textContent = cs.backgroundColor === 'rgba(0, 0, 0, 0)' ? 'transparent' : WE.toHex(cs.backgroundColor);
    ['margin-top', 'margin-right', 'margin-bottom', 'margin-left',
     'padding-top', 'padding-right', 'padding-bottom', 'padding-left']
      .forEach(function (p) { setVal(p, Math.round(WE.px(cs[p]))); });
    setVal('border-radius', Math.round(WE.px(cs.borderTopLeftRadius)));
    if (visible) WE.ui.panelHost().style.display = 'block';
  }

  // 打开/关闭面板
  function toggle() {
    visible = !visible;
    WE.ui.panelHost().style.display = visible && el ? 'block' : 'none';
    if (visible && el) refresh(el);
  }

  // 退出编辑模式时重置：面板随宿主一起销毁，重新进入后按需重建
  function reset() {
    visible = false;
    built = false;
    inputs = {};
    el = null;
  }

  return {
    refresh: refresh,
    toggle: toggle,
    reset: reset,
  };
})();
