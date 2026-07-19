import datetime
import os
import jwt
import requests
from functools import wraps
from flask import Blueprint, request, jsonify, current_app, g
from models import db, User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def token_required(f):
    """Decorator to require a valid JWT token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Check Authorization header
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Missing authentication token'}), 401

        try:
            payload = jwt.decode(
                token,
                current_app.config['SECRET_KEY'],
                algorithms=['HS256']
            )
            current_user = User.query.get(payload['user_id'])
            if not current_user:
                return jsonify({'error': 'User not found'}), 401
            g.current_user = current_user
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(*args, **kwargs)

    return decorated


@auth_bp.route('/google', methods=['POST'])
def google_login():
    """Exchange a Google ID token for a local JWT."""
    data = request.get_json()
    if not data or 'idToken' not in data:
        return jsonify({'error': 'Missing idToken'}), 400

    id_token = data['idToken']
    google_client_id = current_app.config['GOOGLE_CLIENT_ID']

    try:
        # Verify the Google ID token
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        id_info = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            google_client_id
        )

        if id_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            return jsonify({'error': 'Invalid issuer'}), 401

        google_id = id_info['sub']
        email = id_info['email']
        display_name = id_info.get('name', email.split('@')[0])
        picture_url = id_info.get('picture', None)

        # Find or create user
        user = User.query.filter(
            (User.google_id == google_id) | (User.email == email)
        ).first()

        if not user:
            user = User(
                google_id=google_id,
                email=email,
                display_name=display_name,
                picture_url=picture_url,
                academic_id=f'TURING-{google_id[:8].upper()}'
            )
            db.session.add(user)
        else:
            user.google_id = google_id
            user.display_name = display_name
            user.picture_url = picture_url
            user.last_login = datetime.datetime.utcnow()

        db.session.commit()

        # Generate local JWT
        token = jwt.encode(
            {
                'user_id': user.id,
                'email': user.email,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
            },
            current_app.config['SECRET_KEY'],
            algorithm='HS256'
        )

        return jsonify({
            'token': token,
            'user': user.to_dict()
        }), 200

    except ValueError as e:
        return jsonify({'error': f'Invalid Google token: {str(e)}'}), 401
    except Exception as e:
        return jsonify({'error': f'Authentication failed: {str(e)}'}), 500


@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user():
    """Get the currently authenticated user."""
    return jsonify({'user': g.current_user.to_dict()}), 200


@auth_bp.route('/profile', methods=['PUT'])
@token_required
def update_profile():
    """Update user profile fields."""
    data = request.get_json()
    user = g.current_user

    if 'display_name' in data:
        user.display_name = data['display_name']
    if 'institution' in data:
        user.institution = data['institution']
    if 'course' in data:
        user.course = data['course']

    db.session.commit()
    return jsonify({'user': user.to_dict()}), 200
