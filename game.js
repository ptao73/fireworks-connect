// --- Game State & Configuration ---
const CONFIG = {
    cols: 6,
    rows: 10,
    cellSize: 44, // Default, managed by CSS mostly
};

let gameState = {
    levelId: 1,
    timeLimit: 60,
    remainingSeconds: 60,
    timerId: null,
    score: 0,
    grid: [], // 60 cells
    sources: [],
    rockets: [],
    isPlaying: false,
    interactive: true
};

const MAIN_PIPES = ['straight', 'corner', 'tee', 'cross', 'bridge'];
const SOURCE_COLORS = ['#ffffff', '#fef08a', '#67e8f9', '#86efac', '#fca5a5', '#d8b4fe', '#fdba74', '#93c5fd', '#c4b5fd', '#f9a8d4'];

// --- Audio Engine ---
const SFX = {
    rotate: new Audio('assets/audio/rotate.mp3'),
    connect: new Audio('assets/audio/connect.mp3'), 
    firework_small: new Audio('assets/audio/firework_small.mp3'),
    firework_big: new Audio('assets/audio/firework_big.mp3'),
    bgm: new Audio('assets/audio/bgm_loop.mp3')
};
if (SFX.bgm) SFX.bgm.loop = true;

const AudioEngine = {
    enabled: true, 
    bgmPlaying: false,
    started: false,
    init() {
        if (!this.started) {
            this.started = true;
            if (this.enabled && SFX.bgm) {
                SFX.bgm.play()
                    .then(() => this.bgmPlaying = true)
                    .catch(e => {
                        console.warn("本地无 BGM 文件，已为您临时加载一首在线测试音乐", e);
                        SFX.bgm.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3";
                        SFX.bgm.play().then(() => this.bgmPlaying = true).catch(e2=>e2);
                    });
            }
        }
    },
    toggle() {
        this.enabled = !this.enabled;
        const btn = document.getElementById('btn-toggle-music');
        if (this.enabled) {
            btn.textContent = '🔊';
            if (this.started && SFX.bgm && !this.bgmPlaying) {
                SFX.bgm.play().then(() => this.bgmPlaying = true).catch(e=>e);
            }
        } else {
            btn.textContent = '🔇';
            if (SFX.bgm) {
                SFX.bgm.pause();
                this.bgmPlaying = false;
            }
        }
    },
    playRotate() { if(this.enabled && SFX.rotate) SFX.rotate.cloneNode().play().catch(e=>e); },
    playWaveStep(dist) { if(this.enabled && SFX.connect) SFX.connect.cloneNode().play().catch(e=>e); },
    playIgnite() { if(this.enabled && SFX.firework_big) SFX.firework_big.cloneNode().play().catch(e=>e); },
    playSmallIgnite() { if(this.enabled && SFX.firework_small) SFX.firework_small.cloneNode().play().catch(e=>e); }
};

// Map type + base rotation to actual openings 
function getOpenings(type, rotation) {
    let baseOpenings = [];
    switch (type) {
        case 'straight': baseOpenings = ['top', 'bottom']; break;
        case 'corner': baseOpenings = ['top', 'right']; break; // L shape
        case 'tee': baseOpenings = ['top', 'right', 'bottom']; break;
        case 'cross': baseOpenings = ['top', 'right', 'bottom', 'left']; break;
        default: return [];
    }

    const dirs = ['top', 'right', 'bottom', 'left'];
    const rotSteps = (Math.floor(rotation) % 360) / 90;
    
    return baseOpenings.map(dir => {
        let idx = dirs.indexOf(dir);
        return dirs[(idx + rotSteps) % 4];
    });
}

function getExits(type, rotation, entryDir) {
    if (type === 'bridge') {
        if (entryDir === 'left') return ['right'];
        if (entryDir === 'right') return ['left'];
        if (entryDir === 'top') return ['bottom'];
        if (entryDir === 'bottom') return ['top'];
        return [];
    }

    let baseOpenings = [];
    switch (type) {
        case 'straight': baseOpenings = ['top', 'bottom']; break;
        case 'corner': baseOpenings = ['top', 'right']; break; 
        case 'tee': baseOpenings = ['top', 'right', 'bottom']; break;
        case 'cross': baseOpenings = ['top', 'right', 'bottom', 'left']; break;
        default: return [];
    }

    const dirs = ['top', 'right', 'bottom', 'left'];
    const rotSteps = (Math.floor(rotation) % 360) / 90;
    
    let rotatedOpenings = baseOpenings.map(dir => {
        let idx = dirs.indexOf(dir);
        return dirs[(idx + rotSteps) % 4];
    });

    if (!rotatedOpenings.includes(entryDir)) return [];
    
    return rotatedOpenings.filter(d => d !== entryDir);
}

function getOppositeDir(dir) {
    const opp = { 'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left' };
    return opp[dir];
}

function getNeighborCoords(col, row, dir) {
    switch(dir) {
        case 'top': return { c: col, r: row - 1 };
        case 'bottom': return { c: col, r: row + 1 };
        case 'left': return { c: col - 1, r: row };
        case 'right': return { c: col + 1, r: row };
    }
}

// --- DOM Elements ---
const elStartScreen = document.getElementById('screen-start');
const elGameScreen = document.getElementById('screen-game');
const elGridBoard = document.getElementById('grid-board');
const elSourcesCol = document.getElementById('sources-col');
const elRocketsCol = document.getElementById('rockets-col');
const elTimer = document.getElementById('info-timer');
const elLevel = document.getElementById('info-level');
const elScore = document.getElementById('info-score');
const elModal = document.getElementById('modal-settlement');
const elSettleDetails = document.getElementById('settle-details');

// --- Initialization ---
function initLevel(levelData) {
    gameState.levelId = levelData.id;
    gameState.timeLimit = levelData.timeLimit;
    gameState.remainingSeconds = levelData.timeLimit;
    gameState.score = 0;
    gameState.interactive = true;
    gameState.isPlaying = true;
    
    elLevel.textContent = gameState.levelId;
    elTimer.textContent = gameState.remainingSeconds;
    elScore.textContent = gameState.score;
    
    generateGrid(levelData);
    renderGrid();
    calculateConnections();
    
    if (gameState.timerId) clearInterval(gameState.timerId);
    gameState.timerId = setInterval(() => {
        if (!gameState.isPlaying) return;
        gameState.remainingSeconds--;
        elTimer.textContent = gameState.remainingSeconds;
        if (gameState.remainingSeconds <= 0) {
            gameState.remainingSeconds = 0;
            triggerSettlement();
        }
    }, 1000);
}

function generateGrid(levelData) {
    gameState.grid = [];
    gameState.sources = [];
    gameState.rockets = [];
    
    const startRow = CONFIG.rows - levelData.rows;
    
    let validBoard = false;
    let maxAttempts = 200;
    let bestPathGrid;
    let bestSecretTargets = [];
    
    while (!validBoard && maxAttempts > 0) {
        maxAttempts--;
        let attemptGrid = Array(CONFIG.rows).fill(0).map(() => 
            Array(CONFIG.cols).fill(0).map(() => new Set())
        );
        let activeRows = [];
        for (let r = startRow; r < CONFIG.rows; r++) activeRows.push(r);
        
        let targets = [...activeRows];
        targets.sort(() => Math.random() - 0.5);
        
        let pathsToCarve = [];
        for (let i = 0; i < activeRows.length; i++) {
            pathsToCarve.push({ src: activeRows[i], tgt: targets[i] });
        }
        
        let secretTargets = [];
        if (levelData.id >= 3) {
            let numSpecial = Math.random() < 0.5 ? 1 : 2; 
            numSpecial = Math.min(numSpecial, activeRows.length - 1);
            if (numSpecial > 0) {
                let shuffledTgt = [...activeRows].sort(() => Math.random() - 0.5);
                let specialRockets = shuffledTgt.slice(0, numSpecial);
                
                specialRockets.forEach(tgt => {
                    let origSrcObj = pathsToCarve.find(p => p.tgt === tgt);
                    if (!origSrcObj) return; 
                    
                    let possibleSrcs = activeRows.filter(r => r !== origSrcObj.src);
                    if (possibleSrcs.length > 0) {
                        let extraSrc = possibleSrcs[Math.floor(Math.random() * possibleSrcs.length)];
                        pathsToCarve.push({ src: extraSrc, tgt: tgt });
                        secretTargets.push(tgt);
                    }
                });
            }
        }
        
        let allPathsGood = true;
        
        for (let i = 0; i < pathsToCarve.length; i++) {
            let srcR = pathsToCarve[i].src;
            let tgtR = pathsToCarve[i].tgt;
            let currR = srcR;
            let turns = 0;
            let lastDir = 'right'; 
            
            for (let c = 0; c < CONFIG.cols; c++) {
                attemptGrid[currR][c].add('left');
                
                let nextR = currR;
                if (c < CONFIG.cols - 1) { 
                    if (c === CONFIG.cols - 2) {
                        nextR = tgtR;
                    } else {
                        if (Math.random() < 0.7) {
                            let diff = Math.floor(Math.random() * 5) - 2; 
                            nextR = currR + diff;
                            if (nextR < 0) nextR = 0;
                            if (nextR >= CONFIG.rows) nextR = CONFIG.rows - 1;
                        }
                    }
                } else {
                    nextR = currR; 
                }
                
                if (nextR === currR) {
                    attemptGrid[currR][c].add('right');
                    if (lastDir !== 'right') turns++;
                    lastDir = 'right';
                } else if (nextR > currR) {
                    if (lastDir !== 'bottom') turns++; 
                    lastDir = 'bottom';
                    
                    attemptGrid[currR][c].add('bottom');
                    for (let stepR = currR + 1; stepR < nextR; stepR++) {
                        attemptGrid[stepR][c].add('top');
                        attemptGrid[stepR][c].add('bottom');
                    }
                    attemptGrid[nextR][c].add('top');
                    
                    turns++; 
                    lastDir = 'right';
                    attemptGrid[nextR][c].add('right');
                } else {
                    if (lastDir !== 'top') turns++;
                    lastDir = 'top';
                    
                    attemptGrid[currR][c].add('top');
                    for (let stepR = currR - 1; stepR > nextR; stepR--) {
                        attemptGrid[stepR][c].add('bottom');
                        attemptGrid[stepR][c].add('top');
                    }
                    attemptGrid[nextR][c].add('bottom');
                    
                    turns++;
                    lastDir = 'right';
                    attemptGrid[nextR][c].add('right');
                }
                currR = nextR;
            }
            
            if (turns < 3) {
                allPathsGood = false;
                break;
            }
        }
        
        if (allPathsGood) {
            validBoard = true;
            bestPathGrid = attemptGrid;
            bestSecretTargets = secretTargets;
        }
    }

    if (!validBoard) {
        console.warn("Could not generate perfect board with >=3 turns, falling back to last attempt.");
    }

    for (let r = 0; r < CONFIG.rows; r++) {
        let hasEntity = r >= startRow;
        let special = (bestSecretTargets && bestSecretTargets.includes(r));
        gameState.sources.push({ row: r, active: hasEntity, lit: false, litRockets: [], color: SOURCE_COLORS[r] });
        gameState.rockets.push({ row: r, active: hasEntity, lit: false, isSpecial: special });
    }

    for (let r = 0; r < CONFIG.rows; r++) {
        for (let c = 0; c < CONFIG.cols; c++) {
            const dirs = Array.from(bestPathGrid[r][c]);
            let finalType = 'cross';
            
            if (dirs.length <= 1) {
                const rval = Math.random();
                if (rval < 0.3) finalType = 'straight';
                else if (rval < 0.6) finalType = 'corner';
                else if (rval < 0.8) finalType = 'tee';
                else if (rval < 0.9) finalType = 'cross';
                else finalType = 'bridge';
            } else if (dirs.length === 2) {
                if ((dirs.includes('left') && dirs.includes('right')) || 
                    (dirs.includes('top') && dirs.includes('bottom'))) {
                    finalType = 'straight';
                } else {
                    finalType = 'corner';
                }
            } else if (dirs.length === 3) {
                finalType = 'tee';
            } else if (dirs.length === 4) {
                finalType = 'bridge'; // Intersection of isolated carved paths creates a bridge!
            }
            
            const finalRot = [0, 90, 180, 270][Math.floor(Math.random() * 4)];

            gameState.grid.push({
                col: c,
                row: r,
                type: finalType,
                rotation: finalRot,
                connected: false,
                isSpecialTarget: false
            });
        }
    }
}

function renderGrid() {
    elSourcesCol.innerHTML = '';
    elRocketsCol.innerHTML = '';
    elGridBoard.innerHTML = '';
    
    for (let r = 0; r < CONFIG.rows; r++) {
        // Source
        const sDiv = document.createElement('div');
        sDiv.className = 'cell-entity source-icon';
        if (gameState.sources[r].active) {
            sDiv.textContent = '🔥';
            sDiv.style.background = `radial-gradient(circle, ${gameState.sources[r].color}60 0%, transparent 60%)`;
            sDiv.style.textShadow = `0 0 10px ${gameState.sources[r].color}`;
        }
        elSourcesCol.appendChild(sDiv);
        
        // Rocket
        const rDiv = document.createElement('div');
        let rClass = 'cell-entity rocket-icon';
        if (gameState.rockets[r].isSpecial && gameState.rockets[r].active) rClass += ' special';
        rDiv.className = rClass;
        rDiv.id = `rocket-${r}`;
        rDiv.textContent = gameState.rockets[r].active ? '🚀' : '';
        elRocketsCol.appendChild(rDiv);
    }
    
    gameState.grid.forEach((cell, idx) => {
        const cDiv = document.createElement('div');
        cDiv.className = `pipe-cell ${cell.connected ? 'connected' : ''}`;
        cDiv.dataset.idx = idx;
        
        // Render inner pipe shape
        const inner = document.createElement('div');
        inner.className = 'pipe-inner';
        inner.style.transform = `rotate(${cell.rotation}deg)`;
        
        if (cell.type === 'bridge') {
            inner.innerHTML += `<div class="pipe-part pipe-bridge-v"></div>`;
            inner.innerHTML += `<div class="pipe-part pipe-bridge-h"></div>`;
        } else if (cell.type === 'corner') {
            inner.innerHTML += `<div class="pipe-corner-tr pipe-part"></div>`;
        } else {
            // Base center block
            inner.innerHTML += `<div class="pipe-part pipe-center"></div>`;
            const openings = getOpenings(cell.type, 0); // Rendering uses rotation=0 layout, parent rotates
            openings.forEach(dir => {
                inner.innerHTML += `<div class="pipe-part pipe-arm-${dir}"></div>`;
            });
        }
        
        cDiv.appendChild(inner);
        
        cDiv.addEventListener('click', () => {
            if (!gameState.interactive) return;
            AudioEngine.playRotate();
            cell.rotation = (cell.rotation + 90) % 360;
            // Immediate partial update
            calculateConnections();
            updateGridDOM();
        });
        
        elGridBoard.appendChild(cDiv);
    });
}

function updateGridDOM() {
    // Only update classes and transforms instead of full re-render for performance
    gameState.grid.forEach((cell, idx) => {
        const cDiv = elGridBoard.children[idx];
        if (cell.connected) {
            cDiv.classList.add('connected');
            if (cell.activeColor) {
               cDiv.style.setProperty('--pipe-active-color', cell.activeColor);
            }
        } else {
            cDiv.classList.remove('connected');
            cDiv.style.removeProperty('--pipe-active-color');
        }
        
        cDiv.querySelector('.pipe-inner').style.transform = `rotate(${cell.rotation}deg)`;
    });
}

function getCell(col, row) {
    if (col < 0 || col >= CONFIG.cols || row < 0 || row >= CONFIG.rows) return null;
    return gameState.grid[row * CONFIG.cols + col];
}

function calculateConnections() {
    // Reset connections
    gameState.grid.forEach(c => c.connected = false);
    
    // Each source tracks which rockets it has reached
    gameState.sources.forEach(s => s.litRockets = []);
    
    // BFS from each active source
    for (let r = 0; r < CONFIG.rows; r++) {
        if (!gameState.sources[r].active) continue;
        
        let visited = new Set();
        let queue = [];
        
        // Start at col=-1, moving 'right' into col=0
        queue.push({ c: -1, r: r, reqDir: 'right' });
        
        while(queue.length > 0) {
            let curr = queue.shift();
            
            // Check if we hit the rocket column (col=6)
            if (curr.c === CONFIG.cols) {
                // Rocket reached at curr.r
                if (gameState.rockets[curr.r].active && !gameState.sources[r].litRockets.includes(curr.r)) {
                    gameState.sources[r].litRockets.push(curr.r);
                }
                continue;
            }
            
            if (curr.c >= 0 && curr.c < CONFIG.cols) {
                const cell = getCell(curr.c, curr.r);
                if (!cell) continue;
                
                const entryDir = getOppositeDir(curr.reqDir);
                const exits = getExits(cell.type, cell.rotation, entryDir);
                
                if (exits.length === 0) continue;
                
                cell.connected = true; // For visuals
                cell.activeColor = gameState.sources[r].color;
                
                // Add unvisited neighbors
                exits.forEach(outDir => {
                    const nextCoord = getNeighborCoords(curr.c, curr.r, outDir);
                    const key = `${curr.c},${curr.r},${outDir}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push({ c: nextCoord.c, r: nextCoord.r, reqDir: outDir });
                    }
                });
            } else if (curr.c === -1) {
                // Initial jump from source into grid col=0
                queue.push({ c: 0, r: curr.r, reqDir: 'right' });
            }
        }
    }
}

function createParticles(targetEl, type) {
    const rect = targetEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    const count = type === 'big' ? 100 : 20;
    const colors = ['#f87171', '#facc15', '#60a5fa', '#34d399', '#c084fc'];
    
    if (type === 'big') {
        for(let b=0; b<5; b++) {
            setTimeout(() => {
                const bx = Math.random() * window.innerWidth;
                const by = Math.random() * window.innerHeight;
                for (let i = 0; i < 30; i++) {
                    const p = document.createElement('div');
                    p.className = 'particle';
                    p.style.left = bx + 'px';
                    p.style.top = by + 'px';
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    p.style.background = color;
                    p.style.color = color;
                    document.body.appendChild(p);
                    
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 100 + 50;
                    const tx = Math.cos(angle) * speed;
                    const ty = Math.sin(angle) * speed;
                    
                    p.animate([
                        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
                    ], {
                        duration: 1000 + Math.random() * 500,
                        easing: 'cubic-bezier(0, .9, .57, 1)'
                    }).onfinish = () => p.remove();
                }
            }, b * 400);
        }
        return;
    }

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 50 + 20;
        
        let tx = Math.cos(angle) * speed;
        let ty = Math.sin(angle) * speed;
        
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        const color = colors[Math.floor(Math.random() * colors.length)];
        p.style.background = color;
        p.style.color = color;
        document.body.appendChild(p);
        
        p.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
        ], {
            duration: 800 + Math.random() * 400,
            easing: 'cubic-bezier(0, .9, .57, 1)'
        }).onfinish = () => p.remove();
    }
}

function animateFireWave(startRow, claimedRockets) {
    return new Promise(resolve => {
        let visited = new Set();
        let queue = [{ c: -1, r: startRow, reqDir: 'right', dist: 0 }];
        let waves = [];
        
        while(queue.length > 0) {
            let curr = queue.shift();
            
            if (curr.c === CONFIG.cols) {
                continue;
            }
            
            if (curr.c >= 0 && curr.c < CONFIG.cols) {
                const cell = getCell(curr.c, curr.r);
                if (!cell) continue;
                const entryDir = getOppositeDir(curr.reqDir);
                const exits = getExits(cell.type, cell.rotation, entryDir);
                if (exits.length === 0) continue;
                
                if (!waves[curr.dist]) waves[curr.dist] = [];
                if (!waves[curr.dist].includes(cell)) {
                    cell.activeColor = gameState.sources[startRow].color;
                    waves[curr.dist].push(cell);
                }
                
                exits.forEach(outDir => {
                    const nextCoord = getNeighborCoords(curr.c, curr.r, outDir);
                    const key = `${curr.c},${curr.r},${outDir}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push({ c: nextCoord.c, r: nextCoord.r, reqDir: outDir, dist: curr.dist + 1 });
                    }
                });
            } else if (curr.c === -1) {
                queue.push({ c: 0, r: curr.r, reqDir: 'right', dist: 1 });
            }
        }
        
        let step = 1;
        function playWave() {
            if (step >= waves.length) {
                resolve();
                return;
            }
            if (waves[step]) {
                AudioEngine.playWaveStep(step);
                waves[step].forEach(cell => {
                    cell.connected = true;
                });
                updateGridDOM(); 
            }
            step++;
            setTimeout(playWave, 80); 
        }
        playWave();
    });
}

async function triggerSettlement() {
    gameState.isPlaying = false;
    gameState.interactive = false;
    if (gameState.timerId) clearInterval(gameState.timerId);
    
    // Implement "Max grab" priority logic for rockets
    let rocketClaims = new Array(CONFIG.rows).fill(-1); // rocketId -> claimedBySourceRow
    
    // Create source pool
    let sourcePool = [];
    for (let r = CONFIG.rows - 1; r >= 0; r--) {
        if (gameState.sources[r].active) {
            sourcePool.push({
                row: r,
                candidateRockets: [...gameState.sources[r].litRockets]
            });
        }
    }
    
    // Sort sources by connected count DESC, then row DESC (bottom first)
    sourcePool.sort((a, b) => {
        if (b.candidateRockets.length !== a.candidateRockets.length) {
            return b.candidateRockets.length - a.candidateRockets.length;
        }
        return b.row - a.row; 
    });
    
    // Claiming
    sourcePool.forEach(sp => {
        sp.claimedRockets = [];
        sp.candidateRockets.forEach(rocketId => {
            if (rocketClaims[rocketId] === -1) {
                rocketClaims[rocketId] = sp.row;
                sp.claimedRockets.push(rocketId);
            }
        });
    });
    
    let details = "各火源得分：\n";
    let baseScore = 0;
    let litCount = 0;
    
    // Clear all grid highlights dynamically for animation 
    gameState.grid.forEach(c => c.connected = false);
    updateGridDOM();
    
    // Read out results bottom to top logically & animate
    for (let r = CONFIG.rows - 1; r >= 0; r--) {
        if (!gameState.sources[r].active) continue;
        
        const sp = sourcePool.find(s => s.row === r);
        const N = sp.claimedRockets.length;
        
        if (N > 0) {
            // Animate wave
            await animateFireWave(r, sp.claimedRockets);
            
            sp.claimedRockets.forEach(rid => {
                const rEl = document.getElementById(`rocket-${rid}`);
                if (rEl) {
                    rEl.classList.add('lit');
                    rEl.textContent = '🎆'; // Ignite!
                    AudioEngine.playSmallIgnite();
                    createParticles(rEl, 'small');
                    litCount++;
                }
            });
            
            let p = N * 100 * N;
            baseScore += p;
            details += `  火源${10-r}：连通${N}个火箭 -> ${p}分\n`;
            
            // Brief pause between sources fireworks
            await new Promise(res => setTimeout(res, 400));
        } else {
            details += `  火源${10-r}：连通0个火箭 -> 0分\n`;
        }
    }
    
    const timeBonus = gameState.remainingSeconds * gameState.levelId;
    const totalScore = baseScore + timeBonus;
    gameState.score = totalScore;
    
    details += `倍数奖励合计：${baseScore} 分\n`;
    details += `时间奖励：剩余${gameState.remainingSeconds}s × 第${gameState.levelId}关 = ${timeBonus} 分\n`;
    details += `──────────────────\n`;
    details += `总分：${totalScore} 分\n\n`;
    
    // Win condition for Phase 2 (Double-track logic)
    const levelData = LEVELS[gameState.levelId - 1];
    let isWin = false;
    let winReqStr = "";
    
    if (gameState.levelId <= 2) {
        const required = Math.ceil(levelData.rows * 0.6);
        isWin = (litCount >= required);
        winReqStr = `需点燃 ${required} 个火箭，当前点燃 ${litCount} 个`;
    } else {
        const requiredScore = levelData.rows * 100 * 1.3;
        isWin = (totalScore >= requiredScore);
        winReqStr = `需达到分数 ${requiredScore}，当前分数 ${totalScore}`;
    }
    
    gameState.isWin = isWin;
    const btnNext = document.getElementById('btn-next-action');
    
    if (isWin) {
        if (gameState.levelId === 10) {
            details += `[全收集通关！祝您新年快乐！] ${winReqStr}`;
            btnNext.textContent = '返回菜单';
            AudioEngine.playIgnite();
            createParticles(document.body, 'big');
        } else {
            details += `[过关！] ${winReqStr}`;
            btnNext.textContent = '进入下一关';
            if (gameState.levelId >= 3 && isWin) {
                 AudioEngine.playIgnite();
                 createParticles(document.body, 'big');
            }
        }
    } else {
        details += `[未过关，继续加油...] ${winReqStr}`;
        btnNext.textContent = '重玩本关';
    }
    
    elScore.textContent = totalScore;
    
    setTimeout(() => {
        elSettleDetails.textContent = details;
        elModal.classList.remove('hidden');
    }, 800); 
}

// --- Event Binding ---
document.getElementById('btn-start').addEventListener('click', () => {
    AudioEngine.init();
    elStartScreen.classList.remove('active');
    elGameScreen.classList.add('active');
    initLevel(LEVELS[0]); // Start from Level 1
});

const btnToggleMusic = document.getElementById('btn-toggle-music');
if (btnToggleMusic) {
    btnToggleMusic.addEventListener('click', () => {
        AudioEngine.toggle();
    });
}

document.getElementById('btn-restart').addEventListener('click', () => {
    initLevel(LEVELS[gameState.levelId - 1]);
});

document.getElementById('btn-ignite').addEventListener('click', () => {
    if (gameState.interactive) triggerSettlement();
});

document.getElementById('btn-menu').addEventListener('click', () => {
    elGameScreen.classList.remove('active');
    elStartScreen.classList.add('active');
    if (gameState.timerId) clearInterval(gameState.timerId);
    elModal.classList.add('hidden');
});

document.getElementById('btn-next-action').addEventListener('click', () => {
    elModal.classList.add('hidden');
    if (gameState.isWin) {
        if (gameState.levelId === 10) {
            // Return to menu
            elGameScreen.classList.remove('active');
            elStartScreen.classList.add('active');
        } else {
            // Next level
            initLevel(LEVELS[gameState.levelId]);
        }
    } else {
        // Retry current level
        initLevel(LEVELS[gameState.levelId - 1]);
    }
});

// Prevent scrolling on game area specifically
document.getElementById('game-area-container').addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });
