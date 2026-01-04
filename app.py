from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import cv2
import face_recognition
import pytesseract
import numpy as np
from PIL import Image
import os
import json
import base64
import io
import uuid
from utils.currency_detector import INRCurrencyDetector
from utils.object_detector import ObjectDetector

app = Flask(__name__)
CORS(app)

# Configure pytesseract path (update this path based on your system)
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

UPLOAD_FOLDER = 'uploads'
FACES_FOLDER = 'faces'
AUDIOS_FOLDER = 'audios'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(FACES_FOLDER):
    os.makedirs(FACES_FOLDER)
if not os.path.exists(AUDIOS_FOLDER):
    os.makedirs(AUDIOS_FOLDER)

known_faces = {}
known_face_encodings = []

# Initialize currency detector
currency_detector = INRCurrencyDetector()  
# Initialize simple object detector
try:
    object_detector = ObjectDetector()
    print("✅ Object detector initialized")
except Exception as e:
    print(f"⚠️ Object detector initialization warning: {e}")
    object_detector = None

def load_known_faces():
    """Load known faces from the faces directory"""
    global known_faces, known_face_encodings
    
    if os.path.exists('known_faces.json'):
        with open('known_faces.json', 'r') as f:
            known_faces = json.load(f)
            known_face_encodings = list(known_faces.values())

def save_known_faces():
    """Save known faces to JSON file"""
    with open('known_faces.json', 'w') as f:
        json.dump(known_faces, f)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/ocr', methods=['POST'])
def extract_text():
    """Extract text from image using OCR"""
    try:

        data = request.get_json()
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400

        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        gray = cv2.cvtColor(opencv_image, cv2.COLOR_BGR2GRAY)
        gray = cv2.medianBlur(gray, 3)

        text = pytesseract.image_to_string(gray)

        text = text.strip()
        
        if not text:
            return jsonify({'text': 'No text detected in the image', 'success': False})
        
        return jsonify({
            'text': text,
            'success': True,
            'message': f'Detected text: {text}'
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/face/upload', methods=['POST'])
def upload_face():
    """Upload and train a new face"""
    try:
        data = request.get_json()
        name = data.get('name')
        image_data = data.get('image')
        
        if not name or not image_data:
            return jsonify({'error': 'Name and image are required'}), 400

        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        face_locations = face_recognition.face_locations(opencv_image)
        
        if not face_locations:
            return jsonify({'error': 'No face detected in the image', 'success': False}), 400

        face_encoding = face_recognition.face_encodings(opencv_image, face_locations)[0]

        known_faces[name] = face_encoding.tolist()
        known_face_encodings.append(face_encoding)

        save_known_faces()
        
        return jsonify({
            'success': True,
            'message': f'Face uploaded successfully for {name}'
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/face/recognize', methods=['POST'])
def recognize_face():
    """Recognize face in uploaded image"""
    try:
        data = request.get_json()
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400

        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        face_locations = face_recognition.face_locations(opencv_image)
        
        if not face_locations:
            return jsonify({'error': 'No face detected in the image', 'success': False}), 400

        face_encodings = face_recognition.face_encodings(opencv_image, face_locations)
        
        recognized_names = []
        
        for face_encoding in face_encodings:

            matches = face_recognition.compare_faces(known_face_encodings, face_encoding, tolerance=0.6)
            
            if True in matches:
                first_match_index = matches.index(True)
                name = list(known_faces.keys())[first_match_index]
                recognized_names.append(name)
        
        if recognized_names:
            return jsonify({
                'success': True,
                'names': recognized_names,
                'message': f'Recognized: {", ".join(recognized_names)}'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Face not recognized'
            })
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/faces', methods=['GET'])
def get_known_faces():
    """Get list of known faces"""
    return jsonify({
        'faces': list(known_faces.keys()),
        'count': len(known_faces)
    })

@app.route('/api/face/delete/<name>', methods=['DELETE'])
def delete_face(name):
    """Delete a known face"""
    try:
        if name in known_faces:

            face_encoding = known_faces[name]
            known_face_encodings.remove(np.array(face_encoding))
            del known_faces[name]

            save_known_faces()
            
            return jsonify({
                'success': True,
                'message': f'Face for {name} deleted successfully'
            })
        else:
            return jsonify({'error': 'Face not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/location', methods=['POST'])
def update_location():
    """Update user location for navigation assistance"""
    try:
        data = request.get_json()
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if latitude is None or longitude is None:
            return jsonify({'error': 'Latitude and longitude are required'}), 400
        

        return jsonify({
            'success': True,
            'message': f'Location updated: {latitude}, {longitude}'
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/money/detect', methods=['POST'])
def detect_currency():
    """Detect Indian Rupee currency notes"""
    try:
        data = request.get_json()
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image data provided', 'success': False}), 400

        # Remove data URL prefix if present
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]

        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        # Convert to OpenCV format
        opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        # Detect currency
        result = currency_detector.detect(opencv_image)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/object/detect', methods=['POST'])
def detect_objects():
    """Detect generic objects in an uploaded image"""
    try:
        if object_detector is None:
            return jsonify({'error': 'Object detector not initialized', 'success': False}), 503

        data = request.get_json()
        image_data = data.get('image')

        if not image_data:
            return jsonify({'error': 'No image data provided', 'success': False}), 400

        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        result = object_detector.detect(opencv_image)

        return jsonify(result)

    except Exception as e:
        print(f"Object detection error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/audio/upload', methods=['POST'])
def upload_audio():
    """Upload recorded audio file and save to audios folder"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in request'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        # Allow client to provide a reserved filename to overwrite
        provided_name = request.form.get('filename') or request.args.get('filename')
        if provided_name:
            # sanitize provided name
            filename = secure_filename(provided_name)
            save_path = os.path.join(AUDIOS_FOLDER, filename)
        else:
            filename = secure_filename(file.filename or "upload")
            unique_name = f"{uuid.uuid4().hex}_{filename}"
            save_path = os.path.join(AUDIOS_FOLDER, unique_name)

        file.save(save_path)
        # return the saved filename (basename)
        filename = os.path.basename(save_path)

        return jsonify({'success': True, 'filename': filename}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/audio/reserve', methods=['POST'])
def reserve_audio():
    """Reserve an audio filename on server and return it to client"""
    try:
        # Client may optionally suggest a base name
        data = request.get_json(silent=True) or {}
        base = data.get('filename') or f"recording_{uuid.uuid4().hex}.webm"
        safe_base = secure_filename(base)
        unique_name = f"{uuid.uuid4().hex}_{safe_base}"
        save_path = os.path.join(AUDIOS_FOLDER, unique_name)
        # create an empty placeholder file (will be overwritten on upload)
        open(save_path, 'wb').close()
        return jsonify({'success': True, 'filename': unique_name}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/audio/list', methods=['GET'])
def list_audios():
    """Return list of saved audio files with metadata"""
    try:
        files = []
        for fname in os.listdir(AUDIOS_FOLDER):
            full = os.path.join(AUDIOS_FOLDER, fname)
            if os.path.isfile(full):
                stat = os.stat(full)
                files.append({
                    'filename': fname,
                    'size': stat.st_size,
                    'mtime': int(stat.st_mtime)
                })
        # sort by mtime desc
        files.sort(key=lambda x: x['mtime'], reverse=True)
        return jsonify({'success': True, 'files': files}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/audio/download/<path:filename>', methods=['GET'])
def download_audio(filename):
    """Serve an audio file for download"""
    try:
        # Ensure file exists within audios folder
        safe = secure_filename(filename)
        full = os.path.join(AUDIOS_FOLDER, filename)
        if not os.path.exists(full):
            return jsonify({'error': 'File not found'}), 404
        return send_from_directory(AUDIOS_FOLDER, filename, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

if __name__ == '__main__':
    load_known_faces()
    app.run(debug=True, host='0.0.0.0', port=5000)
