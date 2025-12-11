// Kuh Kayi Flap - Flappy Bird Clone
// This file handles the Flappy Bird-style game mechanics

const FlappyGame = {
    canvas: null,
    ctx: null,
    isRunning: false,
    score: 0,
    lastTime: 0,

    // Game objects
    bird: null,
    pipes: [],
    clouds: [], // Animated clouds

    // Configuration
    GRAVITY: 800,
    FLAP_STRENGTH: -350,
    PIPE_SPEED: 200,
    PIPE_GAP: 150,
    PIPE_WIDTH: 60,
    PIPE_SPAWN_RATE: 2000,
    pipeTimer: 0,

    // Character images
    birdImage: null,
    birdImageLoaded: false,
    
    // Wing animation
    wingFlapTimer: 0,
    wingFlapSpeed: 8, // flaps per second
    showWingUp: true,

    init: function () {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Load character image (PNG fallback)
        this.birdImage = new Image();
        this.birdImage.onload = () => {
            this.birdImageLoaded = true;
        };
        this.birdImage.src = 'assets/kuhkayi.png';

        // Setup event listeners
        this.setupControls();

        // Initialize clouds
        this.initClouds();
    },

    initClouds: function () {
        this.clouds = [];
        for (let i = 0; i < 8; i++) {
            this.clouds.push({
                x: Math.random() * (this.canvas.width + 200),
                y: Math.random() * (this.canvas.height * 0.6), // Top 60% of screen
                size: 30 + Math.random() * 50,
                speed: 20 + Math.random() * 40 // Different speeds for parallax
            });
        }
    },

    // Draw a fluffy cloud at position
    drawCloud: function (ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
        ctx.arc(x + size * 0.8, y, size * 0.5, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y + size * 0.2, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
    },

    setupControls: function () {
        // Space/Click/Tap to flap
        const flap = (e) => {
            if (!this.isRunning) return;

            // Prevent default for space
            if (e.code === 'Space') e.preventDefault();

            this.bird.velocity = this.FLAP_STRENGTH;

            // Play flap sound
            if (typeof SoundManager !== 'undefined' && SoundManager.playFlap) {
                SoundManager.playFlap();
            }
        };

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') flap(e);
        });

        this.canvas.addEventListener('click', flap);
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            flap(e);
        }, { passive: false });
    },

    start: function () {
        this.reset();
        this.isRunning = true;
        document.getElementById('score-board').classList.remove('hidden');
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    },

    reset: function () {
        this.score = 0;
        this.updateUI();
        this.pipes = [];
        this.pipeTimer = 0;

        // Reinitialize clouds
        this.initClouds();

        // Initialize bird
        this.bird = {
            x: this.canvas.width * 0.2,
            y: this.canvas.height / 2,
            width: 50,
            height: 50,
            velocity: 0
        };
    },

    gameLoop: function (timestamp) {
        if (!this.isRunning) return;

        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (isNaN(dt) || dt > 0.1) dt = 0.016;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.gameLoop(t));
    },

    update: function (dt) {
        // Update bird
        this.bird.velocity += this.GRAVITY * dt;
        this.bird.y += this.bird.velocity * dt;

        // Update wing flapping animation
        this.wingFlapTimer += dt * this.wingFlapSpeed;
        if (this.wingFlapTimer >= 1) {
            this.wingFlapTimer = 0;
            this.showWingUp = !this.showWingUp;
        }

        // Update clouds (move at different speeds)
        this.clouds.forEach(cloud => {
            cloud.x -= cloud.speed * dt;
            // Wrap around when off screen
            if (cloud.x + cloud.size < 0) {
                cloud.x = this.canvas.width + cloud.size;
                cloud.y = Math.random() * (this.canvas.height * 0.6);
            }
        });

        // Spawn pipes
        this.pipeTimer += dt * 1000;
        if (this.pipeTimer > this.PIPE_SPAWN_RATE) {
            this.pipeTimer = 0;
            this.spawnPipe();
        }

        // Update pipes
        this.pipes.forEach(pipe => {
            pipe.x -= this.PIPE_SPEED * dt;

            // Score when passing pipe
            if (!pipe.scored && pipe.x + this.PIPE_WIDTH < this.bird.x) {
                pipe.scored = true;
                this.score++;
                this.updateUI();
                // Play sound if available
                if (typeof SoundManager !== 'undefined' && SoundManager.playSplat) {
                    SoundManager.playSplat();
                }
            }
        });

        // Remove off-screen pipes
        this.pipes = this.pipes.filter(pipe => pipe.x + this.PIPE_WIDTH > 0);

        // Check collisions
        this.checkCollisions();
    },

    spawnPipe: function () {
        const minGapY = 100;
        const maxGapY = this.canvas.height - 100 - this.PIPE_GAP;
        const gapY = minGapY + Math.random() * (maxGapY - minGapY);

        this.pipes.push({
            x: this.canvas.width,
            gapY: gapY,
            scored: false
        });
    },

    checkCollisions: function () {
        const bird = this.bird;

        // Use circular hitbox (center of bird, with smaller radius for forgiveness)
        const birdCenterX = bird.x + bird.width / 2;
        const birdCenterY = bird.y + bird.height / 2;
        const birdRadius = bird.width / 2 - 8; // Smaller than visual for forgiveness

        // Ground/ceiling collision
        if (birdCenterY - birdRadius < 0 || birdCenterY + birdRadius > this.canvas.height) {
            this.gameOver();
            return;
        }

        // Pipe collision using circle
        for (const pipe of this.pipes) {
            const pipeLeft = pipe.x;
            const pipeRight = pipe.x + this.PIPE_WIDTH;
            const gapTop = pipe.gapY;
            const gapBottom = pipe.gapY + this.PIPE_GAP;

            // Check if bird circle overlaps with pipes
            // Find closest point on pipe rectangles to bird center

            // Top pipe collision
            if (birdCenterX + birdRadius > pipeLeft && birdCenterX - birdRadius < pipeRight) {
                if (birdCenterY - birdRadius < gapTop) {
                    this.gameOver();
                    return;
                }
                if (birdCenterY + birdRadius > gapBottom) {
                    this.gameOver();
                    return;
                }
            }
        }
    },

    draw: function () {
        const ctx = this.ctx;

        // Draw sky gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1e90ff');  // Dodger blue at top
        gradient.addColorStop(0.6, '#87ceeb'); // Sky blue
        gradient.addColorStop(1, '#b0e0e6');   // Powder blue at bottom
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw clouds (animated)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.clouds.forEach(cloud => {
            this.drawCloud(ctx, cloud.x, cloud.y, cloud.size);
        });

        // Draw pipes
        ctx.fillStyle = '#228B22'; // Forest green
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#006400';

        this.pipes.forEach(pipe => {
            // Top pipe
            ctx.fillRect(pipe.x, 0, this.PIPE_WIDTH, pipe.gapY);
            // Pipe cap (top)
            ctx.fillRect(pipe.x - 3, pipe.gapY - 20, this.PIPE_WIDTH + 6, 20);

            // Bottom pipe
            ctx.fillRect(pipe.x, pipe.gapY + this.PIPE_GAP, this.PIPE_WIDTH, this.canvas.height - pipe.gapY - this.PIPE_GAP);
            // Pipe cap (bottom)
            ctx.fillRect(pipe.x - 3, pipe.gapY + this.PIPE_GAP, this.PIPE_WIDTH + 6, 20);
        });

        ctx.shadowBlur = 0;

        // Draw kuhkayi photo masked to a circle with animated wings
        ctx.save();
        ctx.translate(this.bird.x + this.bird.width / 2, this.bird.y + this.bird.height / 2);
        const rotation = Math.min(Math.max(this.bird.velocity / 500, -0.5), 0.5);
        ctx.rotate(rotation);

        // Wings sit behind the photo and flap
        this.drawWingAnimation(ctx);

        // Photo clipped to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.bird.width / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        if (this.birdImageLoaded) {
            ctx.drawImage(this.birdImage, -this.bird.width / 2, -this.bird.height / 2, this.bird.width, this.bird.height);
        } else {
            ctx.fillStyle = '#ffce8a';
            ctx.fillRect(-this.bird.width / 2, -this.bird.height / 2, this.bird.width, this.bird.height);
        }
        ctx.restore();

        // Border ring
        ctx.beginPath();
        ctx.arc(0, 0, this.bird.width / 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#00f3ff';
        ctx.stroke();

        ctx.restore();
    },

    // Draw wing flapping animation overlay
    drawWingAnimation: function (ctx) {
        const wingLift = this.showWingUp ? -10 : 10;
        const wingAngle = this.showWingUp ? -0.4 : 0.35;
        const spread = 26;
        const wingW = 12;
        const wingH = 18;

        ctx.fillStyle = '#fdf5e6';
        ctx.strokeStyle = '#c49a6c';
        ctx.lineWidth = 2;

        const drawWing = (side) => {
            ctx.save();
            const direction = side === 'left' ? -1 : 1;
            ctx.translate(direction * spread, wingLift);
            ctx.rotate(direction * wingAngle);

            // Primary wing shape
            ctx.beginPath();
            ctx.ellipse(0, 0, wingW, wingH, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Inner detail
            ctx.fillStyle = '#f0e1c5';
            ctx.beginPath();
            ctx.ellipse(0, -4, wingW * 0.7, wingH * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        };

        drawWing('left');
        drawWing('right');
    },

    updateUI: function () {
        document.getElementById('score').innerText = this.score;
    },

    gameOver: function () {
        this.isRunning = false;

        // Play game over sound
        if (typeof SoundManager !== 'undefined' && SoundManager.playGameOver) {
            SoundManager.playGameOver();
        }

        document.getElementById('flappy-final-score').innerText = this.score;
        document.getElementById('flappy-game-over').classList.remove('hidden');
        document.getElementById('score-board').classList.add('hidden');
    },

    stop: function () {
        this.isRunning = false;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    FlappyGame.init();
});
