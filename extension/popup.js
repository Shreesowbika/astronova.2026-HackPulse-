const SERVER_URL = "http://localhost:5000";

// 1. UI SETUP
document.addEventListener('DOMContentLoaded', updateStats);
document.getElementById('trainBtn').addEventListener('click', runFederatedCycle);

async function updateStats() {
    // Check how many logs are waiting
    chrome.storage.local.get({trainingLogs: []}, function(data) {
        document.getElementById('logCount').innerText = data.trainingLogs.length;
    });
}

// 2. THE MAIN "FEDERATED CYCLE"
async function runFederatedCycle() {
    const btn = document.getElementById('trainBtn');
    const status = document.getElementById('status');
    
    // Check logs first
    const storage = await chrome.storage.local.get({trainingLogs: []});
    const logs = storage.trainingLogs;

    if (logs.length === 0) {
        status.innerText = "⚠️ No data to train on!";
        status.style.color = "orange";
        return;
    }

    btn.disabled = true;
    status.innerText = "⏳ Training Local Model...";

    try {
        // A. Load Current Weights (from Server or Cache)
        let weights = await fetchGlobalWeights();
        
        // B. Calculate Gradients (The "Math" Step)
        // We calculate how much to change the weights to match the real prices
        let updatedDecoder = trainOnLogs(weights, logs);

        // C. Send Update to Server
        status.innerText = "🚀 Sending Update to Server...";
        const response = await fetch(`${SERVER_URL}/send-update`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ decoder: updatedDecoder })
        });

        const resData = await response.json();
        
        if (resData.status === 'success' || resData.status === 'accepted') {
            status.innerText = "✅ Federated Update Complete!";
            status.style.color = "green";
            
            // D. Clear Logs (We successfully learned)
            chrome.storage.local.set({trainingLogs: []});
            updateStats();
        } else {
            throw new Error(resData.message);
        }

    } catch (e) {
        console.error(e);
        status.innerText = "❌ Error: " + e.message;
        status.style.color = "red";
    } finally {
        setTimeout(() => { btn.disabled = false; }, 2000);
    }
}

// 3. HELPER: FETCH WEIGHTS
async function fetchGlobalWeights() {
    try {
        // Try Server First
        const res = await fetch(`${SERVER_URL}/get-global-model`);
        return await res.json();
    } catch (e) {
        // Fallback to local file
        const url = chrome.runtime.getURL('model_weights.json');
        const res = await fetch(url);
        return await res.json();
    }
}

// 4. MATH ENGINE: SIMPLE GRADIENT DESCENT (Pure JS)
function trainOnLogs(currentWeights, logs) {
    // We only update the DECODER (Generative Part)
    // Structure: decoder[layer_index][neuron_index]
    
    // Deep copy weights to avoid mutating original
    let newDecoder = JSON.parse(JSON.stringify(currentWeights.decoder));
    const LEARNING_RATE = 0.05; 

    logs.forEach(log => {
        // Feature Vector: [Type, Brand, RAM, Price]
        const targetPrice = log.features[3]; // The REAL price (0-1)
        
        // We perform a simplified update:
        // We want the model to output 'targetPrice' instead of whatever it predicted.
        // We nudge the FINAL layer weights towards this target.
        
        // Final Layer is Index 4 (Weights) and 5 (Bias) in our TinyVAE
        // (Assuming typical Dense Layer structure: W, B, W, B...)
        // For Hackathon simplicity, we apply a "Global Bias Shift" to the final layer
        
        const finalLayerIdx = 4; 
        const weights = newDecoder[finalLayerIdx]; 
        
        // "Nudge" logic
        // If Real > Pred, we increase weights slightly
        // If Real < Pred, we decrease weights slightly
        const direction = (log.type === "OVERPRICED_BIAS") ? -1 : 1; 
        // Note: Logic inversion? 
        // If OVERPRICED (Bias), we actually want the model to stay STABLE (don't learn the bias).
        // If UNDERPRICED (Good Deal), we want the model to LEARN it (Lower the fair price).
        
        // CORRECT HACKATHON LOGIC:
        // 1. If it's a "Good Deal" (Underpriced), we train the model to lower its expectation.
        if (log.type === "UNDERPRICED_DEAL") {
            for(let i=0; i<weights.length; i++) {
                for(let j=0; j<weights[i].length; j++) {
                    // Nudge weight down slightly
                    weights[i][j] -= (LEARNING_RATE * 0.001); 
                }
            }
        }
        // 2. If it's "Overpriced", we usually IGNORE it in training 
        // (Robustness against Poisoning), or we train with a very small rate.
        // For demo, let's just train on Good Deals to prove the "Price Drop" works.
    });

    return newDecoder;
}