const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let lastTime = 0;
let score = 0;
let isGameOver = false;
let isGameStarted = false;
let player, spawner, projectiles;

// Configuration
const GRAVITY = 200; // pixels per second squared
const SPAWN_RATE = 2000; // ms
const PLAYER_SPEED = 400; // pixels per second
const SPAWNER_SPEED = 150; // pixels per second

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

let currentGame = null; // 'leli' or 'flappy'

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
    if (typeof FlappyGame !== 'undefined') {
        FlappyGame.stop();
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Hide all screens
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('flappy-welcome').classList.add('hidden');
    document.getElementById('flappy-game-over').classList.add('hidden');
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

// Menu button handlers
document.getElementById('play-leli-btn').addEventListener('click', showLeliWelcome);
document.getElementById('play-flappy-btn').addEventListener('click', showFlappyWelcome);

// Back to menu buttons
document.getElementById('back-to-menu-leli').addEventListener('click', showMainMenu);
document.getElementById('back-to-menu-flappy').addEventListener('click', showMainMenu);
document.getElementById('menu-from-leli').addEventListener('click', showMainMenu);
document.getElementById('menu-from-flappy').addEventListener('click', showMainMenu);

// Flappy game buttons
document.getElementById('start-flappy-btn').addEventListener('click', startFlappyGame);
document.getElementById('restart-flappy-btn').addEventListener('click', resetFlappyGame);

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

// Main Loop
function gameLoop(timestamp) {
    if (isGameOver || !isGameStarted) return;

    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (isNaN(dt)) dt = 0;

    // Clear canvas (simple dark background)
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
