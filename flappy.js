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

    // Configuration
    GRAVITY: 800,
    FLAP_STRENGTH: -350,
    PIPE_SPEED: 200,
    PIPE_GAP: 150,
    PIPE_WIDTH: 60,
    PIPE_SPAWN_RATE: 2000,
    pipeTimer: 0,

    // Character image
    birdImage: null,
    birdImageLoaded: false,

    init: function () {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Load character image
        this.birdImage = new Image();
        this.birdImage.onload = () => {
            this.birdImageLoaded = true;
        };
        this.birdImage.src = 'assets/kuhkayi.png';

        // Setup event listeners
        this.setupControls();
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

        // Ground/ceiling collision
        if (bird.y < 0 || bird.y + bird.height > this.canvas.height) {
            this.gameOver();
            return;
        }

        // Pipe collision
        for (const pipe of this.pipes) {
            // Bird hitbox (slightly smaller than visual)
            const birdLeft = bird.x + 5;
            const birdRight = bird.x + bird.width - 5;
            const birdTop = bird.y + 5;
            const birdBottom = bird.y + bird.height - 5;

            // Pipe bounds
            const pipeLeft = pipe.x;
            const pipeRight = pipe.x + this.PIPE_WIDTH;
            const gapTop = pipe.gapY;
            const gapBottom = pipe.gapY + this.PIPE_GAP;

            // Check if bird is within pipe x range
            if (birdRight > pipeLeft && birdLeft < pipeRight) {
                // Check if bird is outside gap
                if (birdTop < gapTop || birdBottom > gapBottom) {
                    this.gameOver();
                    return;
                }
            }
        }
    },

    draw: function () {
        const ctx = this.ctx;

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw pipes
        ctx.fillStyle = '#00ff00';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ff00';

        this.pipes.forEach(pipe => {
            // Top pipe
            ctx.fillRect(pipe.x, 0, this.PIPE_WIDTH, pipe.gapY);
            // Bottom pipe
            ctx.fillRect(pipe.x, pipe.gapY + this.PIPE_GAP, this.PIPE_WIDTH, this.canvas.height - pipe.gapY - this.PIPE_GAP);
        });

        ctx.shadowBlur = 0;

        // Draw bird
        if (this.birdImageLoaded) {
            ctx.save();
            ctx.translate(this.bird.x + this.bird.width / 2, this.bird.y + this.bird.height / 2);
            // Rotate based on velocity
            const rotation = Math.min(Math.max(this.bird.velocity / 500, -0.5), 0.5);
            ctx.rotate(rotation);
            ctx.drawImage(this.birdImage, -this.bird.width / 2, -this.bird.height / 2, this.bird.width, this.bird.height);
            ctx.restore();
        } else {
            // Fallback emoji
            ctx.font = '40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('😃', this.bird.x + this.bird.width / 2, this.bird.y + this.bird.height / 2);
        }
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
