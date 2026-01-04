// BLINDGO - Face Recognition Module
class FaceModule {
    constructor() {
        this.knownFaces = new Map();
        this.isReady = false;
        this.apiEndpoints = {
            upload: '/api/face/upload',
            recognize: '/api/face/recognize',
            list: '/api/faces',
            delete: '/api/face/delete'
        };
    }

    async init() {
        try {
            await this.loadKnownFaces();
            this.isReady = true;
            return true;
        } catch (error) {
            throw error;
        }
    }

    async loadKnownFaces() {
        try {
            const response = await fetch(this.apiEndpoints.list);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.faces) {
                result.faces.forEach(name => {
                    this.knownFaces.set(name, { name, trained: true });
                });
            }
        } catch (error) {}
    }

    async trainFace(name, imageData) {
        try {
            if (!name || !imageData) {
                throw new Error('Name and image data are required');
            }
            const response = await fetch(this.apiEndpoints.upload, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    image: imageData
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.success) {
                this.knownFaces.set(name, { name, trained: true });
                return result;
            } else {
                throw new Error(result.message || 'Training failed');
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    async recognizeFace(imageData) {
        try {
            if (!imageData) {
                throw new Error('Image data is required');
            }
            const response = await fetch(this.apiEndpoints.recognize, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return result;
        } catch (error) {
            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    }

    async deleteFace(name) {
        try {
            if (!name) {
                throw new Error('Name is required');
            }
            const response = await fetch(`${this.apiEndpoints.delete}/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.success) {
                this.knownFaces.delete(name);
                return result;
            } else {
                throw new Error(result.message || 'Deletion failed');
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    async updateFace(name, newImageData) {
        try {
            const deleteResult = await this.deleteFace(name);
            if (!deleteResult.success) {
                throw new Error(`Failed to delete old face: ${deleteResult.message}`);
            }
            const trainResult = await this.trainFace(name, newImageData);
            if (!trainResult.success) {
                throw new Error(`Failed to train new face: ${trainResult.message}`);
            }
            return {
                success: true,
                message: `Face updated successfully for ${name}`
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    getKnownFaces() {
        return Array.from(this.knownFaces.values());
    }

    isFaceKnown(name) {
        return this.knownFaces.has(name);
    }

    getFaceCount() {
        return this.knownFaces.size;
    }

    assessFaceQuality(imageData) {
        try {
            const img = new Image();
            img.src = imageData;
            return new Promise((resolve) => {
                img.onload = () => {
                    const quality = this.calculateFaceQuality(img);
                    resolve(quality);
                };
                img.onerror = () => {
                    resolve({ score: 0, issues: ['Failed to load image'] });
                };
            });
        } catch (error) {
            return Promise.resolve({ score: 0, issues: ['Assessment failed'] });
        }
    }

    calculateFaceQuality(img) {
        const issues = [];
        let score = 100;
        if (img.width < 200 || img.height < 200) {
            issues.push('Image resolution too low');
            score -= 30;
        }
        if (img.width > 2000 || img.height > 2000) {
            issues.push('Image resolution too high (may slow processing)');
            score -= 10;
        }
        const aspectRatio = img.width / img.height;
        if (aspectRatio < 0.5 || aspectRatio > 2.0) {
            issues.push('Image aspect ratio not ideal for face recognition');
            score -= 20;
        }
        return {
            score: Math.max(0, score),
            issues: issues,
            dimensions: { width: img.width, height: img.height },
            aspectRatio: aspectRatio
        };
    }

    async trainMultipleFaces(facesData) {
        const results = [];
        for (const faceData of facesData) {
            try {
                const result = await this.trainFace(faceData.name, faceData.image);
                results.push({
                    name: faceData.name,
                    success: result.success,
                    message: result.message
                });
            } catch (error) {
                results.push({
                    name: faceData.name,
                    success: false,
                    message: error.message
                });
            }
        }
        return results;
    }

    async recognizeMultipleFaces(imageDataArray) {
        const results = [];
        for (const imageData of imageDataArray) {
            try {
                const result = await this.recognizeFace(imageData);
                results.push({
                    image: imageData,
                    success: result.success,
                    names: result.names || [],
                    message: result.message
                });
            } catch (error) {
                results.push({
                    image: imageData,
                    success: false,
                    names: [],
                    message: error.message
                });
            }
        }
        return results;
    }

    exportFacesData() {
        try {
            const facesData = Array.from(this.knownFaces.values());
            const exportData = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                faces: facesData
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            return URL.createObjectURL(blob);
        } catch (error) {
            return null;
        }
    }

    downloadFacesData(filename = 'faces_data') {
        const url = this.exportFacesData();
        if (!url) {
            return false;
        }
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
    }

    calculateConfidence(matchResults) {
        if (!matchResults || matchResults.length === 0) {
            return 0;
        }
        const totalConfidence = matchResults.reduce((sum, result) => {
            return sum + (result.confidence || 0.5);
        }, 0);
        return totalConfidence / matchResults.length;
    }

    getRecognitionStats() {
        const knownFaces = this.getKnownFaces();
        return {
            totalFaces: knownFaces.length,
            trainedFaces: knownFaces.filter(face => face.trained).length,
            lastTraining: knownFaces.length > 0 ? new Date().toISOString() : null,
            moduleStatus: this.isReady ? 'Ready' : 'Not Ready'
        };
    }

    validateFaceName(name) {
        const issues = [];
        if (!name || name.trim().length === 0) {
            issues.push('Name cannot be empty');
        }
        if (name && name.length > 50) {
            issues.push('Name is too long (max 50 characters)');
        }
        if (name && /[<>:"/\\|?*]/.test(name)) {
            issues.push('Name contains invalid characters');
        }
        if (this.isFaceKnown(name)) {
            issues.push('A face with this name already exists');
        }
        return {
            isValid: issues.length === 0,
            issues: issues
        };
    }

    destroy() {
        this.knownFaces.clear();
        this.isReady = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaceModule;
}
