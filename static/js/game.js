// Space Invaders Game Implementation - Enhanced Version
// スペースインベーダーゲームの実装 - 改良版

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// Game State Manager for better code organization
// ゲーム状態管理（コード構成改善のため）
class GameStateManager {
    constructor() {
        this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAME_OVER, GAME_WON (メニュー、プレイ中、一時停止、ゲームオーバー、ゲームクリア)
        this.previousState = null;
    }
    
    setState(newState) {
        this.previousState = this.state;
        this.state = newState;
        console.log(`ゲーム状態変更: ${this.previousState} -> ${this.state}`);
    }
    
    isPaused() {
        return this.state === 'PAUSED';
    }
    
    isPlaying() {
        return this.state === 'PLAYING';
    }
    
    isGameOver() {
        return this.state === 'GAME_OVER' || this.state === 'GAME_WON';
    }
}

// Object Pool for better memory management
// オブジェクトプール（メモリ管理改善のため）
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.active = [];
        
        // Pre-populate pool
        // プールを事前に生成
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }
    
    get() {
        let obj = this.pool.pop();
        if (!obj) {
            obj = this.createFn();
        }
        this.active.push(obj);
        return obj;
    }
    
    release(obj) {
        const index = this.active.indexOf(obj);
        if (index > -1) {
            this.active.splice(index, 1);
            this.resetFn(obj);
            this.pool.push(obj);
        }
    }
    
    releaseAll() {
        while (this.active.length > 0) {
            this.release(this.active[0]);
        }
    }
    
    getActiveObjects() {
        return this.active;
    }
}

// Performance Monitor
// パフォーマンスモニター
class PerformanceMonitor {
    constructor() {
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.showDebug = false;
    }
    
    update() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }
    
    draw() {
        if (this.showDebug) {
            ctx.fillStyle = 'white';
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`FPS: ${this.fps}`, 10, canvas.height - 10);
            ctx.fillText(`オブジェクト数: ${playerBulletPool.active.length + enemyBulletPool.active.length + enemies.length}`, 10, canvas.height - 25);
        }
    }
    
    toggleDebug() {
        this.showDebug = !this.showDebug;
    }
}

// Game variables
// ゲーム変数
let gameStateManager = new GameStateManager();
let performanceMonitor = new PerformanceMonitor();
let player;
let enemies = [];
let shields = [];
let ufo;
let score = 0;
let lives = 3;
let level = 1;
let lastTime = 0;
let enemyMoveTimer = 0;
let enemyMoveDelay = 60;
let enemyDirection = 1;
let speedFactor = 0.7;
let frameCount = 0;
let enemyFrameToggle = false;
let soundsLoaded = false;
let enterReleased = true;

// Object pools for better memory management
// オブジェクトプール（メモリ管理改善のため）
let playerBulletPool;
let enemyBulletPool;

// Game configuration
// ゲーム設定
const CONFIG = {
    PLAYER_SPEED: 5, // プレイヤースピード
    BULLET_SPEED: 8, // 弾のスピード
    ENEMY_BULLET_SPEED: 5, // 敵の弾のスピード
    MAX_PLAYER_BULLETS: 3, // プレイヤーの最大弾数（オリジナルゲーム同様）
    ENEMY_ROWS: 5, // 敵の行数
    ENEMY_COLS: 11, // 敵の列数
    SHIELD_COUNT: 4, // シールドの数
    INVINCIBLE_TIME: 180, // 無敵時間
    SOUND_VOLUME: 0.3 // サウンド音量
};

// Sprites and images
// スプライトと画像
const sprites = {
    player: new Image(),
    enemy: new Image()
};

// Audio elements
// オーディオ要素
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

// Load sprites with better error handling
// スプライト読み込み（エラーハンドリング改善）
function loadSprites() {
    const loadPromises = [];
    
    for (const [key, sprite] of Object.entries(sprites)) {
        const promise = new Promise((resolve, reject) => {
            sprite.onload = () => {
                console.log(`スプライト読み込み完了: ${key}`);
                resolve();
            };
            sprite.onerror = () => {
                console.warn(`スプライト読み込み失敗: ${key}, フォールバックを使用`);
                resolve(); // 失敗しても処理を続行（フォールバックのため）
            };
        });
        loadPromises.push(promise);
    }
    
    // Set sprite sources after setting up event handlers
    // イベントハンドラ設定後にスプライトソースを設定
    sprites.player.src = '/static/assets/sprites/player.png';
    sprites.enemy.src = '/static/assets/sprites/enemy.png';
    
    return Promise.all(loadPromises);
}

// Initialize object pools
// オブジェクトプールの初期化
function initObjectPools() {
    playerBulletPool = new ObjectPool(
        () => new PlayerBullet(0, 0),
        (bullet) => {
            bullet.x = 0;
            bullet.y = 0;
            bullet.active = false;
        },
        CONFIG.MAX_PLAYER_BULLETS
    );
    
    enemyBulletPool = new ObjectPool(
        () => new EnemyBullet(0, 0),
        (bullet) => {
            bullet.x = 0;
            bullet.y = 0;
            bullet.active = false;
        },
        20
    );
}

// Initialize game
// ゲーム初期化
async function init() {
    try {
        await loadSprites();
        setupSounds();
        initObjectPools();
        
        player = new Player(canvas.width / 2 - 30, canvas.height - 60);
        createEnemyFormation();
        createShields();
        ufo = new UFO();
        
        setupControls();
        gameStateManager.setState('PLAYING');
        
        console.log('ゲーム初期化成功');
        requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error('ゲーム初期化失敗:', error);
        // Show error message to user
        // ユーザーにエラーメッセージを表示
        displayError('ゲームの初期化に失敗しました。ページを再読み込みしてください。');
    }
}

function setupSounds() {
    Object.values(sounds).forEach((sound, index) => {
        sound.volume = CONFIG.SOUND_VOLUME;
        sound.addEventListener('error', () => {
            console.warn(`サウンド読み込み失敗: ${Object.keys(sounds)[index]}`);
        });
    });
    sounds.ufoSound.loop = true;
    soundsLoaded = true;
}

function createEnemyFormation() {
    enemies = [];
    const spaceX = 50;
    const spaceY = 40;
    const startX = 80;
    const startY = 80;
    
    for (let row = 0; row < CONFIG.ENEMY_ROWS; row++) {
        const enemyType = row === 0 ? 3 : (row < 3 ? 2 : 1);
        for (let col = 0; col < CONFIG.ENEMY_COLS; col++) {
            const x = startX + col * spaceX;
            const y = startY + row * spaceY;
            enemies.push(new Enemy(x, y, enemyType));
        }
    }
}

function createShields() {
    shields = [];
    const spacing = 160;
    const startX = 100;
    const y = canvas.height - 150;
    
    for (let i = 0; i < CONFIG.SHIELD_COUNT; i++) {
        shields.push(new Shield(startX + i * spacing, y));
    }
}

function setupControls() {
    const keys = {};
    
    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        
        // Debug toggle with F1
        // F1キーでデバッグ表示切り替え
        if (e.key === 'F1') {
            e.preventDefault();
            performanceMonitor.toggleDebug();
        }
        
        // Space bar for shooting
        // スペースキーで発射
        if (e.key === ' ' && !keys.shootLock && player && gameStateManager.isPlaying()) {
            // Limit concurrent bullets like original game
            // 同時発射弾数を制限（オリジナルゲーム同様）
            if (playerBulletPool.active.length < CONFIG.MAX_PLAYER_BULLETS) {
                keys.shootLock = true;
                player.shoot();
            }
        }
        
        // Prevent scrolling
        // スクロール防止
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'F1'].includes(e.key)) {
            e.preventDefault();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
        if (e.key === ' ') {
            keys.shootLock = false;
        }
        if (e.key === 'Enter') {
            enterReleased = true;
        }
    });
    
    window.controls = keys;
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Update performance monitor
    // パフォーマンスモニター更新
    performanceMonitor.update();
    
    // Clear canvas
    // キャンバスをクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Handle different game states
    // ゲーム状態に応じた処理
    switch (gameStateManager.state) {
        case 'PLAYING':
            updateGame(deltaTime);
            drawGame();
            break;
        case 'PAUSED':
            drawGame(); // Draw current state (現在の状態を描画)
            displayPauseScreen();
            break;
        case 'GAME_OVER':
            displayGameOver();
            break;
        case 'GAME_WON':
            displayGameWon();
            break;
    }
    
    // Draw performance info
    // パフォーマンス情報を描画
    performanceMonitor.draw();
    
    frameCount++;
    requestAnimationFrame(gameLoop);
}

function updateGame(deltaTime) {
    handlePlayerInput();
    player.update();
    
    // Update UFO
    // UFO更新
    ufo.update();
    if (ufo.active && !sounds.ufoSound.paused && !sounds.ufoSound.playing) {
        playSound('ufoSound', false);
    } else if (!ufo.active) {
        stopSound('ufoSound');
    }
    
    // Update enemy formation
    // 敵のフォーメーション更新
    updateEnemyFormation(deltaTime);
    
    // Update bullets using object pools
    // オブジェクトプールを使用して弾を更新
    updateBulletsOptimized();
    
    // Check win/lose conditions
    // 勝敗条件を確認
    checkGameConditions();
}

function drawGame() {
    // Draw player
    // プレイヤー描画
    if (player) {
        player.draw();
    }
    
    // Draw UFO
    // UFO描画
    if (ufo && ufo.active) {
        ufo.draw();
    }
    
    // Draw enemies
    // 敵描画
    enemies.forEach(enemy => enemy.draw());
    
    // Draw bullets
    // 弾描画
    playerBulletPool.getActiveObjects().forEach(bullet => bullet.draw());
    enemyBulletPool.getActiveObjects().forEach(bullet => bullet.draw());
    
    // Draw shields
    // シールド描画
    shields.forEach(shield => shield.draw());
    
    // Draw UI
    // UI描画
    drawUI();
}

function handlePlayerInput() {
    const keys = window.controls;
    
    if (keys['ArrowLeft']) {
        player.moveLeft();
    }
    
    if (keys['ArrowRight']) {
        player.moveRight();
    }
    
    if (keys['Enter'] && enterReleased) {
        if (gameStateManager.isPlaying()) {
            gameStateManager.setState('PAUSED');
        } else if (gameStateManager.isPaused()) {
            gameStateManager.setState('PLAYING');
        } else if (gameStateManager.isGameOver()) {
            resetGame();
        }
        enterReleased = false;
    }
}

function updateEnemyFormation(deltaTime) {
    enemyMoveTimer += deltaTime;
    
    // Move enemies at a specific interval
    // 特定の間隔で敵を移動
    if (enemyMoveTimer >= enemyMoveDelay) {
        enemyMoveTimer = 0;
        
        // Play movement sound based on timing
        // タイミングに基づいて移動音を再生
        if (enemies.length > 0) {
            const soundIndex = Math.floor((frameCount / 10) % 4) + 1;
            playSound(`move${soundIndex}`);
        }
        
        // Check if any enemy reached canvas edge
        // いずれかの敵がキャンバスの端に到達したか確認
        let reachedEdge = false;
        enemies.forEach(enemy => {
            if ((enemy.x <= 10 && enemyDirection === -1) || 
                (enemy.x + enemy.width >= canvas.width - 10 && enemyDirection === 1)) {
                reachedEdge = true;
            }
        });
        
        if (reachedEdge) {
            // Change direction and move enemies down
            // 方向転換して敵を下に移動
            enemyDirection *= -1;
            enemies.forEach(enemy => {
                enemy.y += 20;
            });
        } else {
            // Move enemies horizontally
            // 敵を水平に移動
            enemies.forEach(enemy => {
                enemy.x += 10 * enemyDirection * speedFactor;
            });
        }
        
        // Toggle animation frame
        // アニメーションフレーム切り替え
        enemyFrameToggle = !enemyFrameToggle;
        
        // Improved enemy shooting with object pool
        // オブジェクトプールを使用した敵の射撃改善
        if (enemies.length > 0 && Math.random() < 0.1 + (level * 0.05)) {
            const shooters = enemies.filter(e => {
                // Find enemies at the bottom of each column
                // 各列の最下段の敵を見つける
                const column = enemies.filter(other => 
                    Math.abs(e.x - other.x) < 5
                );
                return e === column[column.length - 1];
            });
            
            if (shooters.length > 0) {
                const shooter = shooters[Math.floor(Math.random() * shooters.length)];
                const bullet = enemyBulletPool.get();
                bullet.x = shooter.x + shooter.width / 2 - bullet.width / 2;
                bullet.y = shooter.y + shooter.height;
                bullet.active = true;
            }
        }
    }
}

// Optimized bullet update system using object pools
// オブジェクトプールを使用した弾丸更新システムの最適化
function updateBulletsOptimized() {
    // Update player bullets
    // プレイヤーの弾を更新
    const playerBullets = playerBulletPool.getActiveObjects();
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        if (!bullet.active) continue;
        
        bullet.update();
        
        // Check for out of bounds
        // 画面外チェック
        if (bullet.y < 0) {
            playerBulletPool.release(bullet);
            continue;
        }
        
        // Check for enemy hits
        // 敵への命中判定
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (checkCollision(bullet, enemies[j])) {
                playSound('invaderKilled');
                score += enemies[j].points;
                enemies.splice(j, 1);
                playerBulletPool.release(bullet);
                break;
            }
        }
        
        // Check for UFO hit
        // UFOへの命中判定
        if (bullet.active && ufo.active && checkCollision(bullet, ufo)) {
            playSound('explosion');
            stopSound('ufoSound');
            score += ufo.getPoints();
            ufo.active = false;
            playerBulletPool.release(bullet);
            continue;
        }
        
        // Check for shield hits
        // シールドへの命中判定
        if (bullet.active) {
            for (const shield of shields) {
                if (shield.checkCollision(bullet)) {
                    playerBulletPool.release(bullet);
                    break;
                }
            }
        }
    }
    
    // Update enemy bullets
    // 敵の弾を更新
    const enemyBullets = enemyBulletPool.getActiveObjects();
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        if (!bullet.active) continue;
        
        bullet.update();
        
        // Check for out of bounds
        // 画面外チェック
        if (bullet.y > canvas.height) {
            enemyBulletPool.release(bullet);
            continue;
        }
        
        // Check for player hit
        // プレイヤーへの命中判定
        if (checkCollision(bullet, player)) {
            playSound('explosion');
            
            if (player.takeDamage()) {
                lives--;
                if (lives <= 0) {
                    gameStateManager.setState('GAME_OVER');
                } else {
                    // Reset player with temporary invincibility
                    // 一時的な無敵状態でプレイヤーをリセット
                    player = new Player(canvas.width / 2 - 30, canvas.height - 60);
                    player.invincible = true;
                    player.invincibleTimer = CONFIG.INVINCIBLE_TIME;
                    enemyBulletPool.releaseAll(); // Clear enemy bullets (敵の弾をクリア)
                }
            }
            
            enemyBulletPool.release(bullet);
            continue;
        }
        
        // Check for shield hits
        // シールドへの命中判定
        for (const shield of shields) {
            if (shield.checkCollision(bullet)) {
                enemyBulletPool.release(bullet);
                break;
            }
        }
    }
}

// Enhanced game condition checking
// ゲーム条件チェックの強化
function checkGameConditions() {
    // Check if enemies reached player level
    // 敵がプレイヤーレベルに到達したか確認
    const dangerousEnemies = enemies.filter(enemy => 
        enemy.y + enemy.height >= player.y - 20
    );
    
    if (dangerousEnemies.length > 0) {
        gameStateManager.setState('GAME_OVER');
        return;
    }
    
    // Check if all enemies defeated
    // 全ての敵を倒したか確認
    if (enemies.length === 0) {
        level++;
        speedFactor += 0.2;
        enemyMoveDelay = Math.max(15, 60 - (level * 3));
        createEnemyFormation();
        
        // Bonus points for completing level
        // レベルクリアボーナスポイント
        score += level * 100;
    }
    
    // Check lives
    // 残機確認
    if (lives <= 0) {
        gameStateManager.setState('GAME_OVER');
    }
}

// Enhanced Player class with better shooting
// 射撃改善されたプレイヤークラス
function updatePlayerShooting() {
    if (player.reloadTime <= 0 && playerBulletPool.active.length < CONFIG.MAX_PLAYER_BULLETS) {
        const bullet = playerBulletPool.get();
        bullet.x = player.x + player.width / 2 - bullet.width / 2;
        bullet.y = player.y;
        bullet.active = true;
        player.reloadTime = 20;
        playSound('shoot');
    }
}

// Error display function
// エラー表示関数
function displayError(message) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('エラー', canvas.width / 2, canvas.height / 2 - 40);
    
    ctx.font = '16px "Press Start 2P", monospace';
    const lines = message.split('\n');
    lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, canvas.height / 2 + (index * 25));
    });
}

// Enhanced reset function
// リセット機能の強化
function resetGame() {
    // Clear all object pools
    // 全てのオブジェクトプールをクリア
    playerBulletPool.releaseAll();
    enemyBulletPool.releaseAll();
    
    // Reset game objects
    // ゲームオブジェクトをリセット
    player = new Player(canvas.width / 2 - 30, canvas.height - 60);
    createEnemyFormation();
    createShields();
    ufo = new UFO();
    
    // Reset game variables
    // ゲーム変数をリセット
    score = 0;
    lives = 3;
    level = 1;
    enemyMoveTimer = 0;
    enemyMoveDelay = 60;
    enemyDirection = 1;
    speedFactor = 0.7;
    frameCount = 0;
    
    // Reset game state
    // ゲーム状態をリセット
    gameStateManager.setState('PLAYING');
    lastTime = performance.now();
}

// Enhanced collision detection with better precision
// より正確な衝突判定（衝突判定の強化）
function checkCollision(obj1, obj2) {
    // Add small buffer to make collision feel more fair
    // 衝突をより公平に感じさせるための小さなバッファを追加
    const buffer = 2;
    return obj1.x + buffer < obj2.x + obj2.width &&
           obj1.x + obj1.width - buffer > obj2.x &&
           obj1.y + buffer < obj2.y + obj2.height &&
           obj1.y + obj1.height - buffer > obj2.y;
}

// Enhanced sound system with error handling
// エラーハンドリング付きサウンドシステムの強化
function playSound(soundName, reset = true) {
    if (!soundsLoaded) return;
    
    try {
        const sound = sounds[soundName];
        if (sound) {
            if (reset) {
                sound.currentTime = 0;
            }
            const playPromise = sound.play();
            
            // Handle autoplay policy restrictions
            // 自動再生ポリシー制限の処理
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn(`サウンド再生不可 ${soundName}:`, error);
                });
            }
        }
    } catch (error) {
        console.warn(`サウンド再生エラー ${soundName}:`, error);
    }
}

function stopSound(soundName) {
    if (!soundsLoaded) return;
    
    try {
        const sound = sounds[soundName];
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    } catch (error) {
        console.warn(`サウンド停止エラー ${soundName}:`, error);
    }
}

// Player class
// プレイヤークラス
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
        if (this.reloadTime <= 0 && playerBulletPool.active.length < CONFIG.MAX_PLAYER_BULLETS) {
            const bullet = playerBulletPool.get();
            bullet.x = this.x + this.width / 2 - bullet.width / 2;
            bullet.y = this.y;
            bullet.active = true;
            this.reloadTime = 20;
            playSound('shoot');
        }
    }
}

// Enemy class
// 敵クラス
class Enemy {
    constructor(x, y, type = 1) {
        this.x = x;
        this.y = y;
        this.type = type; // 敵の種類 (1, 2, or 3)
        this.width = 40;
        this.height = 30;
        this.points = type * 10; // 敵の種類に応じたポイント
    }
    
    draw() {
        // Just use the single enemy sprite, but we could change color based on type if needed
        // 単一の敵スプライトを使用（必要に応じて種類ごとに色を変更可能）
        ctx.drawImage(sprites.enemy, this.x, this.y, this.width, this.height);
    }
}

// UFO class - bonus points
// UFOクラス - ボーナスポイント
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
        // ランダムな確率でUFO出現
        if (!this.active && Math.random() < 0.001) {
            this.active = true;
            this.x = -this.width;
        }
        
        // Move UFO across the screen
        // UFOを画面上で移動
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
            // 専用スプライトがないため、UFOにも敵スプライトを使用
            ctx.drawImage(sprites.enemy, this.x, this.y, this.width, this.height);
        }
    }
    
    getPoints() {
        return this.points[Math.floor(Math.random() * this.points.length)];
    }
}

// Shield class
// シールドクラス
class Shield {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 60;
        this.segments = [];
        
        // Create shield segments
        // シールドセグメント作成
        this.createSegments();
    }
    
    createSegments() {
        const segmentSize = 10;
        
        // Create classic shield shape
        // クラシックなシールド形状を作成
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 8; col++) {
                // Skip corners to create the classic shape
                // 角をスキップしてクラシックな形状を作成
                if ((row === 0 && (col === 0 || col === 7)) ||
                    (row === 1 && (col === 0 || col === 7))) {
                    continue;
                }
                
                // Create bottom cutout
                // 下部の切り欠きを作成
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
            // ダメージに応じて色を変更
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
// プレイヤーの弾クラス
class PlayerBullet extends Bullet {
    constructor(x, y) {
        super(x, y, 3, 15, 8, '#FFFFFF');
    }
    
    update() {
        this.y -= this.speed;
    }
}

// Enemy Bullet class
// 敵の弾クラス
class EnemyBullet extends Bullet {
    constructor(x, y) {
        super(x, y, 3, 15, 5, '#FF0000');
    }
    
    update() {
        this.y += this.speed;
    }
}

// Enhanced UI drawing with better visual feedback
// より良い視覚的フィードバックを備えたUI描画の強化
function drawUI() {
    // Draw score
    // スコア描画
    ctx.fillStyle = 'white';
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score.toString().padStart(6, '0')}`, 20, 30);

    // Draw level with highlight
    // レベル描画（ハイライト付き）
    ctx.textAlign = 'center';
    if (level > 1) {
        ctx.fillStyle = '#FFD700'; // Gold color for higher levels (高レベルは金色)
    } else {
        ctx.fillStyle = 'white';
    }
    ctx.fillText(`LEVEL ${level}`, canvas.width / 2, 30);

    // Draw lives as hearts with better spacing
    // 残機をハートで描画（スペース改善）
    ctx.textAlign = 'right';
    ctx.fillStyle = 'white';
    ctx.fillText(`ライフ:`, canvas.width - 120, 30);
    for (let i = 0; i < lives; i++) {
        ctx.fillStyle = '#FF0066';
        ctx.fillText('❤', canvas.width - 80 + (i * 25), 30);
    }

    // Draw current health status with better visibility
    // 現在の体力ステータスを描画（視認性向上）
    if (player && !gameStateManager.isGameOver()) {
        ctx.textAlign = 'left';
        ctx.fillStyle = player.health > 3 ? '#00FF00' : '#FF6600';
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillText(`HEALTH: ${player.health}/${player.maxHealth}`, 20, canvas.height - 20);
    }
    
    // Draw high score indicator
    // ハイスコアインジケーター描画
    const highScore = localStorage.getItem('spaceInvadersHighScore') || 0;
    if (score > highScore) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillText('NEW HIGH SCORE!', canvas.width / 2, 55);
    }
}

// Enhanced pause screen with better information
// より多くの情報を表示する一時停止画面の強化
function displayPauseScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '40px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 60);
    
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillText('PRESS ENTER TO RESUME', canvas.width / 2, canvas.height / 2);
    
    // Show game statistics
    // ゲーム統計を表示
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillText(`SCORE: ${score}`, canvas.width / 2, canvas.height / 2 + 40);
    ctx.fillText(`LEVEL: ${level}`, canvas.width / 2, canvas.height / 2 + 65);
    ctx.fillText(`LIVES: ${lives}`, canvas.width / 2, canvas.height / 2 + 90);
    ctx.fillText(`ENEMIES LEFT: ${enemies.length}`, canvas.width / 2, canvas.height / 2 + 115);
    
    // Handle resume
    // 再開処理
    if (window.controls && window.controls['Enter'] && enterReleased) {
        gameStateManager.setState('PLAYING');
        enterReleased = false;
        lastTime = performance.now();
    }
    
    requestAnimationFrame(gameLoop);
}

// Enhanced game over screen with high score tracking
// ハイスコア追跡機能付きゲームオーバー画面の強化
function displayGameOver() {
    // Save high score
    // ハイスコア保存
    const highScore = localStorage.getItem('spaceInvadersHighScore') || 0;
    if (score > highScore) {
        localStorage.setItem('spaceInvadersHighScore', score);
    }
    
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '40px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ランドセルvsコンちゃん~鳩山決戦~', canvas.width / 2, canvas.height / 2 - 120);
    
    ctx.fillStyle = '#FF0000';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60);

    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = 'white';
    ctx.fillText(`FINAL SCORE: ${score}`, canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillText(`LEVEL REACHED: ${level}`, canvas.width / 2, canvas.height / 2 + 20);
    
    if (score > highScore) {
        ctx.fillStyle = '#FFD700';
        ctx.fillText('NEW HIGH SCORE!', canvas.width / 2, canvas.height / 2 + 50);
    } else {
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(`HIGH SCORE: ${highScore}`, canvas.width / 2, canvas.height / 2 + 50);
    }
    
    ctx.fillStyle = 'white';
    ctx.fillText('PRESS ENTER TO PLAY AGAIN', canvas.width / 2, canvas.height / 2 + 90);

    // Handle restart
    // リスタート処理
    if (window.controls && window.controls['Enter'] && enterReleased) {
        resetGame();
        enterReleased = false;
        requestAnimationFrame(gameLoop);
    }
}

// Enhanced game won screen
// ゲームクリア画面の強化
function displayGameWon() {
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '40px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ランドセルvsコンちゃん~鳩山決戦~', canvas.width / 2, canvas.height / 2 - 120);
    
    ctx.fillStyle = '#00FF00';
    ctx.fillText('VICTORY!', canvas.width / 2, canvas.height / 2 - 60);

    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = 'white';
    ctx.fillText(`FINAL SCORE: ${score}`, canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillText(`LEVEL COMPLETED: ${level}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('PRESS ENTER TO PLAY AGAIN', canvas.width / 2, canvas.height / 2 + 60);

    // Handle restart
    // リスタート処理
    if (window.controls && window.controls['Enter'] && enterReleased) {
        resetGame();
        enterReleased = false;
        requestAnimationFrame(gameLoop);
    }
}

window.onload = init;