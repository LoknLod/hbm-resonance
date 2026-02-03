// ====== STATE MANAGEMENT ======
const state = {
    currentScreen: 'home',
    sessionState: 'idle', // idle, running, paused
    breathPattern: { inhale: 4, exhale: 6, inhaleHold: 0, exhaleHold: 0 },
    currentWeek: 1,
    sessionTimer: 0,
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

// DOM elements - using getter functions to handle dynamic elements
function getElements() {
    return {
        breathingCircle: document.getElementById('breathing-circle'),
        sessionElapsed: document.getElementById('session-elapsed'),
        sessionTarget: document.getElementById('session-target'),
        breathPhase: document.getElementById('breath-phase'),
        sessionPause: document.getElementById('session-pause'),
        sessionEnd: document.getElementById('session-end'),
        sessionBack: document.getElementById('session-back'),
        quickSession: document.getElementById('quick-session'),
        fullSession: document.getElementById('full-session'),
        calibrationSession: document.getElementById('calibration-session'),
        streakCount: document.querySelector('.streak-count'),
        weekNumber: document.querySelector('.week-number'),
        weekFocus: document.querySelector('.week-focus')
    };
}

// ====== INITIALIZATION ======
function init() {
    loadState();
    setupNavigation();
    setupEventListeners();
    updateUI();
    setupServiceWorker();
    
    // Skip straight to home screen (bypass splash and onboarding for now)
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
}

// ====== NAVIGATION ======
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showScreen(btn.dataset.target);
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
        slides[index].classList.add('active');
        dots[index].classList.add('active');
        currentSlide = index;
    }
    
    // Skip button
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            document.getElementById('onboarding-screen').classList.remove('active');
            document.getElementById('home-screen').classList.add('active');
        });
    }
    
    // Start button (on last slide)
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            document.getElementById('onboarding-screen').classList.remove('active');
            document.getElementById('home-screen').classList.add('active');
        });
    }
    
    // Dot navigation
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
            
            if (Math.abs(diff) > 50) { // Minimum swipe distance
                if (diff > 0 && currentSlide < slides.length - 1) {
                    // Swipe left - next slide
                    goToSlide(currentSlide + 1);
                } else if (diff < 0 && currentSlide > 0) {
                    // Swipe right - previous slide
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
let circleScale = 1;

function startSession() {
    if (state.sessionState === 'running') return;
    
    state.sessionState = 'running';
    state.sessionTimer = 0;
    state.breathCount = 0;
    breathPhase = 'inhale';
    phaseTimer = 0;
    
    // Start timers
    sessionInterval = setInterval(() => {
        state.sessionTimer++;
        updateTimerDisplay();
    }, 1000);
    
    // Start animation loop
    animateBreathing();
    updateUI();
}

function pauseSession() {
    state.sessionState = 'paused';
    clearInterval(sessionInterval);
    cancelAnimationFrame(animationFrame);
    updateUI();
}

function endSession() {
    state.sessionState = 'idle';
    clearInterval(sessionInterval);
    cancelAnimationFrame(animationFrame);
    
    // Record session
    const sessionData = {
        date: new Date(),
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
    const elapsed = now - (animationFrame || now);
    animationFrame = now;
    
    phaseTimer += elapsed / 1000; // Convert to seconds
    
    const { inhale, exhale, inhaleHold, exhaleHold } = state.breathPattern;
    const phaseDurations = {
        inhale: inhale,
        inhaleHold: inhaleHold,
        exhale: exhale,
        exhaleHold: exhaleHold
    };
    
    // Check for phase completion
    if (phaseTimer >= phaseDurations[breathPhase]) {
        phaseTimer = 0;
        switch (breathPhase) {
            case 'inhale': breathPhase = 'inhaleHold'; break;
            case 'inhaleHold': breathPhase = 'exhale'; break;
            case 'exhale': breathPhase = 'exhaleHold'; break;
            case 'exhaleHold': 
                breathPhase = 'inhale';
                state.breathCount++;
                elements.breathCounter.textContent = state.breathCount;
                break;
        }
    }
    
    // Calculate circle scale
    const progress = phaseTimer / phaseDurations[breathPhase];
    switch (breathPhase) {
        case 'inhale':
            circleScale = 1 + progress * 0.5; // Scale up during inhale
            break;
        case 'exhale':
            circleScale = 1.5 - progress * 0.5; // Scale down during exhale
            break;
        default:
            // Maintain scale during holds
            circleScale = breathPhase === 'inhaleHold' ? 1.5 : 1;
    }
    
    // Apply animation
    elements.breathingCircle.style.transform = `scale(${circleScale})`;
    
    // Continue animation loop
    requestAnimationFrame(animateBreathing);
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
    if (week < 1 || week > 10) return;
    state.currentWeek = week;
    state.breathPattern = {...protocol[week]};
    saveState();
    updateUI();
}

function nextWeek() {
    if (state.currentWeek < 10) {
        setWeek(state.currentWeek + 1);
    }
}

// ====== CALIBRATION ======
function startCalibration() {
    const originalPattern = {...state.breathPattern};
    state.breathPattern = { inhale: 3, exhale: 3, inhaleHold: 0, exhaleHold: 0 };
    startSession();
    
    // After 1 minute, calculate breathing rate
    setTimeout(() => {
        const breathsPerMinute = state.breathCount;
        endSession();
        
        // Set optimal rate (5-7 bpm)
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
        btn.classList.toggle('active', btn.dataset.screen === state.currentScreen);
    });
    
    const els = getElements();
    
    // Update displays with null checks
    if (els.streakCount) els.streakCount.textContent = state.streak;
    if (els.weekNumber) els.weekNumber.textContent = `Week ${state.currentWeek}`;
    
    // Update week focus labels
    const weekLabels = {
        1: 'Foundation', 2: 'Building', 3: 'Deepening', 4: 'Expanding',
        5: 'Refinement', 6: 'Integration', 7: 'Strength', 8: 'Mastery',
        9: 'Application', 10: 'Autonomy'
    };
    if (els.weekFocus) els.weekFocus.textContent = weekLabels[state.currentWeek] || 'Practice';
    
    // Apply dark mode
    document.body.classList.toggle('dark-mode', state.settings.darkMode);
}

function updateTimerDisplay() {
    const minutes = Math.floor(state.sessionTimer / 60);
    const seconds = state.sessionTimer % 60;
    elements.timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function updateStreak() {
    const today = new Date().toDateString();
    const lastSessionDay = state.lastSessionDate?.toDateString();
    
    if (lastSessionDay === today) return; // Already counted today
    
    if (state.lastSessionDate) {
        const oneDay = 24 * 60 * 60 * 1000;
        const daysSince = Math.round(Math.abs((new Date() - state.lastSessionDate) / oneDay));
        
        if (daysSince === 1) {
            state.streak++;
        } else if (daysSince > 1) {
            state.streak = 1; // Reset streak
        }
    } else {
        state.streak = 1;
    }
    
    state.lastSessionDate = new Date();
    saveState();
}

// ====== EVENT LISTENERS ======
function setupEventListeners() {
    // Session controls
    elements.startBtn.addEventListener('click', startSession);
    elements.pauseBtn.addEventListener('click', pauseSession);
    elements.endBtn.addEventListener('click', endSession);
    
    // Calibration
    document.getElementById('calibrate-btn').addEventListener('click', startCalibration);
    
    // Week navigation
    document.getElementById('prev-week').addEventListener('click', () => setWeek(state.currentWeek - 1));
    document.getElementById('next-week').addEventListener('click', nextWeek);
    
    // Settings changes
    elements.inhaleInput.addEventListener('change', (e) => {
        state.breathPattern.inhale = parseInt(e.target.value);
        saveState();
    });
    elements.exhaleInput.addEventListener('change', (e) => {
        state.breathPattern.exhale = parseInt(e.target.value);
        saveState();
    });
    elements.inhaleHoldInput.addEventListener('change', (e) => {
        state.breathPattern.inhaleHold = parseInt(e.target.value);
        saveState();
    });
    elements.exhaleHoldInput.addEventListener('change', (e) => {
        state.breathPattern.exhaleHold = parseInt(e.target.value);
        saveState();
    });
    
    // Settings toggles
    document.getElementById('vibration-toggle').addEventListener('change', (e) => {
        state.settings.vibration = e.target.checked;
        saveState();
    });
    document.getElementById('sound-toggle').addEventListener('change', (e) => {
        state.settings.sound = e.target.checked;
        saveState();
    });
    document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
        state.settings.darkMode = e.target.checked;
        saveState();
        updateUI();
    });
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
    
    // Get last 14 days of HRV data
    const recentData = ouraData.data.slice(-14);
    
    // Build HRV chart HTML
    let html = '<div class="hrv-section"><h3>HRV Trends (Last 14 Days)</h3><div class="hrv-grid">';
    
    recentData.forEach(day => {
        const date = new Date(day.day);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const readiness = day.score || 0;
        const hrv = day.contributors?.deep_sleep || 0;
        
        // Check if there was a breathing session that day
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
    
    html += '</div>';
    
    // Add correlation insight
    const sessionsWithHRV = correlateSessionsWithHRV();
    if (sessionsWithHRV.length > 3) {
        const avgWithSessions = sessionsWithHRV.reduce((sum, d) => sum + d.readiness, 0) / sessionsWithHRV.length;
        const daysWithoutSessions = recentData.filter(d => !sessionsWithHRV.some(s => s.day === d.day));
        const avgWithoutSessions = daysWithoutSessions.length > 0 
            ? daysWithoutSessions.reduce((sum, d) => sum + (d.score || 0), 0) / daysWithoutSessions.length 
            : 0;
        
        const improvement = avgWithSessions - avgWithoutSessions;
        
        html += `
            <div class="hrv-insight">
                <strong>Impact:</strong> 
                ${improvement > 0 
                    ? `Your readiness score is ${improvement.toFixed(0)}% higher on days you practice! 🚀` 
                    : 'Keep practicing - HRV improvements take time.'}
            </div>
        `;
    }
    
    html += '</div>';
    hrvContainer.innerHTML = html;
}

function correlateSessionsWithHRV() {
    return ouraData.data.map(day => {
        const hadSession = state.history.some(s => {
            const sessionDate = new Date(s.date);
            const ouraDate = new Date(day.day);
            return sessionDate.toDateString() === ouraDate.toDateString();
        });
        
        return hadSession ? {
            day: day.day,
            readiness: day.score || 0,
            hrv: day.contributors?.deep_sleep || 0
        } : null;
    }).filter(d => d !== null);
}

// ====== START THE APP ======
document.addEventListener('DOMContentLoaded', () => {
    init();
    loadOuraData();
    
    // Reload Oura data when showing analytics
    const originalShowScreen = showScreen;
    showScreen = function(screenName) {
        originalShowScreen(screenName);
        if (screenName === 'analytics') {
            updateHRVDisplay();
        }
    };
});
