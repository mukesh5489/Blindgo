// BLINDGO - Camera Management Module
class CameraModule {
    constructor() {
        this.streams = new Map();
        this.isReady = false;
        this.cameras = new Map();
        this.currentCamera = null;
        this.constraints = {
            video: {
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                facingMode: 'environment'
            },
            audio: false
        };
    }

    async init() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera access not supported in this browser');
            }
            await this.getAvailableCameras();
            if (this.cameras.size > 0) {
                await this.initializeCamera();
            }
            this.isReady = true;
            return true;
        } catch (error) {
            throw error;
        }
    }

    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            this.cameras.clear();
            videoDevices.forEach((device, index) => {
                this.cameras.set(device.deviceId, {
                    id: device.deviceId,
                    label: device.label || `Camera ${index + 1}`,
                    index: index
                });
            });
        } catch (error) {}
    }

    async initializeCamera(cameraId = null) {
        try {
            this.stopAllStreams();
            if (cameraId && this.cameras.has(cameraId)) {
                this.currentCamera = cameraId;
            } else if (this.cameras.size > 0) {
                this.currentCamera = Array.from(this.cameras.keys())[0];
            } else {
                throw new Error('No cameras available');
            }
            const constraints = {
                ...this.constraints,
                video: {
                    ...this.constraints.video,
                    deviceId: this.currentCamera ? { exact: this.currentCamera } : undefined
                }
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.streams.set('main', stream);
            await this.setupVideoElements(stream);
            return true;
        } catch (error) {
            throw error;
        }
    }

    async setupVideoElements(stream) {
        const videoElements = [
            'textCamera',
            'faceCamera',
            'trainingCamera',
            'moneyCamera'
        ];
        for (const elementId of videoElements) {
            const video = document.getElementById(elementId);
            if (video) {
                try {
                    video.srcObject = stream;
                    video.style.transform = 'scaleX(-1)'; // Mirror the camera feed horizontally
                    await video.play();
                } catch (error) {}
            }
        }
    }

    async captureImage(type = 'text') {
        try {
            let videoId, canvasId;
            switch (type) {
                case 'text':
                    videoId = 'textCamera';
                    canvasId = 'textCanvas';
                    break;
                case 'face':
                    videoId = 'faceCamera';
                    canvasId = 'faceCanvas';
                    break;
                case 'training':
                    videoId = 'trainingCamera';
                    canvasId = 'trainingCanvas';
                    break;
                case 'money':
                    videoId = 'moneyCamera';
                    canvasId = 'moneyCanvas';
                    break;
                default:
                    videoId = 'textCamera';
                    canvasId = 'textCanvas';
            }
            const video = document.getElementById(videoId);
            const canvas = document.getElementById(canvasId);
            if (!video || !canvas) {
                throw new Error(`Video or canvas element not found: ${videoId}, ${canvasId}`);
            }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            return imageData;
        } catch (error) {
            return null;
        }
    }

    async captureImageWithQuality(type = 'text', quality = 0.8) {
        try {
            const imageData = await this.captureImage(type);
            if (!imageData) return null;
            let canvasId;
            switch (type) {
                case 'text':
                    canvasId = 'textCanvas';
                    break;
                case 'face':
                    canvasId = 'faceCanvas';
                    break;
                case 'training':
                    canvasId = 'trainingCanvas';
                    break;
                default:
                    canvasId = 'textCanvas';
            }
            const canvas = document.getElementById(canvasId);
            if (canvas) {
                const highQualityData = canvas.toDataURL('image/jpeg', quality);
                return highQualityData;
            }
            return imageData;
        } catch (error) {
            return null;
        }
    }

    async switchCamera() {
        try {
            if (this.cameras.size < 2) {
                return false;
            }
            const cameraIds = Array.from(this.cameras.keys());
            const currentIndex = cameraIds.indexOf(this.currentCamera);
            const nextIndex = (currentIndex + 1) % cameraIds.length;
            const nextCamera = cameraIds[nextIndex];
            await this.initializeCamera(nextCamera);
            return true;
        } catch (error) {
            return false;
        }
    }

    async setCameraConstraints(constraints) {
        try {
            this.constraints = { ...this.constraints, ...constraints };
            if (this.streams.has('main')) {
                await this.initializeCamera();
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    async setResolution(width, height) {
        const constraints = {
            video: {
                width: { exact: width },
                height: { exact: height }
            }
        };
        return await this.setCameraConstraints(constraints);
    }

    async setFacingMode(mode) {
        const constraints = {
            video: {
                facingMode: mode
            }
        };
        return await this.setCameraConstraints(constraints);
    }

    async enableTorch(enabled) {
        try {
            if (!this.streams.has('main')) {
                return false;
            }
            const stream = this.streams.get('main');
            const track = stream.getVideoTracks()[0];
            if (track.getCapabilities && track.getCapabilities().torch) {
                await track.applyConstraints({
                    advanced: [{ torch: enabled }]
                });
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async enableZoom(level) {
        try {
            if (!this.streams.has('main')) {
                return false;
            }
            const stream = this.streams.get('main');
            const track = stream.getVideoTracks()[0];
            if (track.getCapabilities && track.getCapabilities().zoom) {
                await track.applyConstraints({
                    advanced: [{ zoom: level }]
                });
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async takePhoto(videoId, options = {}) {
        const {
            quality = 0.9,
            format = 'jpeg',
            width = null,
            height = null
        } = options;
        try {
            const video = document.getElementById(videoId);
            if (!video) {
                throw new Error('Video element not found');
            }
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (width && height) {
                canvas.width = width;
                canvas.height = height;
            } else {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, `image/${format}`, quality);
            });
            const dataUrl = await this.blobToDataURL(blob);
            return {
                blob: blob,
                dataUrl: dataUrl,
                width: canvas.width,
                height: canvas.height,
                format: format
            };
        } catch (error) {
            return null;
        }
    }

    async blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async startRecording(videoId, options = {}) {
        try {
            const stream = this.streams.get('main');
            if (!stream) {
                throw new Error('No camera stream available');
            }
            const mediaRecorder = new MediaRecorder(stream, options);
            const chunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
            };
            mediaRecorder.start();
            this.mediaRecorder = mediaRecorder;
            return true;
        } catch (error) {
            return false;
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
        }
    }

    stopAllStreams() {
        this.streams.forEach((stream, key) => {
            stream.getTracks().forEach(track => track.stop());
            this.streams.delete(key);
        });
    }

    pauseStream() {
        this.streams.forEach(stream => {
            stream.getTracks().forEach(track => track.enabled = false);
        });
    }

    resumeStream() {
        this.streams.forEach(stream => {
            stream.getTracks().forEach(track => track.enabled = true);
        });
    }

    getCameraInfo() {
        return {
            currentCamera: this.currentCamera,
            availableCameras: Array.from(this.cameras.values()),
            isReady: this.isReady,
            streamActive: this.streams.size > 0
        };
    }

    getStreamConstraints() {
        return this.constraints;
    }

    async testCamera() {
        try {
            const testImage = await this.captureImage('textCamera', 'textCanvas');
            return !!testImage;
        } catch (error) {
            return false;
        }
    }

    destroy() {
        this.stopAllStreams();
        this.isReady = false;
        this.cameras.clear();
        this.currentCamera = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraModule;
}
