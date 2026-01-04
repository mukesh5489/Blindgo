// BLINDGO - OCR (Optical Character Recognition) Module
class OCRModule {
    constructor() {
        this.currentText = '';
        this.isReading = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.readingSpeed = 0.8;
        this.apiEndpoint = '/api/ocr';
    }

    async extractText(imageData) {
        try {
            const response = await fetch(this.apiEndpoint, {
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
            if (result.success) {
                this.currentText = result.text;
                return result;
            } else {
                return result;
            }
        } catch (error) {
            return {
                success: false,
                text: '',
                message: `Error: ${error.message}`
            };
        }
    }

    async readText(text = null, options = {}) {
        try {
            const textToRead = text || this.currentText;
            if (!textToRead || textToRead.trim() === '') {
                return false;
            }
            this.stopReading();
            const readingOptions = {
                rate: options.rate || this.readingSpeed,
                pitch: options.pitch || 1.0,
                volume: options.volume || 1.0,
                voice: options.voice || null
            };
            this.isReading = true;
            this.isPaused = false;
            const sentences = this.splitIntoSentences(textToRead);
            for (let i = 0; i < sentences.length; i++) {
                if (!this.isReading || this.isPaused) {
                    break;
                }
                const sentence = sentences[i].trim();
                if (sentence) {
                    await this.readSentence(sentence, readingOptions);
                    if (i < sentences.length - 1 && this.isReading && !this.isPaused) {
                        await this.delay(500);
                    }
                }
            }
            this.isReading = false;
            return true;
        } catch (error) {
            this.isReading = false;
            return false;
        }
    }

    async readSentence(sentence, options) {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(sentence);
            utterance.rate = options.rate;
            utterance.pitch = options.pitch;
            utterance.volume = options.volume;
            if (options.voice) {
                utterance.voice = options.voice;
            }
            utterance.onend = () => {
                resolve();
            };
            utterance.onerror = () => {
                resolve();
            };
            window.speechSynthesis.speak(utterance);
            this.currentUtterance = utterance;
        });
    }

    pauseReading() {
        if (this.isReading && !this.isPaused) {
            this.isPaused = true;
            if (this.currentUtterance) {
                window.speechSynthesis.pause();
            }
        }
    }

    resumeReading() {
        if (this.isReading && this.isPaused) {
            this.isPaused = false;
            if (this.currentUtterance) {
                window.speechSynthesis.resume();
            }
        }
    }

    stopReading() {
        this.isReading = false;
        this.isPaused = false;
        if (this.currentUtterance) {
            window.speechSynthesis.cancel();
            this.currentUtterance = null;
        }
    }

    setReadingSpeed(speed) {
        this.readingSpeed = Math.max(0.1, Math.min(2.0, speed));
    }

    getReadingSpeed() {
        return this.readingSpeed;
    }

    getReadingStatus() {
        return {
            isReading: this.isReading,
            isPaused: this.isPaused,
            currentText: this.currentText,
            readingSpeed: this.readingSpeed
        };
    }

    splitIntoSentences(text) {
        const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
        return sentences;
    }

    splitIntoWords(text) {
        return text.split(/\s+/).filter(word => word.trim().length > 0);
    }

    splitIntoParagraphs(text) {
        return text.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 0);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    preprocessText(text) {
        if (!text) return '';
        let processed = text.replace(/\s+/g, ' ');
        processed = processed.replace(/[|]/g, 'I');
        processed = processed.replace(/[0]/g, 'O');
        processed = processed.replace(/[1]/g, 'l');
        processed = processed.replace(/\s+([.,!?])/g, '$1');
        return processed.trim();
    }

    getTextStats(text = null) {
        const textToAnalyze = text || this.currentText;
        if (!textToAnalyze) {
            return {
                characters: 0,
                words: 0,
                sentences: 0,
                paragraphs: 0,
                estimatedReadingTime: 0
            };
        }
        const characters = textToAnalyze.length;
        const words = this.splitIntoWords(textToAnalyze).length;
        const sentences = this.splitIntoSentences(textToAnalyze).length;
        const paragraphs = this.splitIntoParagraphs(textToAnalyze).length;
        const estimatedReadingTime = Math.ceil(words / 200);
        return {
            characters,
            words,
            sentences,
            paragraphs,
            estimatedReadingTime
        };
    }

    highlightText(text, highlightWords) {
        if (!text || !highlightWords || highlightWords.length === 0) {
            return text;
        }
        let highlightedText = text;
        highlightWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            highlightedText = highlightedText.replace(regex, `<mark>$&</mark>`);
        });
        return highlightedText;
    }

    searchInText(query, text = null) {
        const textToSearch = text || this.currentText;
        if (!textToSearch || !query) {
            return [];
        }
        const results = [];
        const regex = new RegExp(query, 'gi');
        let match;
        while ((match = regex.exec(textToSearch)) !== null) {
            results.push({
                text: match[0],
                index: match.index,
                context: textToSearch.substring(
                    Math.max(0, match.index - 20),
                    Math.min(textToSearch.length, match.index + match[0].length + 20)
                )
            });
        }
        return results;
    }

    exportText(format = 'txt', text = null) {
        const textToExport = text || this.currentText;
        if (!textToExport) {
            return null;
        }
        switch (format.toLowerCase()) {
            case 'txt':
                return this.exportAsText(textToExport);
            case 'json':
                return this.exportAsJSON(textToExport);
            case 'html':
                return this.exportAsHTML(textToExport);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    exportAsText(text) {
        const blob = new Blob([text], { type: 'text/plain' });
        return URL.createObjectURL(blob);
    }

    exportAsJSON(text) {
        const data = {
            text: text,
            timestamp: new Date().toISOString(),
            stats: this.getTextStats(text)
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }

    exportAsHTML(text) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Extracted Text</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                    .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                    .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 30px; }
                    .text { white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Extracted Text</h1>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                </div>
                <div class="stats">
                    <h3>Text Statistics</h3>
                    <p>${JSON.stringify(this.getTextStats(text), null, 2)}</p>
                </div>
                <div class="text">${text}</div>
            </body>
            </html>
        `;
        const blob = new Blob([html], { type: 'text/html' });
        return URL.createObjectURL(blob);
    }

    downloadText(format = 'txt', filename = 'extracted_text') {
        const url = this.exportText(format);
        if (!url) {
            console.error('No text to export');
            return false;
        }
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
    }

    destroy() {
        this.stopReading();
        this.currentText = '';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OCRModule;
}
