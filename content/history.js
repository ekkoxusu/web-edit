// 撤销/重做：保存 outerHTML 快照双栈，undo/redo 时整体恢复 DOM。
// 核心场景是静态 HTML 文件编辑，整体替换最简单可靠；页面自身脚本的事件绑定会丢失（已接受的取舍）。
WE.history = {
  undoStack: [],
  redoStack: [],
  MAX: 50,

  // 每次破坏性操作开始前调用：记录当前快照，清空 redo
  before: function () {
    this.undoStack.push(WE.saver.snapshot());
    if (this.undoStack.length > this.MAX) this.undoStack.shift();
    this.redoStack.length = 0;
    WE.bus.emit('history-change');
  },

  // 若操作未产生实际变化，调用方回滚最近一条快照（如进入文字编辑但没改字）
  dropLast: function () {
    this.undoStack.pop();
    WE.bus.emit('history-change');
  },

  canUndo: function () { return this.undoStack.length > 0; },
  canRedo: function () { return this.redoStack.length > 0; },

  undo: function () {
    if (!this.canUndo()) return;
    this.redoStack.push(WE.saver.snapshot());
    this.apply(this.undoStack.pop());
  },

  redo: function () {
    if (!this.canRedo()) return;
    this.undoStack.push(WE.saver.snapshot());
    this.apply(this.redoStack.pop());
  },

  // 用快照替换整个文档树，随后重挂 UI 并清除失效的选中状态
  apply: function (html) {
    var parsed = new DOMParser().parseFromString(html, 'text/html');
    document.documentElement.replaceWith(parsed.documentElement);
    WE.selected = null;
    WE.state = 'hover';
    WE.ui.ensure();        // html 已被替换，UI 宿主随之丢失，需重挂
    document.documentElement.style.cursor = 'crosshair';  // 快照不含临时样式，重设编辑光标
    WE.ui.deselect();
    WE.bus.emit('history-change');
  },
};
