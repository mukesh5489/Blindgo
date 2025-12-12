from flask import Flask, request, jsonify, render_template
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
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(FACES_FOLDER):
    os.makedirs(FACES_FOLDER)

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

if __name__ == '__main__':
    load_known_faces()
    app.run(debug=True, host='0.0.0.0', port=5000)
