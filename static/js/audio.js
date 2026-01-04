// Audio Recorder module
class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.chunks = [];
        this.isRecording = false;
        this.currentBlob = null;
        this.reservedFilename = null;
        this.initUI();
    }

    initUI() {
        document.addEventListener('DOMContentLoaded', () => {
            this.startBtn = document.getElementById('startRecordingBtn');
            this.stopBtn = document.getElementById('stopRecordingBtn');
            this.saveBtn = document.getElementById('saveRecordingBtn');
            this.statusEl = document.getElementById('audioStatus');
            this.recordingsList = document.getElementById('audioRecordingsList');

            if (this.startBtn) this.startBtn.addEventListener('click', () => this.start());
            if (this.stopBtn) this.stopBtn.addEventListener('click', () => this.stop());
            if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.uploadCurrent());
            this.updateUI();
        });
    }

    updateUI() {
        if (this.startBtn) this.startBtn.disabled = this.isRecording;
        if (this.stopBtn) this.stopBtn.disabled = !this.isRecording;
        if (this.saveBtn) this.saveBtn.disabled = !(this.currentBlob instanceof Blob);
        if (this.statusEl) this.statusEl.textContent = this.isRecording ? 'Recording...' : (this.currentBlob ? 'Ready to save' : 'Idle');
    }

    async start() {
        try {
            if (this.isRecording) return;
            // Reserve a filename on the server so we can auto-save
            try {
                const res = await fetch('/api/audio/reserve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    this.reservedFilename = data.filename;
                    if (this.statusEl) this.statusEl.textContent = 'Recording (reserved ' + this.reservedFilename + ')';
                } else {
                    console.warn('Failed to reserve filename, will upload normally', data);
                    this.reservedFilename = null;
                }
            } catch (err) {
                console.warn('Reserve request failed', err);
                this.reservedFilename = null;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.chunks = [];
            this.mediaRecorder.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
            this.mediaRecorder.onstop = () => {
                this.currentBlob = new Blob(this.chunks, { type: 'audio/webm' });
                this.updateUI();
                this.addLocalPreview(this.currentBlob, this.reservedFilename);
                // Automatically upload the finished blob to the reserved filename (if any)
                this.uploadBlob(this.currentBlob, this.reservedFilename).finally(() => {
                    // clear reserved filename after upload
                    this.reservedFilename = null;
                    this.updateUI();
                });
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateUI();
        } catch (err) {
            console.error('Microphone access error:', err);
            alert('Unable to access microphone: ' + (err.message || err));
        }
    }

    stop() {
        if (!this.isRecording || !this.mediaRecorder) return;
        try {
            this.mediaRecorder.stop();
            // stop all tracks
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
            }
        } catch (err) {
            console.error('Error stopping recorder:', err);
        }
        this.isRecording = false;
        this.updateUI();
    }

    addLocalPreview(blob) {
        if (!this.recordingsList) return;
        const url = URL.createObjectURL(blob);
        const item = document.createElement('div');
        item.className = 'audio-item';
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = url;
        const info = document.createElement('div');
        info.className = 'audio-info';
        info.textContent = (arguments[1] ? ('Filename: ' + arguments[1]) : 'Unsaved');
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'control-btn';
        saveBtn.addEventListener('click', () => this.uploadBlob(blob, this.reservedFilename));
        item.appendChild(audio);
        item.appendChild(info);
        item.appendChild(saveBtn);
        this.recordingsList.prepend(item);
    }
    async uploadBlob(blob, serverFilename = null) {
        const fd = new FormData();
        const filename = serverFilename || `recording_${Date.now()}.webm`;
        fd.append('file', blob, filename);
        if (serverFilename) fd.append('filename', serverFilename);
        try {
            this.statusEl && (this.statusEl.textContent = 'Uploading...');
            const res = await fetch('/api/audio/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok && data.success) {
                this.statusEl && (this.statusEl.textContent = 'Saved: ' + data.filename);
                // refresh server list after upload
                setTimeout(() => this.fetchServerRecordings(), 500);
            } else {
                this.statusEl && (this.statusEl.textContent = 'Upload failed');
                console.error('Upload failed', data);
            }
        } catch (err) {
            this.statusEl && (this.statusEl.textContent = 'Upload error');
            console.error('Upload error', err);
        }
        setTimeout(() => this.updateUI(), 800);
    }

    async uploadCurrent() {
        if (!(this.currentBlob instanceof Blob)) return;
        await this.uploadBlob(this.currentBlob);
    }
 
    async fetchServerRecordings() {
        try {
            const res = await fetch('/api/audio/list');
            const data = await res.json();
            if (res.ok && data.success) {
                this.renderServerList(data.files || []);
            } else {
                console.error('Failed to fetch recordings', data);
            }
        } catch (err) {
            console.error('Error fetching recordings', err);
        }
    }

    renderServerList(files) {
        const container = document.getElementById('audioServerList');
        if (!container) return;
        container.innerHTML = '';
        if (!files || files.length === 0) {
            container.innerHTML = '<p class="no-recordings">No saved recordings yet</p>';
            return;
        }

        files.forEach(f => {
            const item = document.createElement('div');
            item.className = 'server-audio-item';

            const name = document.createElement('div');
            name.className = 'server-audio-name';
            name.textContent = f.filename;

            const meta = document.createElement('div');
            meta.className = 'server-audio-meta';
            meta.textContent = `${(f.size/1024).toFixed(1)} KB • ${new Date(f.mtime*1000).toLocaleString()}`;

            const controls = document.createElement('div');
            controls.className = 'server-audio-controls';

            const dl = document.createElement('a');
            dl.className = 'control-btn';
            dl.textContent = 'Download';
            dl.href = '/api/audio/download/' + encodeURIComponent(f.filename);
            dl.setAttribute('download', f.filename);

            controls.appendChild(dl);

            item.appendChild(name);
            item.appendChild(meta);
            item.appendChild(controls);
            container.appendChild(item);
        });
    }

    attachServerControls() {
        document.addEventListener('DOMContentLoaded', () => {
            const refreshBtn = document.getElementById('refreshRecordingsBtn');
            if (refreshBtn) refreshBtn.addEventListener('click', () => this.fetchServerRecordings());
            // initial load
            this.fetchServerRecordings();
        });
    }
}

// Expose globally
window.AudioRecorder = AudioRecorder;
window.audioRecorder = new AudioRecorder();
window.audioRecorder.attachServerControls();
