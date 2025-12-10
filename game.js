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
        // Add a slight futuristic glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f3ff';
        ctx.fillText(ASSETS.player, this.x + this.width / 2, this.y + this.height);
        ctx.shadowBlur = 0;
    }
}

class Spawner {
    constructor() {
        this.width = 50;
        this.height = 50;
        this.x = canvas.width / 2;
        this.y = 50;
        this.direction = 1;
        this.timer = 0;
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
        // Draw the emoji
        ctx.font = `${this.height}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff00ff';
        ctx.fillText(ASSETS.enemy, this.x, this.y);
        ctx.shadowBlur = 0;
    }
}

class Projectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vy = 0;
        this.radius = 15;
        this.markedForDeletion = false;
    }

    update(dt) {
        this.vy += GRAVITY * dt;
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
        ctx.fillText(ASSETS.projectile, this.x, this.y);
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
const audioCtx = new AudioContext();

const SoundManager = {
    playPoop: function () {
        if (audioCtx.state === 'suspended') audioCtx.resume();
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
    },

    playSplat: function () {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // Squishy sound: rapid frequency modulation
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        osc.type = 'triangle';

        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    },

    playGameOver: function () {
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;

        // Simple retro "Death" melody (approximate Mario-ish vibe)
        // Notes: C5 -> G4 -> E4 -> A3 -> B3 -> A3 -> G3# -> A3# -> G3# -> G3 (Just a descending crash)
        // Let's do a quick descending arpeggio

        [
            { freq: 523.25, time: 0.0, dur: 0.1 }, // C5
            { freq: 392.00, time: 0.1, dur: 0.1 }, // G4
            { freq: 329.63, time: 0.2, dur: 0.1 }, // E4

            { freq: 220.00, time: 0.35, dur: 0.15 }, // A3
            { freq: 246.94, time: 0.5, dur: 0.15 }, // B3
            { freq: 220.00, time: 0.65, dur: 0.15 }, // A3
            { freq: 207.65, time: 0.8, dur: 0.15 }, // Ab3
            { freq: 196.00, time: 0.95, dur: 0.4 }, // G3
        ].forEach(note => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            osc.type = 'square'; // retro 8-bit sound
            osc.frequency.value = note.freq;

            gainNode.gain.setValueAtTime(0.3, now + note.time);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + note.time + note.dur);

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.start(now + note.time);
            osc.stop(now + note.time + note.dur);
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
function startGame() {
    // Unlock AudioContext for Mobile (must be in user interaction)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log('AudioContext resumed successfully');
        });
    }

    isGameStarted = true;
    document.getElementById('welcome-screen').classList.add('hidden');

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

function resetGame() {
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

// Main Loop
function gameLoop(timestamp) {
    if (isGameOver || !isGameStarted) return;

    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (isNaN(dt)) dt = 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
