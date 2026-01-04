# Google Maps API Setup for BLINDGO

## 🗺️ Getting Your Google Maps API Key

### Step 1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "BLINDGO-Navigation")
4. Click "Create"

### Step 2: Enable Required APIs
1. In your project, go to "APIs & Services" → "Library"
2. Search for and enable these APIs:
   - **Maps JavaScript API** - For interactive maps
   - **Places API** - For nearby places search
   - **Geocoding API** - For address conversion
   - **Directions API** - For navigation routes

### Step 3: Create API Key
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy your new API key

### Step 4: Restrict API Key (Recommended)
1. Click on your API key to edit it
2. Under "Application restrictions", select "HTTP referrers"
3. Add your domain (e.g., `localhost:5000/*` for development)
4. Under "API restrictions", select "Restrict key"
5. Select only the APIs you enabled in Step 2
6. Click "Save"

### Step 5: Update BLINDGO Configuration
Replace the existing API key in these files:

#### Option 1: Update JavaScript files
```javascript
// In static/js/navigation.js
this.googleMapsApiKey = 'YOUR_NEW_API_KEY_HERE';
```

#### Option 2: Update HTML files
```html
<!-- In test_navigation.html -->
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_NEW_API_KEY_HERE&libraries=places&callback=initGoogleMaps"></script>
```

## 🔑 Current API Key Status

**⚠️ IMPORTANT**: The current API key in the project is for demonstration purposes only and has usage limitations.

**For Production Use**: You must replace it with your own API key following the steps above.

## 💰 API Pricing (as of 2024)

- **Maps JavaScript API**: $7 per 1,000 map loads
- **Places API**: $17 per 1,000 requests
- **Geocoding API**: $5 per 1,000 requests
- **Directions API**: $5 per 1,000 requests

**Free Tier**: $200 monthly credit (approximately 28,500 map loads)

## 🚀 Testing Your Setup

1. Replace the API key in the files
2. Run your BLINDGO application
3. Test navigation features:
   - Say "Hello" to activate voice control
   - Say "Get location" to test geolocation
   - Say "Find nearby restaurants" to test places search
   - Say "Help me to go to [PLACE]" to test navigation

## 🛡️ Security Best Practices

1. **Never commit API keys to public repositories**
2. **Use environment variables in production**
3. **Restrict API keys to specific domains/IPs**
4. **Monitor API usage regularly**
5. **Set up billing alerts**

## 🔧 Environment Variable Setup (Production)

```bash
# Set environment variable
export GOOGLE_MAPS_API_KEY="your_api_key_here"

# Or add to .env file
echo "GOOGLE_MAPS_API_KEY=your_api_key_here" >> .env
```

Then update your code to read from environment:
```javascript
this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || 'fallback_key';
```

## 📞 Support

If you encounter issues:
1. Check Google Cloud Console for API quotas and errors
2. Verify all required APIs are enabled
3. Ensure your API key has proper restrictions
4. Check browser console for JavaScript errors

---

**Note**: The current API key in the project is for development/testing only. Replace it with your own key for production use.
