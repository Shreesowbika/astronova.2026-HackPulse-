from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime
from collections import defaultdict

app = Flask(__name__)
CORS(app)

# Enhanced storage
price_reports = []
stats = {
    'total_users': 0,
    'total_scans': 0,
    'bias_detected': 0,
    'by_platform': defaultdict(int),
    'by_location_tier': defaultdict(int),
    'by_device': defaultdict(int)
}

@app.route('/')
def home():
    return jsonify({
        'status': 'FairMarket AI Backend Running',
        'version': '2.0.0',
        'stats': dict(stats),
        'total_reports': len(price_reports)
    })

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'reports_stored': len(price_reports)
    })

@app.route('/api/report-price', methods=['POST'])
def report_price():
    """Receive enhanced price reports"""
    data = request.json
    
    # Create detailed report
    report = {
        'price': data.get('price'),
        'product': data.get('product'),
        'category': data.get('category', 'Unknown'),
        'location': data.get('location', 'Unknown'),
        'device_type': data.get('device_type', 'Unknown'),
        'platform': data.get('platform', 'Unknown'),
        'bias_detected': data.get('bias_detected', False),
        'confidence': data.get('confidence', 0.0),
        'timestamp': data.get('timestamp', datetime.now().isoformat()),
        'report_id': len(price_reports) + 1
    }
    
    price_reports.append(report)
    
    # Update stats
    stats['total_scans'] += 1
    if report['bias_detected']:
        stats['bias_detected'] += 1
    
    stats['by_platform'][report['platform']] += 1
    stats['by_device'][report['device_type']] += 1
    
    # Extract tier from location string
    if 'Tier-' in report['location']:
        tier = report['location'].split(',')[-1].strip()
        stats['by_location_tier'][tier] += 1
    
    print(f"📊 New report: {report['product'][:30]}... | ₹{report['price']} | {report['location']} | Bias: {report['bias_detected']}")
    
    return jsonify({
        'status': 'success',
        'message': 'Enhanced report received',
        'report_id': report['report_id'],
        'bias_detected': report['bias_detected']
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get comprehensive statistics"""
    return jsonify({
        'total_scans': stats['total_scans'],
        'bias_detected': stats['bias_detected'],
        'bias_rate': round(stats['bias_detected'] / stats['total_scans'] * 100, 2) if stats['total_scans'] > 0 else 0,
        'by_platform': dict(stats['by_platform']),
        'by_device': dict(stats['by_device']),
        'by_location_tier': dict(stats['by_location_tier']),
        'total_reports': len(price_reports)
    })

@app.route('/api/recent-reports', methods=['GET'])
def recent_reports():
    """Get recent price reports"""
    limit = int(request.args.get('limit', 10))
    return jsonify({
        'reports': price_reports[-limit:],
        'total': len(price_reports)
    })

@app.route('/api/price-comparison', methods=['POST'])
def price_comparison():
    """Compare prices for a product"""
    data = request.json
    product_name = data.get('product', '').lower()
    
    # Find similar products
    similar = [r for r in price_reports if product_name[:20] in r['product'].lower()]
    
    if len(similar) < 2:
        return jsonify({
            'status': 'insufficient_data',
            'message': f'Only {len(similar)} report(s) for similar products'
        })
    
    # Calculate statistics by tier
    tier_data = defaultdict(list)
    for report in similar:
        if 'Tier-' in report['location']:
            tier = report['location'].split(',')[-1].strip()
            tier_data[tier].append(report['price'])
    
    comparison = {}
    for tier, prices in tier_data.items():
        comparison[tier] = {
            'average': round(sum(prices) / len(prices), 2),
            'min': min(prices),
            'max': max(prices),
            'count': len(prices)
        }
    
    return jsonify({
        'status': 'success',
        'product': product_name,
        'comparison': comparison,
        'total_samples': len(similar)
    })

@app.route('/api/bias-hotspots', methods=['GET'])
def bias_hotspots():
    """Identify locations with high bias rates"""
    location_stats = defaultdict(lambda: {'total': 0, 'biased': 0})
    
    for report in price_reports:
        loc = report['location']
        location_stats[loc]['total'] += 1
        if report['bias_detected']:
            location_stats[loc]['biased'] += 1
    
    hotspots = []
    for location, data in location_stats.items():
        if data['total'] >= 3:  # Min 3 reports
            bias_rate = (data['biased'] / data['total']) * 100
            hotspots.append({
                'location': location,
                'bias_rate': round(bias_rate, 2),
                'total_scans': data['total'],
                'biased_count': data['biased']
            })
    
    # Sort by bias rate
    hotspots.sort(key=lambda x: x['bias_rate'], reverse=True)
    
    return jsonify({
        'hotspots': hotspots[:10],  # Top 10
        'total_locations': len(location_stats)
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)