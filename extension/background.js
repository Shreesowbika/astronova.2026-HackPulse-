// Initialize stats on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('FairMarket AI installed!');
  
  chrome.storage.local.set({
    scannedCount: 0,
    biasCount: 0,
    status: 'Active'
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message);
  
  if (message.type === 'BIAS_DETECTED') {
    // We'll add backend communication here tomorrow
    console.log('Bias detected:', message.data);
  }
  
  return true;
});