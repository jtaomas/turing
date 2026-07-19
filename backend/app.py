import os, sys
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv

load_dotenv()

from config import Config
from models import db
from auth import auth_bp
from routes.hints import hints_bp
from routes.problems import problems_bp
from routes.recommendations import rec_bp

def create_app():
    app = Flask(__name__, static_folder='../dist', static_url_path='')
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {
        "origins": [
            Config.FRONTEND_URL,
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5174',
            'http://127.0.0.1:3000',
        ],
        "supports_credentials": True,
        "allow_headers": ["Content-Type", "Authorization"],
    }})

    db.init_app(app)
    Migrate(app, db)

    app.register_blueprint(auth_bp)
    app.register_blueprint(hints_bp)
    app.register_blueprint(problems_bp)
    app.register_blueprint(rec_bp)

    with app.app_context():
        db.create_all()

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        static = app.static_folder or '../dist'
        filepath = os.path.join(static, path)
        if path and os.path.exists(filepath) and os.path.isfile(filepath):
            return send_from_directory(static, path)
        return send_from_directory(static, 'index.html')

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok', 'app': 'Turing'})

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': 'Internal server error'}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', '1') == '1'
    app.run(host='0.0.0.0', port=port, debug=debug)
