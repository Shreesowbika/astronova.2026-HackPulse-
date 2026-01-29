import json
import numpy as np
import os
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow Chrome Extension to connect

# =========================================================
# 1. CONFIGURATION & STATE
# =========================================================
MODEL_FILE = 'model_weights.json'

# SETTINGS FOR HACKATHON
MIN_UPDATES_FOR_AGGREGATION = 2  # Aggregates after every 2 user updates
SERVER_MOMENTUM = 0.9            # Stability Factor (0.9 = 90% stability, 10% new change)

# GLOBAL MEMORY
pending_updates = []   # The "Waiting Room" for user updates
velocity_buffer = {}   # The "Memory" of the model's past direction

# =========================================================
# 2. HELPER FUNCTIONS
# =========================================================
def load_global_weights():
    """Loads the Master Brain from disk."""
    if not os.path.exists(MODEL_FILE): 
        print(f"⚠️ Warning: {MODEL_FILE} not found. Please place it in the backend folder.")
        return None
    with open(MODEL_FILE, 'r') as f: 
        return json.load(f)

def save_global_weights(weights):
    """Saves the new Master Brain to disk."""
    with open(MODEL_FILE, 'w') as f: 
        json.dump(weights, f)
    print("💾 Global Model Updated & Saved to Disk!")

# =========================================================
# 3. THE "PRO" ALGORITHM: FEDAVGM (Federated Momentum)
# =========================================================
def aggregate_updates():
    """
    Advanced Aggregation: Uses Server Momentum to stabilize learning.
    This prevents 'Client Drift' and makes the model robust against bad data.
    """
    global pending_updates, velocity_buffer
    
    print(f"🔄 Running FedAvgM (Momentum {SERVER_MOMENTUM}) on {len(pending_updates)} clients...")
    
    global_weights = load_global_weights()
    if not global_weights: return

    # A. Calculate Simple Average first (The "Proposed" Update)
    proposed_decoder = []
    num_layers = len(global_weights['decoder'])
    
    for i in range(num_layers):
        # Collect this specific layer from all pending user updates
        layer_updates = [np.array(u['decoder'][i]) for u in pending_updates]
        
        # Calculate the mathematical average
        avg_update = np.mean(layer_updates, axis=0)
        proposed_decoder.append(avg_update)

    # B. Apply Server Momentum (The Stabilization)
    final_decoder = []
    
    # Initialize velocity buffer (Memory) if it's the first run
    if 'decoder' not in velocity_buffer:
        # Create a zero-filled memory of the same shape as our model
        velocity_buffer['decoder'] = [np.zeros_like(d) for d in proposed_decoder]

    for i in range(num_layers):
        # 1. Get Current State
        w_current = np.array(global_weights['decoder'][i])
        w_new_avg = proposed_decoder[i]
        
        # 2. Calculate the "Push" (Pseudo-Gradient)
        # "How much do the users want to change the model?"
        gradient = w_new_avg - w_current
        
        # 3. Update Momentum (Velocity)
        # New Speed = (0.9 * Old Speed) + (1.0 * New Push)
        v_old = velocity_buffer['decoder'][i]
        v_new = (SERVER_MOMENTUM * v_old) + gradient
        
        # Save this new speed for next time
        velocity_buffer['decoder'][i] = v_new
        
        # 4. Apply the Move
        # New Position = Old Position + New Speed
        w_final = w_current + v_new
        final_decoder.append(w_final.tolist())

    # C. Commit Changes
    global_weights['decoder'] = final_decoder
    save_global_weights(global_weights)
    
    # D. Clear the Waiting Room
    pending_updates = []
    print("✅ Global Intelligence Improved (with Momentum)!")

# =========================================================
# 4. API ENDPOINTS
# =========================================================
@app.route('/')
def home(): 
    return "🛡️ FairMarket Federated Server (FedAvgM Active)"

@app.route('/get-global-model', methods=['GET'])
def get_model():
    """Extensions call this to download the latest brain."""
    return send_file(MODEL_FILE, mimetype='application/json')

@app.route('/send-update', methods=['POST'])
def receive_update():
    """Extensions call this to upload their training results."""
    data = request.json
    
    # Basic Validation
    if 'decoder' not in data:
        return jsonify({"status": "error", "message": "Invalid format"}), 400
    
    # Add to Buffer
    pending_updates.append(data)
    print(f"📥 Received Update. Buffer: {len(pending_updates)}/{MIN_UPDATES_FOR_AGGREGATION}")
    
    # Check if we should trigger training
    if len(pending_updates) >= MIN_UPDATES_FOR_AGGREGATION:
        aggregate_updates()
        return jsonify({"status": "success", "message": "Aggregated with Momentum!"})
    
    return jsonify({"status": "accepted", "message": "Buffered"})

if __name__ == '__main__':
    print(f"🚀 Starting FedAvgM Server (Port 5000)...")
    app.run(host='0.0.0.0', port=5000, debug=True)