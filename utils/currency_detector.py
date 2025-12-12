"""
Indian Rupee Currency Detection Module
Uses OCR to extract denomination numbers from INR notes
"""

import cv2
import numpy as np
from collections import Counter
import pytesseract
import re

class INRCurrencyDetector:
    def __init__(self):
        """Initialize INR Currency Detector with comprehensive note characteristics"""
        
        # Actual dimensions of INR notes (width x height in mm)
        self.note_dimensions = {
            10: (63, 123),
            20: (63, 129),
            50: (66, 135),
            100: (66, 142),
            200: (66, 146),
            500: (66, 150),
            2000: (66, 166)
        }
        
        # Calculate aspect ratios for matching
        self.note_aspect_ratios = {
            denom: width / height for denom, (width, height) in self.note_dimensions.items()
        }
        
        # INR Note Color Definitions (in HSV color space) - More flexible ranges
        self.color_ranges = {
            10: {
                'name': 'Chocolate Brown/Orange',
                'lower': np.array([5, 30, 30]),
                'upper': np.array([30, 255, 255])
            },
            20: {
                'name': 'Greenish Yellow',
                'lower': np.array([20, 30, 30]),
                'upper': np.array([50, 255, 255])
            },
            50: {
                'name': 'Fluorescent Blue',
                'lower': np.array([85, 30, 30]),
                'upper': np.array([135, 255, 255])
            },
            100: {
                'name': 'Lavender/Violet',
                'lower': np.array([125, 20, 30]),
                'upper': np.array([165, 255, 255])
            },
            200: {
                'name': 'Bright Yellow',
                'lower': np.array([15, 50, 50]),
                'upper': np.array([40, 255, 255])
            },
            500: {
                'name': 'Stone Grey',
                'lower': np.array([0, 0, 30]),
                'upper': np.array([180, 60, 220])
            },
            2000: {
                'name': 'Magenta/Pink',
                'lower': np.array([135, 30, 30]),
                'upper': np.array([175, 255, 255])
            }
        }
        
        # INR Note Sizes (width/height ratio for identification)
        self.aspect_ratios = {
            10: 1.95,   # 123mm / 63mm
            20: 2.05,   # 129mm / 63mm
            50: 2.05,   # 135mm / 66mm
            100: 2.15,  # 142mm / 66mm
            200: 2.21,  # 146mm / 66mm
            500: 2.27,  # 150mm / 66mm
            2000: 2.52  # 166mm / 66mm
        }
        
    def preprocess_image(self, image):
        """
        Preprocess the image for better detection
        """
        # Resize for consistent processing
        height, width = image.shape[:2]
        if width > 800:
            scale = 800 / width
            image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        
        # Enhance contrast
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        
        # Denoise
        denoised = cv2.fastNlMeansDenoisingColored(enhanced, None, 10, 10, 7, 21)
        
        return denoised
    
    def detect_note_region(self, image):
        """
        Detect the currency note region in the image
        Returns the largest rectangular contour
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        # Find the largest rectangular contour
        max_area = 0
        best_contour = None
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 1000:  # Too small
                continue
            
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            
            # Look for rectangular shape (4 corners)
            if len(approx) == 4 and area > max_area:
                max_area = area
                best_contour = approx
        
        return best_contour
    
    def extract_dominant_color(self, image, mask=None):
        """
        Extract the dominant color from the image
        """
        if mask is not None:
            image = cv2.bitwise_and(image, image, mask=mask)
        
        # Convert to HSV
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # Reshape to a list of pixels
        pixels = hsv.reshape(-1, 3)
        
        # Remove black/very dark pixels (likely background)
        pixels = pixels[pixels[:, 2] > 30]
        
        if len(pixels) == 0:
            return None
        
        # Get the most common hue value
        hues = pixels[:, 0]
        hist, bins = np.histogram(hues, bins=180, range=(0, 180))
        dominant_hue = np.argmax(hist)
        
        return dominant_hue
    
    def match_color_to_denomination(self, hsv_image):
        """
        Match the dominant color to a denomination
        Returns list of (denomination, confidence) tuples
        """
        matches = []
        
        for denomination, color_range in self.color_ranges.items():
            # Create mask for this color range
            mask = cv2.inRange(hsv_image, color_range['lower'], color_range['upper'])
            
            # Calculate percentage of image matching this color
            match_percentage = (np.sum(mask > 0) / mask.size) * 100
            
            if match_percentage > 2:  # At least 2% match (more flexible)
                matches.append((denomination, match_percentage))
        
        # Sort by match percentage
        matches.sort(key=lambda x: x[1], reverse=True)
        
        return matches
    
    def estimate_aspect_ratio(self, contour):
        """
        Estimate the aspect ratio of the detected note
        """
        if contour is None:
            return None
        
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(contour)
        
        if h == 0:
            return None
        
        aspect_ratio = w / h
        
        # Notes can be horizontal or vertical
        if aspect_ratio < 1:
            aspect_ratio = 1 / aspect_ratio
        
        return aspect_ratio
    
    def match_aspect_ratio(self, measured_ratio):
        """
        Match measured aspect ratio to denomination
        """
        if measured_ratio is None:
            return []
        
        matches = []
        
        for denomination, expected_ratio in self.aspect_ratios.items():
            # Allow 15% tolerance
            tolerance = expected_ratio * 0.15
            diff = abs(measured_ratio - expected_ratio)
            
            if diff <= tolerance:
                confidence = (1 - (diff / tolerance)) * 100
                matches.append((denomination, confidence))
        
        matches.sort(key=lambda x: x[1], reverse=True)
        return matches
    
    def detect_note_dimensions(self, image):
        """
        Detect actual note dimensions from image
        Returns: (width, height, aspect_ratio)
        """
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply edge detection
            edges = cv2.Canny(gray, 50, 150)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                # Get largest contour (should be the note)
                largest_contour = max(contours, key=cv2.contourArea)
                
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(largest_contour)
                
                # Calculate aspect ratio
                aspect_ratio = w / h if h > 0 else 0
                
                return w, h, aspect_ratio
            
            return None, None, None
            
        except Exception as e:
            print(f"Dimension detection error: {str(e)}")
            return None, None, None
    
    def match_by_size(self, detected_aspect_ratio):
        """
        Match denomination by note size/aspect ratio
        Returns: list of (denomination, confidence) tuples
        """
        if not detected_aspect_ratio or detected_aspect_ratio == 0:
            return []
        
        matches = []
        
        for denom, expected_ratio in self.note_aspect_ratios.items():
            # Calculate similarity (closer to 1.0 = better match)
            ratio_diff = abs(detected_aspect_ratio - expected_ratio)
            
            # Convert to confidence score (max 10% difference allowed)
            if ratio_diff < 0.1:
                confidence = (1 - (ratio_diff / 0.1)) * 100
                matches.append((denom, confidence))
        
        matches.sort(key=lambda x: x[1], reverse=True)
        return matches
    
    def detect_dominant_color_advanced(self, image):
        """
        Advanced color detection using clustering
        Returns: (denomination, confidence) based on dominant colors
        """
        try:
            # Resize for faster processing
            small = cv2.resize(image, (150, 150))
            
            # Convert to HSV
            hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
            
            # Flatten image
            pixels = hsv.reshape(-1, 3)
            
            # Remove very dark and very bright pixels (background/shadows)
            mask = (pixels[:, 2] > 30) & (pixels[:, 2] < 230)
            filtered_pixels = pixels[mask]
            
            if len(filtered_pixels) == 0:
                return None, 0
            
            # Get average hue
            avg_hue = np.mean(filtered_pixels[:, 0])
            avg_saturation = np.mean(filtered_pixels[:, 1])
            
            # Match to denomination colors with more precision
            best_match = None
            best_confidence = 0
            
            for denom, color_info in self.color_ranges.items():
                lower = color_info['lower']
                upper = color_info['upper']
                
                # Check if average color falls in range
                hue_in_range = lower[0] <= avg_hue <= upper[0]
                sat_in_range = lower[1] <= avg_saturation <= upper[1]
                
                if hue_in_range and sat_in_range:
                    # Calculate confidence based on how centered it is in the range
                    hue_center = (lower[0] + upper[0]) / 2
                    hue_distance = abs(avg_hue - hue_center) / ((upper[0] - lower[0]) / 2)
                    
                    confidence = max(0, (1 - hue_distance) * 100)
                    
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_match = denom
            
            return best_match, best_confidence
            
        except Exception as e:
            print(f"Advanced color detection error: {str(e)}")
            return None, 0
    
    def detect_edge_patterns(self, image):
        """
        Detect unique edge patterns (motifs) on notes
        Returns: (denomination, confidence)
        """
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect edges
            edges = cv2.Canny(gray, 50, 150)
            
            # Count edge density in different regions
            h, w = edges.shape
            
            # Divide into 3 regions (left, center, right)
            left = edges[:, :w//3]
            center = edges[:, w//3:2*w//3]
            right = edges[:, 2*w//3:]
            
            # Calculate edge density
            left_density = np.sum(left) / left.size
            center_density = np.sum(center) / center.size
            right_density = np.sum(right) / right.size
            
            # Create pattern signature
            pattern = (left_density, center_density, right_density)
            
            # Simple pattern matching (can be enhanced with actual reference patterns)
            # For now, return based on edge complexity
            total_edges = np.sum(edges)
            complexity = total_edges / edges.size
            
            # Higher denominations tend to have more complex patterns
            if complexity > 0.15:
                possible_denoms = [500, 2000, 200]
            elif complexity > 0.10:
                possible_denoms = [100, 200]
            else:
                possible_denoms = [10, 20, 50]
            
            # Return middle denomination with moderate confidence
            return possible_denoms[len(possible_denoms)//2], 40
            
        except Exception as e:
            print(f"Edge pattern detection error: {str(e)}")
            return None, 0
    
    def rotate_image(self, image, angle):
        """
        Rotate image by specified angle
        """
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(image, M, (w, h), 
                                 flags=cv2.INTER_CUBIC,
                                 borderMode=cv2.BORDER_REPLICATE)
        return rotated
    
    def try_ocr_with_rotation(self, image, valid_denominations):
        """
        Try OCR with multiple rotations (0°, 90°, 180°, 270°)
        Returns: (denomination, confidence, rotation_angle) or (None, 0, 0)
        """
        best_result = (None, 0, 0)
        
        # Try all 4 rotations
        for angle in [0, 90, 180, 270]:
            if angle == 0:
                rotated = image
            else:
                rotated = self.rotate_image(image, angle)
            
            # Preprocess for better OCR
            gray = cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY)
            
            # Try multiple preprocessing techniques
            preprocessing_methods = [
                gray,  # Original grayscale
                cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],  # Otsu threshold
                cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2),  # Adaptive
            ]
            
            detected_numbers = []
            
            for processed_img in preprocessing_methods:
                # Extract text using OCR
                text = pytesseract.image_to_string(processed_img, config='--psm 6')
                
                # Find all numbers in the text
                numbers = re.findall(r'\d+', text)
                
                for num_str in numbers:
                    try:
                        num = int(num_str)
                        # Check if it's a valid denomination
                        if num in valid_denominations:
                            detected_numbers.append(num)
                    except ValueError:
                        continue
            
            if detected_numbers:
                # Get most common detection
                most_common = Counter(detected_numbers).most_common(1)[0]
                denomination = most_common[0]
                frequency = most_common[1]
                
                # Confidence based on how many times it was detected
                confidence = min(95, 60 + (frequency * 15))
                
                # Keep track of best result
                if confidence > best_result[1]:
                    best_result = (denomination, confidence, angle)
                    
                # If we got high confidence, no need to try other rotations
                if confidence > 80:
                    break
        
        return best_result
    
    def extract_denomination_via_ocr(self, image):
        """
        Extract denomination number using OCR with automatic rotation detection
        Returns: (denomination, confidence) or (None, 0)
        """
        try:
            # Valid INR denominations
            valid_denominations = [10, 20, 50, 100, 200, 500, 2000]
            
            # Try OCR with all rotations
            denomination, confidence, rotation = self.try_ocr_with_rotation(image, valid_denominations)
            
            if denomination:
                if rotation != 0:
                    print(f"✓ Note detected at {rotation}° rotation: ₹{denomination}")
                return denomination, confidence
            
            return None, 0
            
        except Exception as e:
            print(f"OCR error: {str(e)}")
            return None, 0
    
    def detect(self, image):
        """
        Main detection method using multi-feature verification
        Returns: {
            'denomination': int,
            'confidence': float,
            'currency': 'INR',
            'color_name': str
        }
        """
        try:
            # Preprocess image
            processed = self.preprocess_image(image)
            
            # Method 1: OCR (Primary - most reliable for denomination)
            ocr_denomination, ocr_confidence = self.extract_denomination_via_ocr(processed)
            
            # Method 2: Size/Aspect Ratio (Secondary verification)
            width, height, aspect_ratio = self.detect_note_dimensions(processed)
            size_matches = self.match_by_size(aspect_ratio)
            
            # Method 3: Advanced Color Detection
            color_denom, color_conf = self.detect_dominant_color_advanced(processed)
            
            # Method 4: Basic color matching (fallback)
            hsv = cv2.cvtColor(processed, cv2.COLOR_BGR2HSV)
            color_matches = self.match_color_to_denomination(hsv)
            
            # Method 5: Edge pattern detection (when numbers are covered)
            edge_denom, edge_conf = self.detect_edge_patterns(processed)
            
            # Multi-feature scoring with cross-verification
            denomination_scores = {}
            verification_details = {}
            
            # OCR: Weight 60% (most accurate for reading numbers)
            if ocr_denomination:
                denomination_scores[ocr_denomination] = ocr_confidence * 0.6
                verification_details[ocr_denomination] = {'ocr': True, 'size': False, 'color': False}
            
            # Size matching: Weight 25% (physical characteristic)
            for denom, score in size_matches[:3]:
                if denom in denomination_scores:
                    denomination_scores[denom] += score * 0.25
                    verification_details[denom]['size'] = True
                else:
                    denomination_scores[denom] = score * 0.25
                    verification_details[denom] = {'ocr': False, 'size': True, 'color': False}
            
            # Color matching: Weight 15% (can fade over time)
            for denom, score in color_matches[:3]:
                if denom in denomination_scores:
                    denomination_scores[denom] += score * 0.15
                    verification_details[denom]['color'] = True
                else:
                    denomination_scores[denom] = score * 0.15
                    verification_details[denom] = {'ocr': False, 'size': False, 'color': True}
            
            if not denomination_scores:
                return {
                    'success': False,
                    'message': 'No currency note detected. Please ensure the note is fully visible in frame.'
                }
            
            # Get best match
            best_denomination = max(denomination_scores.items(), key=lambda x: x[1])
            denomination = best_denomination[0]
            confidence = best_denomination[1]
            
            # Check verification count (how many methods agreed)
            verification = verification_details.get(denomination, {'ocr': False, 'size': False, 'color': False})
            verification_count = sum(verification.values())
            
            # Apply verification bonus
            if verification_count >= 2:
                # Multiple methods agree - boost confidence
                confidence = min(95, confidence * 1.2)
                verification_status = f"{verification_count}/3 methods verified"
            else:
                verification_status = "Single method detection"
            
            # Stricter threshold with verification requirement
            if confidence < 30:
                return {
                    'success': False,
                    'message': 'Detection confidence too low. Please hold the note flat and ensure good lighting.'
                }
            
            # High confidence with cross-verification
            if ocr_denomination and verification_count >= 2:
                return {
                    'success': True,
                    'denomination': denomination,
                    'confidence': round(confidence, 2),
                    'currency': 'INR',
                    'symbol': '₹',
                    'color_name': self.color_ranges[denomination]['name'],
                    'method': f'Multi-feature ({verification_status})',
                    'verified': True,
                    'message': f'Detected ₹{denomination} note with {round(confidence, 2)}% confidence'
                }
            
            # Lower confidence or single method
            return {
                'success': True,
                'denomination': denomination,
                'confidence': round(confidence, 2),
                'currency': 'INR',
                'symbol': '₹',
                'color_name': self.color_ranges[denomination]['name'],
                'method': f'{verification_status}',
                'verified': False,
                'message': f'Detected ₹{denomination} note with {round(confidence, 2)}% confidence'
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Detection error: {str(e)}'
            }
