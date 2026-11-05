// 保存/导出：序列化当前 DOM 为完整 HTML 文档；优先 File System Access API 写回原文件
// （首次弹系统对话框选目标，之后静默写回），不支持 FSA 或失败时降级为浏览器下载。
WE.saver = (function () {
  var handle = null;  // 会话内记住的文件句柄，二次保存免选

  // 生成完整 HTML 字符串：先收尾文字编辑、临时摘除扩展 UI 宿主与 html 上的临时内联样式
  function snapshot() {
    if (WE.state === 'editing') WE.interactions.finishTextEdit();
    var host = WE.ui.getHost();
    var attached = host && host.isConnected;
    if (attached) host.remove();
    // 清理编辑模式写入 <html> 的 cursor/user-select，避免污染导出文件
    var htmlEl = document.documentElement;
    var savedCursor = htmlEl.style.cursor, savedSelect = htmlEl.style.userSelect;
    htmlEl.style.cursor = '';
    htmlEl.style.userSelect = '';
    var html = '<!DOCTYPE html>\n' + htmlEl.outerHTML;
    htmlEl.style.cursor = savedCursor;
    htmlEl.style.userSelect = savedSelect;
    if (attached) (document.body || document.documentElement).appendChild(host);
    return html;
  }

  // 当前文件名（file:// 与 http 均取路径最后一段，无扩展名时回退；畸形编码序列回退原串）
  function filename() {
    var raw = (location.pathname.split('/').pop() || '').trim();
    var name;
    try { name = decodeURIComponent(raw); } catch (e) { name = raw; }
    return /\.html?$/i.test(name) ? name : 'page.html';
  }

  // 主入口：saveAs=true 强制弹出另存对话框
  async function save(saveAs) {
    var html = snapshot();
    if (typeof window.showSaveFilePicker === 'function') {
      if (!saveAs && handle) {
        try {
          if (await ensurePermission(handle)) {
            await write(handle, html);                // 已有授权句柄，静默写回
            return;
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          // 缓存句柄失效（文件被移动/删除）：作废句柄，改走选择器重新指定
          handle = null;
          console.warn('[WebEdit] 缓存句柄写回失败，需重新选择文件:', err);
        }
      }
      try {
        var picker = await window.showSaveFilePicker({
          suggestedName: filename(),
          types: [{ description: 'HTML 文档', accept: { 'text/html': ['.html', '.htm'] } }],
        });
        handle = picker;
        return write(picker, html);
      } catch (err) {
        if (err && err.name === 'AbortError') return; // 用户取消保存
        console.warn('[WebEdit] 直接写回不可用，降级为下载:', err);
      }
    }
    download(html);
  }

  // 句柄权限确认（requestPermission 需要用户手势，保存按钮/快捷键满足）
  async function ensurePermission(h) {
    var opts = { mode: 'readwrite' };
    if ((await h.queryPermission(opts)) === 'granted') return true;
    return (await h.requestPermission(opts)) === 'granted';
  }

  // 写入文件并提示
  async function write(h, html) {
    var w = await h.createWritable();
    await w.write(new Blob([html], { type: 'text/html' }));
    await w.close();
    WE.ui.toast('已保存 ✓');
  }

  // 降级方案：构造 Blob 触发浏览器下载
  function download(html) {
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = filename();
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    WE.ui.toast('写回不可用，已下载 ' + filename());
  }

  return {
    snapshot: snapshot,
    save: save,
  };
})();
