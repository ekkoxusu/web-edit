// popup：查询当前标签页编辑状态，点击切换；content script 不可达时给出针对性提示
const statusEl = document.getElementById('status');
const btn = document.getElementById('toggle');

// 渲染开关状态
function render(on) {
  statusEl.textContent = on ? '编辑模式已开启，可直接在页面中编辑' : '编辑模式未开启';
  btn.textContent = on ? '退出编辑' : '开启编辑';
  btn.dataset.on = String(on);
}

// 页面不可注入（chrome:// 内部页、商店页、未开权限的 file:// 页）
function unavailable(msg) {
  statusEl.textContent = msg;
  btn.disabled = true;
}

// 查询当前标签页状态
async function queryTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return unavailable('无法获取当前标签页');
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'get-state' });
    render(!!res.on);
  } catch (e) {
    const isFile = (tab.url || '').startsWith('file:');
    unavailable(isFile
      ? '未连接到页面：编辑本地 HTML 需先在扩展详情开启「允许访问文件网址」'
      : '此页面暂不支持（浏览器内部页面无法注入）');
  }
}

// 切换编辑模式并关闭弹窗
btn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'toggle-edit' });
    render(!!res.on);
  } catch (e) {
    unavailable('操作失败，请刷新页面后重试');
    return;
  }
  window.close();
});

queryTab();
