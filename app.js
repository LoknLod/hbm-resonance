// ====== STATE MANAGEMENT ======
const state = {
    currentScreen: 'home',
    sessionState: 'idle', // idle, running, paused
    breathPattern: { inhale: 4, exhale: 6, inhaleHold: 0, exhaleHold: 0 },
    currentWeek: 1,
    sessionTimer: 0,
    sessionDuration: 600, // 10 minutes default
    breathCount: 0,
    history: [],
    streak: 0,
    lastSessionDate: null,
    calibration: { rate: 6, complete: false },
    settings: { vibration: true, sound: false, darkMode: false }
};

// ====== DOM ELEMENTS ======
const screens = {
    home: document.getElementById('home-screen'),
    session: document.getElementById('session-screen'),
    protocol: document.getElementById('protocol-screen'),
    analytics: document.getElementById('analytics-screen'),
    settings: document.getElementById('settings-screen')
};

// ====== INITIALIZATION ======
function init() {
    loadState();
    setupNavigation();
    setupEventListeners();
    updateUI();
    setupServiceWorker();
    
    // Skip straight to home screen
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        const onboarding = document.getElementById('onboarding-screen');
        const homeScreen = document.getElementById('home-screen');
        
        if (splash) {
            splash.classList.remove('active');
            splash.style.display = 'none';
        }
        if (onboarding) {
            onboarding.classList.remove('active');
            onboarding.style.display = 'none';
        }
        if (homeScreen) {
            homeScreen.classList.add('active');
            homeScreen.style.display = 'block';
        }
        
        state.currentScreen = 'home';
    }, 100);
}

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.error('Service Worker registration failed:', err));
    }
}

// ====== STATE PERSISTENCE ======
function saveState() {
    localStorage.setItem('hbmState', JSON.stringify({
        history: state.history,
        streak: state.streak,
        lastSessionDate: state.lastSessionDate,
        calibration: state.calibration,
        settings: state.settings,
        currentWeek: state.currentWeek,
        breathPattern: state.breathPattern
    }));
}

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem('hbmState') || '{}');
        Object.assign(state, {
            history: saved.history || [],
            streak: saved.streak || 0,
            lastSessionDate: saved.lastSessionDate ? new Date(saved.lastSessionDate) : null,
            calibration: saved.calibration || { rate: 6, complete: false },
            settings: saved.settings || { vibration: true, sound: false, darkMode: false },
            currentWeek: saved.currentWeek || 1,
            breathPattern: saved.breathPattern || { inhale: 4, exhale: 6, inhaleHold: 0, exhaleHold: 0 }
        });
        updateStreak();
    } catch (e) {
        console.error('Error loading state:', e);
    }
}

// ====== NAVIGATION ======
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-screen');
            if (target) showScreen(target);
        });
    });
    
    // Onboarding navigation
    setupOnboarding();
}

function setupOnboarding() {
    const skipBtn = document.getElementById('skip-onboarding');
    const startBtn = document.getElementById('start-onboarding');
    const dots = document.querySelectorAll('.slide-dots .dot');
    const slides = document.querySelectorAll('.onboarding-slides .slide');
    let currentSlide = 0;
    
    function goToSlide(index) {
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));
        if (slides[index]) slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
        currentSlide = index;
    }
    
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            const onboarding = document.getElementById('onboarding-screen');
            const home = document.getElementById('home-screen');
            if (onboarding) onboarding.classList.remove('active');
            if (home) home.classList.add('active');
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const onboarding = document.getElementById('onboarding-screen');
            const home = document.getElementById('home-screen');
            if (onboarding) onboarding.classList.remove('active');
            if (home) home.classList.add('active');
        });
    }
    
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => goToSlide(index));
    });
    
    // Swipe support
    let touchStartX = 0;
    const onboardingSlides = document.querySelector('.onboarding-slides');
    if (onboardingSlides) {
        onboardingSlides.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });
        
        onboardingSlides.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0 && currentSlide < slides.length - 1) {
                    goToSlide(currentSlide + 1);
                } else if (diff < 0 && currentSlide > 0) {
                    goToSlide(currentSlide - 1);
                }
            }
        });
    }
}

function showScreen(screenName) {
    // Remove active from all screens
    Object.values(screens).forEach(screen => {
        if (screen) {
            screen.classList.remove('active');
            screen.style.display = 'none';
        }
    });
    
    // Activate the target screen
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
        screens[screenName].style.display = 'block';
        state.currentScreen = screenName;
    }
    
    updateUI();
}

// ====== BREATHING ENGINE ======
let animationFrame;
let sessionInterval;
let breathPhase = 'inhale';
let phaseTimer = 0;
let phaseStartTime = 0;

function startSession() {
    if (state.sessionState === 'running') return;
    
    state.sessionState = 'running';
    state.sessionTimer = 0;
    state.breathCount = 0;
    breathPhase = 'inhale';
    phaseTimer = 0;
    phaseStartTime = Date.now();
    
    // Start timer
    sessionInterval = setInterval(() => {
        state.sessionTimer++;
        updateTimerDisplay();
    }, 1000);
    
    // Start animation
    requestAnimationFrame(animateBreathing);
    updateUI();
}

function pauseSession() {
    if (state.sessionState === 'running') {
        state.sessionState = 'paused';
        clearInterval(sessionInterval);
        updateUI();
    } else if (state.sessionState === 'paused') {
        state.sessionState = 'running';
        phaseStartTime = Date.now();
        sessionInterval = setInterval(() => {
            state.sessionTimer++;
            updateTimerDisplay();
        }, 1000);
        requestAnimationFrame(animateBreathing);
        updateUI();
    }
}

function endSession() {
    state.sessionState = 'idle';
    clearInterval(sessionInterval);
    
    // Record session
    const sessionData = {
        date: new Date().toISOString(),
        duration: state.sessionTimer,
        breaths: state.breathCount,
        week: state.currentWeek
    };
    
    state.history.push(sessionData);
    updateStreak();
    saveState();
    showScreen('home');
}

function animateBreathing() {
    if (state.sessionState !== 'running') return;
    
    const now = Date.now();
    const elapsed = (now - phaseStartTime) / 1000; // seconds
    
    const { inhale, exhale, inhaleHold, exhaleHold } = state.breathPattern;
    const phaseDurations = {
        'inhale': inhale,
        'inhaleHold': inhaleHold,
        'exhale': exhale,
        'exhaleHold': exhaleHold
    };
    
    // Check if phase is complete
    if (elapsed >= phaseDurations[breathPhase]) {
        phaseStartTime = now;
        
        // Move to next phase
        switch (breathPhase) {
            case 'inhale':
                breathPhase = inhaleHold > 0 ? 'inhaleHold' : 'exhale';
                break;
            case 'inhaleHold':
                breathPhase = 'exhale';
                break;
            case 'exhale':
                breathPhase = exhaleHold > 0 ? 'exhaleHold' : 'inhale';
                break;
            case 'exhaleHold':
                breathPhase = 'inhale';
                state.breathCount++;
                break;
        }
        
        updatePhaseDisplay();
    }
    
    // Calculate scale based on phase
    const progress = elapsed / phaseDurations[breathPhase];
    let scale = 1;
    
    switch (breathPhase) {
        case 'inhale':
            scale = 1 + (progress * 0.5); // 1.0 -> 1.5
            break;
        case 'inhaleHold':
            scale = 1.5;
            break;
        case 'exhale':
            scale = 1.5 - (progress * 0.5); // 1.5 -> 1.0
            break;
        case 'exhaleHold':
            scale = 1;
            break;
    }
    
    // Apply animation
    const circle = document.getElementById('breathing-circle');
    if (circle) {
        circle.style.transform = `scale(${scale})`;
    }
    
    requestAnimationFrame(animateBreathing);
}

function updatePhaseDisplay() {
    const phaseLabel = document.getElementById('breath-phase');
    if (phaseLabel) {
        const labels = {
            'inhale': 'Breathe In',
            'inhaleHold': 'Hold',
            'exhale': 'Breathe Out',
            'exhaleHold': 'Hold'
        };
        phaseLabel.textContent = labels[breathPhase] || 'Breathe';
    }
}

// ====== 10-WEEK PROTOCOL ======
const protocol = {
    1: { inhale: 4, exhale: 6, inhaleHold: 0, exhaleHold: 0 },
    2: { inhale: 4, exhale: 6, inhaleHold: 1, exhaleHold: 0 },
    3: { inhale: 4, exhale: 6, inhaleHold: 2, exhaleHold: 1 },
    4: { inhale: 5, exhale: 7, inhaleHold: 2, exhaleHold: 1 },
    5: { inhale: 5, exhale: 7, inhaleHold: 3, exhaleHold: 2 },
    6: { inhale: 6, exhale: 8, inhaleHold: 3, exhaleHold: 2 },
    7: { inhale: 6, exhale: 8, inhaleHold: 4, exhaleHold: 3 },
    8: { inhale: 7, exhale: 9, inhaleHold: 4, exhaleHold: 3 },
    9: { inhale: 7, exhale: 9, inhaleHold: 5, exhaleHold: 4 },
    10: { inhale: 8, exhale: 10, inhaleHold: 5, exhaleHold: 4 }
};

function setWeek(week) {
    if (week >= 1 && week <= 10) {
        state.currentWeek = week;
        state.breathPattern = protocol[week];
        saveState();
        updateUI();
    }
}

function nextWeek() {
    setWeek(state.currentWeek + 1);
}

// ====== CALIBRATION ======
function startCalibration() {
    const originalPattern = {...state.breathPattern};
    state.breathPattern = { inhale: 3, exhale: 3, inhaleHold: 0, exhaleHold: 0 };
    startSession();
    
    setTimeout(() => {
        const breathsPerMinute = state.breathCount;
        endSession();
        
        state.calibration.rate = Math.min(7, Math.max(5, breathsPerMinute));
        state.calibration.complete = true;
        state.breathPattern = originalPattern;
        saveState();
        updateUI();
    }, 60000);
}

// ====== UI UPDATES ======
function updateUI() {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const target = btn.getAttribute('data-screen');
        btn.classList.toggle('active', target === state.currentScreen);
    });
    
    // Update streak display
    const streakCount = document.querySelector('.streak-count');
    if (streakCount) streakCount.textContent = state.streak;
    
    // Update week display
    const weekNumber = document.querySelector('.week-number');
    const weekFocus = document.querySelector('.week-focus');
    if (weekNumber) weekNumber.textContent = `Week ${state.currentWeek}`;
    
    const weekLabels = {
        1: 'Foundation', 2: 'Building', 3: 'Deepening', 4: 'Expanding',
        5: 'Refinement', 6: 'Integration', 7: 'Strength', 8: 'Mastery',
        9: 'Application', 10: 'Autonomy'
    };
    if (weekFocus) weekFocus.textContent = weekLabels[state.currentWeek] || 'Practice';
    
    // Update session controls
    const pauseBtn = document.getElementById('session-pause');
    if (pauseBtn) {
        const pauseIcon = pauseBtn.querySelector('.pause-icon');
        const playIcon = pauseBtn.querySelector('.play-icon');
        
        if (state.sessionState === 'paused') {
            if (pauseIcon) pauseIcon.style.display = 'none';
            if (playIcon) playIcon.style.display = 'block';
        } else {
            if (pauseIcon) pauseIcon.style.display = 'block';
            if (playIcon) playIcon.style.display = 'none';
        }
    }
    
    // Apply dark mode
    document.body.classList.toggle('dark-mode', state.settings.darkMode);
}

function updateTimerDisplay() {
    const elapsed = document.getElementById('session-elapsed');
    if (elapsed) {
        const minutes = Math.floor(state.sessionTimer / 60);
        const seconds = state.sessionTimer % 60;
        elapsed.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
}

function updateStreak() {
    const today = new Date().toDateString();
    const lastSessionDay = state.lastSessionDate ? new Date(state.lastSessionDate).toDateString() : null;
    
    if (lastSessionDay === today) return;
    
    if (state.lastSessionDate) {
        const oneDay = 24 * 60 * 60 * 1000;
        const lastDate = new Date(state.lastSessionDate);
        const daysSince = Math.round(Math.abs((new Date() - lastDate) / oneDay));
        
        if (daysSince === 1) {
            state.streak++;
        } else if (daysSince > 1) {
            state.streak = 1;
        }
    } else {
        state.streak = 1;
    }
    
    state.lastSessionDate = new Date().toISOString();
}

// ====== EVENT LISTENERS ======
function setupEventListeners() {
    // Home screen session buttons
    const quickBtn = document.getElementById('quick-session');
    const fullBtn = document.getElementById('full-session');
    const calibBtn = document.getElementById('calibration-session');
    
    if (quickBtn) {
        quickBtn.addEventListener('click', () => {
            state.sessionDuration = 5 * 60;
            showScreen('session');
            setTimeout(() => startSession(), 100);
        });
    }
    
    if (fullBtn) {
        fullBtn.addEventListener('click', () => {
            state.sessionDuration = 10 * 60;
            showScreen('session');
            setTimeout(() => startSession(), 100);
        });
    }
    
    if (calibBtn) {
        calibBtn.addEventListener('click', () => {
            showScreen('session');
            setTimeout(() => startCalibration(), 100);
        });
    }
    
    // Session controls
    const pauseBtn = document.getElementById('session-pause');
    const endBtn = document.getElementById('session-end');
    const backBtn = document.getElementById('session-back');
    
    if (pauseBtn) pauseBtn.addEventListener('click', pauseSession);
    if (endBtn) endBtn.addEventListener('click', endSession);
    if (backBtn) backBtn.addEventListener('click', () => showScreen('home'));
}

// ====== OURA HRV INTEGRATION ======
let ouraData = { data: [] };

async function loadOuraData() {
    try {
        const response = await fetch('./oura-data.json');
        ouraData = await response.json();
        updateHRVDisplay();
    } catch (err) {
        console.log('Oura data not available:', err);
    }
}

function updateHRVDisplay() {
    if (state.currentScreen !== 'analytics') return;
    
    const hrvContainer = document.getElementById('hrv-chart');
    if (!hrvContainer) return;
    
    const recentData = ouraData.data.slice(-14);
    
    let html = '<div class="hrv-section"><h3>HRV Trends (Last 14 Days)</h3><div class="hrv-grid">';
    
    recentData.forEach(day => {
        const date = new Date(day.day);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const readiness = day.score || 0;
        
        const hadSession = state.history.some(s => {
            const sessionDate = new Date(s.date);
            return sessionDate.toDateString() === date.toDateString();
        });
        
        html += `
            <div class="hrv-day ${hadSession ? 'has-session' : ''}">
                <div class="hrv-date">${dateStr}</div>
                <div class="hrv-bar" style="height: ${readiness}%">
                    <span class="hrv-value">${readiness}</span>
                </div>
                <div class="hrv-label">Readiness</div>
                ${hadSession ? '<div class="session-marker">🫁</div>' : ''}
            </div>
        `;
    });
    
    html += '</div></div>';
    hrvContainer.innerHTML = html;
}

// ====== START THE APP ======
document.addEventListener('DOMContentLoaded', () => {
    init();
    loadOuraData();
});
