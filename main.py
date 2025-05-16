from flask import Flask, request, jsonify, send_from_directory
import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
import mediapipe as mp
import os
import json
from googletrans import Translator

app = Flask(__name__, static_folder='static')

# Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=True,
    max_num_hands=1,
    min_detection_confidence=0.5
)
mp_drawing = mp.solutions.drawing_utils

# Tamil sign classes (corresponding to the frontend dictionary)
tamil_classes = [
    'அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ', 
    'க', 'ங', 'ச', 'ஞ', 'ட', 'ந', 'த', 'ன'
]

# Tamil to English translation dictionary
tamil_to_english = {
    'அ': 'a - that',
    'ஆ': 'aa - cow',
    'இ': 'i - this',
    'ஈ': 'ee - fly',
    'உ': 'u - food',
    'ஊ': 'oo - blow',
    'எ': 'e - which',
    'ஏ': 'ae - why',
    'ஐ': 'ai - five',
    'ஒ': 'o - one',
    'ஓ': 'oa - run',
    'ஔ': 'au - beauty',
    'க': 'ka - eye',
    'ங': 'nga - good',
    'ச': 'sa - die',
    'ஞ': 'nya - wisdom',
    'ட': 'ta - obstacle',
    'ந': 'na - good',
    'த': 'tha - give',
    'ன': 'nha - I/me'
}

# Common Tamil phrases and their English translations
tamil_phrases = {
    'வணக்கம்': 'Hello/Greetings',
    'நன்றி': 'Thank you',
    'எப்படி இருக்கிறீர்கள்': 'How are you',
    'நான் நலமாக இருக்கிறேன்': 'I am fine',
    'உங்கள் பெயர் என்ன': 'What is your name',
    'என் பெயர்': 'My name is',
    'சந்தோஷமாக இருங்கள்': 'Be happy',
    'நான் உங்களை காதலிக்கிறேன்': 'I love you',
    'உதவி': 'Help',
    'தயவு செய்து': 'Please'
}

# Initialize translator
translator = Translator()

# Path to the trained model
MODEL_PATH = 'models/tamil_sign_model.h5'

# Directory for debug images
DEBUG_DIR = os.path.join('static', 'debug')
os.makedirs(DEBUG_DIR, exist_ok=True)

# Check if model exists, otherwise initialize a new one for demo
def get_model():
    if os.path.exists(MODEL_PATH):
        return load_model(MODEL_PATH)
    else:
        # Create directories if they don't exist
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        
        # Create a more sophisticated CNN model
        model = tf.keras.Sequential([
            tf.keras.layers.Input(shape=(224, 224, 3)),
            tf.keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.MaxPooling2D(2, 2),
            
            tf.keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.MaxPooling2D(2, 2),
            
            tf.keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.MaxPooling2D(2, 2),
            
            tf.keras.layers.GlobalAveragePooling2D(),
            tf.keras.layers.Dense(256, activation='relu'),
            tf.keras.layers.Dropout(0.5),
            tf.keras.layers.Dense(len(tamil_classes), activation='softmax')
        ])
        
        model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        
        # Save the model
        model.save(MODEL_PATH)
        return model

# Load the model
model = get_model()

# Preprocess the image for model input
def preprocess_image(image):
    # Resize to the input shape expected by the model
    img = cv2.resize(image, (224, 224))
    # Convert to RGB (model was trained on RGB)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    # Normalize pixel values
    img = img / 255.0
    # Add batch dimension
    img = np.expand_dims(img, axis=0)
    return img

# Process hand landmarks
def process_landmarks(image):
    # Convert BGR to RGB
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Process the image
    results = hands.process(image_rgb)
    
    if results.multi_hand_landmarks:
        # Extract the first detected hand
        hand_landmarks = results.multi_hand_landmarks[0]
        
        # Draw the hand landmarks on a copy of the image
        annotated_image = image.copy()
        mp_drawing.draw_landmarks(
            annotated_image, 
            hand_landmarks, 
            mp_hands.HAND_CONNECTIONS
        )
        
        return annotated_image, True
    
    return image, False

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    try:
        # Read the image file
        file = request.files['image']
        img_bytes = file.read()
        img_array = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        # Process hand landmarks
        annotated_img, hand_detected = process_landmarks(img)
        
        # Save annotated image for debugging
        debug_path = os.path.join(DEBUG_DIR, 'latest_hand.jpg')
        cv2.imwrite(debug_path, annotated_img)
        
        if not hand_detected:
            return jsonify({
                'prediction': None,
                'confidence': 0,
                'message': 'No hand detected',
                'debug_image': f'/static/debug/latest_hand.jpg'
            })
        
        # Preprocess image for model
        processed_img = preprocess_image(img)
        
        # Get prediction
        predictions = model.predict(processed_img)[0]
        predicted_class_idx = np.argmax(predictions)
        confidence = float(predictions[predicted_class_idx] * 100)
        
        # Get the predicted Tamil character
        predicted_char = tamil_classes[predicted_class_idx]
        
        # Get the English meaning if available
        english_meaning = tamil_to_english.get(predicted_char, "Unknown")
        
        return jsonify({
            'prediction': predicted_char,
            'english_meaning': english_meaning,
            'confidence': confidence,
            'debug_image': f'/static/debug/latest_hand.jpg'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/translate', methods=['POST'])
def translate_text():
    data = request.json
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400
    
    text = data['text']
    
    # Check if text is a common phrase
    if text in tamil_phrases:
        translation = tamil_phrases[text]
    else:
        try:
            # Use Google Translate API for other text
            translation = translator.translate(text, src='ta', dest='en').text
        except Exception as e:
            return jsonify({'error': f'Translation error: {str(e)}'}), 500
    
    return jsonify({'translation': translation})

@app.route('/phrases')
def get_phrases():
    return jsonify(tamil_phrases)

@app.route('/dictionary')
def get_dictionary():
    return jsonify(tamil_to_english)

# Serve static files
@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# Error handling
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Route not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Server error'}), 500

if __name__ == "__main__":
    print("=" * 50)
    print("Tamil Sign Language Recognition Server")
    print("=" * 50)
    print("Server starting...")
    print("Access the application at: http://127.0.0.1:5000")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)