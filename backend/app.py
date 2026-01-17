from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime
from database import init_db, save_report, get_stats, get_recent_reports, get_price_comparison

app = Flask(__name__)
CORS(app)

# Initialize database on startup
init_db()

@app.route('/')
def home():
    stats = get_stats()
    return jsonify({
        'status': 'FairMarket AI Backend Running',
        'version': '3.0.0 - With PostgreSQL',
        'stats': stats,
        'database': 'Connected' if stats else 'Error'
    })

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'database': 'connected'
    })

@app.route('/api/report-price', methods=['POST'])
def report_price():
    """Receive and store price report"""
    try:
        data = request.json
        
        report_id = save_report(data)
        
        if report_id:
            return jsonify({
                'status': 'success',
                'message': 'Report saved to database',
                'report_id': report_id
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to save report'
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/stats', methods=['GET'])
def stats():
    """Get comprehensive statistics"""
    return jsonify(get_stats())

@app.route('/api/recent-reports', methods=['GET'])
def recent_reports():
    """Get recent price reports"""
    limit = int(request.args.get('limit', 10))
    reports = get_recent_reports(limit)
    return jsonify({
        'reports': reports,
        'total': len(reports)
    })

@app.route('/api/price-comparison', methods=['POST'])
def price_comparison():
    """Compare prices for a product"""
    data = request.json
    product_name = data.get('product', '')
    
    result = get_price_comparison(product_name)
    return jsonify(result)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)