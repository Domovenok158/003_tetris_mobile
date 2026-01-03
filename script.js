// Game constants
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = [
    null,
    '#FF6B6B', // I piece - Red
    '#4ECDC4', // O piece - Teal
    '#45B7D1', // T piece - Blue
    '#F9CA24', // S piece - Yellow
    '#6C5CE7', // Z piece - Purple
    '#A29BFE', // J piece - Light Purple
    '#FD79A8'  // L piece - Pink
];

// Tetromino shapes
const SHAPES = [
    // I piece
    [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    // O piece
    [
        [2, 2],
        [2, 2]
    ],
    // T piece
    [
        [0, 3, 0],
        [3, 3, 3],
        [0, 0, 0]
    ],
    // S piece
    [
        [0, 4, 4],
        [4, 4, 0],
        [0, 0, 0]
    ],
    // Z piece
    [
        [5, 5, 0],
        [0, 5, 5],
        [0, 0, 0]
    ],
    // J piece
    [
        [6, 0, 0],
        [6, 6, 6],
        [0, 0, 0]
    ],
    // L piece
    [
        [0, 0, 7],
        [7, 7, 7],
        [0, 0, 0]
    ]
];

// Game state
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let lines = 0;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let gameRunning = false;
let gamePaused = false;
let animationId = null;

// Canvas elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

// UI elements
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const gameOverlay = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const startButton = document.getElementById('startButton');

// Mobile control buttons
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const downBtn = document.getElementById('downBtn');
const rotateBtn = document.getElementById('rotateBtn');
const hardDropBtn = document.getElementById('hardDropBtn');

// Initialize canvas size
function resizeCanvas() {
    const container = canvas.parentElement; // game-board-container
    const gameArea = container.parentElement; // game-area
    const mobileControls = document.getElementById('mobileControls');
    
    // Get available space from container
    const containerPadding = parseInt(window.getComputedStyle(container).padding) * 2 || 16;
    const availableWidth = container.clientWidth - containerPadding;
    
    // On mobile, account for controls height if visible
    let availableHeight = container.clientHeight - containerPadding;
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile && mobileControls && window.getComputedStyle(mobileControls).display !== 'none') {
        // Calculate available height considering controls
        const gameAreaHeight = gameArea ? gameArea.clientHeight : container.clientHeight;
        const controlsHeight = mobileControls.offsetHeight || 0;
        const gap = 8; // gap between board and controls
        availableHeight = gameAreaHeight - controlsHeight - gap - containerPadding;
    }
    
    const aspectRatio = COLS / ROWS;
    
    // Calculate canvas size to fit available space
    let canvasWidth = availableWidth;
    let canvasHeight = canvasWidth / aspectRatio;
    
    // If height is the constraint, adjust width
    if (canvasHeight > availableHeight && availableHeight > 0) {
        canvasHeight = availableHeight;
        canvasWidth = canvasHeight * aspectRatio;
    }
    
    // Ensure minimum size
    canvasWidth = Math.max(canvasWidth, COLS * 10);
    canvasHeight = Math.max(canvasHeight, ROWS * 10);
    
    canvas.width = Math.floor(canvasWidth);
    canvas.height = Math.floor(canvasHeight);
    
    // Redraw if game is running
    if (gameRunning) {
        draw();
    }
}

// Initialize game board
function initBoard() {
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
}

// Create a new piece
function createPiece(type) {
    const shape = SHAPES[type];
    return {
        shape: shape,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: 0,
        type: type + 1
    };
}

// Get random piece
function getRandomPiece() {
    return Math.floor(Math.random() * SHAPES.length);
}

// Check collision
function collide(board, piece, dx = 0, dy = 0) {
    const shape = piece.shape;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const newX = piece.x + x + dx;
                const newY = piece.y + y + dy;
                
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                if (newY >= 0 && board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Rotate piece
function rotatePiece(piece) {
    const shape = piece.shape;
    const rotated = shape[0].map((_, i) => 
        shape.map(row => row[i]).reverse()
    );
    
    const rotatedPiece = {
        ...piece,
        shape: rotated
    };
    
    // Wall kick - try to adjust position if rotation causes collision
    if (collide(board, rotatedPiece)) {
        // Try moving left
        rotatedPiece.x -= 1;
        if (!collide(board, rotatedPiece)) {
            return rotatedPiece;
        }
        // Try moving right
        rotatedPiece.x += 2;
        if (!collide(board, rotatedPiece)) {
            return rotatedPiece;
        }
        // Try moving up
        rotatedPiece.x -= 1;
        rotatedPiece.y -= 1;
        if (!collide(board, rotatedPiece)) {
            return rotatedPiece;
        }
        // Can't rotate
        return piece;
    }
    
    return rotatedPiece;
}

// Place piece on board
function placePiece() {
    const shape = currentPiece.shape;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const boardY = currentPiece.y + y;
                const boardX = currentPiece.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.type;
                }
            }
        }
    }
}

// Clear lines
function clearLines() {
    let linesCleared = 0;
    
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            y++; // Check the same row again
        }
    }
    
    if (linesCleared > 0) {
        lines += linesCleared;
        
        // Score calculation
        const lineScores = [0, 100, 300, 500, 800];
        score += lineScores[linesCleared] * level;
        
        // Level progression (every 10 lines)
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
            dropInterval = Math.max(100, 1000 - (level - 1) * 50);
        }
        
        updateUI();
    }
}

// Move piece
function movePiece(dx, dy) {
    if (!currentPiece || !gameRunning || gamePaused) return;
    
    if (!collide(board, currentPiece, dx, dy)) {
        currentPiece.x += dx;
        currentPiece.y += dy;
        return true;
    }
    return false;
}

// Hard drop
function hardDrop() {
    if (!currentPiece || !gameRunning || gamePaused) return;
    
    let dropDistance = 0;
    while (movePiece(0, 1)) {
        dropDistance++;
    }
    
    // Bonus points for hard drop
    score += dropDistance * 2;
    updateUI();
    
    // Place piece immediately
    placePiece();
    clearLines();
    spawnPiece();
}

// Spawn new piece
function spawnPiece() {
    currentPiece = nextPiece || createPiece(getRandomPiece());
    nextPiece = createPiece(getRandomPiece());
    
    if (collide(board, currentPiece)) {
        gameOver();
    }
    
    drawNextPiece();
}

// Draw block
function drawBlock(ctx, x, y, color, blockSize) {
    ctx.fillStyle = color;
    ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
    
    // Add border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
    
    // Add highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x * blockSize, y * blockSize, blockSize * 0.3, blockSize * 0.3);
}

// Draw board
function drawBoard() {
    const blockSize = canvas.width / COLS;
    
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw placed blocks
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x]) {
                const pixelY = (y * blockSize);
                const pixelX = (x * blockSize);
                drawBlock(ctx, x, y, COLORS[board[y][x]], blockSize);
            }
        }
    }
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * blockSize, 0);
        ctx.lineTo(x * blockSize, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * blockSize);
        ctx.lineTo(canvas.width, y * blockSize);
        ctx.stroke();
    }
    
    // Draw current piece
    if (currentPiece) {
        const shape = currentPiece.shape;
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    const pixelY = currentPiece.y + y;
                    const pixelX = currentPiece.x + x;
                    if (pixelY >= 0) {
                        drawBlock(ctx, pixelX, pixelY, COLORS[currentPiece.type], blockSize);
                    }
                }
            }
        }
    }
}

// Draw next piece
function drawNextPiece() {
    if (!nextPiece) return;
    
    const blockSize = 20;
    const shape = nextPiece.shape;
    const offsetX = (nextCanvas.width - shape[0].length * blockSize) / 2;
    const offsetY = (nextCanvas.height - shape.length * blockSize) / 2;
    
    // Clear canvas
    nextCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    // Draw piece
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const pixelX = offsetX + x * blockSize;
                const pixelY = offsetY + y * blockSize;
                nextCtx.fillStyle = COLORS[nextPiece.type];
                nextCtx.fillRect(pixelX, pixelY, blockSize, blockSize);
                
                nextCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                nextCtx.lineWidth = 1;
                nextCtx.strokeRect(pixelX, pixelY, blockSize, blockSize);
            }
        }
    }
}

// Draw function
function draw() {
    drawBoard();
}

// Update UI
function updateUI() {
    scoreElement.textContent = score.toLocaleString();
    levelElement.textContent = level;
    linesElement.textContent = lines;
}

// Game loop
function gameLoop(time = 0) {
    if (!gameRunning) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;
    
    dropCounter += deltaTime;
    
    if (dropCounter > dropInterval) {
        if (movePiece(0, 1)) {
            // Piece moved down
        } else {
            // Piece can't move down, place it
            placePiece();
            clearLines();
            spawnPiece();
        }
        dropCounter = 0;
    }
    
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    initBoard();
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    dropCounter = 0;
    lastTime = 0;
    gameRunning = true;
    gamePaused = false;
    
    nextPiece = createPiece(getRandomPiece());
    spawnPiece();
    
    gameOverlay.classList.add('hidden');
    startButton.textContent = 'Pause';
    
    updateUI();
    gameLoop();
}

// Pause game
function pauseGame() {
    if (!gameRunning) return;
    
    gamePaused = !gamePaused;
    
    if (gamePaused) {
        cancelAnimationFrame(animationId);
        gameOverlay.classList.remove('hidden');
        overlayTitle.textContent = 'Paused';
        overlayMessage.textContent = 'Press Resume to continue';
        startButton.textContent = 'Resume';
    } else {
        lastTime = performance.now();
        gameOverlay.classList.add('hidden');
        startButton.textContent = 'Pause';
        gameLoop();
    }
}

// Game over
function gameOver() {
    gameRunning = false;
    gamePaused = false;
    cancelAnimationFrame(animationId);
    
    gameOverlay.classList.remove('hidden');
    overlayTitle.textContent = 'Game Over';
    overlayMessage.textContent = `Final Score: ${score.toLocaleString()}`;
    startButton.textContent = 'Play Again';
}

// Keyboard controls
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowDown: false,
    ArrowUp: false,
    ' ': false
};

let keyRepeatTimer = null;
const KEY_REPEAT_DELAY = 150;

function handleKeyDown(event) {
    if (!gameRunning && event.code !== 'Space' && event.key !== 'Enter') {
        return;
    }
    
    if (event.code === 'Space' && !gameRunning) {
        event.preventDefault();
        startGame();
        return;
    }
    
    if (event.key === 'Enter' && !gameRunning) {
        event.preventDefault();
        startGame();
        return;
    }
    
    if (keys.hasOwnProperty(event.code) || keys.hasOwnProperty(event.key)) {
        event.preventDefault();
        const key = event.code || event.key;
        
        if (!keys[key]) {
            keys[key] = true;
            handleKeyAction(key);
            
            // Set up repeat
            clearTimeout(keyRepeatTimer);
            keyRepeatTimer = setTimeout(() => {
                const repeatInterval = setInterval(() => {
                    if (keys[key] && gameRunning && !gamePaused) {
                        handleKeyAction(key);
                    } else {
                        clearInterval(repeatInterval);
                    }
                }, 50);
            }, KEY_REPEAT_DELAY);
        }
    }
}

function handleKeyUp(event) {
    if (keys.hasOwnProperty(event.code) || keys.hasOwnProperty(event.key)) {
        const key = event.code || event.key;
        keys[key] = false;
        clearTimeout(keyRepeatTimer);
    }
}

function handleKeyAction(key) {
    if (!gameRunning || gamePaused) return;
    
    switch (key) {
        case 'ArrowLeft':
            movePiece(-1, 0);
            break;
        case 'ArrowRight':
            movePiece(1, 0);
            break;
        case 'ArrowDown':
            if (movePiece(0, 1)) {
                score += 1;
                updateUI();
            }
            break;
        case 'ArrowUp':
            currentPiece = rotatePiece(currentPiece);
            break;
        case ' ':
            hardDrop();
            break;
    }
    draw();
}

// Touch controls
function setupTouchControls() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    // Prevent default touch behaviors
    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('.control-btn') || e.target.closest('#gameCanvas')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('.control-btn') || e.target.closest('#gameCanvas')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('touchend', (e) => {
        if (e.target.closest('.control-btn') || e.target.closest('#gameCanvas')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Button controls
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused) {
            movePiece(-1, 0);
            draw();
        }
    });
    
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused) {
            movePiece(1, 0);
            draw();
        }
    });
    
    downBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused) {
            if (movePiece(0, 1)) {
                score += 1;
                updateUI();
            }
            draw();
        }
    });
    
    rotateBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused && currentPiece) {
            currentPiece = rotatePiece(currentPiece);
            draw();
        }
    });
    
    hardDropBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused) {
            hardDrop();
            draw();
        }
    });
    
    // Also support click for desktop testing
    leftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused) {
            movePiece(-1, 0);
            draw();
        }
    });
    
    rightBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused) {
            movePiece(1, 0);
            draw();
        }
    });
    
    downBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused) {
            if (movePiece(0, 1)) {
                score += 1;
                updateUI();
            }
            draw();
        }
    });
    
    rotateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused && currentPiece) {
            currentPiece = rotatePiece(currentPiece);
            draw();
        }
    });
    
    hardDropBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameRunning && !gamePaused) {
            hardDrop();
            draw();
        }
    });
}

// Start button handler
startButton.addEventListener('click', () => {
    if (!gameRunning) {
        startGame();
    } else {
        pauseGame();
    }
});

// Initialize
window.addEventListener('load', () => {
    // Use requestAnimationFrame to ensure layout is calculated
    requestAnimationFrame(() => {
        resizeCanvas();
        initBoard();
        draw();
        updateUI();
        setupTouchControls();
        
        // Resize again after a short delay to account for mobile controls
        setTimeout(() => {
            resizeCanvas();
            if (gameRunning) {
                draw();
            }
        }, 100);
    });
    
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            resizeCanvas();
            if (gameRunning) {
                draw();
            }
        }, 100);
    });
    
    // Keyboard event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Prevent context menu on long press (mobile)
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.control-btn') || e.target.closest('#gameCanvas')) {
            e.preventDefault();
        }
    });
    
    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd < 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
});

