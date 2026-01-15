from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allow extension to connect

# In-memory storage (we'll add database tomorrow)
price_reports = []
stats = {
    'total_users': 0,
    'total_scans': 0,
    'bias_detected': 0
}

@app.route('/')
def home():
    return jsonify({
        'status': 'FairMarket AI Backend Running',
        'version': '1.0.0',
        'stats': stats
    })

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/api/report-price', methods=['POST'])
def report_price():
    """Receive price reports from extensions"""
    data = request.json
    
    # Store report
    report = {
        'price': data.get('price'),
        'product': data.get('product'),
        'location': data.get('location', 'unknown'),
        'timestamp': datetime.now().isoformat(),
        'bias_detected': data.get('bias_detected', False)
    }
    
    price_reports.append(report)
    
    # Update stats
    stats['total_scans'] += 1
    if report['bias_detected']:
        stats['bias_detected'] += 1
    
    return jsonify({
        'status': 'success',
        'message': 'Price report received',
        'report_id': len(price_reports)
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get current statistics"""
    return jsonify(stats)

@app.route('/api/price-comparison', methods=['POST'])
def price_comparison():
    """Compare prices across locations (placeholder for now)"""
    data = request.json
    product = data.get('product')
    
    # Filter reports for this product
    product_reports = [r for r in price_reports if product.lower() in r['product'].lower()]
    
    if len(product_reports) < 2:
        return jsonify({
            'status': 'insufficient_data',
            'message': 'Not enough data for comparison yet'
        })
    
    # Calculate average
    prices = [r['price'] for r in product_reports]
    avg_price = sum(prices) / len(prices)
    min_price = min(prices)
    max_price = max(prices)
    
    return jsonify({
        'status': 'success',
        'average_price': avg_price,
        'min_price': min_price,
        'max_price': max_price,
        'sample_size': len(product_reports)
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

