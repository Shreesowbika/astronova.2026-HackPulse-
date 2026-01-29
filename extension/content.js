console.log('🛡️ FairMarket AI: Initializing Federated Engine...');

// =========================================================
// 1. CONFIGURATION
// =========================================================
const CONFIG = {
    MAX_PRICE: 500000.0,
    MAX_RAM: 64.0,
    THRESHOLD: 0.005,
    BIAS_TOLERANCE: 0.015,
    MAX_ERROR_CAP: 0.15,
    
    TYPE_MAP: {'notebook': 0, 'ultrabook': 1, 'gaming': 2, 'workstation': 3, 'convertible': 4, 'netbook': 5},
    COMPANY_MAP: {
        'apple': 0, 'hp': 1, 'lenovo': 2, 'asus': 3, 'dell': 4, 'acer': 5, 'msi': 6, 
        'toshiba': 7, 'microsoft': 8, 'xiaomi': 9, 'huawei': 10, 'razer': 11, 'samsung': 12
    },
    
    // MULTI-SITE SELECTORS (Fallback only)
    SITE_CONFIGS: {
        'amazon': {
            domain: 'amazon.in',
            productPagePattern: /\/(dp|gp\/product)\//,
            selectors: {
                price: ['.a-price-whole', '.a-price .a-offscreen'],
                title: '#productTitle',
                specs: '#productDetails_techSpec_section_1'
            }
        },
        'flipkart': {
            domain: 'flipkart.com',
            productPagePattern: /\/p\//,
            selectors: {
                price: ['.hZ3P6w', 'div.hZ3P6w', '.Nx9bqj', '._30jeq3._16Jk6d', '._30jeq3', '._16Jk6d'],
                title: ['.LMizgS', 'span.LMizgS', '.VU-ZEz', '.B_NuCI', 'span.B_NuCI', 'h1.yhB1nd', 'span.VU-ZEz'],
                specs: ['._1mKqjD', 'div._1mKqjD', '._2418kt']
            }
        }
    }
};

// =========================================================
// 2. SITE DETECTOR
// =========================================================
function detectSite() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('amazon')) return 'amazon';
    if (hostname.includes('flipkart')) return 'flipkart';
    
    return null;
}

// =========================================================
// 3. SEO METADATA EXTRACTOR (PRIMARY METHOD)
// =========================================================
function extractFromSEOMetadata() {
    try {
        // Method 1: JSON-LD Schema.org (Most Reliable)
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        
        for (let script of jsonLdScripts) {
            try {
                const data = JSON.parse(script.textContent);
                
                // Handle both single objects and arrays
                const products = Array.isArray(data) ? data : [data];
                
                for (let item of products) {
                    // Check if it's a Product schema
                    if (item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product') {
                        const name = (item.name || '').toLowerCase();
                        const price = parseFloat(
                            (item.offers?.price || item.offers?.lowPrice || '0').toString().replace(/[^0-9.]/g, '')
                        );
                        
                        if (price > 0 && name) {
                            console.log('✅ Extracted from JSON-LD Schema.org');
                            console.log('📝 Product:', name.substring(0, 50));
                            console.log('💰 Price:', price);
                            return { name, price };
                        }
                    }
                }
            } catch (e) {
                continue; // Try next script
            }
        }
        
        // Method 2: Open Graph Meta Tags (Fallback)
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const ogPriceAmount = document.querySelector('meta[property="product:price:amount"]')?.content || 
                              document.querySelector('meta[property="og:price:amount"]')?.content || '';
        
        if (ogTitle && ogPriceAmount) {
            const price = parseFloat(ogPriceAmount.replace(/[^0-9.]/g, ''));
            if (price > 0) {
                console.log('✅ Extracted from Open Graph meta tags');
                return { name: ogTitle.toLowerCase(), price };
            }
        }
        
        // Method 3: Twitter Card Meta Tags (Another Fallback)
        const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.content || '';
        const twitterData = document.querySelector('meta[name="twitter:data1"]')?.content || '';
        
        if (twitterTitle && twitterData) {
            const price = parseFloat(twitterData.replace(/[^0-9.]/g, ''));
            if (price > 0) {
                console.log('✅ Extracted from Twitter Card meta tags');
                return { name: twitterTitle.toLowerCase(), price };
            }
        }
        
        console.warn('⚠️ No SEO metadata found, falling back to DOM scraping');
        return null;
        
    } catch (e) {
        console.error('❌ SEO extraction failed:', e);
        return null;
    }
}

// =========================================================
// 4. SMART DOM READER (FALLBACK METHOD)
// =========================================================
function waitForElement(selectors, timeout = 10000) {
    return new Promise((resolve) => {
        for (let selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText) {
                resolve(element);
                return;
            }
        }
        
        const startTime = Date.now();
        const observer = new MutationObserver(() => {
            for (let selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.innerText) {
                    observer.disconnect();
                    resolve(element);
                    return;
                }
            }
            
            if (Date.now() - startTime > timeout) {
                observer.disconnect();
                resolve(null);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

async function extractFromDOM() {
    const site = detectSite();
    if (!site) return null;
    
    const siteConfig = CONFIG.SITE_CONFIGS[site];
    
    try {
        console.log('🔄 Falling back to DOM scraping...');
        
        const priceElement = await waitForElement(
            Array.isArray(siteConfig.selectors.price) 
                ? siteConfig.selectors.price 
                : [siteConfig.selectors.price],
            15000
        );
        
        if (!priceElement) {
            console.warn('❌ Price not found in DOM');
            return null;
        }
        
        let priceText = priceElement.innerText || priceElement.textContent;
        let price = parseFloat(priceText.replace(/[^0-9]/g, ''));
        
        if (price === 0 || isNaN(price)) {
            console.warn('❌ Invalid price from DOM:', priceText);
            return null;
        }
        
        const titleElement = await waitForElement(
            Array.isArray(siteConfig.selectors.title) 
                ? siteConfig.selectors.title 
                : [siteConfig.selectors.title]
        );
        
        let name = titleElement ? (titleElement.innerText || titleElement.textContent).toLowerCase() : "";
        
        console.log('✅ Extracted from DOM');
        return { name, price };
        
    } catch (e) { 
        console.error('❌ DOM extraction failed:', e);
        return null; 
    }
}

// =========================================================
// 5. UNIVERSAL FEATURE EXTRACTOR (USES SEO FIRST)
// =========================================================
async function extractFeatures() {
    const site = detectSite();
    if (!site) return null;
    
    const siteConfig = CONFIG.SITE_CONFIGS[site];
    
    // Check if we're on a product page
    if (!siteConfig.productPagePattern.test(window.location.pathname)) {
        return null;
    }
    
    console.log(`🔍 Analyzing ${site.toUpperCase()} product page...`);
    
    // TRY SEO METADATA FIRST (More Reliable)
    let productData = extractFromSEOMetadata();
    
    // FALLBACK TO DOM SCRAPING
    if (!productData) {
        productData = await extractFromDOM();
    }
    
    if (!productData || !productData.price) {
        console.warn('❌ Could not extract product data');
        return null;
    }
    
    const { name, price } = productData;
    
    // Extract Brand
    let brandIdx = 13; 
    for (let b in CONFIG.COMPANY_MAP) {
        if (name.includes(b)) { 
            brandIdx = CONFIG.COMPANY_MAP[b]; 
            console.log(`🏷️ Brand detected: ${b}`);
            break; 
        }
    }
    
    // Extract Type
    let typeIdx = 0;
    if (name.includes('gaming') || name.includes('rog') || name.includes('alienware') || name.includes('tuf')) {
        typeIdx = 2;
        console.log('🎮 Type: Gaming');
    } else if (name.includes('ultrabook') || name.includes('macbook') || name.includes('air')) {
        typeIdx = 1;
        console.log('✈️ Type: Ultrabook');
    }
    
    // Extract RAM
    let ram = 8; // default
    let ramMatch = name.match(/(\d+)\s*gb\s*(ram|ddr)/i);
    if (ramMatch) {
        ram = parseInt(ramMatch[1]);
        console.log(`💾 RAM detected: ${ram}GB`);
    }
    
    console.log(`✅ Feature vector created successfully`);
    return [
        typeIdx / 5.0, 
        brandIdx / 13.0, 
        ram / CONFIG.MAX_RAM, 
        price / CONFIG.MAX_PRICE
    ];
}

// =========================================================
// 6. MATH ENGINE (Tiny-VAE Logic)
// =========================================================
const MathOps = {
    dense: (input, weights, bias, activation) => {
        let output = [];
        for (let j = 0; j < weights[0].length; j++) {
            let sum = 0;
            for (let i = 0; i < input.length; i++) sum += input[i] * weights[i][j];
            if (bias) sum += bias[j];
            if (activation === 'relu') output.push(Math.max(0, sum));
            else if (activation === 'sigmoid') output.push(1 / (1 + Math.exp(-sum)));
            else output.push(sum);
        }
        return output;
    }
};

// =========================================================
// 7. AI MODEL CLASS
// =========================================================
class TinyVAE {
    constructor() {
        this.weights = null;
        this.loaded = false;
    }

    async loadBrain() {
        try {
            console.log("📡 Connecting to Central Server...");
            const response = await fetch('http://localhost:5000/get-global-model');
            this.weights = await response.json();
            this.loaded = true;
            console.log("🧠 Global Intelligence Downloaded from Server!");
        } catch (e) {
            console.warn("⚠️ Server Offline. Falling back to local cache...");
            const url = chrome.runtime.getURL('model_weights.json');
            const localResp = await fetch(url);
            this.weights = await localResp.json();
            this.loaded = true;
            console.log("📂 Local Weights Loaded (Server Unreachable).");
        }
    }

    predict(features) {
        if (!this.loaded) return null;

        let h1 = MathOps.dense(features, this.weights.encoder[0], this.weights.encoder[1], 'relu');
        let h2 = MathOps.dense(h1, this.weights.encoder[2], this.weights.encoder[3], 'relu');
        let z_mean = MathOps.dense(h2, this.weights.encoder[4], this.weights.encoder[5], 'linear');

        let d1 = MathOps.dense(z_mean, this.weights.decoder[0], this.weights.decoder[1], 'relu');
        let d2 = MathOps.dense(d1, this.weights.decoder[2], this.weights.decoder[3], 'relu');
        let reconstructed = MathOps.dense(d2, this.weights.decoder[4], this.weights.decoder[5], 'sigmoid');

        return reconstructed;
    }
}

// =========================================================
// 8. MAIN LOGIC
// =========================================================
const ai = new TinyVAE();
ai.loadBrain(); 

async function runAnalysis() {
    const site = detectSite();
    if (!site) return;
    
    if (!ai.loaded) { 
        setTimeout(runAnalysis, 500); 
        return; 
    }

    const inputVector = await extractFeatures();
    if (!inputVector) return;
    
    const outputVector = ai.predict(inputVector);
    
    const realPrice = inputVector[3] * CONFIG.MAX_PRICE;
    const fairPrice = outputVector[3] * CONFIG.MAX_PRICE;
    const error = Math.abs(inputVector[3] - outputVector[3]);

    console.log(`📉 Analysis: Real ₹${realPrice.toFixed(0)} vs Fair ₹${fairPrice.toFixed(0)} | Error: ${error.toFixed(4)}`);

    // Log for federated learning if error exceeds threshold
    if (error > CONFIG.THRESHOLD) {
        logForFederatedLearning(inputVector, outputVector, error);
    }

    // ALWAYS SHOW POPUP - Color based on price comparison
    if (error < CONFIG.MAX_ERROR_CAP) {
        if (inputVector[3] > outputVector[3] && error > CONFIG.BIAS_TOLERANCE) {
            console.warn("🚨 PRICE BIAS DETECTED (High)");
            showColoredPopup(realPrice, fairPrice, error, 'overpriced');
        } else if (inputVector[3] < outputVector[3] && error > CONFIG.THRESHOLD) {
            console.log("💎 GOOD DEAL DETECTED (Low Price)");
            showColoredPopup(realPrice, fairPrice, error, 'deal');
        } else {
            console.log("✅ FAIR PRICE DETECTED");
            showColoredPopup(realPrice, fairPrice, error, 'fair');
        }
    } else {
        console.log("⚠️ Price variance too high - model needs more training data from this platform");
    }
}

// =========================================================
// 9. FEDERATED LEARNING LOGGER
// =========================================================
function logForFederatedLearning(input, output, error) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        site: detectSite(),
        features: input,
        reconstruction_error: error,
        type: (input[3] > output[3]) ? "OVERPRICED_BIAS" : "UNDERPRICED_DEAL"
    };

    chrome.storage.local.get({trainingLogs: []}, function(result) {
        let logs = result.trainingLogs;
        logs.push(logEntry);
        chrome.storage.local.set({trainingLogs: logs}, function() {
            console.log("📥 Data Logged for Tonight's Training:", logEntry.type);
        });
    });
}

// =========================================================
// 10. UI: COLORED POPUP (Red/Green/Blue)
// =========================================================
function showColoredPopup(real, fair, err, type) {
    if (document.getElementById('fairmarket-alert')) return;
    
    let headerColor, headerIcon, headerText, messageText, priceColor;
    
    if (type === 'overpriced') {
        headerColor = '#ff4757';
        headerIcon = '⚠️';
        headerText = 'Potential Price Bias';
        messageText = 'This price is <b>higher</b> than our AI model expected based on market patterns.';
        priceColor = '#ff4757';
    } else if (type === 'deal') {
        headerColor = '#2196F3';
        headerIcon = '💎';
        headerText = 'Good Deal Detected';
        messageText = 'This price is <b>lower</b> than our AI model expected. Could be a great deal!';
        priceColor = '#2196F3';
    } else {
        headerColor = '#2ed573';
        headerIcon = '✅';
        headerText = 'Fair Price';
        messageText = 'This price matches our AI model\'s market expectations.';
        priceColor = '#2ed573';
    }
    
    const div = document.createElement('div');
    div.id = 'fairmarket-alert';
    div.innerHTML = `
        <div style="position:fixed; top:130px; right:20px; width:320px; background:white; 
             box-shadow:0 8px 30px rgba(0,0,0,0.3); border-radius:12px; z-index:99999; font-family:sans-serif; animation: slideIn 0.5s;">
            <div style="background:${headerColor}; color:white; padding:15px; font-weight:bold; border-radius:12px 12px 0 0; display:flex; justify-content:space-between;">
                <span>${headerIcon} ${headerText}</span>
                <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer;">×</span>
            </div>
            <div style="padding:20px;">
                <div style="font-size:14px; color:#333; margin-bottom:10px;">
                    ${messageText}
                </div>
                <div style="background:#f8f9fa; padding:10px; border-radius:6px; font-size:13px; border:1px solid #e9ecef;">
                    <div>Listing Price: <b style="color:${priceColor}">₹${Math.round(real).toLocaleString()}</b></div>
                    <div>Fair Estimate: <b style="color:#555">~₹${Math.round(fair).toLocaleString()}</b></div>
                </div>
                <div style="margin-top:10px; font-size:10px; color:#888;">
                    ${err > CONFIG.THRESHOLD ? 'Data logged for Federated Learning.' : 'No training needed - price within normal range.'}
                </div>
            </div>
        </div>
        <style> @keyframes slideIn { from { transform: translateX(120%); } to { transform: translateX(0); } } </style>
    `;
    document.body.appendChild(div);
}

// =========================================================
// 11. INITIALIZATION
// =========================================================
window.addEventListener('load', () => setTimeout(runAnalysis, 3000));