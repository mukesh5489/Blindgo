
"""
BLINDGO - Startup Script
Simple script to launch the BLINDGO application
"""

import os
import sys
import subprocess
import webbrowser
import time

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import flask
        import cv2
        import face_recognition
        import pytesseract
        print("✅ All Python dependencies are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def check_tesseract():
    """Check if Tesseract is available"""
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        print("✅ Tesseract OCR is available")
        return True
    except Exception as e:
        print(f"⚠️ Tesseract OCR not found: {e}")
        print("Please install Tesseract OCR:")
        print("  Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki")
        print("  macOS: brew install tesseract")
        print("  Linux: sudo apt-get install tesseract-ocr")
        return False

def create_directories():
    """Create necessary directories if they don't exist"""
    directories = ['uploads', 'faces', 'static/audio']
    
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"📁 Created directory: {directory}")

def main():
    """Main startup function"""
    print("🚀 Starting BLINDGO - Assistant for Visually Impaired")
    print("=" * 60)

    if not check_dependencies():
        sys.exit(1)

    check_tesseract()

    create_directories()
    
    print("\n🌐 Starting Flask application...")
    
    try:

        from app import app

        def open_browser():
            time.sleep(2)
            webbrowser.open('http://localhost:5000')
            print("🌐 Browser opened automatically")

        import threading
        browser_thread = threading.Thread(target=open_browser)
        browser_thread.daemon = True
        browser_thread.start()


        app.run(debug=True, host='0.0.0.0', port=5000)
        
    except KeyboardInterrupt:
        print("\n👋 BLINDGO stopped by user")
    except Exception as e:
        print(f"❌ Error starting BLINDGO: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
