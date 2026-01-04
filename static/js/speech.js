// Speech Recognition Module - Voice Commands Handler
class SpeechModule {
    constructor(appInstance) {
        this.app = appInstance;
        this.voiceRecognition = null;
        this.isListening = false;
        this.isProcessingCommand = false;
        this.lastCommandTime = 0;
        this.init();
    }

    init() {
        // Check if browser supports Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported in this browser');
            const voiceCommandsPanel = document.getElementById('voiceCommandsPanel');
            if (voiceCommandsPanel) {
                voiceCommandsPanel.style.display = 'none';
            }
            this.app.updateStatusBarVoice('Not Supported');
            return;
        }

        this.voiceRecognition = new SpeechRecognition();
        
        // Optimized settings for faster response
        this.voiceRecognition.continuous = true;
        this.voiceRecognition.interimResults = true;
        this.voiceRecognition.lang = 'en-US';
        this.voiceRecognition.maxAlternatives = 1;

        this.setupEventHandlers();
        this.startListening();
    }

    setupEventHandlers() {
        this.voiceRecognition.onstart = () => {
            console.log('Voice recognition active - Ready for commands');
            this.isListening = true;
            this.app.updateStatusBarVoice('Active');
        };

        this.voiceRecognition.onresult = (event) => {
            this.handleVoiceResult(event);
        };

        this.voiceRecognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            
            if (event.error === 'no-speech') {
                return;
            }
            
            if (event.error === 'aborted' || event.error === 'audio-capture') {
                console.log('Restarting voice recognition...');
                this.app.updateStatusBarVoice('Error - Restarting');
                setTimeout(() => {
                    if (!this.isListening) {
                        this.startListening();
                    }
                }, 1000);
            }
        };

        this.voiceRecognition.onend = () => {
            console.log('Voice recognition ended, restarting...');
            this.isListening = false;
            this.app.updateStatusBarVoice('Restarting...');
            
            setTimeout(() => {
                this.startListening();
            }, 100);
        };
    }

    handleVoiceResult(event) {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript.toLowerCase().trim();
            
            // INSTANT PAUSE - Check pause FIRST for immediate response
            if (transcript.includes('pause') || 
                transcript.includes('paus') ||
                transcript === 'stop' ||
                transcript.includes('hold')) {
                console.log('✓ INSTANT Pause command recognized!');
                this.app.pauseText();
                break;
            }
            
            // Check if this is a control command for faster processing
            const isControlCommand = this.isControlCommand(transcript);
            
            const shouldProcess = isControlCommand ? 
                (result[0].confidence > 0.3) : 
                (result.isFinal || result[0].confidence > 0.5);
            
            if (shouldProcess) {
                console.log('Detected:', transcript, '(confidence:', result[0].confidence, ')');
                
                if (this.processCommand(transcript)) {
                    break;
                }
            }
        }
    }

    isControlCommand(transcript) {
        return transcript.includes('play') || 
               transcript.includes('resume') || 
               transcript.includes('replay') || 
               transcript.includes('repeat') ||
               transcript.includes('start') ||
               transcript.includes('continue') ||
               transcript.includes('again') ||
               transcript.includes('recognize') ||
               transcript.includes('face') ||
               transcript.includes('location') ||
               transcript.includes('where') ||
               transcript.includes('capture') ||
               transcript.includes('train') ||
               transcript.includes('detect') ||
               transcript.includes('object');
    }

    processCommand(transcript) {
        // 1. Capture Face (training)
        if ((transcript.includes('capture') && transcript.includes('face')) ||
            transcript.includes('capture training') ||
            transcript.includes('take photo') ||
            transcript.includes('take picture')) {
            console.log('✓ Capture training face command detected!');
            this.app.captureTrainingFace();
            return true;
        }
        
        // 2. Train Face with Name
        if (transcript.includes('train face') || 
            (transcript.includes('train') && transcript.includes('as'))) {
            console.log('✓ Train face command detected!');
            
            let name = null;
            
            if (transcript.includes('train face as')) {
                name = transcript.split('train face as')[1].trim();
            } else if (transcript.includes('train face')) {
                name = transcript.split('train face')[1].trim();
            } else if (transcript.includes('train as')) {
                name = transcript.split('train as')[1].trim();
            }
            
            if (name) {
                name = name.split(' ')[0];
                name = name.charAt(0).toUpperCase() + name.slice(1);
                console.log('Extracted name:', name);
                this.app.trainFace(name);
            } else {
                this.app.speakText('Please say train face followed by the name');
            }
            return true;
        }
        
        // 3. Get Location
        if ((transcript.includes('get') && transcript.includes('location')) ||
            transcript.includes('get location') ||
            transcript.includes('where am i') ||
            transcript.includes('my location') ||
            transcript.includes('current location') ||
            transcript.includes('find location') ||
            transcript.includes('show location')) {
            console.log('✓ Get location command detected!');
            this.app.getLocation();
            return true;
        }
        
        // 4. Detect Objects
        if ((transcript.includes('detect') && transcript.includes('object')) ||
            transcript.includes('detect object') ||
            transcript.includes('identify object') ||
            transcript.includes('scan object') ||
            transcript.includes('what is around me') ||
            transcript.includes('what do you see')) {
            console.log('✓ Detect objects command detected!');
            const detectBtn = document.getElementById('detectObjectBtn');
            if (detectBtn) {
                detectBtn.click();
            }
            return true;
        }
        
        // 5. Recognize Face
        if ((transcript.includes('recognize') && transcript.includes('face')) ||
            transcript.includes('recognize face') ||
            transcript.includes('who is this') ||
            transcript.includes('who is that') ||
            transcript.includes('identify face') ||
            transcript.includes('scan face')) {
            console.log('✓ Recognize face command detected!');
            this.app.recognizeFace();
            return true;
        }
        
        // 6. Play Text
        if (transcript.includes('play') || 
            transcript.includes('start') ||
            transcript.includes('begin')) {
            console.log('✓ Play command recognized!');
            this.app.playText();
            return true;
        }
        
        // 7. Resume Text
        if (transcript.includes('resume') || 
            transcript.includes('continue')) {
            console.log('✓ Resume command recognized!');
            if (this.app.textControls.isPaused) {
                this.app.pauseText();
            }
            return true;
        }
        
        // 8. Replay Text
        if (transcript.includes('replay') || 
            transcript.includes('repeat') ||
            transcript.includes('read again') ||
            transcript.includes('again')) {
            console.log('✓ Replay command recognized!');
            this.app.replayText();
            return true;
        }
        
        // 9. Read Text (with debounce)
        if ((transcript.includes('read') && transcript.includes('text')) ||
            transcript.includes('read text') ||
            transcript.includes('readtext')) {
            
            const currentTime = Date.now();
            if (this.isProcessingCommand || (currentTime - this.lastCommandTime) < 2000) {
                console.log('Command ignored - too soon after previous command');
                return true;
            }
            
            console.log('✓ Command recognized! Capturing text...');
            this.isProcessingCommand = true;
            this.lastCommandTime = currentTime;
            
            this.app.captureText().finally(() => {
                setTimeout(() => {
                    this.isProcessingCommand = false;
                    console.log('Ready for next command');
                }, 1000);
            });
            return true;
        }

        // 10. Record Audio (voice command)
        if (transcript.includes('record audio') || transcript.includes('start recording') || transcript.includes('start record')) {
            console.log('✓ Record audio command detected!');
            if (this.app.startRecording) {
                this.app.startRecording();
            }
            return true;
        }

        // 11. Stop Recording
        if (transcript.includes('stop recording') || transcript.includes('stop record') || transcript === 'stop recording') {
            console.log('✓ Stop recording command detected!');
            if (this.app.stopRecording) {
                this.app.stopRecording();
            }
            return true;
        }
        
        return false;
    }

    startListening() {
        if (this.voiceRecognition && !this.isListening) {
            try {
                this.voiceRecognition.start();
                console.log('Voice recognition started - ready for commands');
            } catch (error) {
                if (error.message.includes('already started')) {
                    this.isListening = true;
                } else {
                    console.error('Error starting voice recognition:', error);
                }
            }
        }
    }

    stopListening() {
        if (this.voiceRecognition && this.isListening) {
            try {
                this.voiceRecognition.stop();
                this.isListening = false;
                this.app.updateStatusBarVoice('Stopped');
                console.log('Voice recognition stopped');
            } catch (error) {
                console.error('Error stopping voice recognition:', error);
            }
        }
    }

    restart() {
        this.stopListening();
        setTimeout(() => this.startListening(), 500);
    }
}

// Export for use in main.js
window.SpeechModule = SpeechModule;
