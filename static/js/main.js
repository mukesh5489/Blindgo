// BLINDGO - Main Application Controller
class BlindGoApp {
    constructor() {
        this.isInitialized = false;
        this.currentText = '';
        this.textControls = {
            isPlaying: false,
            isPaused: false
        };
        this.speechModule = null;
        this.init();
    }

    async init() {
        try {
            await this.initializeModules();
            this.setupEventListeners();
            this.initVoiceRecognition();
            this.start();
            this.isInitialized = true;
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    async initializeModules() {
        try {
            console.log("Initializing Camera Module...");
            try {
                window.cameraModule = new CameraModule();
                await window.cameraModule.init();
                console.log("✓ Camera module initialized.");
                this.updateCameraStatus(true);
            } catch (cameraError) {
                console.warn("⚠ Camera Module failed:", cameraError.message || cameraError);
                this.updateCameraStatus(false);
                window.cameraModule = {
                    isReady: false,
                    captureImage: async () => {
                        throw new Error('Camera not available. Please check camera permissions and refresh the page.');
                    }
                };
            }

            console.log("Initializing OCR Module...");
            window.ocrModule = new OCRModule();
            console.log("✓ OCR module initialized.");

            console.log("Initializing Face Module...");
            try {
                window.faceModule = new FaceModule();
                await window.faceModule.init();
                console.log("✓ Face module initialized.");
            } catch (faceError) {
                console.warn("⚠ Face Module failed:", faceError.message || faceError);
                window.faceModule = {
                    isReady: false,
                    trainFace: async () => ({ success: false, message: 'Face recognition not available' }),
                    recognizeFace: async () => ({ success: false, message: 'Face recognition not available' })
                };
            }

            console.log("Initializing Navigation Module...");
            try {
                window.navigationModule = new NavigationModule();
                await window.navigationModule.init();
                console.log("✓ Navigation module initialized.");
                this.updateLocationStatus(true);
            } catch (navError) {
                console.warn("⚠ Navigation Module failed:", navError.message || navError);
                this.updateLocationStatus(false);
                window.navigationModule = {
                    isReady: false,
                    getCurrentLocation: async () => ({ success: false, message: 'Navigation not available' })
                };
            }

            console.log("Initializing Money Recognition Module...");
            try {
                window.moneyModule = new MoneyModule();
                console.log("✓ Money module initialized.");
            } catch (moneyError) {
                console.warn("⚠ Money Module failed:", moneyError.message || moneyError);
                window.moneyModule = {
                    detectMoney: async () => ({ success: false, message: 'Money recognition not available' }),
                    clearTotal: () => {},
                    addToTotal: () => {}
                };
            }

            console.log("✓ All modules initialized successfully!");
     } catch (error) {
         console.error("❌ Initialization failed:", error.message || error);
            throw error;
        }
    }

    setupEventListeners() {
        const captureTextBtn = document.getElementById('captureTextBtn');
        if (captureTextBtn) {
            captureTextBtn.addEventListener('click', () => this.captureText());
        }
        
        const playTextBtn = document.getElementById('playTextBtn');
        if (playTextBtn) {
            playTextBtn.addEventListener('click', () => this.playText());
        }
        const pauseTextBtn = document.getElementById('pauseTextBtn');
        if (pauseTextBtn) {
            pauseTextBtn.addEventListener('click', () => this.pauseText());
        }
        const replayTextBtn = document.getElementById('replayTextBtn');
        if (replayTextBtn) {
            replayTextBtn.addEventListener('click', () => this.replayText());
        }
        const recognizeFaceBtn = document.getElementById('recognizeFaceBtn');
        if (recognizeFaceBtn) {
            recognizeFaceBtn.addEventListener('click', () => this.recognizeFace());
        }
        const captureTrainingFaceBtn = document.getElementById('captureTrainingFaceBtn');
        if (captureTrainingFaceBtn) {
            captureTrainingFaceBtn.addEventListener('click', () => this.captureTrainingFace());
        }
        const trainFaceBtn = document.getElementById('trainFaceBtn');
        if (trainFaceBtn) {
            trainFaceBtn.addEventListener('click', () => this.trainFace());
        }
        const getLocationBtn = document.getElementById('getLocationBtn');
        if (getLocationBtn) {
            getLocationBtn.addEventListener('click', () => this.getLocation());
        }

        // Money Recognition event listeners
        const detectMoneyBtn = document.getElementById('detectMoneyBtn');
        if (detectMoneyBtn) {
            detectMoneyBtn.addEventListener('click', () => this.detectMoney());
        }

        const addToTotalBtn = document.getElementById('addToTotalBtn');
        if (addToTotalBtn) {
            addToTotalBtn.addEventListener('click', () => this.addDetectedToTotal());
        }

        const clearTotalBtn = document.getElementById('clearTotalBtn');
        if (clearTotalBtn) {
            clearTotalBtn.addEventListener('click', () => this.clearMoneyTotal());
        }

        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    start() {
        console.log('BLINDGO Application started and ready.');
    }

    initVoiceRecognition() {
        // Initialize SpeechModule for voice commands
        if (window.SpeechModule) {
            this.speechModule = new window.SpeechModule(this);
            console.log('Speech recognition module initialized');
        } else {
            console.error('SpeechModule not loaded. Please ensure speech.js is included.');
            this.updateStatusBarVoice('Not Available');
        }
    }

    async captureText() {
        try {
            console.log('Capturing text from camera');
            if (!window.cameraModule || !window.cameraModule.isReady) {
                throw new Error('Camera not ready. Please check camera permissions and refresh the page.');
            }
            const imageData = await window.cameraModule.captureImage('text');
            if (imageData) {
                const ocrResult = await window.ocrModule.extractText(imageData);
                if (ocrResult.success && ocrResult.text && ocrResult.text.trim()) {
                    this.currentText = ocrResult.text;
                    this.displayText(ocrResult.text);
                    this.showTextControls();
                    
                    // Automatically start reading the text aloud
                    setTimeout(() => {
                        this.playText();
                    }, 500);
                } else {
                    const message = ocrResult.message || 'No text detected in the image. Please try again.';
                    this.displayText(message);
                    // Read the error message aloud
                    this.speakText(message);
                }
            } else {
                const errorMessage = 'Failed to capture image. Please check camera permissions.';
                this.displayText(errorMessage);
                this.speakText(errorMessage);
            }
        } catch (error) {
            const errorMessage = `Error capturing text: ${error.message}. Please try again.`;
            this.displayText(errorMessage);
            this.speakText(errorMessage);
        }
    }

    async recognizeFace() {
        try {
            console.log('Recognizing face from camera');
            if (!window.cameraModule || !window.cameraModule.isReady) {
                throw new Error('Camera not ready. Please check camera permissions and refresh the page.');
            }
            const imageData = await window.cameraModule.captureImage('face');
            if (imageData) {
                const result = await window.faceModule.recognizeFace(imageData);
                this.displayFaceResult(result);
                // Auto-read the face recognition result
                setTimeout(() => {
                    const message = result.message || result;
                    this.speakText(message);
                }, 500);
            } else {
                const errorMessage = 'Failed to capture image. Please check camera permissions.';
                this.displayFaceResult({ success: false, message: errorMessage });
                // Auto-read the error message
                setTimeout(() => {
                    this.speakText(errorMessage);
                }, 500);
            }
        } catch (error) {
            const errorMessage = `Error recognizing face: ${error.message}`;
            this.displayFaceResult({ success: false, message: errorMessage });
            // Auto-read the error message
            setTimeout(() => {
                this.speakText(errorMessage);
            }, 500);
        }
    }

    async captureTrainingFace() {
        try {
            console.log('Capturing face for training');
            if (!window.cameraModule || !window.cameraModule.isReady) {
                throw new Error('Camera not ready. Please check camera permissions and refresh the page.');
            }
            const imageData = await window.cameraModule.captureImage('training');
            if (imageData) {
                this.trainingImageData = imageData;
                const trainBtn = document.getElementById('trainFaceBtn');
                if (trainBtn) {
                    trainBtn.disabled = false;
                }
                const successMessage = 'Face captured successfully! Enter a name and click Train Face to complete.';
                const trainingResult = document.getElementById('trainingResult');
                if (trainingResult) {
                    trainingResult.innerHTML = `<p style="color: #059669;">${successMessage}</p>`;
                }
                // Auto-read the success message
                setTimeout(() => {
                    this.speakText(successMessage);
                }, 500);
            } else {
                const errorMessage = 'Failed to capture image. Please check camera permissions.';
                const trainingResult = document.getElementById('trainingResult');
                if (trainingResult) {
                    trainingResult.innerHTML = `<p style="color: #dc2626;">${errorMessage}</p>`;
                }
                // Auto-read the error message
                setTimeout(() => {
                    this.speakText(errorMessage);
                }, 500);
            }
        } catch (error) {
            const errorMessage = `Error: ${error.message}`;
            const trainingResult = document.getElementById('trainingResult');
            if (trainingResult) {
                trainingResult.innerHTML = `<p style="color: #dc2626;">${errorMessage}</p>`;
            }
            // Auto-read the error message
            setTimeout(() => {
                this.speakText(errorMessage);
            }, 500);
        }
    }

    async trainFace(personName = null) {
        try {
            let name = personName;
            if (!name) {
                name = document.getElementById('personName')?.value?.trim();
            }
            if (!name) {
                const trainingResult = document.getElementById('trainingResult');
                if (trainingResult) {
                    trainingResult.innerHTML = '<p style="color: #dc2626;">Please enter a person\'s name.</p>';
                }
                return;
            }
            if (!this.trainingImageData) {
                const trainingResult = document.getElementById('trainingResult');
                if (trainingResult) {
                    trainingResult.innerHTML = '<p style="color: #dc2626;">Please capture a face first.</p>';
                }
                return;
            }
            console.log(`Training face recognition for ${name}`);
            const result = await window.faceModule.trainFace(name, this.trainingImageData);
            if (result.success) {
                this.displayFaceResult(result);
                this.clearTrainingForm();
                const successMessage = `Face trained successfully for ${name}!`;
                const trainingResult = document.getElementById('trainingResult');
                if (trainingResult) {
                    trainingResult.innerHTML = `<p style="color: #059669;">${successMessage}</p>`;
                }
                // Auto-read the success message
                setTimeout(() => {
                    this.speakText(successMessage);
                }, 500);
            } else {
                const errorMessage = `Training failed: ${result.message}`;
                const trainingResult = document.getElementById('trainingResult');
                if (trainingResult) {
                    trainingResult.innerHTML = `<p style="color: #dc2626;">${errorMessage}</p>`;
                }
                // Auto-read the error message
                setTimeout(() => {
                    this.speakText(errorMessage);
                }, 500);
            }
        } catch (error) {
            const errorMessage = 'Error training face. Please try again.';
            const trainingResult = document.getElementById('trainingResult');
            if (trainingResult) {
                trainingResult.innerHTML = `<p style="color: #dc2626;">${errorMessage}</p>`;
            }
            // Auto-read the error message
            setTimeout(() => {
                this.speakText(errorMessage);
            }, 500);
        }
    }

    async getLocation() {
        try {
            console.log('Getting current location');
            if (window.navigationModule && window.navigationModule.isReady) {
                const location = await window.navigationModule.getCurrentLocation();
                if (location) {
                    this.displayLocation(location);
                    // Auto-read the location
                    setTimeout(() => {
                        const message = location.address || 'Location retrieved successfully';
                        this.speakText(message);
                    }, 500);
                } else {
                    const errorMessage = 'Unable to get location. Please check permissions.';
                    this.displayLocation({ success: false, message: errorMessage });
                    // Auto-read the error message
                    setTimeout(() => {
                        this.speakText(errorMessage);
                    }, 500);
                }
            } else {
                const position = await this.getBasicLocation();
                if (position) {
                    const locationMessage = `Lat: ${position.coords.latitude.toFixed(6)}, Lng: ${position.coords.longitude.toFixed(6)}`;
                    this.displayLocation({
                        address: locationMessage,
                        coordinates: position.coords
                    });
                    // Auto-read the location
                    setTimeout(() => {
                        this.speakText(`Your location is ${locationMessage}`);
                    }, 500);
                }
            }
        } catch (error) {
            const errorMessage = 'Error getting location. Please try again.';
            this.displayLocation({ success: false, message: errorMessage });
            // Auto-read the error message
            setTimeout(() => {
                this.speakText(errorMessage);
            }, 500);
        }
    }

    displayLocation(locationData) {
        const locationOutput = document.getElementById('navigationOutput');
        const currentLocation = document.getElementById('currentLocation');
        if (locationOutput) {
            locationOutput.innerHTML = `<p><strong>Location:</strong> ${locationData.address || locationData.message}</p>`;
            locationOutput.classList.add('success');
        }
        if (currentLocation) {
            currentLocation.textContent = locationData.address || locationData.message;
        }
    }

    async getBasicLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    async detectMoney() {
        try {
            console.log('Detecting currency from camera');
            if (!window.cameraModule || !window.cameraModule.isReady) {
                throw new Error('Camera not ready. Please check camera permissions and refresh the page.');
            }

            const imageData = await window.cameraModule.captureImage('money');
            if (imageData) {
                const result = await window.moneyModule.detectMoney(imageData);
                
                if (result.success) {
                    // Store the last detected amount
                    this.lastDetectedAmount = result.denomination;
                    
                    // Enable the "Add to Total" button
                    const addToTotalBtn = document.getElementById('addToTotalBtn');
                    if (addToTotalBtn) {
                        addToTotalBtn.disabled = false;
                    }
                } else {
                    // Disable the "Add to Total" button on failure
                    const addToTotalBtn = document.getElementById('addToTotalBtn');
                    if (addToTotalBtn) {
                        addToTotalBtn.disabled = true;
                    }
                }
            } else {
                const errorMessage = 'Failed to capture image. Please check camera permissions.';
                window.moneyModule.updateDetectionStatus(errorMessage, 'error');
            }
        } catch (error) {
            const errorMessage = `Error detecting currency: ${error.message}`;
            window.moneyModule.updateDetectionStatus(errorMessage, 'error');
            console.error(errorMessage);
        }
    }

    addDetectedToTotal() {
        if (this.lastDetectedAmount) {
            window.moneyModule.addToTotal(this.lastDetectedAmount);
            
            // Disable button after adding
            const addToTotalBtn = document.getElementById('addToTotalBtn');
            if (addToTotalBtn) {
                addToTotalBtn.disabled = true;
            }
            
            // Clear last detected amount
            this.lastDetectedAmount = null;
        }
    }

    clearMoneyTotal() {
        if (window.moneyModule) {
            window.moneyModule.clearTotal();
            
            // Disable add to total button
            const addToTotalBtn = document.getElementById('addToTotalBtn');
            if (addToTotalBtn) {
                addToTotalBtn.disabled = true;
            }
            
            this.lastDetectedAmount = null;
        }
    }

    playText() {
        // Stop any previous speech before starting new one
        window.speechSynthesis.cancel();
        
        if (this.currentText) {
            this.textControls.isPlaying = true;
            this.textControls.isPaused = false;
            this.speakText(this.currentText);
            this.updateTextControls();
        }
    }

    pauseText() {
        // Check if speech is currently active
        const isSpeaking = window.speechSynthesis.speaking;
        
        if (isSpeaking && !this.textControls.isPaused) {
            // Pause the speech
            console.log('Pausing speech...');
            this.textControls.isPlaying = false;
            this.textControls.isPaused = true;
            window.speechSynthesis.pause();
            this.updateTextControls();
        } else if (this.textControls.isPaused) {
            // Resume the speech
            console.log('Resuming speech...');
            this.textControls.isPlaying = true;
            this.textControls.isPaused = false;
            window.speechSynthesis.resume();
            this.updateTextControls();
        } else {
            // If nothing is playing, just log it
            console.log('No speech to pause');
        }
    }

    replayText() {
        // Cancel current speech and start over
        window.speechSynthesis.cancel();
        this.textControls.isPlaying = false;
        this.textControls.isPaused = false;
        setTimeout(() => this.playText(), 500);
    }

    resetText() {
        this.currentText = '';
        this.textControls.isPlaying = false;
        this.textControls.isPaused = false;
        this.displayText('');
        this.hideTextControls();
    }

    clearAll() {
        this.resetText();
        this.displayFaceResult({ message: 'Face recognition cleared' });
        this.displayLocation({ message: 'Location cleared' });
    }

    validateTrainingForm() {
        const personName = document.getElementById('personName')?.value?.trim();
        const trainFaceBtn = document.getElementById('trainFaceBtn');
        if (trainFaceBtn) {
            trainFaceBtn.disabled = !personName || !this.trainingImageData;
        }
    }

    clearTrainingForm() {
        const personNameInput = document.getElementById('personName');
        const trainFaceBtn = document.getElementById('trainFaceBtn');
        if (personNameInput) personNameInput.value = '';
        if (trainFaceBtn) trainFaceBtn.disabled = true;
        this.trainingImageData = null;
    }

    displayText(text) {
        const textOutput = document.getElementById('textOutput');
        if (textOutput) {
            if (text.includes('<h3>') || text.includes('<h4>') || text.includes('<ul>')) {
                textOutput.innerHTML = text;
            } else {
                textOutput.innerHTML = `<p><strong>Detected Text:</strong><br>${text}</p>`;
            }
            textOutput.classList.add('success');
        }
    }

    displayFaceResult(result) {
        const faceOutput = document.getElementById('faceOutput');
        if (faceOutput) {
            faceOutput.innerHTML = `<p><strong>Result:</strong> ${result.message || result}</p>`;
            faceOutput.classList.add(result.message?.includes('not recognized') ? 'error' : 'success');
        }
    }

    showTextControls() {
        const textControls = document.getElementById('textControls');
        if (textControls) {
            textControls.style.display = 'flex';
        }
    }

    hideTextControls() {
        const textControls = document.getElementById('textControls');
        if (textControls) {
            textControls.style.display = 'none';
        }
    }

    showConfidence(confidence) {
        const confidenceDisplay = document.getElementById('confidenceDisplay');
        const confidenceValue = document.getElementById('confidenceValue');
        if (confidenceDisplay && confidenceValue) {
            confidenceValue.textContent = `${Math.round(confidence * 100)}%`;
            confidenceDisplay.style.display = 'block';
            setTimeout(() => {
                confidenceDisplay.style.display = 'none';
            }, 3000);
        }
    }

    hideConfidence() {
        const confidenceDisplay = document.getElementById('confidenceDisplay');
        if (confidenceDisplay) {
            confidenceDisplay.style.display = 'none';
        }
    }

    updateStatus(status) {
        const statusBar = document.getElementById('statusBar');
        if (statusBar) {
            statusBar.setAttribute('data-status', status);
        }
    }

    speakText(text) {
        if (!text) return;
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        
        // Set playing state when speech starts
        utterance.onstart = () => {
            this.textControls.isPlaying = true;
            this.textControls.isPaused = false;
            console.log('Speech started');
        };
        
        // Handle when speech ends
        utterance.onend = () => {
            this.textControls.isPlaying = false;
            this.textControls.isPaused = false;
            this.updateTextControls();
            console.log('Speech ended');
        };
        
        // Handle speech errors
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.textControls.isPlaying = false;
            this.textControls.isPaused = false;
            this.updateTextControls();
        };
        
        // Handle pause event
        utterance.onpause = () => {
            console.log('Speech paused');
        };
        
        // Handle resume event
        utterance.onresume = () => {
            console.log('Speech resumed');
        };
        
        window.speechSynthesis.speak(utterance);
    }

    showError(message) {
        console.error(`Error: ${message}`);
        alert(`Error: ${message}`);
    }

    handleKeyboardShortcuts(e) {
        if (e.code === 'Escape') {
            // Cancel speech and reset state
            window.speechSynthesis.cancel();
            this.textControls.isPlaying = false;
            this.textControls.isPaused = false;
            this.updateTextControls();
        }
    }

    updateTextControls() {
        const playBtn = document.getElementById('playTextBtn');
        const pauseBtn = document.getElementById('pauseTextBtn');
        
        if (playBtn) {
            playBtn.disabled = this.textControls.isPlaying;
        }
        if (pauseBtn) {
            pauseBtn.disabled = !this.textControls.isPlaying && !this.textControls.isPaused;
            // Change icon based on state
            if (this.textControls.isPaused) {
                pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                pauseBtn.title = 'Resume';
            } else {
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                pauseBtn.title = 'Pause';
            }
        }
    }

    updateStatusBarVoice(status) {
        const voiceStatus = document.getElementById('voiceStatus');
        const voiceStatusBar = document.getElementById('voiceStatusBar');
        if (voiceStatus) {
            voiceStatus.textContent = `Voice: ${status}`;
            
            // Update color based on status
            if (voiceStatusBar) {
                if (status === 'Active' || status.includes('Awake')) {
                    voiceStatusBar.classList.remove('inactive');
                    voiceStatusBar.classList.add('active');
                } else if (status === 'Sleeping' || status.includes('Error')) {
                    voiceStatusBar.classList.remove('active');
                    voiceStatusBar.classList.add('inactive');
                } else {
                    voiceStatusBar.classList.remove('active', 'inactive');
                }
            }
        }
    }

    updateCameraStatus(isActive) {
        const cameraStatus = document.getElementById('cameraStatus');
        const cameraStatusItem = document.getElementById('cameraStatusItem');
        if (cameraStatus && cameraStatusItem) {
            if (isActive) {
                cameraStatus.textContent = 'Camera: Active';
                cameraStatusItem.classList.remove('inactive');
                cameraStatusItem.classList.add('active');
            } else {
                cameraStatus.textContent = 'Camera: Inactive';
                cameraStatusItem.classList.remove('active');
                cameraStatusItem.classList.add('inactive');
            }
        }
    }

    updateLocationStatus(isActive) {
        const locationStatus = document.getElementById('locationStatus');
        const locationStatusItem = document.getElementById('locationStatusItem');
        if (locationStatus && locationStatusItem) {
            if (isActive) {
                locationStatus.textContent = 'Location: Active';
                locationStatusItem.classList.remove('inactive');
                locationStatusItem.classList.add('active');
            } else {
                locationStatus.textContent = 'Location: Inactive';
                locationStatusItem.classList.remove('active');
                locationStatusItem.classList.add('inactive');
            }
        }
    }

    // Audio recording controls (invoked by UI or voice commands)
    startRecording() {
        if (window.audioRecorder) {
            window.audioRecorder.start();
            this.speakText('Started recording');
        } else {
            this.speakText('Audio recorder not available');
        }
    }

    stopRecording() {
        if (window.audioRecorder) {
            window.audioRecorder.stop();
            this.speakText('Stopped recording');
        } else {
            this.speakText('Audio recorder not available');
        }
    }

    saveRecording() {
        if (window.audioRecorder) {
            window.audioRecorder.uploadCurrent();
            this.speakText('Saving recording');
        } else {
            this.speakText('Audio recorder not available');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.blindGoApp = new BlindGoApp();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlindGoApp;
}
