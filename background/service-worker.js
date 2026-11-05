// 快捷键转发：Alt+Shift+E 切换当前标签页的编辑模式（发消息给 content script）
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-edit') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-edit' }).catch(() => {});
  }
});
