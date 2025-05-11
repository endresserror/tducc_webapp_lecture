// Space Invaders Game Implementation

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// Game variables
let player;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let shields = [];
let ufo;
let score = 0;
let lives = 3;
let level = 1;
let gameOver = false;
let gameWon = false;
let lastTime = 0;
let enemyMoveTimer = 0;
let enemyMoveDelay = 60; // 30から60に変更して敵の移動速度を遅くする
let enemyDirection = 1;
let speedFactor = 0.7; // 1.0から0.7に下げて移動距離を短くする
let frameCount = 0;
let enemyFrameToggle = false; // For alternating enemy sprite animation
let soundsLoaded = false;
let enterReleased = true; // 新しい変数：Enterキーがリリースされたかどうかを追跡
let gamePaused = false; // ポーズ状態を管理する新しい変数

// Sprites and images
const sprites = {
    player: new Image(),
    enemy: new Image()
};

// Audio elements
const sounds = {
    shoot: new Audio('/static/assets/sounds/shoot.wav'),
    explosion: new Audio('/static/assets/sounds/explosion.wav'),
    invaderKilled: new Audio('/static/assets/sounds/invaderkilled.wav'),
    ufoSound: new Audio('/static/assets/sounds/ufo_highpitch.wav'),
    move1: new Audio('/static/assets/sounds/fastinvader1.wav'),
    move2: new Audio('/static/assets/sounds/fastinvader2.wav'),
    move3: new Audio('/static/assets/sounds/fastinvader3.wav'),
    move4: new Audio('/static/assets/sounds/fastinvader4.wav')
};

// Load sprites
function loadSprites() {
    sprites.player.src = '/static/assets/sprites/player.png';
    sprites.enemy.src = '/static/assets/sprites/enemy.png';
    
    // Make sure sprites are loaded before starting
    const promises = Object.values(sprites).map(sprite => {
        return new Promise((resolve) => {
            sprite.onload = resolve;
        });
    });
    
    return Promise.all(promises);
}

// Initialize game
async function init() {
    await loadSprites();
    setupSounds();
    
    player = new Player(canvas.width / 2 - 30, canvas.height - 60);
    createEnemyFormation();
    createShields();
    ufo = new UFO();
    
    // Set up keyboard controls
    setupControls();
    
    // Start game loop
    requestAnimationFrame(gameLoop);
}

function setupSounds() {
    // Reduce volume of sounds
    Object.values(sounds).forEach(sound => {
        sound.volume = 0.3;
    });
    sounds.ufoSound.loop = true;
    soundsLoaded = true;
}

function createEnemyFormation() {
    enemies = [];
    const rows = 5;
    const cols = 11;
    const spaceX = 50;
    const spaceY = 40;
    const startX = 80;
    const startY = 80;
    
    for (let row = 0; row < rows; row++) {
        const enemyType = row === 0 ? 3 : (row < 3 ? 2 : 1);
        for (let col = 0; col < cols; col++) {
            const x = startX + col * spaceX;
            const y = startY + row * spaceY;
            enemies.push(new Enemy(x, y, enemyType));
        }
    }
}

function createShields() {
    shields = [];
    const shieldCount = 4;
    const spacing = 160;
    const startX = 100;
    const y = canvas.height - 150;
    
    for (let i = 0; i < shieldCount; i++) {
        shields.push(new Shield(startX + i * spacing, y));
    }
}

function setupControls() {
    const keys = {};
    
    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        
        // Space bar for shooting - プレイヤーが存在するときだけ発射
        if (e.key === ' ' && !keys.shootLock && player && !gameOver && !gameWon) {
            keys.shootLock = true;
            player.shoot();
        }
        
        // Prevent scrolling with arrow keys, space, and enter
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) {
            e.preventDefault();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
        if (e.key === ' ') {
            keys.shootLock = false;
        }
        if (e.key === 'Enter') {
            enterReleased = true; // Enterキーが離されたことを記録
        }
    });
    
    // Game loop will check these
    window.controls = keys;
}

function gameLoop(timestamp) {
    // Calculate delta time for smooth animations
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Handle game over or won states
    if (gameOver) {
        displayGameOver();
        return;
    }
    
    if (gameWon) {
        displayGameWon();
        return;
    }
    
    // Handle game pause
    if (gamePaused) {
        displayPauseScreen();
        return;
    }
    
    // Update player
    handlePlayerInput();
    player.update();
    player.draw();
    
    // Update UFO
    ufo.update();
    if (ufo.active) {
        ufo.draw();
        if (!sounds.ufoSound.paused && !sounds.ufoSound.playing) {
            playSound('ufoSound', false);
        }
    } else {
        stopSound('ufoSound');
    }
    
    // Update enemy formation movement
    updateEnemyFormation(deltaTime);
    
    // Update bullets
    updateBullets();
    
    // Draw shields
    shields.forEach(shield => shield.draw());
    
    // Draw UI
    drawUI();
    
    // Next frame
    frameCount++;
    requestAnimationFrame(gameLoop);
}

function handlePlayerInput() {
    const keys = window.controls;
    
    if (keys['ArrowLeft']) {
        player.moveLeft();
    }
    
    if (keys['ArrowRight']) {
        player.moveRight();
    }
    
    // Enterキーの処理
    if (keys['Enter']) {
        if (enterReleased) {
            // 一時停止機能など、ゲーム中にEnterで実行したい機能をここに追加
            enterReleased = false;
            gamePaused = !gamePaused; // ポーズ状態を切り替える
            
            // デモとしてゲームのステータスをコンソールに表示
            console.log(`現在のスコア: ${score}, レベル: ${level}, 残機: ${lives}`);
        }
    } else {
        enterReleased = true;
    }
}

function updateEnemyFormation(deltaTime) {
    enemyMoveTimer += deltaTime;
    
    // Move enemies at a specific interval
    if (enemyMoveTimer >= enemyMoveDelay) {
        enemyMoveTimer = 0;
        
        // Play movement sound based on timing
        if (enemies.length > 0) {
            const soundIndex = Math.floor((frameCount / 10) % 4) + 1;
            playSound(`move${soundIndex}`);
        }
        
        // Check if any enemy reached canvas edge
        let reachedEdge = false;
        enemies.forEach(enemy => {
            if ((enemy.x <= 10 && enemyDirection === -1) || 
                (enemy.x + enemy.width >= canvas.width - 10 && enemyDirection === 1)) {
                reachedEdge = true;
            }
        });
        
        if (reachedEdge) {
            // Change direction and move enemies down
            enemyDirection *= -1;
            enemies.forEach(enemy => {
                enemy.y += 20;
            });
        } else {
            // Move enemies horizontally
            enemies.forEach(enemy => {
                enemy.x += 10 * enemyDirection * speedFactor;
            });
        }
        
        // Toggle animation frame
        enemyFrameToggle = !enemyFrameToggle;
        
        // Random enemy shooting
        if (enemies.length > 0 && Math.random() < 0.1 + (level * 0.05)) {
            const shooters = enemies.filter(e => {
                // Find enemies at the bottom of each column
                const column = enemies.filter(other => 
                    Math.abs(e.x - other.x) < 5
                );
                return e === column[column.length - 1];
            });
            
            if (shooters.length > 0) {
                const shooter = shooters[Math.floor(Math.random() * shooters.length)];
                enemyBullets.push(new EnemyBullet(shooter.x + shooter.width / 2, shooter.y + shooter.height));
            }
        }
    }
    
    // Draw enemies
    enemies.forEach(enemy => enemy.draw());
    
    // Check if enemies reached player level
    enemies.forEach(enemy => {
        if (enemy.y + enemy.height >= player.y) {
            gameOver = true;
        }
    });
    
    // Check if all enemies defeated
    if (enemies.length === 0) {
        level++;
        speedFactor += 0.2;
        enemyMoveDelay = Math.max(15, 30 - (level * 2));
        createEnemyFormation();
    }
}

function updateBullets() {
    // Update player bullets
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        bullet.update();
        bullet.draw();
        
        // Check for out of bounds
        if (bullet.y < 0) {
            playerBullets.splice(i, 1);
            continue;
        }
        
        // Check for enemy hits
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (checkCollision(bullet, enemies[j])) {
                // 敵の撃破音を再生
                playSound('invaderKilled');
                
                // Add score based on enemy type
                score += enemies[j].points;
                
                playerBullets.splice(i, 1);
                enemies.splice(j, 1);
                break;
            }
        }
        
        // Check for UFO hit
        if (bullet && ufo.active && checkCollision(bullet, ufo)) {
            playSound('explosion');
            stopSound('ufoSound');
            
            score += ufo.getPoints();
            ufo.active = false;
            playerBullets.splice(i, 1);
        }
        
        // Check for shield hits
        if (bullet) {
            for (const shield of shields) {
                if (shield.checkCollision(bullet)) {
                    playerBullets.splice(i, 1);
                    break;
                }
            }
        }
    }
    
    // Update enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.update();
        bullet.draw();
        
        // Check for out of bounds
        if (bullet.y > canvas.height) {
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // Check for player hit
        if (checkCollision(bullet, player)) {
            playSound('explosion');
            
            // プレイヤーがダメージを受ける
            if (player.takeDamage()) {
                // 体力が0になった場合
                lives--; // ストックを1つ消費
                
                if (lives <= 0) {
                    // ストックもなくなったらゲームオーバー
                    gameOver = true;
                } else {
                    // まだストックがある場合は新しいプレイヤーを生成
                    // 一時的に無敵にして敵の弾をクリア
                    player = new Player(canvas.width / 2 - 30, canvas.height - 60);
                    player.invincible = true;
                    player.invincibleTimer = 180; // 3秒間の無敵時間
                    enemyBullets = []; // 敵の弾をクリア
                }
            }
            
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // Check for shield hits
        for (const shield of shields) {
            if (shield.checkCollision(bullet)) {
                enemyBullets.splice(i, 1);
                break;
            }
        }
    }
}

function drawUI() {
    // Draw score
    ctx.fillStyle = 'white';
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score.toString().padStart(4, '0')}`, 20, 30);
    
    // Draw level
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${level}`, canvas.width / 2, 30);
    
    // Draw ships/stock count
    ctx.textAlign = 'right';
    ctx.fillText(`SHIPS: ${lives}`, canvas.width - 20, 30);
    
    // Draw extra ships indicators (stock)
    for (let i = 0; i < lives - 1; i++) {
        ctx.drawImage(sprites.player, canvas.width - 100 + (i * 30), 40, 25, 15);
    }
    
    // Draw current health status
    if (player && !gameOver) {
        ctx.textAlign = 'left';
        ctx.fillText(`HEALTH: ${player.health}/${player.maxHealth}`, 20, canvas.height - 20);
    }
}

// ゲームオーバーとゲーム勝利画面を共通化した関数
function displayGameStatus(title, isGameOver = true) {
    ctx.fillStyle = 'white';
    ctx.font = '40px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 40);
    
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillText(`FINAL SCORE: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('PRESS ENTER TO PLAY AGAIN', canvas.width / 2, canvas.height / 2 + 60);
    
    // Check for Enter key press to restart
    if (window.controls && window.controls['Enter']) {
        if (enterReleased) {
            resetGame();
            enterReleased = false;
            // ゲームループを再開する
            lastTime = performance.now(); // タイムスタンプをリセット
            requestAnimationFrame(gameLoop);
        }
    } else {
        enterReleased = true;
    }
}

function displayGameOver() {
    displayGameStatus('GAME OVER');
}

function displayGameWon() {
    displayGameStatus('YOU WIN!', false);
}

function displayPauseScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 半透明の黒色オーバーレイ
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '40px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 40);
    
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillText('PRESS ENTER TO RESUME', canvas.width / 2, canvas.height / 2 + 20);
    
    // ゲーム情報も表示
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillText(`SCORE: ${score}   LEVEL: ${level}   SHIPS: ${lives}`, canvas.width / 2, canvas.height / 2 + 80);
    
    // Check for Enter key press to resume
    if (window.controls && window.controls['Enter']) {
        if (enterReleased) {
            gamePaused = false; // ポーズ解除
            enterReleased = false;
            lastTime = performance.now(); // タイムスタンプをリセット（時間ずれ防止）
        }
    } else {
        enterReleased = true;
    }
    
    // ゲームを継続
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    player = new Player(canvas.width / 2 - 30, canvas.height - 60);
    createEnemyFormation();
    createShields();
    ufo = new UFO();
    playerBullets = [];
    enemyBullets = [];
    score = 0;
    lives = 3;
    level = 1;
    gameOver = false;
    gameWon = false;
    enemyMoveTimer = 0;
    enemyMoveDelay = 60; // 変更：30から60に修正して以前の設定を維持
    enemyDirection = 1;
    speedFactor = 0.7; // 変更：1.0から0.7に修正して以前の設定を維持
}

function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj2.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj2.height > obj2.y;
}

// サウンド再生用のユーティリティ関数
function playSound(soundName, reset = true) {
    if (soundsLoaded) {
        if (reset) {
            sounds[soundName].currentTime = 0;
        }
        sounds[soundName].play();
    }
}

function stopSound(soundName) {
    if (soundsLoaded) {
        sounds[soundName].pause();
        sounds[soundName].currentTime = 0;
    }
}

// Player class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 30;
        this.speed = 5;
        this.reloadTime = 0;
        this.health = 10; // プレイヤーの体力（10回まで打たれる）
        this.maxHealth = 10; // 最大体力
        this.invincible = false; // 無敵状態（ダメージを受けた直後の一時的な無敵）
        this.invincibleTimer = 0; // 無敵時間のタイマー
        this.blinkTimer = 0; // 点滅用タイマー
    }
    
    update() {
        if (this.reloadTime > 0) {
            this.reloadTime--;
        }
        
        // 無敵状態の更新
        if (this.invincible) {
            this.invincibleTimer--;
            this.blinkTimer++;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
                this.blinkTimer = 0;
            }
        }
    }
    
    draw() {
        // 無敵状態なら点滅表示
        if (!this.invincible || (this.blinkTimer % 10) < 5) {
            ctx.drawImage(sprites.player, this.x, this.y, this.width, this.height);
        }
        
        // 体力バーの描画
        this.drawHealthBar();
    }
    
    drawHealthBar() {
        const barWidth = this.width;
        const barHeight = 5;
        const barY = this.y + this.height + 5;
        
        // 背景（赤）
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(this.x, barY, barWidth, barHeight);
        
        // 体力（緑）
        const healthWidth = (this.health / this.maxHealth) * barWidth;
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(this.x, barY, healthWidth, barHeight);
    }
    
    takeDamage() {
        if (this.invincible) return false;
        
        this.health--;
        
        // 一時的に無敵にする（連続ダメージ防止）
        this.invincible = true;
        this.invincibleTimer = 60; // 60フレーム（約1秒）の無敵時間
        
        return this.health <= 0; // 体力が0以下ならtrueを返す
    }
    
    moveLeft() {
        this.x = Math.max(this.x - this.speed, 0);
    }
    
    moveRight() {
        this.x = Math.min(this.x + this.speed, canvas.width - this.width);
    }
    
    shoot() {
        if (this.reloadTime <= 0) {
            playSound('shoot');
            
            playerBullets.push(new PlayerBullet(this.x + this.width / 2, this.y));
            this.reloadTime = 20; // Cooldown between shots
        }
    }
}

// Enemy class
class Enemy {
    constructor(x, y, type = 1) {
        this.x = x;
        this.y = y;
        this.type = type; // 1, 2, or 3 for different enemy types
        this.width = 40;
        this.height = 30;
        this.points = type * 10; // Different points based on enemy type
    }
    
    draw() {
        // Just use the single enemy sprite, but we could change color based on type if needed
        ctx.drawImage(sprites.enemy, this.x, this.y, this.width, this.height);
    }
}

// UFO class - bonus points
class UFO {
    constructor() {
        this.width = 70;
        this.height = 30;
        this.x = -this.width;
        this.y = 50;
        this.active = false;
        this.speed = 2;
        this.points = [50, 100, 150, 300];
    }
    
    update() {
        // Random chance to spawn UFO
        if (!this.active && Math.random() < 0.001) {
            this.active = true;
            this.x = -this.width;
        }
        
        // Move UFO across the screen
        if (this.active) {
            this.x += this.speed;
            
            if (this.x > canvas.width) {
                this.active = false;
            }
        }
    }
    
    draw() {
        if (this.active) {
            // Use the enemy sprite for UFO as well since we don't have a dedicated sprite
            ctx.drawImage(sprites.enemy, this.x, this.y, this.width, this.height);
        }
    }
    
    getPoints() {
        return this.points[Math.floor(Math.random() * this.points.length)];
    }
}

// Shield class
class Shield {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 60;
        this.segments = [];
        
        // Create shield segments
        this.createSegments();
    }
    
    createSegments() {
        const segmentSize = 10;
        
        // Create classic shield shape
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 8; col++) {
                // Skip corners to create the classic shape
                if ((row === 0 && (col === 0 || col === 7)) ||
                    (row === 1 && (col === 0 || col === 7))) {
                    continue;
                }
                
                // Create bottom cutout
                if (row >= 4 && col >= 3 && col <= 4) {
                    continue;
                }
                
                this.segments.push({
                    x: this.x + col * segmentSize,
                    y: this.y + row * segmentSize,
                    width: segmentSize,
                    height: segmentSize,
                    health: 4
                });
            }
        }
    }
    
    draw() {
        ctx.fillStyle = '#00FF00';
        
        this.segments.forEach(segment => {
            // Change color based on damage
            if (segment.health === 3) {
                ctx.fillStyle = '#00CC00';
            } else if (segment.health === 2) {
                ctx.fillStyle = '#009900';
            } else if (segment.health === 1) {
                ctx.fillStyle = '#006600';
            }
            
            ctx.fillRect(segment.x, segment.y, segment.width, segment.height);
        });
    }
    
    checkCollision(bullet) {
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            
            if (bullet.x < segment.x + segment.width &&
                bullet.x + bullet.width > segment.x &&
                bullet.y < segment.y + segment.height &&
                bullet.y + bullet.height > segment.y) {
                
                segment.health--;
                if (segment.health <= 0) {
                    this.segments.splice(i, 1);
                }
                
                return true;
            }
        }
        
        return false;
    }
}

// 基底弾丸クラス - プレイヤーと敵の弾の共通部分
class Bullet {
    constructor(x, y, width, height, speed, color) {
        this.x = x - Math.floor(width / 2); // 中央揃え
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.color = color;
    }
    
    update() {
        // 子クラスで実装
    }
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// Player Bullet class
class PlayerBullet extends Bullet {
    constructor(x, y) {
        super(x, y, 3, 15, 8, '#FFFFFF');
    }
    
    update() {
        this.y -= this.speed;
    }
}

// Enemy Bullet class
class EnemyBullet extends Bullet {
    constructor(x, y) {
        super(x, y, 3, 15, 5, '#FF0000');
    }
    
    update() {
        this.y += this.speed;
    }
}

window.onload = init;