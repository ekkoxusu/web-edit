// 全局命名空间与公共工具（各 content script 按序注入共享）
var WE = window.WE = {
  state: 'off',      // off | hover | selected | editing | dragging | resizing
  selected: null,    // 当前选中元素
};

// 数值夹取
WE.clamp = function (v, min, max) {
  return Math.min(max, Math.max(min, v));
};

// 阻止事件冒泡与默认行为（编辑模式下拦截页面自身交互）
WE.eat = function (e) {
  e.preventDefault();
  e.stopPropagation();
};

// rgb()/rgba() 颜色转 #rrggbb，供颜色输入框初始化
WE.toHex = function (color) {
  var s = String(color);
  if (s.charAt(0) === '#') return s;
  var m = s.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return '#000000';
  var hex = function (n) { return ('0' + parseInt(n, 10).toString(16)).slice(-2); };
  return '#' + hex(m[1]) + hex(m[2]) + hex(m[3]);
};

// 简单发布订阅：模块间解耦通信（如历史变化后刷新按钮态）
WE.bus = (function () {
  var map = {};
  return {
    on: function (type, fn) { (map[type] = map[type] || []).push(fn); },
    emit: function (type, arg) { (map[type] || []).forEach(function (fn) { fn(arg); }); },
  };
})();

// 从 computed style 解析像素数值，非像素值回退为 0
WE.px = function (value) {
  var n = parseFloat(value);
  return isNaN(n) ? 0 : n;
};

// 当前元素的 CSS 独立 translate 分量（用于拖拽/缩放补偿，不覆盖 transform）
WE.getTranslate = function (el) {
  var parts = getComputedStyle(el).translate.split(' ').map(parseFloat).filter(function (n) { return !isNaN(n); });
  return parts.length >= 2 ? { x: parts[0], y: parts[1] } : { x: parts[0] || 0, y: 0 };
};

// 写入 CSS 独立 translate 属性（序列化导出时自然保留）
WE.setTranslate = function (el, x, y) {
  el.style.translate = Math.round(x) + 'px ' + Math.round(y) + 'px';
};

// 防抖记录历史：连续快速修改（方向键连按/面板连续输入）合并为一条撤销记录
WE.debouncedBefore = (function () {
  var pending = false, timer = 0;
  return function () {
    if (!pending) {
      WE.history.before();
      pending = true;
    }
    clearTimeout(timer);
    timer = setTimeout(function () { pending = false; }, 600);
  };
})();
