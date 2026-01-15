// Load stats when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  // Get stats from storage
  const stats = await chrome.storage.local.get(['scannedCount', 'biasCount', 'status']);
  
  // Update UI
  document.getElementById('scanned').textContent = stats.scannedCount || 0;
  document.getElementById('bias-count').textContent = stats.biasCount || 0;
  document.getElementById('status').textContent = stats.status || 'Active';
  
  // Make status green if active
  if (stats.status === 'Active') {
    document.getElementById('status').style.color = '#10b981';
  }
});

// Settings button
document.getElementById('settings-btn').addEventListener('click', () => {
  alert('Settings panel coming soon!');
});

// Report button
document.getElementById('report-btn').addEventListener('click', () => {
  // Open reports page (we'll build this later)
  alert('Reports dashboard coming soon!');
});

// Listen for updates from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STATS_UPDATE') {
    document.getElementById('scanned').textContent = message.scanned;
    document.getElementById('bias-count').textContent = message.biasCount;
  }
});