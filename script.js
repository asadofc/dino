// ==================== Game Configuration ====================
const CONFIG = {
    GRAVITY: 0.6,
    JUMP_STRENGTH: -12,
    GROUND_HEIGHT: 350,
    GAME_SPEED_INITIAL: 6,
    GAME_SPEED_INCREMENT: 0.002,
    MIN_GAP_MULTIPLIER: 50,
    MAX_GAP_MULTIPLIER: 100,
    DINO_WIDTH: 44,
    DINO_HEIGHT: 47,
    DINO_DUCK_HEIGHT: 30,
    CACTUS_WIDTH: 25,
    CACTUS_HEIGHT: 50,
    BIRD_WIDTH: 46,
    BIRD_HEIGHT: 40,
    CLOUD_SPEED: 1,
};

// ==================== Game State ====================
let canvas, ctx;
let gameRunning = false;
let score = 0;
let highScore = 0;
let gameSpeed = CONFIG.GAME_SPEED_INITIAL;
let frameCount = 0;
let nextSpawnDistance = 0;

// Game objects
let dino = {
    x: 50,
    y: CONFIG.GROUND_HEIGHT - CONFIG.DINO_HEIGHT,
    width: CONFIG.DINO_WIDTH,
    height: CONFIG.DINO_HEIGHT,
    velocityY: 0,
    isJumping: false,
    isDucking: false,
};

let obstacles = [];
let clouds = [];

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', init);

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Set FIXED internal resolution for consistent physics everywhere
    // CSS will handle visual scaling
    canvas.width = 800;
    canvas.height = 400;

    // Load high score
    loadHighScore();
    updateScoreDisplay();

    // Event listeners - optimized for instant response
    document.getElementById('startBtn').addEventListener('touchstart', startGame);
    document.getElementById('startBtn').addEventListener('mousedown', startGame);
    document.getElementById('restartBtn').addEventListener('touchstart', restartGame);
    document.getElementById('restartBtn').addEventListener('mousedown', restartGame);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Canvas interactions - instant response
    canvas.addEventListener('mousedown', handleCanvasInteraction);
    canvas.addEventListener('touchstart', handleCanvasInteraction, { passive: false });

    // == Mobile Controls Wiring ==
    const btnJump = document.getElementById('btnJump');
    const btnDuck = document.getElementById('btnDuck');

    if (btnJump && btnDuck) {
        // Prevent default to stop scrolling, doubling events
        const prevent = (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
        };

        // Jump
        btnJump.addEventListener('touchstart', (e) => { prevent(e); jump(); }, { passive: false });
        btnJump.addEventListener('mousedown', (e) => { prevent(e); jump(); });

        // Duck (Hold to duck)
        btnDuck.addEventListener('touchstart', (e) => { prevent(e); duck(true); }, { passive: false });
        btnDuck.addEventListener('mousedown', (e) => { prevent(e); duck(true); });

        ['touchend', 'mouseup', 'mouseleave'].forEach(evt => {
            btnDuck.addEventListener(evt, (e) => { prevent(e); duck(false); });
        });
    }

    // Initial render
    renderStartScreen();
}

// Resizing is handled by CSS aspect-ratio now


// ==================== Game Loop ====================
function startGame() {
    document.getElementById('startPanel').classList.add('hidden');
    resetGame();
    gameRunning = true;
    gameLoop();
}

function gameLoop() {
    if (!gameRunning) return;

    update();
    render();
    requestAnimationFrame(gameLoop);
}

function update() {
    frameCount++;

    // Update score
    score++;
    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }
    updateScoreDisplay();

    // Increase game speed
    gameSpeed += CONFIG.GAME_SPEED_INCREMENT;

    // Update dino
    updateDino();

    // Update obstacles
    updateObstacles();

    // Update clouds
    updateClouds();

    // Spawn manager
    manageSpawns();

    // Spawn clouds occasionally
    if (frameCount % 150 === 0) {
        spawnCloud();
    }

    // Check collisions
    checkCollisions();
}

function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw sky gradient (already in CSS background)

    // Draw ground
    drawGround();

    // Draw clouds
    clouds.forEach(cloud => drawCloud(cloud));

    // Draw dino
    drawDino();

    // Draw obstacles
    obstacles.forEach(obstacle => drawObstacle(obstacle));
}

// ==================== Dino Functions ====================
function updateDino() {
    if (dino.isJumping) {
        dino.velocityY += CONFIG.GRAVITY;
        dino.y += dino.velocityY;

        // Land on ground
        const groundY = CONFIG.GROUND_HEIGHT - (dino.isDucking ? CONFIG.DINO_DUCK_HEIGHT : CONFIG.DINO_HEIGHT);
        if (dino.y >= groundY) {
            dino.y = groundY;
            dino.velocityY = 0;
            dino.isJumping = false;
        }
    }
}

function drawDino() {
    ctx.save();

    // Wireframe/Pixel Style Dino
    ctx.fillStyle = '#d4d4d4';

    if (dino.isDucking) {
        // == Ducking Shape ==
        // Body (long)
        ctx.fillRect(dino.x, dino.y + 20, 40, 15);
        // Tail
        ctx.fillRect(dino.x - 5, dino.y + 15, 10, 5);
        // Head (forward)
        ctx.fillRect(dino.x + 40, dino.y + 15, 14, 10);

        // Legs (moving)
        const frame = Math.floor(frameCount / 5) % 2;
        if (frame === 0) {
            ctx.fillRect(dino.x + 10, dino.y + 35, 6, 4); // Back
            ctx.fillRect(dino.x + 25, dino.y + 35, 6, 4); // Front
        } else {
            ctx.fillRect(dino.x + 12, dino.y + 35, 6, 4);
            ctx.fillRect(dino.x + 27, dino.y + 35, 6, 4);
        }
    } else {
        // == Standing Shape ==
        // Head
        ctx.fillRect(dino.x + 20, dino.y, 20, 15);
        // Snout
        ctx.fillRect(dino.x + 40, dino.y + 5, 8, 8);

        // Neck/Body
        ctx.fillRect(dino.x + 15, dino.y + 15, 15, 20);
        ctx.fillRect(dino.x + 5, dino.y + 20, 10, 15); // Back

        // Tail
        ctx.fillRect(dino.x - 5, dino.y + 25, 10, 5);

        // Arms
        ctx.fillRect(dino.x + 30, dino.y + 22, 5, 3);

        // Legs
        const legOffset = dino.isJumping ? 0 : Math.floor(frameCount / 5) % 2 * 6;

        // Back Leg
        ctx.fillRect(dino.x + 10, dino.y + 35, 5, 12);

        // Front Leg
        if (!dino.isJumping) {
            ctx.fillRect(dino.x + 20, dino.y + 35, 5, 12 - (legOffset ? 4 : 0));
        } else {
            ctx.fillRect(dino.x + 20, dino.y + 33, 5, 8);
        }
    }

    ctx.restore();
}

function jump() {
    if (!dino.isJumping && !dino.isDucking) {
        dino.isJumping = true;
        dino.velocityY = CONFIG.JUMP_STRENGTH;
    }
}

function duck(isDucking) {
    if (!dino.isJumping) {
        dino.isDucking = isDucking;
        if (isDucking) {
            dino.height = CONFIG.DINO_DUCK_HEIGHT;
            dino.y = CONFIG.GROUND_HEIGHT - CONFIG.DINO_DUCK_HEIGHT;
        } else {
            dino.height = CONFIG.DINO_HEIGHT;
            dino.y = CONFIG.GROUND_HEIGHT - CONFIG.DINO_HEIGHT;
        }
    }
}

// ==================== Obstacle Functions ====================
// ==================== Spawn Manager ====================
function manageSpawns() {
    let lastObstacle = obstacles[obstacles.length - 1];

    if (!lastObstacle) {
        spawnObstacle();
        setNextSpawnDistance();
    } else {
        const distanceToLast = canvas.width - (lastObstacle.x + lastObstacle.width);
        if (distanceToLast >= nextSpawnDistance) {
            spawnObstacle();
            setNextSpawnDistance();
        }
    }
}

function setNextSpawnDistance() {
    const minGap = gameSpeed * CONFIG.MIN_GAP_MULTIPLIER;
    const maxGap = gameSpeed * CONFIG.MAX_GAP_MULTIPLIER;
    nextSpawnDistance = Math.floor(Math.random() * (maxGap - minGap + 1) + minGap);
}

function spawnObstacle() {
    // 0-60%: Single Cactus, 60-80%: Double Cactus, 80-90%: Triple Cactus, 90-100%: Bird
    const rand = Math.random();
    let type = 'cactus';
    let count = 1;

    if (rand > 0.9 && score > 500) {
        type = 'bird';
    } else if (rand > 0.8 && score > 1000) {
        count = 3;
    } else if (rand > 0.6 && score > 300) {
        count = 2;
    }

    if (type === 'bird') {
        const bird = {
            x: canvas.width,
            y: 0,
            width: CONFIG.BIRD_WIDTH,
            height: CONFIG.BIRD_HEIGHT,
            type: 'bird'
        };
        // Variable bird heights
        const heights = [
            CONFIG.GROUND_HEIGHT - 100, // High (duckable)
            CONFIG.GROUND_HEIGHT - 70,  // Mid (duck/jump)
            CONFIG.GROUND_HEIGHT - 35   // Low (jump)
        ];
        bird.y = heights[Math.floor(Math.random() * heights.length)];
        obstacles.push(bird);
    } else {
        // Spawn cactus cluster
        for (let i = 0; i < count; i++) {
            const cactus = {
                x: canvas.width + (i * (CONFIG.CACTUS_WIDTH + 5)), // Tight cluster
                y: 0,
                width: CONFIG.CACTUS_WIDTH + Math.random() * 10,
                height: CONFIG.CACTUS_HEIGHT + Math.random() * 15,
                type: 'cactus'
            };
            cactus.y = CONFIG.GROUND_HEIGHT - cactus.height;
            obstacles.push(cactus);
        }
    }
}

function updateObstacles() {
    obstacles.forEach(obstacle => {
        obstacle.x -= gameSpeed;
    });

    // Remove off-screen obstacles
    obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > 0);
}

function drawObstacle(obstacle) {
    ctx.save();

    if (obstacle.type === 'cactus') {
        // == Geometric/Angular Cactus ==
        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#d4d4d4';
        ctx.lineWidth = 2;

        const w = obstacle.width;
        const h = obstacle.height;
        const cw = w * 0.35; // Column width

        ctx.beginPath();
        // Start bottom left of trunk
        ctx.moveTo(obstacle.x + (w - cw) / 2, obstacle.y + h);

        // Up to left arm
        ctx.lineTo(obstacle.x + (w - cw) / 2, obstacle.y + h * 0.5);
        ctx.lineTo(obstacle.x, obstacle.y + h * 0.5);
        ctx.lineTo(obstacle.x, obstacle.y + h * 0.25);
        ctx.lineTo(obstacle.x + cw, obstacle.y + h * 0.25);
        ctx.lineTo(obstacle.x + cw, obstacle.y + h * 0.4);

        // Back to trunk and Up
        ctx.lineTo(obstacle.x + (w - cw) / 2, obstacle.y + h * 0.4);
        ctx.lineTo(obstacle.x + (w - cw) / 2, obstacle.y);
        ctx.lineTo(obstacle.x + (w + cw) / 2, obstacle.y);

        // Down to right arm
        ctx.lineTo(obstacle.x + (w + cw) / 2, obstacle.y + h * 0.3);
        ctx.lineTo(obstacle.x + w - cw, obstacle.y + h * 0.3);
        ctx.lineTo(obstacle.x + w - cw, obstacle.y + h * 0.15);
        ctx.lineTo(obstacle.x + w, obstacle.y + h * 0.15);
        ctx.lineTo(obstacle.x + w, obstacle.y + h * 0.45);
        ctx.lineTo(obstacle.x + (w + cw) / 2, obstacle.y + h * 0.45);

        // Down trunk right
        ctx.lineTo(obstacle.x + (w + cw) / 2, obstacle.y + h);

        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Tech Detail: Vertical center spine
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.moveTo(obstacle.x + w / 2, obstacle.y + 5);
        ctx.lineTo(obstacle.x + w / 2, obstacle.y + h);
        ctx.stroke();

    } else {
        // Bird - Pixel art style
        ctx.fillStyle = '#aaa';

        const wingOffset = Math.floor(frameCount / 10) % 2 * 10;

        // Body
        ctx.fillRect(obstacle.x + 10, obstacle.y + 10, 20, 8);
        // Head
        ctx.fillRect(obstacle.x + 28, obstacle.y + 6, 8, 8);
        // Beak
        ctx.fillRect(obstacle.x + 36, obstacle.y + 8, 4, 2);

        // Wing
        if (wingOffset === 0) {
            // Wing up
            ctx.beginPath();
            ctx.moveTo(obstacle.x + 15, obstacle.y + 10);
            ctx.lineTo(obstacle.x + 20, obstacle.y - 5);
            ctx.lineTo(obstacle.x + 25, obstacle.y + 10);
            ctx.fill();
        } else {
            // Wing down
            ctx.beginPath();
            ctx.moveTo(obstacle.x + 15, obstacle.y + 10);
            ctx.lineTo(obstacle.x + 20, obstacle.y + 20);
            ctx.lineTo(obstacle.x + 25, obstacle.y + 10);
            ctx.fill();
        }
    }

    ctx.restore();
}

// ==================== Cloud Functions ====================
function spawnCloud() {
    clouds.push({
        x: canvas.width,
        y: Math.random() * 100 + 30,
        width: 60 + Math.random() * 40,
        height: 20 + Math.random() * 10
    });
}

function updateClouds() {
    clouds.forEach(cloud => {
        cloud.x -= CONFIG.CLOUD_SPEED;
    });

    clouds = clouds.filter(cloud => cloud.x + cloud.width > 0);
}

function drawCloud(cloud) {
    ctx.save();

    // == Blueprint Cloud ==
    ctx.fillStyle = '#0a0a0a'; // Match bg slightly to occult stars
    ctx.strokeStyle = '#444'; // Subtle technical line
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    // Flat bottom
    ctx.moveTo(cloud.x, cloud.y + cloud.height);
    ctx.lineTo(cloud.x + cloud.width, cloud.y + cloud.height);

    // Smooth distinct bumps (Technical Drawing style)
    // Right bump
    ctx.arcTo(cloud.x + cloud.width, cloud.y + cloud.height * 0.5, cloud.x + cloud.width * 0.7, cloud.y, 15);
    // Center bump (higher)
    ctx.arcTo(cloud.x + cloud.width * 0.5, cloud.y - 10, cloud.x + cloud.width * 0.3, cloud.y + cloud.height * 0.5, 20);
    // Left bump
    ctx.arcTo(cloud.x, cloud.y + cloud.height * 0.5, cloud.x, cloud.y + cloud.height, 15);

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Add "Data Lines" inside to make it look industrial
    ctx.beginPath();
    ctx.strokeStyle = '#222';
    ctx.moveTo(cloud.x + 10, cloud.y + cloud.height - 5);
    ctx.lineTo(cloud.x + cloud.width - 10, cloud.y + cloud.height - 5);
    ctx.stroke();

    ctx.restore();
}

// ==================== Ground ====================
function drawGround() {
    ctx.save();

    // Single clean horizon line
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CONFIG.GROUND_HEIGHT);
    ctx.lineTo(canvas.width, CONFIG.GROUND_HEIGHT);
    ctx.stroke();

    // Simple markers for speed illusion
    ctx.fillStyle = '#444';
    const markerInterval = 100;
    const offset = (frameCount * gameSpeed) % markerInterval;

    for (let x = -offset; x < canvas.width; x += markerInterval) {
        ctx.fillRect(x, CONFIG.GROUND_HEIGHT, 1, 5);
    }

    ctx.restore();
}

// ==================== Collision Detection ====================
function checkCollisions() {
    obstacles.forEach(obstacle => {
        if (isColliding(dino, obstacle)) {
            gameOver();
        }
    });
}

function isColliding(dino, obstacle) {
    // Hitbox collision with some tolerance for better gameplay
    const tolerance = 5;
    return (
        dino.x + tolerance < obstacle.x + obstacle.width &&
        dino.x + dino.width - tolerance > obstacle.x &&
        dino.y + tolerance < obstacle.y + obstacle.height &&
        dino.y + dino.height - tolerance > obstacle.y
    );
}

// ==================== Game Over ====================
function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = Math.floor(score / 10);
    document.getElementById('gameOverPanel').classList.remove('hidden');
}

function restartGame() {
    document.getElementById('gameOverPanel').classList.add('hidden');
    startGame();
}

function resetGame() {
    score = 0;
    gameSpeed = CONFIG.GAME_SPEED_INITIAL;
    frameCount = 0;
    obstacles = [];
    clouds = [];
    nextSpawnDistance = 0;
    dino.y = CONFIG.GROUND_HEIGHT - CONFIG.DINO_HEIGHT;
    dino.velocityY = 0;
    dino.isJumping = false;
    dino.isDucking = false;
    dino.height = CONFIG.DINO_HEIGHT;
}

// ==================== Input Handling ====================
function handleKeyDown(e) {
    if (!gameRunning) return;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
    } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        duck(true);
    }
}

function handleKeyUp(e) {
    if (!gameRunning) return;

    if (e.code === 'ArrowDown') {
        e.preventDefault();
        duck(false);
    }
}

function handleCanvasInteraction(e) {
    e.preventDefault(); // Prevent default immediately to avoid delays

    if (gameRunning) {
        jump();
    }
}

// ==================== Score Management ====================
function updateScoreDisplay() {
    document.getElementById('currentScore').textContent = String(Math.floor(score / 10)).padStart(5, '0');
    document.getElementById('highScore').textContent = String(Math.floor(highScore / 10)).padStart(5, '0');
}

function saveHighScore() {
    localStorage.setItem('dinoHighScore', highScore);
}

function loadHighScore() {
    const saved = localStorage.getItem('dinoHighScore');
    if (saved) {
        highScore = parseInt(saved);
    }
}

// ==================== Start Screen Render ====================
function renderStartScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround();

    // Add some clouds
    for (let i = 0; i < 3; i++) {
        drawCloud({
            x: 100 + i * 200,
            y: 50 + i * 20,
            width: 80,
            height: 30
        });
    }

    // Draw static dino
    drawDino();
}
