// BLINDGO - Enhanced Navigation and Location Module with Google Maps API
class NavigationModule {
    constructor() {
        this.isReady = false;
        this.currentLocation = null;
        this.watchId = null;
        this.locationHistory = [];
        this.navigationActive = false;
        this.destination = null;
        this.currentRoute = null;
        this.apiEndpoint = '/api/location';
        this.googleMapsApiKey = 'AIzaSyD36_qmVZJNpLRrlBrHDNuamZzSau4oAzY';
        this.googleMapsLoaded = false;
        this.directionsService = null;
        this.directionsRenderer = null;
        this.settings = {
            updateInterval: 5000,
            accuracyThreshold: 10,
            maxHistorySize: 100,
            enableVoiceGuidance: false,
            guidanceLanguage: 'en',
            enableTurnByTurn: true,
            voiceGuidanceInterval: 3000
        };
    }

    async init() {
        try {
            if (!navigator.geolocation) throw new Error('Geolocation not supported in this browser');
            await this.loadGoogleMapsAPI();
            await this.requestLocationPermission();
            this.isReady = true;
            return true;
        } catch (error) {
            throw error;
        }
    }

    async loadGoogleMapsAPI() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.maps) {
                this.googleMapsLoaded = true;
                this.initializeGoogleMapsServices();
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.googleMapsApiKey}&libraries=places&callback=initGoogleMaps`;
            script.async = true;
            script.defer = true;
            window.initGoogleMaps = () => {
                this.googleMapsLoaded = true;
                this.initializeGoogleMapsServices();
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load Google Maps API'));
            };
            document.head.appendChild(script);
        });
    }

    initializeGoogleMapsServices() {
        if (window.google && window.google.maps) {
            this.directionsService = new google.maps.DirectionsService();
            this.directionsRenderer = new google.maps.DirectionsRenderer();
        }
    }

    async navigateToDestination(destination, travelMode = 'driving') {
        try {
            if (!this.currentLocation) throw new Error('Current location not available');
            if (!this.googleMapsLoaded) throw new Error('Google Maps API not loaded');
            const geocodedDestination = await this.geocodeAddress(destination);
            if (!geocodedDestination) throw new Error(`Could not find location: ${destination}`);
            const directions = await this.getDirectionsTo(geocodedDestination, travelMode);
            if (!directions.success) throw new Error(directions.message);
            this.currentRoute = directions;
            this.destination = geocodedDestination;
            this.startTurnByTurnNavigation();
            return {
                success: true,
                destination: destination,
                distance: directions.distance,
                duration: directions.duration,
                message: `Route found to ${destination}. ${Math.round(directions.distance / 1000)} kilometers, ${Math.round(directions.duration / 60)} minutes.`
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    async geocodeAddress(address) {
        try {
            const geocoder = new google.maps.Geocoder();
            return new Promise((resolve, reject) => {
                geocoder.geocode({ address: address }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const location = results[0].geometry.location;
                        resolve({
                            address: address,
                            latitude: location.lat(),
                            longitude: location.lng(),
                            formattedAddress: results[0].formatted_address
                        });
                    } else {
                        reject(new Error(`Geocoding failed: ${status}`));
                    }
                });
            });
        } catch (error) {
            return null;
        }
    }

    async getDirectionsTo(destination, travelMode = 'driving') {
        try {
            if (!this.directionsService) throw new Error('Directions service not available');
            const request = {
                origin: {
                    lat: this.currentLocation.coords.latitude,
                    lng: this.currentLocation.coords.longitude
                },
                destination: {
                    lat: destination.latitude,
                    lng: destination.longitude
                },
                travelMode: google.maps.TravelMode[travelMode.toUpperCase()],
                provideRouteAlternatives: false
            };
            return new Promise((resolve, reject) => {
                this.directionsService.route(request, (result, status) => {
                    if (status === 'OK') {
                        const route = result.routes[0];
                        const leg = route.legs[0];
                        const directions = {
                            success: true,
                            distance: leg.distance.value,
                            duration: leg.duration.value,
                            steps: leg.steps.map(step => ({
                                instruction: step.instructions,
                                distance: step.distance.text,
                                duration: step.duration.text,
                                maneuver: step.maneuver || 'straight'
                            })),
                            polyline: route.overview_polyline.points
                        };
                        resolve(directions);
                    } else {
                        reject(new Error(`Directions failed: ${status}`));
                    }
                });
            });
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    startTurnByTurnNavigation() {
        if (!this.currentRoute || !this.settings.enableTurnByTurn) return;
        this.navigationActive = true;
        this.startLocationTracking();
        this.provideTurnByTurnGuidance();
        this.guidanceInterval = setInterval(() => {
            if (this.navigationActive) {
                this.provideTurnByTurnGuidance();
            }
        }, this.settings.voiceGuidanceInterval);
    }

    stopTurnByTurnNavigation() {
        this.navigationActive = false;
        this.currentRoute = null;
        this.destination = null;
        if (this.guidanceInterval) {
            clearInterval(this.guidanceInterval);
            this.guidanceInterval = null;
        }
    }

    provideTurnByTurnGuidance() {
        if (!this.currentRoute || !this.currentLocation) return;
        const currentStep = this.findCurrentNavigationStep();
        if (currentStep) {
            const guidance = this.generateTurnByTurnInstruction(currentStep);
            // Guidance generated but voice output disabled
            console.log('Navigation guidance:', guidance);
        }
    }

    findCurrentNavigationStep() {
        if (!this.currentRoute || !this.currentLocation) return null;
        return this.currentRoute.steps[0];
    }

    generateTurnByTurnInstruction(step) {
        if (!step) return null;
        const instruction = step.instruction;
        const distance = step.distance;
        const cleanInstruction = instruction.replace(/<[^>]*>/g, '');
        return `In ${distance}, ${cleanInstruction}`;
    }

    async findNearbyPlaces(query, radius = 5000) {
        try {
            if (!this.currentLocation || !this.googleMapsLoaded) throw new Error('Location or Google Maps not available');
            const placesService = new google.maps.places.PlacesService(document.createElement('div'));
            const request = {
                location: {
                    lat: this.currentLocation.coords.latitude,
                    lng: this.currentLocation.coords.longitude
                },
                radius: radius,
                query: query,
                type: this.getPlaceType(query)
            };
            return new Promise((resolve, reject) => {
                placesService.textSearch(request, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK) {
                        const places = results.map(place => ({
                            name: place.name,
                            address: place.formatted_address,
                            rating: place.rating,
                            types: place.types,
                            distance: this.calculateDistance(
                                this.currentLocation.coords.latitude,
                                this.currentLocation.coords.longitude,
                                place.geometry.location.lat(),
                                place.geometry.location.lng()
                            )
                        }));
                        places.sort((a, b) => a.distance - b.distance);
                        resolve(places);
                    } else {
                        reject(new Error(`Places search failed: ${status}`));
                    }
                });
            });
        } catch (error) {
            return [];
        }
    }

    getPlaceType(query) {
        const queryLower = query.toLowerCase();
        if (queryLower.includes('restaurant') || queryLower.includes('food')) {
            return 'restaurant';
        } else if (queryLower.includes('hospital') || queryLower.includes('medical')) {
            return 'hospital';
        } else if (queryLower.includes('bank') || queryLower.includes('atm')) {
            return 'bank';
        } else if (queryLower.includes('gas') || queryLower.includes('fuel')) {
            return 'gas_station';
        } else if (queryLower.includes('pharmacy') || queryLower.includes('drugstore')) {
            return 'pharmacy';
        }
        return undefined;
    }

    async requestLocationPermission() {
        try {
            const position = await this.getCurrentPosition();
            if (position) {
                this.currentLocation = position;
                this.addToHistory(position);
            }
        } catch (error) {
            throw error;
        }
    }

    getCurrentPosition(options = {}) {
        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        };
        const finalOptions = { ...defaultOptions, ...options };
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => reject(error),
                finalOptions
            );
        });
    }

    async getCurrentLocation() {
        try {
            const position = await this.getCurrentPosition();
            if (position) {
                this.currentLocation = position;
                this.addToHistory(position);
                await this.updateLocationOnServer(position);
                const address = await this.reverseGeocode(position.coords);
                // Show location on map
                this.showLocationOnMap(position.coords);
                return {
                    success: true,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp,
                    address: address,
                    message: `Location obtained: ${address}`
                };
            } else {
                throw new Error('Failed to get location');
            }
        } catch (error) {
            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    }

    showLocationOnMap(coords) {
        if (!this.googleMapsLoaded) {
            console.warn('Google Maps not loaded, cannot show location on map');
            return;
        }

        const mapContainer = document.getElementById('mapContainer');
        const mapElement = document.getElementById('map');

        if (!mapContainer || !mapElement) {
            console.warn('Map container not found in DOM');
            return;
        }

        // Show the map container
        mapContainer.style.display = 'block';

        // Initialize or update the map
        if (!this.map) {
            this.map = new google.maps.Map(mapElement, {
                center: { lat: coords.latitude, lng: coords.longitude },
                zoom: 15,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                styles: [
                    {
                        featureType: 'poi',
                        stylers: [{ visibility: 'off' }]
                    }
                ]
            });
        } else {
            this.map.setCenter({ lat: coords.latitude, lng: coords.longitude });
            this.map.setZoom(15);
        }

        // Clear existing markers
        if (this.currentLocationMarker) {
            this.currentLocationMarker.setMap(null);
        }

        // Add a marker for current location
        this.currentLocationMarker = new google.maps.Marker({
            position: { lat: coords.latitude, lng: coords.longitude },
            map: this.map,
            title: 'Your Location',
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
            }
        });

        // Add accuracy circle
        if (this.accuracyCircle) {
            this.accuracyCircle.setMap(null);
        }

        this.accuracyCircle = new google.maps.Circle({
            strokeColor: '#4285F4',
            strokeOpacity: 0.3,
            strokeWeight: 1,
            fillColor: '#4285F4',
            fillOpacity: 0.1,
            map: this.map,
            center: { lat: coords.latitude, lng: coords.longitude },
            radius: coords.accuracy || 10
        });

        // Scroll to map
        mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async updateLocationOnServer(position) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                })
            });
        } catch (error) {}
    }

    async reverseGeocode(coords) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.display_name) {
                return data.display_name;
            } else {
                return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
            }
        } catch (error) {
            return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
        }
    }

    startLocationTracking() {
        if (this.watchId) return false;
        try {
            this.watchId = navigator.geolocation.watchPosition(
                (position) => this.onLocationUpdate(position),
                (error) => this.onLocationError(error),
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 5000
                }
            );
            this.navigationActive = true;
            return true;
        } catch (error) {
            return false;
        }
    }

    stopLocationTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.navigationActive = false;
        }
    }

    onLocationUpdate(position) {
        if (this.hasLocationChanged(position)) {
            this.currentLocation = position;
            this.addToHistory(position);
            this.updateLocationOnServer(position);
        }
    }

    onLocationError(error) {
        let message = 'Location error occurred';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out';
                break;
        }
        console.error(message);
    }

    hasLocationChanged(newPosition) {
        if (!this.currentLocation) return true;
        const oldCoords = this.currentLocation.coords;
        const newCoords = newPosition.coords;
        const distance = this.calculateDistance(
            oldCoords.latitude, oldCoords.longitude,
            newCoords.latitude, newCoords.longitude
        );
        return distance > this.settings.accuracyThreshold;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    addToHistory(position) {
        this.locationHistory.push({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
        });
        if (this.locationHistory.length > this.settings.maxHistorySize) {
            this.locationHistory.shift();
        }
    }

    provideLocationGuidance(position) {
        if (!this.currentLocation || !this.destination) return;
        const coords = position.coords;
        const guidance = this.generateNavigationGuidance(coords);
        // Guidance generated but voice output disabled
        if (guidance) {
            console.log('Location guidance:', guidance);
        }
    }

    generateNavigationGuidance(coords) {
        if (this.locationHistory.length < 2) return null;
        const previous = this.locationHistory[this.locationHistory.length - 2];
        const current = coords;
        const deltaLat = current.latitude - previous.latitude;
        const deltaLon = current.longitude - previous.longitude;
        if (Math.abs(deltaLat) < 0.0001 && Math.abs(deltaLon) < 0.0001) {
            return 'You have stopped moving';
        }
        if (Math.abs(deltaLat) > Math.abs(deltaLon)) {
            if (deltaLat > 0) {
                return 'Moving north';
            } else {
                return 'Moving south';
            }
        } else {
            if (deltaLon > 0) {
                return 'Moving east';
            } else {
                return 'Moving west';
            }
        }
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    getSettings() {
        return { ...this.settings };
    }

    getLocationHistory() {
        return [...this.locationHistory];
    }

    clearLocationHistory() {
        this.locationHistory = [];
    }

    exportLocationHistory(format = 'json') {
        try {
            const data = {
                timestamp: new Date().toISOString(),
                locations: this.locationHistory,
                total: this.locationHistory.length
            };
            if (format === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json'
                });
                return URL.createObjectURL(blob);
            } else if (format === 'csv') {
                const csv = this.convertToCSV(data.locations);
                const blob = new Blob([csv], { type: 'text/csv' });
                return URL.createObjectURL(blob);
            }
        } catch (error) {
            return null;
        }
    }

    convertToCSV(locations) {
        const headers = ['Timestamp', 'Latitude', 'Longitude', 'Accuracy'];
        const rows = locations.map(loc => [
            new Date(loc.timestamp).toISOString(),
            loc.latitude,
            loc.longitude,
            loc.accuracy
        ]);
        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    getStatus() {
        return {
            isReady: this.isReady,
            navigationActive: this.navigationActive,
            currentLocation: this.currentLocation ? {
                latitude: this.currentLocation.coords.latitude,
                longitude: this.currentLocation.coords.longitude,
                accuracy: this.currentLocation.coords.accuracy
            } : null,
            locationHistorySize: this.locationHistory.length,
            settings: this.settings
        };
    }

    destroy() {
        this.stopLocationTracking();
        this.clearLocationHistory();
        this.isReady = false;
        this.currentLocation = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationModule;
}

