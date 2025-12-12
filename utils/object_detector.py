import cv2
import numpy as np
from ultralytics import YOLO


class ObjectDetector:
    """YOLOv8 based object detector.

    Uses YOLOv8-nano model for fast, accurate real-time object detection.
    Model is automatically downloaded on first use (~6 MB).
    """

    def __init__(self):
        self.model = None
        self.model_loaded = False
        self._load_model()

    def _load_model(self):
        """Load YOLOv8-nano model."""
        try:
            # YOLOv8-nano is smallest and fastest
            # Auto-downloads on first use to ~/.yolo/models/
            self.model = YOLO('yolov8n.pt')
            self.model_loaded = True
            print("✅ YOLOv8-nano model loaded successfully")
        except Exception as e:
            print(f"❌ Error loading YOLOv8 model: {e}")
            self.model_loaded = False

    def detect(self, image):
        """Detects objects in an image using YOLOv8.

        Args:
            image: OpenCV BGR image (numpy array)

        Returns:
            dict: { 'success': bool, 'detections': [ {label, confidence, box} ], 'message' }
        """
        try:
            if not self.model_loaded or self.model is None:
                return {'success': False, 'detections': [], 'message': 'Model not loaded'}

            h, w = image.shape[:2]

            # Run inference
            results = self.model(image, conf=0.5, verbose=False)

            detections = []

            # Parse results
            if results and len(results) > 0:
                for result in results:
                    boxes = result.boxes
                    if boxes is not None:
                        for box in boxes:
                            # Get confidence
                            confidence = float(box.conf[0])

                            # Get class name
                            cls_idx = int(box.cls[0])
                            label = self.model.names[cls_idx]

                            # Get bounding box coordinates
                            x1, y1, x2, y2 = map(int, box.xyxy[0])
                            box_w = x2 - x1
                            box_h = y2 - y1

                            if box_w > 0 and box_h > 0:
                                detections.append({
                                    'label': label,
                                    'confidence': round(confidence, 2),
                                    'box': [x1, y1, box_w, box_h]
                                })

            return {
                'success': True,
                'detections': detections,
                'message': f'Found {len(detections)} object(s) using YOLOv8'
            }

        except Exception as e:
            return {
                'success': False,
                'detections': [],
                'message': str(e)
            }
