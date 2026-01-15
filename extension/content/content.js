console.log('🛡️ FairMarket AI: Extension loaded on', window.location.hostname);

// Configuration for different e-commerce sites
const SITE_CONFIG = {
  'amazon.in': {
    name: 'Amazon India',
    priceSelectors: [
      '.a-price-whole',
      '.a-offscreen',
      'span.a-price span.a-offscreen'
    ],
    productSelectors: [
      '#productTitle',
      'h1.product-title'
    ]
  },
  'flipkart.com': {
    name: 'Flipkart',
    priceSelectors: [
      '._30jeq3',
      '._16Jk6d',
      'div._30jeq3'
    ],
    productSelectors: [
      '.B_NuCI',
      'span.B_NuCI'
    ]
  },
  'myntra.com': {
    name: 'Myntra',
    priceSelectors: [
      '.pdp-price strong',
      'span.pdp-price'
    ],
    productSelectors: [
      '.pdp-title',
      'h1.pdp-name'
    ]
  }
};

// Get current site config
function getSiteConfig() {
  const hostname = window.location.hostname;
  for (let domain in SITE_CONFIG) {
    if (hostname.includes(domain)) {
      return SITE_CONFIG[domain];
    }
  }
  return null;
}

// Extract price from page
function extractPrice() {
  const config = getSiteConfig();
  if (!config) return null;
  
  // Try each selector
  for (let selector of config.priceSelectors) {
    const elements = document.querySelectorAll(selector);
    for (let element of elements) {
      const text = element.textContent || element.innerText;
      // Extract numbers from text (handles ₹45,999 or 45,999 or 45999)
      const match = text.replace(/,/g, '').match(/(\d+)/);
      if (match && match[1]) {
        const price = parseInt(match[1]);
        if (price > 100 && price < 1000000) { // Sanity check
          console.log('💰 Price detected:', price);
          return price;
        }
      }
    }
  }
  
  return null;
}

// Extract product name
function extractProductName() {
  const config = getSiteConfig();
  if (!config) return 'Unknown Product';
  
  for (let selector of config.productSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent.trim();
    }
  }
  
  return 'Unknown Product';
}

// Simple bias detection (for Day 1 - we'll upgrade this)
function detectBias(price) {
  // For now, we'll use a simple threshold
  // Products over ₹50,000 get flagged (just for testing)
  // Tomorrow we'll add real VAE model
  
  if (price > 50000) {
    return {
      isBiased: true,
      confidence: 0.75,
      reason: 'HIGH_PRICE',
      message: 'This price seems unusually high compared to typical range'
    };
  }
  
  return {
    isBiased: false,
    confidence: 0.0,
    reason: 'NORMAL',
    message: 'Price appears normal'
  };
}

// Inject alert on page
function showBiasAlert(price, productName, biasInfo) {
  // Check if alert already exists
  if (document.getElementById('fairmarket-alert')) {
    return; // Don't duplicate
  }
  
  // Create alert container
  const alertDiv = document.createElement('div');
  alertDiv.id = 'fairmarket-alert';
  alertDiv.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 999999;
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease-out;
    ">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">⚠️</span>
          <strong style="font-size: 16px;">Potential Bias Detected</strong>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        ">×</button>
      </div>
      
      <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
        <div style="font-size: 13px; margin-bottom: 8px;">
          <strong>Product:</strong> ${productName.substring(0, 50)}...
        </div>
        <div style="font-size: 13px; margin-bottom: 8px;">
          <strong>Detected Price:</strong> ₹${price.toLocaleString('en-IN')}
        </div>
        <div style="font-size: 13px;">
          <strong>Confidence:</strong> ${(biasInfo.confidence * 100).toFixed(0)}%
        </div>
      </div>
      
      <div style="font-size: 12px; line-height: 1.5; margin-bottom: 15px; opacity: 0.95;">
        ${biasInfo.message}
      </div>
      
      <div style="display: flex; gap: 8px;">
        <button style="
          flex: 1;
          background: white;
          color: #ff6b6b;
          border: none;
          padding: 10px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        ">Learn More</button>
        <button style="
          flex: 1;
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.5);
          padding: 10px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        ">Dismiss</button>
      </div>
      
      <div style="margin-top: 12px; font-size: 10px; text-align: center; opacity: 0.7;">
        Powered by FairMarket AI
      </div>
    </div>
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Add to page
  document.body.appendChild(alertDiv);
  
  console.log('✅ Alert injected on page');
}

// Main detection logic
async function scanPage() {
  console.log('🔍 Scanning page for prices...');
  
  const config = getSiteConfig();
  if (!config) {
    console.log('❌ Site not supported yet');
    return;
  }
  
  console.log('✅ Supported site:', config.name);
  
  // Extract price
  const price = extractPrice();
  if (!price) {
    console.log('❌ No price found on page');
    return;
  }
  
  console.log('💰 Price found:', price);
  
  // Extract product name
  const productName = extractProductName();
  console.log('📦 Product:', productName);
  
  // Detect bias
  const biasInfo = detectBias(price);
  console.log('🤖 Bias analysis:', biasInfo);
  
  // Update stats
  const stats = await chrome.storage.local.get(['scannedCount', 'biasCount']);
  const newScanned = (stats.scannedCount || 0) + 1;
  const newBiasCount = biasInfo.isBiased ? (stats.biasCount || 0) + 1 : (stats.biasCount || 0);
  
  await chrome.storage.local.set({
    scannedCount: newScanned,
    biasCount: newBiasCount,
    status: 'Active'
  });
  
  // Show alert if bias detected
  if (biasInfo.isBiased) {
    console.log('🚨 BIAS DETECTED! Showing alert...');
    showBiasAlert(price, productName, biasInfo);
  } else {
    console.log('✅ No bias detected');
  }
}

// Run scan when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanPage);
} else {
  // DOM already loaded
  setTimeout(scanPage, 1000); // Wait 1 sec for dynamic content
}

// Also scan when URL changes (for single-page apps)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(scanPage, 2000); // Wait 2 sec after navigation
  }
}).observe(document, {subtree: true, childList: true});

console.log('✅ FairMarket AI: Monitoring active');