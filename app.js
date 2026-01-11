// ===== DISC GOLF COURSES =====
const COURSES = {
    jaskowa: {
        name: "Jaśkowa Dolina",
        lat: 54.372664,
        lng: 18.590667,
        icon: "🌲",
        osmLink: "https://www.openstreetmap.org/#map=19/54.372664/18.590667"
    },
    reagana: {
        name: "Ronalda Reagana",
        lat: 54.408414,
        lng: 18.616033,
        icon: "🏞️",
        osmLink: "https://www.openstreetmap.org/#map=19/54.408414/18.616033"
    },
    zbocze: {
        name: "Na Zboczu",
        lat: 54.346376,
        lng: 18.608766,
        icon: "⛰️",
        osmLink: "https://www.openstreetmap.org/#map=19/54.346376/18.608766"
    }
};

// ===== TRANSPORT SPEEDS (km/h) =====
const TRANSPORT_SPEEDS = {
    walk: 5,
    bike: 15,
    car: 35,
    transit: 12
};

// ===== ROUTE FACTOR (multiply straight line distance) =====
const ROUTE_FACTOR = 1.3;

// ===== STATE =====
let state = {
    userLat: null,
    userLng: null,
    transportMode: 'car',
    prepTime: 5,
    sunAngle: 0,
    travelTimes: {
        jaskowa: null,
        reagana: null,
        zbocze: null
    }
};

// ===== MAP =====
let map;
let userMarker;
let courseMarkers = {};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initMap();
    initEventListeners();
    updateUI();
    startClock();
});

// ===== LOCAL STORAGE =====
function loadState() {
    const saved = localStorage.getItem('discGolfState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
        } catch (e) {
            console.error('Error loading state:', e);
        }
    }
}

function saveState() {
    localStorage.setItem('discGolfState', JSON.stringify(state));
}

// ===== MAP INITIALIZATION =====
function initMap() {
    // Center on Gdańsk
    const gdanskCenter = [54.372, 18.60];

    map = L.map('map').setView(gdanskCenter, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Add course markers
    Object.entries(COURSES).forEach(([key, course]) => {
        const marker = L.marker([course.lat, course.lng])
            .addTo(map)
            .bindPopup(`<strong>${course.icon} ${course.name}</strong><br><a href="${course.osmLink}" target="_blank">Otwórz w OSM</a>`);
        courseMarkers[key] = marker;
    });

    // Add user marker if position saved
    if (state.userLat && state.userLng) {
        setUserMarker(state.userLat, state.userLng);
    }

    // Click on map to set location
    map.on('click', (e) => {
        setUserLocation(e.latlng.lat, e.latlng.lng);
    });
}

function setUserMarker(lat, lng) {
    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        userMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'user-marker',
                html: '📍',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(map).bindPopup('Twoja lokalizacja');
    }
    map.setView([lat, lng], 13);
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    // Geolocation button
    document.getElementById('geolocate-btn').addEventListener('click', geolocate);

    // Transport buttons
    document.querySelectorAll('.transport-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.transportMode = btn.dataset.mode;
            saveState();
            updateEstimates();
            updateNavLinks();
            calculateResults();
        });
    });

    // Set active transport button from state
    document.querySelectorAll('.transport-btn').forEach(btn => {
        if (btn.dataset.mode === state.transportMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Sun preset buttons
    document.querySelectorAll('.preset-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const angle = parseInt(btn.dataset.angle);
            state.sunAngle = angle;
            document.getElementById('sun-angle').value = angle;
            saveState();
            calculateResults();
        });
        // Keyboard support
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });

    // Custom sun angle input
    const sunAngleInput = document.getElementById('sun-angle');
    const sunAngleSlider = document.getElementById('sun-angle-slider');

    sunAngleInput.addEventListener('input', (e) => {
        const angle = parseInt(e.target.value) || 0;
        state.sunAngle = angle;
        // Update slider (clamped to slider range)
        sunAngleSlider.value = Math.max(-12, Math.min(6, angle));
        // Update preset buttons
        document.querySelectorAll('.preset-option').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.angle) === angle);
        });
        saveState();
        calculateResults();
    });

    sunAngleSlider.addEventListener('input', (e) => {
        const angle = parseInt(e.target.value);
        state.sunAngle = angle;
        sunAngleInput.value = angle;
        // Update preset buttons
        document.querySelectorAll('.preset-option').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.angle) === angle);
        });
        saveState();
        calculateResults();
    });

    // Prep time input and slider
    const prepTimeInput = document.getElementById('prep-time');
    const prepTimeSlider = document.getElementById('prep-time-slider');

    prepTimeInput.addEventListener('input', (e) => {
        const time = parseInt(e.target.value) || 0;
        state.prepTime = time;
        // Update slider (clamped to slider range)
        prepTimeSlider.value = Math.max(0, Math.min(60, time));
        saveState();
        calculateResults();
    });

    prepTimeSlider.addEventListener('input', (e) => {
        const time = parseInt(e.target.value);
        state.prepTime = time;
        prepTimeInput.value = time;
        saveState();
        calculateResults();
    });

    // Travel time inputs
    Object.keys(COURSES).forEach(key => {
        document.getElementById(`travel-${key}`).addEventListener('input', (e) => {
            const val = e.target.value;
            state.travelTimes[key] = val ? parseInt(val) : null;
            saveState();
            calculateResults();
        });
    });
}

// ===== GEOLOCATION =====
function geolocate() {
    const btn = document.getElementById('geolocate-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Lokalizuję...';

    if (!navigator.geolocation) {
        alert('Twoja przeglądarka nie obsługuje geolokalizacji.');
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">📍</span> Zlokalizuj mnie';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            setUserLocation(pos.coords.latitude, pos.coords.longitude);
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">📍</span> Zlokalizuj mnie';
        },
        (err) => {
            alert('Nie udało się uzyskać lokalizacji: ' + err.message);
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">📍</span> Zlokalizuj mnie';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function setUserLocation(lat, lng) {
    state.userLat = lat;
    state.userLng = lng;
    saveState();
    setUserMarker(lat, lng);
    updateLocationInfo();
    updateEstimates();
    updateNavLinks();
    calculateResults();
}

function updateLocationInfo() {
    const info = document.getElementById('location-info');
    if (state.userLat && state.userLng) {
        info.textContent = `Lokalizacja: ${state.userLat.toFixed(5)}, ${state.userLng.toFixed(5)}`;
        info.classList.add('active');
    } else {
        info.textContent = 'Lokalizacja nie wybrana';
        info.classList.remove('active');
    }
}

// ===== DISTANCE & TRAVEL TIME =====
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function estimateTravelTime(courseKey) {
    if (!state.userLat || !state.userLng) return null;

    const course = COURSES[courseKey];
    const straightDistance = haversineDistance(state.userLat, state.userLng, course.lat, course.lng);
    const routeDistance = straightDistance * ROUTE_FACTOR;
    const speed = TRANSPORT_SPEEDS[state.transportMode];
    const timeHours = routeDistance / speed;
    const timeMinutes = Math.round(timeHours * 60);

    return timeMinutes;
}

function updateEstimates() {
    Object.keys(COURSES).forEach(key => {
        const estimate = estimateTravelTime(key);
        const estimateEl = document.getElementById(`estimate-${key}`);
        const input = document.getElementById(`travel-${key}`);

        if (estimate !== null) {
            estimateEl.textContent = `${estimate} min`;
            // Only update input if user hasn't set a custom value
            if (state.travelTimes[key] === null) {
                input.placeholder = estimate;
            }
        } else {
            estimateEl.textContent = '-- min';
            input.placeholder = '';
        }
    });
}

function getTravelTime(courseKey) {
    // User override takes priority
    if (state.travelTimes[courseKey] !== null) {
        return state.travelTimes[courseKey];
    }
    // Otherwise use estimate
    return estimateTravelTime(courseKey);
}

// ===== NAVIGATION LINKS =====
function updateNavLinks() {
    Object.keys(COURSES).forEach(key => {
        const course = COURSES[key];
        const link = document.getElementById(`nav-link-${key}`);

        if (state.userLat && state.userLng) {
            if (state.transportMode === 'transit') {
                // jakdojade.pl link
                link.href = `https://jakdojade.pl/gdansk/trasa/?fn=Moja%20lokalizacja&fc=${state.userLat}:${state.userLng}&tn=${encodeURIComponent(course.name)}&tc=${course.lat}:${course.lng}`;
                link.textContent = '🚌 Sprawdź w jakdojade';
            } else {
                // Google Maps directions
                const modeMap = { walk: 'walking', bike: 'bicycling', car: 'driving' };
                const mode = modeMap[state.transportMode] || 'driving';
                link.href = `https://www.google.com/maps/dir/?api=1&origin=${state.userLat},${state.userLng}&destination=${course.lat},${course.lng}&travelmode=${mode}`;
                link.textContent = '📍 Sprawdź trasę';
            }
        } else {
            link.href = course.osmLink;
            link.textContent = '📍 Zobacz na mapie';
        }
    });

    // Update navigate buttons in results
    Object.keys(COURSES).forEach(key => {
        const course = COURSES[key];
        const navBtn = document.getElementById(`navigate-${key}`);

        if (state.userLat && state.userLng) {
            // Use geo: URI for mobile navigation apps
            navBtn.href = `geo:${course.lat},${course.lng}?q=${course.lat},${course.lng}(${encodeURIComponent(course.name)})`;
        } else {
            navBtn.href = course.osmLink;
        }
    });
}

// ===== SUN CALCULATIONS =====
function getSunTimeForAngle(lat, lng, targetAngle, date = new Date()) {
    const times = SunCalc.getTimes(date, lat, lng);

    // For angle 0 (sunset)
    if (targetAngle === 0) {
        return times.sunset;
    }

    // For negative angles (after sunset)
    // SunCalc provides specific twilight times
    if (targetAngle === -6) {
        return times.dusk; // Civil twilight end
    }
    if (targetAngle === -12) {
        return times.nauticalDusk; // Nautical twilight end
    }
    if (targetAngle === -18) {
        return times.night; // Astronomical twilight end
    }

    // For custom angles, interpolate
    if (targetAngle < 0 && targetAngle > -6) {
        // Between sunset and civil dusk
        const sunsetTime = times.sunset.getTime();
        const duskTime = times.dusk.getTime();
        const ratio = targetAngle / -6;
        return new Date(sunsetTime + (duskTime - sunsetTime) * ratio);
    }
    if (targetAngle <= -6 && targetAngle > -12) {
        // Between civil and nautical dusk
        const duskTime = times.dusk.getTime();
        const nauticalTime = times.nauticalDusk.getTime();
        const ratio = (targetAngle + 6) / -6;
        return new Date(duskTime + (nauticalTime - duskTime) * ratio);
    }
    if (targetAngle <= -12 && targetAngle > -18) {
        // Between nautical and astronomical dusk
        const nauticalTime = times.nauticalDusk.getTime();
        const nightTime = times.night.getTime();
        const ratio = (targetAngle + 12) / -6;
        return new Date(nauticalTime + (nightTime - nauticalTime) * ratio);
    }

    // For positive angles (before sunset), use golden hour as reference
    if (targetAngle > 0) {
        const goldenHour = times.goldenHour.getTime();
        const sunsetTime = times.sunset.getTime();
        // Rough estimate: golden hour is ~6° above horizon
        const ratio = 1 - (targetAngle / 6);
        return new Date(goldenHour + (sunsetTime - goldenHour) * ratio);
    }

    return times.sunset;
}

// Get sunrise time for angle (morning) - for next day display
function getSunriseTimeForAngle(lat, lng, targetAngle, date = new Date()) {
    const times = SunCalc.getTimes(date, lat, lng);

    // For angle 0 (sunrise)
    if (targetAngle === 0) {
        return times.sunrise;
    }

    // For negative angles (before sunrise)
    if (targetAngle === -6) {
        return times.dawn; // Civil twilight start
    }
    if (targetAngle === -12) {
        return times.nauticalDawn; // Nautical twilight start
    }
    if (targetAngle === -18) {
        return times.nightEnd; // Astronomical twilight start
    }

    // For custom angles, interpolate
    if (targetAngle < 0 && targetAngle > -6) {
        // Between dawn and sunrise
        const dawnTime = times.dawn.getTime();
        const sunriseTime = times.sunrise.getTime();
        const ratio = 1 - (targetAngle / -6);
        return new Date(dawnTime + (sunriseTime - dawnTime) * ratio);
    }
    if (targetAngle <= -6 && targetAngle > -12) {
        // Between nautical dawn and civil dawn
        const nauticalTime = times.nauticalDawn.getTime();
        const dawnTime = times.dawn.getTime();
        const ratio = 1 - ((targetAngle + 6) / -6);
        return new Date(nauticalTime + (dawnTime - nauticalTime) * ratio);
    }
    if (targetAngle <= -12 && targetAngle > -18) {
        // Between night end and nautical dawn
        const nightEndTime = times.nightEnd.getTime();
        const nauticalTime = times.nauticalDawn.getTime();
        const ratio = 1 - ((targetAngle + 12) / -6);
        return new Date(nightEndTime + (nauticalTime - nightEndTime) * ratio);
    }

    // For positive angles (after sunrise)
    if (targetAngle > 0) {
        const sunriseTime = times.sunrise.getTime();
        const goldenHourEnd = times.goldenHourEnd.getTime();
        // Rough estimate: golden hour end is ~6° above horizon
        const ratio = targetAngle / 6;
        return new Date(sunriseTime + (goldenHourEnd - sunriseTime) * ratio);
    }

    return times.sunrise;
}

// ===== RESULTS CALCULATION =====
function calculateResults() {
    const now = new Date();
    const arrivalTimes = {};

    Object.keys(COURSES).forEach(key => {
        const course = COURSES[key];
        const travelTime = getTravelTime(key);

        // Get sun time for this course's location
        const sunTime = getSunTimeForAngle(course.lat, course.lng, state.sunAngle);

        // Update sun time display
        const sunTimeEl = document.getElementById(`sun-time-${key}`);
        sunTimeEl.textContent = formatTime(sunTime);

        // Update sun angle displays
        document.querySelectorAll('.sun-angle-display').forEach(el => {
            el.textContent = `${state.sunAngle}°`;
        });

        // Calculate arrival time
        const arrivalEl = document.getElementById(`arrival-${key}`);
        const playtimeEl = document.getElementById(`playtime-${key}`);
        const nextDayEl = document.getElementById(`nextday-${key}`);

        if (travelTime === null) {
            arrivalEl.textContent = '--:--';
            playtimeEl.innerHTML = 'Wybierz lokalizację';
            playtimeEl.classList.remove('late');
            if (nextDayEl) nextDayEl.style.display = 'none';
            arrivalTimes[key] = null;
            return;
        }

        const totalTravelMinutes = state.prepTime + travelTime;
        const arrivalTime = new Date(now.getTime() + totalTravelMinutes * 60 * 1000);
        arrivalEl.textContent = formatTime(arrivalTime);
        arrivalTimes[key] = arrivalTime;

        // Calculate playtime
        const playtimeMs = sunTime.getTime() - arrivalTime.getTime();
        const playtimeMinutes = Math.round(playtimeMs / 60000);

        if (playtimeMinutes > 0) {
            playtimeEl.innerHTML = formatDuration(playtimeMinutes);
            playtimeEl.classList.remove('late');
            // Show "czasu na grę" label
            playtimeEl.nextElementSibling.style.display = '';
            if (nextDayEl) nextDayEl.style.display = 'none';
        } else {
            playtimeEl.innerHTML = `Za późno!<br><small>o ${formatDuration(Math.abs(playtimeMinutes))}</small>`;
            playtimeEl.classList.add('late');
            // Hide "czasu na grę" label - doesn't make sense here
            playtimeEl.nextElementSibling.style.display = 'none';

            // Calculate tomorrow's sunrise time for the same angle
            if (nextDayEl) {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowSunrise = getSunriseTimeForAngle(course.lat, course.lng, state.sunAngle, tomorrow);

                // Calculate how long the play window is tomorrow (sunrise to sunset at given angle)
                const tomorrowSunset = getSunTimeForAngle(course.lat, course.lng, state.sunAngle, tomorrow);
                const tomorrowPlayMinutes = Math.round((tomorrowSunset.getTime() - tomorrowSunrise.getTime()) / 60000);

                nextDayEl.innerHTML = `🌅 Jutro od <strong>${formatTime(tomorrowSunrise)}</strong> (${formatDuration(tomorrowPlayMinutes)} gry)`;
                nextDayEl.style.display = 'block';
            }
        }
    });

    // Update weather for arrival times
    updateWeather(arrivalTimes);
}

// ===== FORMATTING =====
function formatTime(date) {
    if (!date || isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
        return `${hours} godz.`;
    }
    return `${hours}h ${mins}min`;
}

// ===== CLOCK =====
function startClock() {
    function updateClock() {
        const now = new Date();
        document.getElementById('current-time').textContent = formatTime(now);
        calculateResults();
    }

    updateClock();
    setInterval(updateClock, 30000); // Update every 30 seconds
}

// ===== WEATHER =====
let weatherCache = null;
let weatherCacheTime = null;
const WEATHER_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const WEATHER_CODES = {
    0: { icon: '☀️', desc: 'Słonecznie' },
    1: { icon: '🌤️', desc: 'Lekkie chmury' },
    2: { icon: '⛅', desc: 'Częściowe zachmurzenie' },
    3: { icon: '☁️', desc: 'Pochmurno' },
    45: { icon: '🌫️', desc: 'Mgła' },
    48: { icon: '🌫️', desc: 'Szron' },
    51: { icon: '🌧️', desc: 'Lekka mżawka' },
    53: { icon: '🌧️', desc: 'Mżawka' },
    55: { icon: '🌧️', desc: 'Gęsta mżawka' },
    61: { icon: '🌧️', desc: 'Lekki deszcz' },
    63: { icon: '🌧️', desc: 'Deszcz' },
    65: { icon: '🌧️', desc: 'Silny deszcz' },
    71: { icon: '🌨️', desc: 'Lekki śnieg' },
    73: { icon: '🌨️', desc: 'Śnieg' },
    75: { icon: '🌨️', desc: 'Intensywny śnieg' },
    80: { icon: '🌦️', desc: 'Przelotne opady' },
    81: { icon: '🌦️', desc: 'Przelotne opady' },
    82: { icon: '⛈️', desc: 'Silne opady' },
    95: { icon: '⛈️', desc: 'Burza' },
    96: { icon: '⛈️', desc: 'Burza z gradem' },
    99: { icon: '⛈️', desc: 'Silna burza z gradem' }
};

async function fetchWeather() {
    // Use Gdańsk center coordinates for weather (all courses are nearby)
    const lat = 54.372;
    const lng = 18.60;

    // Check cache
    if (weatherCache && weatherCacheTime && (Date.now() - weatherCacheTime < WEATHER_CACHE_DURATION)) {
        return weatherCache;
    }

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode,windspeed_10m,windgusts_10m,precipitation_probability,cloudcover&timezone=Europe%2FWarsaw&forecast_days=2`;
        const response = await fetch(url);
        const data = await response.json();

        weatherCache = data;
        weatherCacheTime = Date.now();
        return data;
    } catch (e) {
        console.error('Weather fetch error:', e);
        return null;
    }
}

function getWeatherForTime(weatherData, targetTime) {
    if (!weatherData || !weatherData.hourly) return null;

    // API returns times in format "2026-01-11T21:00" (local timezone Europe/Warsaw)
    // We need to match against target time in the same format
    const year = targetTime.getFullYear();
    const month = String(targetTime.getMonth() + 1).padStart(2, '0');
    const day = String(targetTime.getDate()).padStart(2, '0');
    const hour = String(targetTime.getHours()).padStart(2, '0');
    const targetHourStr = `${year}-${month}-${day}T${hour}:00`;

    let idx = weatherData.hourly.time.findIndex(t => t === targetHourStr);

    if (idx === -1) {
        // Find closest hour
        const targetTs = targetTime.getTime();
        let closestDiff = Infinity;
        weatherData.hourly.time.forEach((t, i) => {
            // Parse API time string as local time
            const apiTime = new Date(t.replace('T', ' ').replace(/-/g, '/'));
            const diff = Math.abs(apiTime.getTime() - targetTs);
            if (diff < closestDiff) {
                closestDiff = diff;
                idx = i;
            }
        });
    }

    // Convert km/h to m/s (divide by 3.6)
    const windMs = (weatherData.hourly.windspeed_10m[idx] / 3.6).toFixed(1);
    const gustMs = (weatherData.hourly.windgusts_10m[idx] / 3.6).toFixed(1);

    // Get the actual hour from API data for display
    const actualHour = weatherData.hourly.time[idx];

    return {
        temp: Math.round(weatherData.hourly.temperature_2m[idx]),
        code: weatherData.hourly.weathercode[idx],
        wind: windMs,
        gusts: gustMs,
        precipitation: weatherData.hourly.precipitation_probability[idx],
        clouds: weatherData.hourly.cloudcover[idx],
        forecastHour: actualHour // Store the actual forecast hour
    };
}

async function updateWeather(arrivalTimes) {
    const weatherData = await fetchWeather();
    const weatherContent = document.getElementById('weather-content');
    const weatherCard = document.getElementById('weather-section');

    if (!weatherData) {
        weatherContent.innerHTML = '<p class="weather-loading">Nie udało się pobrać pogody</p>';
        return;
    }

    // Use current time as baseline
    const now = new Date();
    let targetTime = now;

    // Get valid future arrival times only
    const validArrivals = Object.values(arrivalTimes).filter(t => t !== null && t > now);
    if (validArrivals.length > 0) {
        // Use the earliest future arrival time
        targetTime = validArrivals.reduce((earliest, t) => t < earliest ? t : earliest);
    }

    const weather = getWeatherForTime(weatherData, targetTime);
    if (!weather) {
        weatherContent.innerHTML = '<p class="weather-loading">Brak danych pogodowych</p>';
        return;
    }

    const weatherInfo = WEATHER_CODES[weather.code] || { icon: '❓', desc: 'Nieznana' };

    // Determine weather status and alerts
    let status = 'good';
    let alerts = [];

    // Check for bad conditions
    const badWeatherCodes = [63, 65, 73, 75, 82, 95, 96, 99]; // Heavy rain, snow, storms
    const warningWeatherCodes = [51, 53, 55, 61, 71, 80, 81]; // Light rain, snow, showers

    if (badWeatherCodes.includes(weather.code)) {
        status = 'bad';
        alerts.push({ type: 'danger', text: `⚠️ ${weatherInfo.desc} - rozważ przełożenie gry!` });
    } else if (warningWeatherCodes.includes(weather.code)) {
        status = 'warning';
        alerts.push({ type: 'warning', text: `⚡ ${weatherInfo.desc} - weź kurtkę!` });
    }

    // Check precipitation probability
    if (weather.precipitation >= 70) {
        status = 'bad';
        alerts.push({ type: 'danger', text: `🌧️ ${weather.precipitation}% szans na opady - będzie mokro!` });
    } else if (weather.precipitation >= 40) {
        if (status === 'good') status = 'warning';
        alerts.push({ type: 'warning', text: `🌧️ ${weather.precipitation}% szans na opady - weź kurtkę` });
    }

    // Check wind
    const windMs = parseFloat(weather.wind);
    const gustMs = parseFloat(weather.gusts);

    if (gustMs >= 15) {
        status = 'bad';
        alerts.push({ type: 'danger', text: `💨 Porywy ${weather.gusts} m/s - dyski będą latać!` });
    } else if (windMs >= 8 || gustMs >= 10) {
        if (status === 'good') status = 'warning';
        alerts.push({ type: 'warning', text: `💨 Silny wiatr - wybierz stabilne dyski` });
    }

    // Check temperature
    if (weather.temp <= 0) {
        if (status === 'good') status = 'warning';
        alerts.push({ type: 'warning', text: `🥶 Mróz! Ubierz się ciepło` });
    } else if (weather.temp >= 30) {
        if (status === 'good') status = 'warning';
        alerts.push({ type: 'warning', text: `🥵 Upał! Weź dużo wody` });
    }

    // Update card class
    weatherCard.classList.remove('weather-good', 'weather-warning', 'weather-bad');
    weatherCard.classList.add(`weather-${status}`);

    // Build HTML
    // Format the forecast hour (comes as "2026-01-11T21:00" format - local time)
    // Extract just the hour part
    const forecastTimeStr = weather.forecastHour.slice(11, 16); // "21:00"

    const alertsHtml = alerts.map(a =>
        `<div class="weather-alert alert-${a.type}">${a.text}</div>`
    ).join('');

    weatherContent.innerHTML = `
        <div class="weather-grid">
            <div class="weather-main-info">
                <span class="weather-main-icon">${weatherInfo.icon}</span>
                <span class="weather-main-temp">${weather.temp}°C</span>
                <span class="weather-main-desc">${weatherInfo.desc}</span>
            </div>
            <div class="weather-details-grid">
                <div class="weather-detail">
                    <span class="weather-detail-icon">💨</span>
                    <div>
                        <div class="weather-detail-value">${weather.wind} m/s</div>
                        <div class="weather-detail-label">wiatr</div>
                    </div>
                </div>
                <div class="weather-detail">
                    <span class="weather-detail-icon">🌬️</span>
                    <div>
                        <div class="weather-detail-value">${weather.gusts} m/s</div>
                        <div class="weather-detail-label">porywy</div>
                    </div>
                </div>
                <div class="weather-detail">
                    <span class="weather-detail-icon">🌧️</span>
                    <div>
                        <div class="weather-detail-value">${weather.precipitation}%</div>
                        <div class="weather-detail-label">szansa na opady</div>
                    </div>
                </div>
                <div class="weather-detail">
                    <span class="weather-detail-icon">☁️</span>
                    <div>
                        <div class="weather-detail-value">${weather.clouds}%</div>
                        <div class="weather-detail-label">zachmurzenie</div>
                    </div>
                </div>
            </div>
        </div>
        ${alertsHtml}
        <p class="weather-time-note">Prognoza na godz. ${forecastTimeStr}</p>
    `;
}

// ===== UI UPDATE =====
function updateUI() {
    // Set saved values to inputs and sliders
    document.getElementById('prep-time').value = state.prepTime;
    document.getElementById('prep-time-slider').value = Math.max(0, Math.min(60, state.prepTime));

    document.getElementById('sun-angle').value = state.sunAngle;
    document.getElementById('sun-angle-slider').value = Math.max(-12, Math.min(6, state.sunAngle));

    // Set active sun preset
    document.querySelectorAll('.preset-option').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.angle) === state.sunAngle);
    });

    // Set travel time inputs
    Object.keys(COURSES).forEach(key => {
        const input = document.getElementById(`travel-${key}`);
        if (state.travelTimes[key] !== null) {
            input.value = state.travelTimes[key];
        }
    });

    // Update location info
    updateLocationInfo();
    updateEstimates();
    updateNavLinks();
    calculateResults();
}

