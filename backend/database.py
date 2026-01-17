import psycopg2
import os
from psycopg2.extras import RealDictCursor
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def init_db():
    """Initialize database tables"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cur = conn.cursor()
        
        # Create reports table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS price_reports (
                id SERIAL PRIMARY KEY,
                price INTEGER NOT NULL,
                product VARCHAR(500),
                category VARCHAR(200),
                location VARCHAR(200),
                city_tier VARCHAR(50),
                device_type VARCHAR(50),
                platform VARCHAR(100),
                bias_detected BOOLEAN DEFAULT FALSE,
                confidence FLOAT DEFAULT 0.0,
                session_id VARCHAR(100),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create index for faster queries
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_product ON price_reports(product);
            CREATE INDEX IF NOT EXISTS idx_platform ON price_reports(platform);
            CREATE INDEX IF NOT EXISTS idx_tier ON price_reports(city_tier);
            CREATE INDEX IF NOT EXISTS idx_timestamp ON price_reports(timestamp);
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Database initialized successfully")
        return True
    except Exception as e:
        print(f"❌ Database init error: {e}")
        return False

def save_report(report_data):
    """Save a price report"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor()
        
        # Extract city tier from location
        location = report_data.get('location', '')
        city_tier = 'Unknown'
        if 'Tier-1' in location:
            city_tier = 'Tier-1'
        elif 'Tier-2' in location:
            city_tier = 'Tier-2'
        elif 'Tier-3' in location:
            city_tier = 'Tier-3'
        
        cur.execute("""
            INSERT INTO price_reports 
            (price, product, category, location, city_tier, device_type, 
             platform, bias_detected, confidence, session_id, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            report_data.get('price'),
            report_data.get('product'),
            report_data.get('category', 'Unknown'),
            location,
            city_tier,
            report_data.get('device_type', 'Unknown'),
            report_data.get('platform', 'Unknown'),
            report_data.get('bias_detected', False),
            report_data.get('confidence', 0.0),
            report_data.get('session_id', ''),
            report_data.get('timestamp', datetime.now())
        ))
        
        report_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        return report_id
    except Exception as e:
        print(f"❌ Save report error: {e}")
        return None

def get_stats():
    """Get overall statistics"""
    conn = get_db_connection()
    if not conn:
        return {}
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Total scans
        cur.execute("SELECT COUNT(*) as total FROM price_reports")
        total = cur.fetchone()['total']
        
        # Bias detected
        cur.execute("SELECT COUNT(*) as biased FROM price_reports WHERE bias_detected = TRUE")
        biased = cur.fetchone()['biased']
        
        # By platform
        cur.execute("""
            SELECT platform, COUNT(*) as count 
            FROM price_reports 
            GROUP BY platform
        """)
        by_platform = {row['platform']: row['count'] for row in cur.fetchall()}
        
        # By tier
        cur.execute("""
            SELECT city_tier, COUNT(*) as count 
            FROM price_reports 
            GROUP BY city_tier
        """)
        by_tier = {row['city_tier']: row['count'] for row in cur.fetchall()}
        
        # By device
        cur.execute("""
            SELECT device_type, COUNT(*) as count 
            FROM price_reports 
            GROUP BY device_type
        """)
        by_device = {row['device_type']: row['count'] for row in cur.fetchall()}
        
        cur.close()
        conn.close()
        
        return {
            'total_scans': total,
            'bias_detected': biased,
            'bias_rate': round((biased / total * 100) if total > 0 else 0, 2),
            'by_platform': by_platform,
            'by_location_tier': by_tier,
            'by_device': by_device
        }
    except Exception as e:
        print(f"❌ Get stats error: {e}")
        return {}

def get_recent_reports(limit=10):
    """Get recent reports"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT * FROM price_reports 
            ORDER BY timestamp DESC 
            LIMIT %s
        """, (limit,))
        
        reports = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(row) for row in reports]
    except Exception as e:
        print(f"❌ Get reports error: {e}")
        return []

def get_price_comparison(product_name, limit=100):
    """Compare prices for similar products"""
    conn = get_db_connection()
    if not conn:
        return {}
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Find similar products (case-insensitive partial match)
        cur.execute("""
            SELECT price, city_tier, location, platform, timestamp
            FROM price_reports 
            WHERE LOWER(product) LIKE %s
            ORDER BY timestamp DESC
            LIMIT %s
        """, (f'%{product_name.lower()}%', limit))
        
        reports = cur.fetchall()
        cur.close()
        conn.close()
        
        if len(reports) < 2:
            return {'status': 'insufficient_data', 'count': len(reports)}
        
        # Calculate by tier
        tier_data = {}
        for report in reports:
            tier = report['city_tier']
            if tier not in tier_data:
                tier_data[tier] = []
            tier_data[tier].append(report['price'])
        
        comparison = {}
        for tier, prices in tier_data.items():
            comparison[tier] = {
                'average': round(sum(prices) / len(prices), 2),
                'min': min(prices),
                'max': max(prices),
                'count': len(prices)
            }
        
        return {
            'status': 'success',
            'comparison': comparison,
            'total_samples': len(reports)
        }
    except Exception as e:
        print(f"❌ Price comparison error: {e}")
        return {}