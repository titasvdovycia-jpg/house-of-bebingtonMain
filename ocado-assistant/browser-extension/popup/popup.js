document.getElementById('open-app').addEventListener('click', () => {
  // In dev, this would be localhost:5173 or similar
  chrome.tabs.create({ url: 'http://localhost:5173' });
});
