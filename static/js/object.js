// Object detection frontend module
(function () {
    const video = document.getElementById('objectCamera');
    const canvas = document.getElementById('objectCanvas');
    const btn = document.getElementById('detectObjectBtn');
    const output = document.getElementById('objectOutput');

    if (!video || !canvas || !btn || !output) return;

    const ctx = canvas.getContext('2d');
    let isDetecting = false;

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' }, 
                audio: false 
            });
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            };
        } catch (err) {
            output.innerHTML = '<p style="color: red;">❌ Camera access denied</p>';
        }
    }

    function captureFrame() {
        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    async function detect() {
        if (isDetecting) {
            output.innerHTML = '<p>⏳ Detection in progress...</p>';
            return;
        }

        isDetecting = true;
        btn.disabled = true;
        output.innerHTML = '<p>🔄 Detecting objects...</p>';

        try {
            const dataUrl = captureFrame();

            const resp = await fetch('/api/object/detect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl })
            });

            if (!resp.ok) {
                const errorText = await resp.text();
                output.innerHTML = `<p style="color: red;">❌ Server error: ${resp.status}</p><p style="font-size: 12px;">${errorText}</p>`;
                return;
            }

            const result = await resp.json();

            if (!result.success) {
                output.innerHTML = `<p>⚠️ ${result.message || 'No objects detected'}</p>`;
                // Still draw the frame even if no objects detected
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                return;
            }

            // Clear and redraw
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            if (!result.detections || result.detections.length === 0) {
                output.innerHTML = '<p>👀 No objects detected</p>';
                return;
            }

            // Display detections and draw boxes
            output.innerHTML = `<p><strong>✅ Detected ${result.detections.length} object(s):</strong></p>`;
            result.detections.forEach((d, i) => {
                const p = document.createElement('p');
                p.innerText = `• ${d.label} (${Math.round(d.confidence * 100)}%)`;
                p.style.margin = '4px 0';
                output.appendChild(p);

                const [x, y, w, h] = d.box;
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, w, h);
                ctx.fillStyle = 'rgba(0,255,0,0.2)';
                ctx.fillRect(x, y, w, h);
                ctx.fillStyle = '#00FF00';
                ctx.font = 'bold 14px Arial';
                ctx.fillText(`${d.label} ${Math.round(d.confidence * 100)}%`, x + 4, y + 20);
            });

        } catch (err) {
            console.error('Detection error:', err);
            output.innerHTML = `<p style="color: red;">❌ Error: ${err.message}</p>`;
        } finally {
            isDetecting = false;
            btn.disabled = false;
        }
    }

    btn.addEventListener('click', detect);

    // Start camera when script loads
    startCamera();

})();
