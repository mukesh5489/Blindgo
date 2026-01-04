// BLINDGO - Money Recognition Module
class MoneyModule {
    constructor() {
        this.apiEndpoint = '/api/money/detect';
        this.runningTotal = 0;
        this.detectionHistory = [];
        this.isDetecting = false;
    }

    async detectMoney(imageData) {
        try {
            if (this.isDetecting) {
                return {
                    success: false,
                    message: 'Detection already in progress...'
                };
            }

            this.isDetecting = true;
            this.updateDetectionStatus('Detecting currency...', 'info');

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
                // Add to history
                this.addToHistory(result);
                
                // Update display
                this.displayResult(result);
                
                // Auto-speak the result
                this.speakResult(result);
            } else {
                this.updateDetectionStatus(result.message || 'Detection failed', 'error');
            }

            this.isDetecting = false;
            return result;
            
        } catch (error) {
            this.isDetecting = false;
            this.updateDetectionStatus(`Error: ${error.message}`, 'error');
            return {
                success: false,
                message: error.message
            };
        }
    }

    displayResult(result) {
        const outputDiv = document.getElementById('moneyOutput');
        if (!outputDiv) return;

        const { denomination, confidence, symbol, color_name } = result;

        outputDiv.innerHTML = `
            <div class="money-result-card">
                <div class="denomination-display">
                    <span class="currency-symbol">${symbol}</span>
                    <span class="amount">${denomination}</span>
                </div>
                <div class="detection-details">
                    <p><strong>Color:</strong> ${color_name}</p>
                    <p><strong>Confidence:</strong> ${confidence}%</p>
                </div>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidence}%"></div>
                </div>
            </div>
        `;

        outputDiv.classList.remove('error');
        outputDiv.classList.add('success');
    }

    updateDetectionStatus(message, type = 'info') {
        const outputDiv = document.getElementById('moneyOutput');
        if (!outputDiv) return;

        outputDiv.innerHTML = `<p class="${type}">${message}</p>`;
        
        if (type === 'error') {
            outputDiv.classList.add('error');
            outputDiv.classList.remove('success');
        } else {
            outputDiv.classList.remove('error', 'success');
        }
    }

    addToHistory(result) {
        const historyItem = {
            denomination: result.denomination,
            timestamp: new Date().toISOString(),
            confidence: result.confidence
        };

        this.detectionHistory.unshift(historyItem);

        // Keep only last 10 detections
        if (this.detectionHistory.length > 10) {
            this.detectionHistory.pop();
        }

        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyDiv = document.getElementById('moneyHistory');
        if (!historyDiv) return;

        if (this.detectionHistory.length === 0) {
            historyDiv.innerHTML = '<p class="no-history">No detections yet</p>';
            return;
        }

        const historyHTML = this.detectionHistory.map((item, index) => {
            const time = new Date(item.timestamp).toLocaleTimeString();
            return `
                <div class="history-item">
                    <span class="history-amount">₹${item.denomination}</span>
                    <span class="history-time">${time}</span>
                </div>
            `;
        }).join('');

        historyDiv.innerHTML = historyHTML;
    }

    addToTotal(amount) {
        this.runningTotal += amount;
        this.updateTotalDisplay();
        this.speakTotal();
    }

    updateTotalDisplay() {
        const totalDisplay = document.getElementById('runningTotal');
        if (totalDisplay) {
            totalDisplay.textContent = `₹${this.runningTotal}`;
        }

        const totalAmount = document.getElementById('totalAmount');
        if (totalAmount) {
            totalAmount.textContent = this.runningTotal;
        }
    }

    clearTotal() {
        this.runningTotal = 0;
        this.updateTotalDisplay();
        
        const outputDiv = document.getElementById('moneyOutput');
        if (outputDiv) {
            outputDiv.innerHTML = '<p>Total cleared. Scan a note to begin.</p>';
            outputDiv.classList.remove('success', 'error');
        }

        this.speakText('Total cleared');
    }

    clearHistory() {
        this.detectionHistory = [];
        this.updateHistoryDisplay();
        this.speakText('History cleared');
    }

    speakResult(result) {
        const { denomination, confidence } = result;
        let text = `This is a ${denomination} rupee note`;
        
        if (confidence < 60) {
            text += '. Low confidence, please try again with better lighting.';
        }
        
        this.speakText(text);
    }

    speakTotal() {
        const text = `Total: ${this.runningTotal} rupees`;
        this.speakText(text);
    }

    speakText(text) {
        if (!text) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        window.speechSynthesis.speak(utterance);
    }

    getHistory() {
        return [...this.detectionHistory];
    }

    getTotalAmount() {
        return this.runningTotal;
    }

    exportHistory() {
        const data = {
            history: this.detectionHistory,
            total: this.runningTotal,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `money-history-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MoneyModule;
}
