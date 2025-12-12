const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let lastTime = 0;
let score = 0;
let isGameOver = false;
let isGameStarted = false;
let player, spawner, projectiles;
let stars = [];
let starTick = 0;
let AngryLeliGame; // Assigned later so resize can safely reference it

// Configuration
const GRAVITY = 200; // pixels per second squared
const SPAWN_RATE = 2000; // ms
const PLAYER_SPEED = 400; // pixels per second
const SPAWNER_SPEED = 150; // pixels per second
const STAR_DENSITY = 0.00004; // stars per pixel squared (scaled below)

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    generateStars();
    if (AngryLeliGame && AngryLeliGame.onResize) {
        AngryLeliGame.onResize();
    }
    // Reposition player if they are off screen
    if (player) {
        player.y = canvas.height - player.height - 10;
        if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;
    }
}
window.addEventListener('resize', resize);
resize();

// Assets (Emojis as fallback)
const ASSETS = {
    player: '🚽',
    enemy: '🧎‍♀️', // Kneeling person
    projectile: '💩'
};

// Background stars
function generateStars() {
    const area = canvas.width * canvas.height;
    const targetCount = Math.min(250, Math.max(60, Math.floor(area * STAR_DENSITY)));
    stars = [];
    for (let i = 0; i < targetCount; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: 0.6 + Math.random() * 1.6,
            baseAlpha: 0.25 + Math.random() * 0.45,
            twinkleSpeed: 0.8 + Math.random() * 1.6,
            twinkleOffset: Math.random() * Math.PI * 2
        });
    }
}

// Input
const keys = {
    ArrowLeft: false,
    ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

// Touch Controls
window.addEventListener('touchstart', (e) => {
    // e.preventDefault(); // Prevent scrolling/zooming default behavior if needed
    const touchX = e.touches[0].clientX;
    const halfWidth = window.innerWidth / 2;

    if (touchX < halfWidth) {
        keys.ArrowLeft = true;
        keys.ArrowRight = false;
    } else {
        keys.ArrowRight = true;
        keys.ArrowLeft = false;
    }
}, { passive: false });

window.addEventListener('touchend', (e) => {
    // e.preventDefault();
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
});

// Entities
class Player {
    constructor() {
        this.width = 60;
        this.height = 60;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 10;
    }

    update(dt) {
        if (keys.ArrowLeft) {
            this.x -= PLAYER_SPEED * dt;
        }
        if (keys.ArrowRight) {
            this.x += PLAYER_SPEED * dt;
        }

        // Bounds checking
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
    }

    draw(ctx) {
        ctx.font = `${this.height}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f3ff';
        ctx.fillText(ASSETS.player, this.x + this.width / 2, this.y + this.height);
        ctx.shadowBlur = 0;
    }
}

class Spawner {
    constructor() {
        this.width = 60;
        this.height = 60;
        this.x = canvas.width / 2;
        this.y = 50;
        this.direction = 1;
        this.timer = 0;

        // Load spawner image
        this.image = new Image();
        this.imageLoaded = false;
        this.image.onload = () => {
            this.imageLoaded = true;
        };
        this.image.src = 'assets/spawner.png';
    }

    update(dt) {
        this.x += SPAWNER_SPEED * this.direction * dt;

        // Bounce off walls
        if (this.x < 50 || this.x > canvas.width - 50) {
            this.direction *= -1;
        }

        // Spawn logic
        this.timer += dt * 1000;
        if (this.timer > SPAWN_RATE) {
            this.timer = 0;
            spawnProjectile(this.x, this.y + 30);
        }
    }

    draw(ctx) {
        if (this.imageLoaded) {
            ctx.save();
            ctx.translate(this.x, this.y);

            // Clip to circle
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            // Draw image
            ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();

            // Draw neon border
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff00ff';
            ctx.stroke();
            ctx.restore();
        } else {
            // Fallback emoji
            ctx.font = `${this.height}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff00ff';
            ctx.fillText(ASSETS.enemy, this.x, this.y);
            ctx.shadowBlur = 0;
        }
    }
}

class Projectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vy = 0;
        this.radius = 15;
        this.markedForDeletion = false;

        // Random speed boost settings
        this.speedBoostTimer = 0;
        this.nextBoostTime = 500 + Math.random() * 1000; // Random time between boosts
        this.isBoosting = false;
    }

    update(dt) {
        this.vy += GRAVITY * dt;

        // Random sudden speed boost
        this.speedBoostTimer += dt * 1000;
        if (this.speedBoostTimer > this.nextBoostTime && !this.isBoosting) {
            // Apply sudden speed boost!
            this.vy += 150 + Math.random() * 200; // Add 150-350 extra velocity
            this.isBoosting = true;
            this.speedBoostTimer = 0;
            this.nextBoostTime = 500 + Math.random() * 1000;
        }
        if (this.isBoosting && this.speedBoostTimer > 100) {
            this.isBoosting = false;
        }

        this.y += this.vy * dt;

        if (this.y > canvas.height) {
            this.markedForDeletion = true;
            triggerGameOver();
        }
    }

    draw(ctx) {
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Glow effect when boosting
        if (this.isBoosting) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff0000';
        }
        ctx.fillText(ASSETS.projectile, this.x, this.y);
        ctx.shadowBlur = 0;
    }
}

// Particle System
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * 6 - 3;
        this.color = color;
        this.life = 1.0;
    }
    update(dt) {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 2.0 * dt;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// Game Objects
player = new Player();
spawner = new Spawner();
projectiles = [];
let particles = [];

// Sound Manager using Web Audio API
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let audioUnlocked = false;
let audioReadyPromise = null;

// Check if we're on iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Initialize AudioContext (on iOS, it MUST be created in user gesture)
function initAudioContext() {
    if (audioCtx) return audioCtx;

    try {
        audioCtx = new AudioContext();
        console.log('AudioContext created, state:', audioCtx.state);
        audioUnlocked = audioCtx.state === 'running';
        audioCtx.onstatechange = () => {
            if (audioCtx.state === 'running') {
                audioUnlocked = true;
            }
        };
    } catch (e) {
        console.warn('AudioContext not available:', e);
    }
    return audioCtx;
}

// For non-iOS, create context immediately
if (!isIOS) {
    initAudioContext();
}

// Synchronous prime to keep within the user gesture
function forceUnlockAudio() {
    if (!audioCtx) {
        initAudioContext();
    }
    if (!audioCtx) return;

    try {
        const buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.value = 0.0001;
        source.connect(gain);
        gain.connect(audioCtx.destination);
        source.start(0);
        source.stop(audioCtx.currentTime + 0.01);
    } catch (e) {
        console.warn('forceUnlockAudio failed:', e);
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            if (audioCtx.state === 'running') {
                audioUnlocked = true;
            }
        }).catch((e) => console.warn('Resume failed:', e));
    } else if (audioCtx.state === 'running') {
        audioUnlocked = true;
    }
}

// Unlock/resume audio - call this on user interaction
function unlockAudio() {
    forceUnlockAudio();
    ensureAudioReady();
}

// Add unlock listeners for various user interactions
['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(event => {
    document.addEventListener(event, unlockAudio, { passive: false });
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        unlockAudio();
    }
});

async function ensureAudioReady() {
    forceUnlockAudio();
    if (audioUnlocked && audioCtx && audioCtx.state === 'running') return true;

    if (audioReadyPromise) return audioReadyPromise;

    audioReadyPromise = (async () => {
        if (!audioCtx) initAudioContext();
        if (!audioCtx) return false;

        if (audioCtx.state === 'suspended') {
            try {
                await audioCtx.resume();
            } catch (e) {
                console.warn('Resume failed:', e);
            }
        }

        try {
            // A one-sample buffer is the most reliable way to unlock iOS audio.
            const buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            const gain = audioCtx.createGain();
            gain.gain.value = 0.0001;
            source.connect(gain);
            gain.connect(audioCtx.destination);
            source.start(0);
            await new Promise(resolve => source.onended = resolve);
        } catch (e) {
            console.warn('Silent unlock failed:', e);
        }

        if (audioCtx.state === 'suspended') {
            try {
                await audioCtx.resume();
            } catch (e) {
                console.warn('Resume after silent unlock failed:', e);
            }
        }

        audioUnlocked = audioCtx.state === 'running';
        return audioUnlocked;
    })();

    audioReadyPromise.finally(() => {
        audioReadyPromise = null;
    });

    return audioReadyPromise;
}

function withAudioReady(callback) {
    ensureAudioReady().then(ready => {
        if (!ready) return;
        try {
            callback();
        } catch (e) {
            console.warn('Sound playback error:', e);
        }
    });
}

const SoundManager = {
    // Helper to check if audio is ready; attempts to unlock if suspended
    isReady: function () {
        return audioUnlocked && audioCtx && audioCtx.state === 'running';
    },

    playPoop: function () {
        withAudioReady(() => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            osc.frequency.value = 300;
            osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
            osc.type = 'sawtooth';

            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        });
    },

    playSplat: function () {
        withAudioReady(() => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.1);
            osc.type = 'triangle';

            gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        });
    },

    playFlap: function () {
        withAudioReady(() => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            // Quick rising chirp for flap
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.08);
            osc.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        });
    },

    playGameOver: function () {
        withAudioReady(() => {
            const now = audioCtx.currentTime;

            [
                { freq: 523.25, time: 0.0, dur: 0.1 },
                { freq: 392.00, time: 0.1, dur: 0.1 },
                { freq: 329.63, time: 0.2, dur: 0.1 },
                { freq: 220.00, time: 0.35, dur: 0.15 },
                { freq: 246.94, time: 0.5, dur: 0.15 },
                { freq: 220.00, time: 0.65, dur: 0.15 },
                { freq: 207.65, time: 0.8, dur: 0.15 },
                { freq: 196.00, time: 0.95, dur: 0.4 },
            ].forEach(note => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                osc.type = 'square';
                osc.frequency.value = note.freq;

                gainNode.gain.setValueAtTime(0.3, now + note.time);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + note.time + note.dur);

                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                osc.start(now + note.time);
                osc.stop(now + note.time + note.dur);
            });
        });
    }
};

function spawnProjectile(x, y) {
    projectiles.push(new Projectile(x, y));
    SoundManager.playPoop(); // Play sound on spawn
}

function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function checkCollisions() {
    projectiles.forEach(p => {
        if (
            p.y + 15 > player.y &&
            p.y - 15 < player.y + player.height &&
            p.x > player.x &&
            p.x < player.x + player.width
        ) {
            p.markedForDeletion = true;
            score++;
            spawnParticles(p.x, p.y, '#00ff00', 15);
            SoundManager.playSplat(); // Play sound on catch
            updateUI();
        }
    });
}

function updateUI() {
    document.getElementById('score').innerText = score;
}

function triggerGameOver() {
    isGameOver = true;
    SoundManager.playGameOver(); // Play retro game over tune
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over').classList.remove('hidden');
}

// Game Flow Control
async function startGame() {
    // Unlock AudioContext for Mobile (must be in user interaction)
    await ensureAudioReady();

    isGameStarted = true;
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('score-board').classList.remove('hidden');

    // Request Device Orientation Permission (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // This is where the actual permission request logic would go.
        // For example:
        // DeviceOrientationEvent.requestPermission()
        //   .then(response => {
        //     if (response === 'granted') {
        //       window.addEventListener('deviceorientation', handleTilt);
        //     } else {
        //       console.log('Device orientation permission not granted');
        //     }
        //   })
        //   .catch(console.error);
    }
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

async function resetGame() {
    await ensureAudioReady(); // Ensure audio stays unlocked on restart
    isGameOver = false;
    score = 0;
    updateUI();
    projectiles = [];
    particles = [];
    player = new Player();
    spawner = new Spawner();
    document.getElementById('game-over').classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function handleTilt(e) {
    const tilt = e.gamma; // Left/Right tilt in degrees (-90 to 90)

    // Deadzone of +/- 5 degrees
    if (tilt < -5) {
        keys.ArrowLeft = true;
        keys.ArrowRight = false;
    } else if (tilt > 5) {
        keys.ArrowRight = true;
        keys.ArrowLeft = false;
    } else {
        keys.ArrowLeft = false;
        keys.ArrowRight = false;
    }
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', resetGame);

// =====================================
// MENU NAVIGATION
// =====================================

let currentGame = null; // 'leli', 'flappy', or 'angry'
let orientationBlocked = false;
let pendingAngryStart = false;

function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
}

function needsLandscapeForAngry() {
    return isMobileDevice() && window.innerWidth < window.innerHeight;
}

function updateOrientationLock() {
    const overlay = document.getElementById('rotate-overlay');
    const shouldBlock = (currentGame === 'angry' || pendingAngryStart) && needsLandscapeForAngry();

    if (overlay) {
        overlay.classList.toggle('hidden', !shouldBlock);
    }
    orientationBlocked = shouldBlock;

    if (shouldBlock) {
        if (currentGame === 'angry') pendingAngryStart = true;
        if (AngryLeliGame && AngryLeliGame.stop) AngryLeliGame.stop();
        const board = document.getElementById('score-board');
        if (board) board.classList.add('hidden');
    }

    return shouldBlock;
}

function handleOrientationChange() {
    const wasBlocked = orientationBlocked;
    const blocked = updateOrientationLock();

    if (wasBlocked && !blocked && pendingAngryStart) {
        pendingAngryStart = false;
        startAngryGame();
    }
}
['resize', 'orientationchange'].forEach(event => {
    window.addEventListener(event, handleOrientationChange);
});

// Background Music
let bgMusic = null;

function initBackgroundMusic() {
    if (!bgMusic) {
        bgMusic = new Audio('assets/flintastek.mp3');
        bgMusic.loop = true;
        bgMusic.volume = 0.5;
    }
}

function playBackgroundMusic() {
    initBackgroundMusic();
    if (bgMusic.paused) {
        bgMusic.play().catch(e => {
            console.log('Background music autoplay blocked, will try on interaction');
        });
    }
}

function stopBackgroundMusic() {
    if (bgMusic && !bgMusic.paused) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
    }
}

// Try to play music on first interaction (for mobile)
function tryPlayMusicOnInteraction() {
    playBackgroundMusic();
}
['click', 'touchstart', 'keydown'].forEach(event => {
    document.addEventListener(event, function musicStarter() {
        // Only play if on main menu
        if (currentGame === null && !document.getElementById('main-menu').classList.contains('hidden')) {
            playBackgroundMusic();
        }
        document.removeEventListener(event, musicStarter);
    }, { once: true });
});

function showMainMenu() {
    // Stop any running game
    isGameStarted = false;
    isGameOver = false;
    pendingAngryStart = false;
    orientationBlocked = false;
    const rotateOverlay = document.getElementById('rotate-overlay');
    if (rotateOverlay) rotateOverlay.classList.add('hidden');
    if (typeof FlappyGame !== 'undefined') {
        FlappyGame.stop();
    }
    if (AngryLeliGame && AngryLeliGame.stop) {
        AngryLeliGame.stop();
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Hide all screens
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('flappy-welcome').classList.add('hidden');
    document.getElementById('flappy-game-over').classList.add('hidden');
    document.getElementById('angry-welcome').classList.add('hidden');
    document.getElementById('angry-game-over').classList.add('hidden');
    document.getElementById('score-board').classList.add('hidden');

    currentGame = null;

    // Play background music on main menu
    playBackgroundMusic();
}

function showLeliWelcome() {
    stopBackgroundMusic();
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('welcome-screen').classList.remove('hidden');
    currentGame = 'leli';
}

function showFlappyWelcome() {
    stopBackgroundMusic();
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('flappy-welcome').classList.remove('hidden');
    currentGame = 'flappy';
}

function showAngryWelcome() {
    stopBackgroundMusic();
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('angry-welcome').classList.remove('hidden');
    currentGame = 'angry';
}

function startFlappyGame() {
    document.getElementById('flappy-welcome').classList.add('hidden');
    document.getElementById('score-board').classList.remove('hidden');

    // Unlock audio
    unlockAudio();

    // Start the flappy game
    if (typeof FlappyGame !== 'undefined') {
        FlappyGame.start();
    }
}

function resetFlappyGame() {
    document.getElementById('flappy-game-over').classList.add('hidden');

    if (typeof FlappyGame !== 'undefined') {
        FlappyGame.start();
    }
}

function startAngryGame() {
    if (updateOrientationLock()) {
        pendingAngryStart = true;
        return;
    }
    pendingAngryStart = false;
    document.getElementById('angry-welcome').classList.add('hidden');
    document.getElementById('angry-game-over').classList.add('hidden');
    document.getElementById('score-board').classList.remove('hidden');
    stopBackgroundMusic();
    currentGame = 'angry';
    unlockAudio();

    if (AngryLeliGame) {
        AngryLeliGame.start();
    }
}

function resetAngryGame() {
    document.getElementById('angry-game-over').classList.add('hidden');
    document.getElementById('score-board').classList.remove('hidden');
    currentGame = 'angry';
    stopBackgroundMusic();

    if (AngryLeliGame) {
        AngryLeliGame.start();
    }
}

// Menu button handlers
document.getElementById('play-leli-btn').addEventListener('click', showLeliWelcome);
document.getElementById('play-flappy-btn').addEventListener('click', showFlappyWelcome);
document.getElementById('play-angry-btn').addEventListener('click', showAngryWelcome);

// Back to menu buttons
document.getElementById('back-to-menu-leli').addEventListener('click', showMainMenu);
document.getElementById('back-to-menu-flappy').addEventListener('click', showMainMenu);
document.getElementById('back-to-menu-angry').addEventListener('click', showMainMenu);
document.getElementById('menu-from-leli').addEventListener('click', showMainMenu);
document.getElementById('menu-from-flappy').addEventListener('click', showMainMenu);
document.getElementById('menu-from-angry').addEventListener('click', showMainMenu);

// Flappy game buttons
document.getElementById('start-flappy-btn').addEventListener('click', startFlappyGame);
document.getElementById('restart-flappy-btn').addEventListener('click', resetFlappyGame);

// Angry Leli buttons
document.getElementById('start-angry-btn').addEventListener('click', startAngryGame);
document.getElementById('restart-angry-btn').addEventListener('click', resetAngryGame);

// =====================================
// ANGRY LELI (Angry Birds-style mini-game)
// =====================================
AngryLeliGame = {
    canvas,
    ctx,
    isRunning: false,
    lastTime: 0,
    score: 0,
    birdsRemaining: 0,
    maxBirds: 5,
    birds: [],
    pigs: [],
    obstacles: [],
    currentLevel: 0,
    particles: [],
    currentBird: null,
    isDragging: false,
    slingAnchor: { x: 150, y: 0 },
    pull: { dist: 0, angle: -Math.PI / 4 },
    maxPull: 250,
    groundY: 0,
    birdRadius: 18,
    pigRadius: 16,
    nextBirdTimer: 0,
    images: {},
    imagesLoaded: false,

    init() {
        this.loadImages();
        this.onResize();
        this.setupControls();
    },

    loadImages() {
        const imagePaths = {
            bird: 'assets/leli-angry.png',
            pig: 'assets/pig-target-sprite.svg',
            slingshot: 'assets/slingshot-sprite.svg',
            background: 'assets/angry-leli-background.svg',
            particle: 'assets/explosion-particle.svg',
            platform: 'assets/wood-platform.svg'
        };

        let loadedCount = 0;
        const totalImages = Object.keys(imagePaths).length;

        Object.keys(imagePaths).forEach(key => {
            const img = new Image();
            img.src = imagePaths[key];
            img.onload = () => {
                this.images[key] = img;
                loadedCount++;
                if (loadedCount === totalImages) {
                    this.imagesLoaded = true;
                    console.log('All Angry Leli images loaded');
                }
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${imagePaths[key]}`);
                loadedCount++;
            };
        });
    },

    onResize() {
        this.groundY = canvas.height - 80;
        const slingTargetX = canvas.width * 0.20; // Further right for even more pull space on the left
        this.slingAnchor.x = Math.max(200, Math.min(380, slingTargetX));
        this.slingAnchor.y = this.groundY - 60;

        // Keep an unlaunched bird at the sling after resize
        if (this.currentBird && !this.currentBird.launched) {
            this.currentBird.x = this.slingAnchor.x;
            this.currentBird.y = this.slingAnchor.y;
        }
    },

    setupControls() {
        const pointerDown = (e) => {
            if (!this.isRunning || currentGame !== 'angry') return;
            const pos = this.getPointer(e);
            if (this.canGrab(pos.x, pos.y)) {
                this.isDragging = true;
                this.updateAim(pos.x, pos.y);
                e.preventDefault();
            }
        };

        const pointerMove = (e) => {
            if (!this.isRunning || currentGame !== 'angry' || !this.isDragging) return;
            const pos = this.getPointer(e);
            this.updateAim(pos.x, pos.y);
            e.preventDefault();
        };

        const pointerUp = (e) => {
            if (!this.isRunning || currentGame !== 'angry' || !this.isDragging) return;
            this.launchCurrentBird();
            e.preventDefault();
        };

        canvas.addEventListener('pointerdown', pointerDown, { passive: false });
        canvas.addEventListener('pointermove', pointerMove, { passive: false });
        canvas.addEventListener('pointerup', pointerUp, { passive: false });
        canvas.addEventListener('pointerleave', pointerUp, { passive: false });
    },

    getPointer(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        return { x, y };
    },

    canGrab(x, y) {
        if (!this.currentBird) return false;
        const dx = x - this.currentBird.x;
        const dy = y - this.currentBird.y;
        return Math.hypot(dx, dy) <= this.currentBird.r * 2;
    },

    updateAim(x, y) {
        if (!this.currentBird) return;
        const dx = x - this.slingAnchor.x;
        const dy = y - this.slingAnchor.y;
        const dist = Math.min(this.maxPull, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        this.pull = { dist, angle };

        this.currentBird.x = this.slingAnchor.x + Math.cos(angle) * dist;
        this.currentBird.y = this.slingAnchor.y + Math.sin(angle) * dist;
    },

    launchCurrentBird() {
        if (!this.currentBird) return;
        const { dist, angle } = this.pull;
        const minPull = 10;
        if (dist < minPull) {
            // Not enough pull, snap back
            this.resetCurrentBirdPosition();
            this.isDragging = false;
            return;
        }

        const speedScale = 5.0;
        // FIXED: Use the opposite angle to launch in the correct direction
        // When you pull down, the bird should launch up (and vice versa)
        this.currentBird.vx = -Math.cos(-angle) * dist * speedScale;
        this.currentBird.vy = -Math.sin(-angle) * dist * speedScale;
        this.currentBird.launched = true;
        this.currentBird.active = true;
        this.currentBird.restTime = 0;
        this.birds.push(this.currentBird);
        this.currentBird = null;
        this.isDragging = false;
        this.nextBirdTimer = 0.5;

        if (SoundManager && SoundManager.playPoop) {
            SoundManager.playPoop();
        }
    },

    resetCurrentBirdPosition() {
        if (!this.currentBird) return;
        this.currentBird.x = this.slingAnchor.x;
        this.currentBird.y = this.slingAnchor.y;
        this.pull = { dist: 0, angle: -Math.PI / 4 };
    },

    prepareNextBird() {
        if (this.birdsRemaining <= 0) return;
        this.currentBird = {
            x: this.slingAnchor.x,
            y: this.slingAnchor.y,
            vx: 0,
            vy: 0,
            r: this.birdRadius,
            launched: false,
            active: true,
            restTime: 0
        };
        this.pull = { dist: 0, angle: -Math.PI / 4 };
        this.birdsRemaining--;
    },

    buildLevel(levelIndex) {
        const g = this.groundY;
        const r = this.pigRadius;
        // Push targets right, but not as extreme
        const baseX = Math.max(200, Math.min(canvas.width - 200, Math.max(canvas.width * 0.60, this.slingAnchor.x + 340)));
        const platformH = 18;
        const tallH = 90;

        const layouts = [
            // Level 0: original simple cluster
            () => ({
                pigs: [
                    { x: baseX, y: g - r, r },
                    { x: baseX + 60, y: g - r, r },
                    { x: baseX + 30, y: g - r * 3, r },
                    { x: baseX + 100, y: g - r * 2, r }
                ],
                obstacles: []
            }),
            // Level 1: two pillars and a roof
            () => ({
                pigs: [
                    { x: baseX - 10, y: g - r, r },
                    { x: baseX + 70, y: g - r, r },
                    { x: baseX + 150, y: g - r, r },
                    { x: baseX + 40, y: g - tallH - r, r },
                    { x: baseX + 120, y: g - tallH - platformH - r * 1.3, r }
                ],
                obstacles: [
                    { x: baseX - 60, y: g - platformH, w: 220, h: platformH, health: 5 },
                    { x: baseX - 60, y: g - platformH - tallH, w: 24, h: tallH, health: 4 },
                    { x: baseX + 136, y: g - platformH - tallH, w: 24, h: tallH, health: 4 },
                    { x: baseX - 40, y: g - platformH - tallH - platformH, w: 240, h: platformH, health: 5 }
                ]
            }),
            // Level 2: stacked platforms with roof
            () => ({
                pigs: [
                    { x: baseX + 10, y: g - r, r },
                    { x: baseX + 80, y: g - r, r },
                    { x: baseX + 150, y: g - r, r },
                    { x: baseX + 70, y: g - 70 - r, r },
                    { x: baseX + 120, y: g - 70 - platformH - r * 1.5, r }
                ],
                obstacles: [
                    { x: baseX - 30, y: g - platformH, w: 240, h: platformH, health: 5 },
                    { x: baseX, y: g - platformH - 70, w: 20, h: 70, health: 4 },
                    { x: baseX + 190, y: g - platformH - 70, w: 20, h: 70, health: 4 },
                    { x: baseX - 10, y: g - platformH - 70, w: 240, h: 16, health: 4 },
                    { x: baseX + 60, y: g - platformH - 70 - 70, w: 120, h: 16, health: 3 }
                ]
            })
        ];

        const builder = layouts[levelIndex % layouts.length];
        const { pigs, obstacles } = builder();

        const normalizedPigs = pigs.map(p => ({ ...p, alive: true }));
        const normalizedObstacles = obstacles.map(o => ({
            ...o,
            alive: true,
            health: o.health || 3
        }));

        return { pigs: normalizedPigs, obstacles: normalizedObstacles };
    },

    loadLevel(levelIndex) {
        const layout = this.buildLevel(levelIndex);
        this.currentLevel = levelIndex;
        this.pigs = layout.pigs;
        this.obstacles = layout.obstacles;
        this.particles = [];
        this.birds = [];
        this.currentBird = null;
        this.isDragging = false;
        this.nextBirdTimer = 0;
        this.prepareNextBird();
    },

    advanceLevel() {
        // Reward a couple birds for clearing a wave
        this.birdsRemaining = Math.max(this.birdsRemaining + 2, 2);
        this.loadLevel(this.currentLevel + 1);
    },

    start() {
        this.reset();
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    },

    reset() {
        this.score = 0;
        this.birdsRemaining = this.maxBirds;
        this.loadLevel(0);
        document.getElementById('score').innerText = this.score;
    },

    stop() {
        this.isRunning = false;
    },

    loop(timestamp) {
        if (!this.isRunning || currentGame !== 'angry') return;
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        if (isNaN(dt) || dt > 0.05) dt = 0.016;

        this.update(dt);
        this.draw(dt);

        requestAnimationFrame((t) => this.loop(t));
    },

    update(dt) {
        this.updateBirds(dt);
        this.updateParticles(dt);
        this.cleanupObstacles();
        this.checkHits();
        this.handleNextBird(dt);
        this.checkGameOver();
    },

    updateBirds(dt) {
        for (const bird of this.birds) {
            this.integrateBird(bird, dt);
            this.handleObstacleCollisions(bird);
        }
        this.birds = this.birds.filter(b => b.active);
    },

    integrateBird(bird, dt) {
        if (!bird.launched) return;

        const gravity = 700;
        bird.vy += gravity * dt;
        bird.x += bird.vx * dt;
        bird.y += bird.vy * dt;

        // Wall bounce
        if (bird.x - bird.r < 0) {
            bird.x = bird.r;
            bird.vx *= -0.4;
        }
        if (bird.x + bird.r > canvas.width) {
            bird.x = canvas.width - bird.r;
            bird.vx *= -0.4;
        }

        // Ground bounce
        if (bird.y + bird.r > this.groundY) {
            bird.y = this.groundY - bird.r;
            if (Math.abs(bird.vy) > 40) {
                bird.vy *= -0.35;
            } else {
                bird.vy = 0;
            }
            bird.vx *= 0.93;
            if (Math.hypot(bird.vx, bird.vy) < 12) {
                bird.restTime += dt;
            } else {
                bird.restTime = 0;
            }
        }

        // Off-screen cleanup
        if (bird.y - bird.r > canvas.height * 1.2 || bird.x + bird.r < -200 || bird.x - bird.r > canvas.width + 200) {
            bird.active = false;
            return;
        }

        // Fall asleep when fully stopped
        if (Math.hypot(bird.vx, bird.vy) < 8 && bird.restTime > 0.8) {
            bird.active = false;
        }
    },

    handleObstacleCollisions(bird) {
        if (!bird.launched) return;
        for (const ob of this.obstacles) {
            if (!ob.alive) continue;

            const nearestX = Math.max(ob.x, Math.min(bird.x, ob.x + ob.w));
            const nearestY = Math.max(ob.y, Math.min(bird.y, ob.y + ob.h));
            const dx = bird.x - nearestX;
            const dy = bird.y - nearestY;
            const distSq = dx * dx + dy * dy;
            const r = bird.r;

            if (distSq < r * r) {
                const dist = Math.sqrt(distSq) || 0.001;
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = r - dist;

                // Push bird out of the obstacle
                bird.x += nx * overlap;
                bird.y += ny * overlap;

                // Reflect velocity with some dampening
                const dot = bird.vx * nx + bird.vy * ny;
                bird.vx = (bird.vx - 1.6 * dot * nx) * 0.82;
                bird.vy = (bird.vy - 1.6 * dot * ny) * 0.82;

                // Damage the obstacle based on impact
                ob.health -= Math.max(1, Math.abs(dot) * 0.02);
                if (ob.health <= 0) {
                    ob.alive = false;
                }

                // Wake the bird to prevent sleeping mid-block
                bird.active = true;
                bird.restTime = 0;
            }
        }
    },

    updateParticles(dt) {
        for (const p of this.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 50 * dt;
            p.life -= dt;
        }
        this.particles = this.particles.filter(p => p.life > 0);
    },

    cleanupObstacles() {
        this.obstacles = this.obstacles.filter(o => o.alive && o.health > 0);
    },

    checkHits() {
        for (const pig of this.pigs) {
            if (!pig.alive) continue;
            for (const bird of this.birds) {
                if (!bird.launched) continue;
                const dx = pig.x - bird.x;
                const dy = pig.y - bird.y;
                const dist = Math.hypot(dx, dy);
                if (dist < pig.r + bird.r) {
                    pig.alive = false;
                    this.score += 100;
                    document.getElementById('score').innerText = this.score;
                    this.spawnHitParticles(pig.x, pig.y);
                    bird.vx *= 0.7;
                    bird.vy *= 0.7;
                    if (SoundManager && SoundManager.playSplat) {
                        SoundManager.playSplat();
                    }
                    break;
                }
            }
        }
    },

    handleNextBird(dt) {
        if (this.currentBird || this.birdsRemaining <= 0) return;
        this.nextBirdTimer -= dt;
        if (this.nextBirdTimer <= 0) {
            this.prepareNextBird();
        }
    },

    checkGameOver() {
        const pigsAlive = this.pigs.some(p => p.alive);
        if (!pigsAlive) {
            this.advanceLevel();
            return;
        }

        const activeBirds = this.birds.some(b => b.active);
        const hasAmmo = this.birdsRemaining > 0 || !!this.currentBird;
        if (!activeBirds && !hasAmmo) {
            this.gameOver(false);
        }
    },

    gameOver(victory) {
        this.isRunning = false;
        const title = document.querySelector('#angry-game-over h1');
        if (title) {
            title.textContent = victory ? 'LEVEL CLEAR' : 'GAME OVER';
        }
        document.getElementById('angry-final-score').innerText = this.score;
        document.getElementById('score-board').classList.add('hidden');
        document.getElementById('angry-game-over').classList.remove('hidden');
    },

    spawnHitParticles(x, y) {
        for (let i = 0; i < 18; i++) {
            this.particles.push({
                x,
                y,
                vx: (Math.random() * 2 - 1) * 180,
                vy: (Math.random() * -1) * 120,
                life: 0.8 + Math.random() * 0.4,
                size: 2 + Math.random() * 3
            });
        }
    },

    draw(dt) {
        const ctx = this.ctx;

        // Draw new background using preloaded image
        if (this.imagesLoaded) {
            ctx.drawImage(this.images.background, 0, 0, canvas.width, canvas.height);
        } else {
            // Fallback if images not loaded yet
            ctx.fillStyle = '#0a0a15';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawStars(ctx, dt);
        }

        // Draw ground overlay
        drawTileFloor(ctx);

        this.drawSlingshot(ctx);
        this.drawObstacles(ctx);
        this.drawTargets(ctx);
        this.drawBirds(ctx);
        this.drawParticles(ctx);
        this.drawAmmo(ctx);
    },

    drawSlingshot(ctx) {
        if (!this.imagesLoaded) return;

        ctx.save();

        // Draw slingshot base using preloaded image
        ctx.drawImage(this.images.slingshot, this.slingAnchor.x - 100, this.groundY - 100, 200, 100);

        // Draw rubber bands when dragging
        if (this.isDragging && this.currentBird) {
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.slingAnchor.x - 10, this.slingAnchor.y);
            ctx.lineTo(this.currentBird.x, this.currentBird.y);
            ctx.lineTo(this.slingAnchor.x + 10, this.slingAnchor.y);
            ctx.stroke();
        }

        ctx.restore();
    },

    drawObstacles(ctx) {
        for (const ob of this.obstacles) {
            if (!ob.alive) continue;

            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#d4b07a';
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 4;
            if (this.images.platform && this.imagesLoaded) {
                ctx.drawImage(this.images.platform, ob.x, ob.y, ob.w, ob.h);
            } else {
                ctx.fillStyle = '#8b6a3d';
                ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
            }
            ctx.restore();
        }
    },

    drawTargets(ctx) {
        if (!this.imagesLoaded) return;

        for (const pig of this.pigs) {
            if (!pig.alive) continue;

            // Draw shadow first
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#7CFC00';
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;

            // Draw pig sprite using preloaded image
            ctx.drawImage(this.images.pig, pig.x - pig.r * 2, pig.y - pig.r * 2, pig.r * 4, pig.r * 4);

            ctx.restore();
        }
    },

    drawBirds(ctx) {
        const drawOne = (bird, isGhost) => {
            ctx.save();

            // Apply ghost effect if needed
            if (isGhost) {
                ctx.globalAlpha = 0.5;
            }

            const radius = bird.r * 1.2;
            const drawSize = radius * 2.4;

            ctx.translate(bird.x, bird.y);
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff69b4';
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;

            // Clip to circle mask
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            if (this.imagesLoaded && this.images.bird) {
                ctx.drawImage(this.images.bird, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
            } else {
                ctx.fillStyle = '#ffb6c1';
                ctx.fillRect(-drawSize / 2, -drawSize / 2, drawSize, drawSize);
            }

            // Border ring
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff69b4';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.restore();
        };

        this.birds.forEach(b => drawOne(b, false));

        if (this.currentBird) {
            drawOne(this.currentBird, !this.isDragging);
        }
    },

    drawParticles(ctx) {
        if (!this.imagesLoaded) return;

        ctx.save();

        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life);

            // Draw explosion particle using preloaded image
            const size = p.size * 2;
            ctx.drawImage(this.images.particle, p.x - size, p.y - size, size * 2, size * 2);
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    },

    drawAmmo(ctx) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        const x = canvas.width / 2;
        ctx.fillText(`Birds Left: ${this.birdsRemaining + (this.currentBird ? 1 : 0)}`, x, 30);
        ctx.fillText(`Wave: ${this.currentLevel + 1}`, x, 50);
        ctx.restore();
    }
};

AngryLeliGame.init();

// Background drawing for Leli Poop (bathroom tiles)
function drawBathroomBackground(ctx) {
    const tileSize = 40;
    const groutColor = '#1a1a2e';
    const tileColor = '#252545';

    // Fill with grout color first
    ctx.fillStyle = groutColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    ctx.fillStyle = tileColor;
    for (let y = 0; y < canvas.height; y += tileSize) {
        for (let x = 0; x < canvas.width; x += tileSize) {
            ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
    }

    // Add subtle shine effect on some tiles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let y = 0; y < canvas.height; y += tileSize * 2) {
        for (let x = 0; x < canvas.width; x += tileSize * 2) {
            ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
    }
}

// Draw tile floor at bottom of screen
function drawTileFloor(ctx) {
    const tileSize = 30;
    const floorHeight = tileSize; // Enforce a single row of tiles
    const floorY = canvas.height - floorHeight;
    const groutColor = '#2a2a3e';
    const tileColor = '#3a3a55';

    // Fill floor area with grout color
    ctx.fillStyle = groutColor;
    ctx.fillRect(0, floorY, canvas.width, floorHeight);

    // Draw a single row of tiles
    ctx.fillStyle = tileColor;
    for (let x = 0; x < canvas.width; x += tileSize) {
        ctx.fillRect(x + 1, floorY + 1, tileSize - 2, tileSize - 2);
    }

    // Add subtle shine on alternating tiles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = 0; x < canvas.width; x += tileSize * 2) {
        ctx.fillRect(x + 1, floorY + 1, tileSize - 2, tileSize - 2);
    }
}

// Draw twinkling stars behind the action
function drawStars(ctx, dt) {
    starTick += dt;
    ctx.save();
    for (const star of stars) {
        const alpha = star.baseAlpha + Math.sin(star.twinkleOffset + starTick * star.twinkleSpeed * Math.PI * 2) * 0.25;
        const clampedAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = `rgba(255,255,255,${clampedAlpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// Main Loop
function gameLoop(timestamp) {
    if (isGameOver || !isGameStarted) return;

    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (isNaN(dt)) dt = 0;

    // Clear canvas (simple dark background)
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Star field backdrop
    drawStars(ctx, dt);

    // Draw tile floor at bottom
    drawTileFloor(ctx);

    // Update
    player.update(dt);
    spawner.update(dt);
    projectiles.forEach(p => p.update(dt));
    projectiles = projectiles.filter(p => !p.markedForDeletion);

    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.life > 0);

    checkCollisions();

    // Draw
    player.draw(ctx);
    spawner.draw(ctx);
    projectiles.forEach(p => p.draw(ctx));
    particles.forEach(p => p.draw(ctx));

    requestAnimationFrame(gameLoop);
}
