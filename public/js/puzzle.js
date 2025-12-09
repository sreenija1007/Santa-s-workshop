// Time Limits in Seconds
const TIME_LIMITS = {
    3: 120,   // 3x3: 2 Minutes
    4: 300,   // 4x4: 5 Minutes
    6: 600,   // 6x6: 10 Minutes
    8: 900,   // 8x8: 15 Minutes
    10: 1200  // 10x10: 20 Minutes
};
class SantaPuzzle {
    constructor() {
        this.gridSize = 4;
        this.tiles = [];
        this.emptyIndex = 15;
        this.isGameActive = false;
        this.winAudio = null;
        
        // Grab elements
        this.gridEl = document.getElementById('puzzle-grid');
        this.timerEl = document.getElementById('timer');
        this.startBtn = document.getElementById('start-btn');
        this.diffSelect = document.getElementById('difficulty-select');

        // Check if elements exist
        if (!this.gridEl) console.error("❌ Error: Grid missing");
        if (!this.diffSelect) console.error("❌ Error: Dropdown missing");

        // Run Init
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log("🎅 Puzzle Engine Starting...");
        
        if (this.startBtn) {
            const newBtn = this.startBtn.cloneNode(true);
            this.startBtn.parentNode.replaceChild(newBtn, this.startBtn);
            this.startBtn = newBtn;
            this.startBtn.addEventListener('click', () => this.startGame());
        }

        // 1. Load saved difficulty
        const savedDiff = localStorage.getItem('lastDifficulty');
        if (this.diffSelect && savedDiff) {
            this.diffSelect.value = savedDiff;
        }

        // 2. Listen for changes
        if (this.diffSelect) {
            this.diffSelect.addEventListener('change', () => {
                localStorage.setItem('lastDifficulty', this.diffSelect.value);
                this.updatePredictions();
                
                // --- Update Grid & Timer Immediately ---
                if (!this.isGameActive) {
                    this.updateTimerPreview();

                    // 1. Get new size
                    const val = parseInt(this.diffSelect.value);
                    this.gridSize = (isNaN(val) || val < 3) ? 4 : val;

                    // 2. Reset data to "Solved" state
                    this.resetData(this.gridSize);

                    // 3. Redraw the grid visually
                    this.updateGridCSS();
                    this.render();
                }
            });
        }

        this.cachedStats = {}; 
        this.loadUserStats();
        this.loadGameHistory();

        // Initial Load
        this.gridSize = savedDiff ? parseInt(savedDiff) : 4;
        this.resetData(this.gridSize);
        this.updateGridCSS();
        this.updateTimerPreview();
        this.render();
    }

    startGame() {
        // 1. Stop Victory Sound if playing
        if (this.winAudio) {
            this.winAudio.pause();
            this.winAudio.currentTime = 0;
        }

        // 2. START BACKGROUND RADIO 🎵
        if (window.audioManager) {
            window.audioManager.playBGM();
        }

        if (this.isGameActive) { this.saveGameSession(false); }

        // ... rest of start logic (grid setup, timer, etc) ...
        
        const val = this.diffSelect ? parseInt(this.diffSelect.value) : 4;
        this.gridSize = (isNaN(val) || val < 3) ? 4 : val;
        
        this.resetData(this.gridSize);
        this.isGameActive = true;
        this.moveCount = 0;
        this.totalTime = TIME_LIMITS[this.gridSize] || 300; 
        this.timeLeft = this.totalTime;

        this.resetTimer();
        this.updateGridCSS();
        this.shuffleBoard();
        this.startTimer();
        
        this.startBtn.textContent = "Restart Game";
    }

    resetData(size) {
        // Add this inside gameWon() and resetData()
        document.body.classList.remove('state-panic');
        const tileCount = (size * size) - 1;
        this.tiles = Array.from({length: tileCount}, (_, i) => i + 1).concat([0]);
        this.emptyIndex = tileCount;
    }

    updateGridCSS() {
        if (!this.gridEl) return;
        
        this.gridEl.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;
        this.gridEl.style.gridTemplateRows = `repeat(${this.gridSize}, 1fr)`;
        this.gridEl.style.fontSize = this.gridSize > 6 ? '0.9rem' : '1.5rem';

        // Pass the grid size to CSS so it can calculate image scale
        this.gridEl.style.setProperty('--grid-size', this.gridSize);
    }
    
    render() {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = ''; 

        // Identify which tiles can move
        const neighbors = this.isGameActive ? this.getNeighbors(this.emptyIndex) : [];

        this.tiles.forEach((tileNum, index) => {
            const tileEl = document.createElement('div');
            
            // Base Class
            let className = tileNum === 0 ? 'tile empty' : 'tile';
            if (neighbors.includes(index) && tileNum !== 0) {
                className += ' movable';
            }
            tileEl.className = className;

            if (tileNum !== 0) {
                tileEl.textContent = tileNum;
                // We calculate position based on the tile's ORIGINAL number (tileNum - 1)
                // This ensures the image slice stays with the tile as it moves.
                const originalRow = Math.floor((tileNum - 1) / this.gridSize);
                const originalCol = (tileNum - 1) % this.gridSize;

                const percentX = originalCol * 100 / (this.gridSize - 1);
                const percentY = originalRow * 100 / (this.gridSize - 1);

                tileEl.style.backgroundPosition = `${percentX}% ${percentY}%`;

                tileEl.addEventListener('click', () => this.handleTileClick(index));
            }
            this.gridEl.appendChild(tileEl);
        });
    }

    // Updates timer text based on selected difficulty
    updateTimerPreview() {
        if (!this.diffSelect || !this.timerEl) return;
        
        const val = parseInt(this.diffSelect.value);
        const size = (isNaN(val) || val < 3) ? 4 : val;
        
        // Use the global TIME_LIMITS object we added earlier
        const limit = TIME_LIMITS[size] || 300; 

        const mins = String(Math.floor(limit / 60)).padStart(2, '0');
        const secs = String(limit % 60).padStart(2, '0');
        
        this.timerEl.textContent = `${mins}:${secs}`;
        this.timerEl.style.color = ""; // Reset color
    }

    startTimer() {
        console.log("⏰ Timer Started");
        this.startTime = Date.now();
        
        // --- Update Display IMMEDIATELY (Don't wait 1 second) ---
        const updateDisplay = () => {
            const mins = String(Math.floor(this.timeLeft / 60)).padStart(2, '0');
            const secs = String(this.timeLeft % 60).padStart(2, '0');
            
            if (this.timerEl) {
                this.timerEl.textContent = `${mins}:${secs}`;
                // Turn red if low on time
                this.timerEl.style.color = this.timeLeft < 30 ? "red" : ""; 
            }
        };
        
        // Run once right now!
        updateDisplay(); 
        
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            // 1. Decrease Time
            this.timeLeft--;

            // 2. Check for "Time Run Out" (LOSS)
            if (this.timeLeft <= 0) {
                this.handleGameOver("Time Run Out! ⏳");
                return;
            }

            // 3. Visuals: Panic Mode if < 30 seconds left
            if (this.timeLeft <= 30 && !document.body.classList.contains('state-panic')) {
                document.body.classList.add('state-panic');
            }

            // 4. Update Display using the helper
            updateDisplay();

        }, 1000);
    }

    resetTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.updateTimerPreview();
        
        document.body.classList.remove('state-panic');
    }

    async shuffleBoard() {
        console.log("🔀 Shuffling...");
        const shuffleMoves = this.gridSize === 3 ? 20 : (this.gridSize * 15);
        for (let i = 0; i < shuffleMoves; i++) {
            const neighbors = this.getNeighbors(this.emptyIndex);
            const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
            this.swap(randomNeighbor, this.emptyIndex);
            this.emptyIndex = randomNeighbor;
        }
        this.render();
    }

    getNeighbors(index) {
        const neighbors = [];
        const size = this.gridSize; 
        const row = Math.floor(index / size);
        const col = index % size;
        if (row > 0) neighbors.push(index - size); 
        if (row < size - 1) neighbors.push(index + size); 
        if (col > 0) neighbors.push(index - 1); 
        if (col < size - 1) neighbors.push(index + 1); 
        return neighbors;
    }

    handleTileClick(index) {
        if (!this.isGameActive) return;
        const neighbors = this.getNeighbors(this.emptyIndex);
        if (neighbors.includes(index)) {
            this.swap(index, this.emptyIndex);
            this.emptyIndex = index;
            this.moveCount++;
            this.render();
            this.checkWin();
        }
    }

    swap(i, j) {
        [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }

    checkWin() {
        const tileCount = (this.gridSize * this.gridSize) - 1;
        const isSolved = this.tiles.every((val, index) => {
            if (index === tileCount) return val === 0;
            return val === index + 1;
        });
        if (isSolved) this.gameWon();
    }

    gameWon() {
        this.isGameActive = false;
        clearInterval(this.timerInterval);
        document.body.classList.remove('state-panic');
        
        // 1. STOP RADIO 🎵
        if (window.audioManager) {
            window.audioManager.stopBGM();
        }

        // 2. PLAY VICTORY SOUND 🎉
        if (!this.winAudio) {
            this.winAudio = new Audio('/assets/success.mp3')
        }
        this.winAudio.play().catch(e => console.log("Audio requires interaction"));
        
        this.timerEl.innerHTML = `<span style="color: #165b33; font-size: 1.2rem;">🏆 You won in ${this.moveCount} moves!</span>`;
        this.saveGameSession(true);
        
        const shareBtn = document.createElement('button');
        shareBtn.className = 'btn-primary';
        shareBtn.style.marginTop = "10px";
        shareBtn.innerHTML = "🔗 Challenge a Friend";
        shareBtn.onclick = () => {
             if (window.openChallengeModal) {
                const sMap = {3:"Easy (3x3)", 4:"Classic (4x4)", 6:"Hard (6x6)", 8:"Expert (8x8)", 10:"Santa (10x10)"};
                const diffLabel = sMap[this.gridSize] || "Custom";
                window.openChallengeModal(this.moveCount, Math.floor((Date.now() - this.startTime) / 1000), diffLabel);
            }
        };
        this.gridEl.parentNode.insertBefore(shareBtn, this.gridEl);
        setTimeout(() => shareBtn.remove(), 10000);
    }

    // --- API CALLS ---
    async loadUserStats() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) return; 

            const response = await fetch(`/api/analytics/${userId}`); 
            const data = await response.json();

            // 1. Update Header Info
            if (data.magic_dust !== undefined) document.getElementById('dust-count').innerText = data.magic_dust;
            if (data.username && document.getElementById('username-display')) {
                // Add Skill Title if available
                const title = data.title ? ` (${data.title})` : '';
                document.getElementById('username-display').innerText = data.username + title;
            }

            // 2. Store Stats for Predictive Logic
            this.cachedStats = data.stats || {};
            this.recommendedLevel = data.recommendation;

            // 3. Run Prediction
            this.updatePredictions();

            // 4. Smart Suggestion Popup (Only once per session)
            if (!sessionStorage.getItem('suggestionShown') && this.recommendedLevel) {
                const currentVal = this.diffSelect ? this.diffSelect.value : "4";
                
                if (parseInt(this.recommendedLevel) > parseInt(currentVal)) {
                    if(window.showUnlockNotification) window.showUnlockNotification("💡 Try the next level! You're ready.", "📈");
                }
                sessionStorage.setItem('suggestionShown', 'true');
            }

        } catch (err) { console.error("Stats Error", err); }
    }

    updatePredictions() {
        const predTimeEl = document.getElementById('predicted-time');
        const winChanceEl = document.getElementById('win-chance');
        
        if (!this.diffSelect || !this.cachedStats) return;

        const selectedSize = this.diffSelect.value; // "3", "4", "6", etc.
        const stat = this.cachedStats[selectedSize];

        if (stat) {
            // Known Data
            if (predTimeEl) predTimeEl.innerText = `${stat.avgTime}s`;
            
            // Color code the win chance
            let color = "#d42426"; // Red (Low)
            if (stat.winRate > 50) color = "orange";
            if (stat.winRate > 80) color = "#165b33"; // Green (High)
            
            if (winChanceEl) {
                winChanceEl.innerText = `${stat.winRate}%`;
                winChanceEl.style.color = color;
                winChanceEl.style.fontWeight = "bold";
            }
        } else {
            // No Data (Prediction based on heuristics)
            // E.g., if you haven't played 6x6, assume it takes 4x longer than 4x4
            if (predTimeEl) predTimeEl.innerText = "Unknown";
            if (winChanceEl) {
                winChanceEl.innerText = "???";
                winChanceEl.style.color = "#666";
            }
        }
    }

    async loadGameHistory() {
        const userId = localStorage.getItem('userId');
        const listEl = document.getElementById('history-list');
        if(!listEl) return;
        try {
            const res = await fetch(`/api/history/${userId}`);
            const games = await res.json();
            listEl.innerHTML = ''; 
            if (games.length === 0) { listEl.innerHTML = '<li style="color:#999">No games played yet.</li>'; return; }
            games.forEach(game => {
                const li = document.createElement('li');
                li.style.marginBottom = "8px"; li.style.borderBottom = "1px solid #eee"; li.style.paddingBottom = "4px";
                const dateObj = new Date(game.played_at);
                const dateStr = dateObj.toLocaleDateString();
                const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const icon = game.is_won ? "✅" : "❌";
                li.innerHTML = `<div style="display:flex; justify-content:space-between;"><strong>${icon} ${game.is_won ? "Won" : "Lost"}</strong><span style="font-size:0.75rem; color:#888;">${dateStr} ${timeStr}</span></div><div style="font-size:0.85rem; color:#555;">${game.difficulty_level} • ${game.time_taken_seconds}s • ${game.moves_count} moves</div>`;
                listEl.appendChild(li);
            });
        } catch (err) { console.error("History Error", err); }
    }
    async saveGameSession(isVictory = true) {
        const userId = localStorage.getItem('userId');
        const sMap = {3:"Easy (3x3)", 4:"Classic (4x4)", 6:"Hard (6x6)", 8:"Expert (8x8)", 10:"Santa (10x10)"};
        const diffLabel = sMap[this.gridSize] || "Custom";

        // Capture stats BEFORE they get reset
        const timeSpent = Math.floor((Date.now() - this.startTime) / 1000);
        
        // Don't save if game was barely started (< 1 second)
        if (timeSpent < 1) return;

        const payload = {
            userId: userId,
            difficulty: diffLabel, 
            moves: this.moveCount,
            time: timeSpent,
            isWon: isVictory // True for Win, False for Quit/Restart
        };

        try {
            const response = await fetch('/api/game/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            
            // 1. Update Dust (Only happens on Win)
            if (data.dustEarned !== undefined) {
                const currentDust = parseInt(document.getElementById('dust-count').innerText) || 0;
                document.getElementById('dust-count').innerText = currentDust + data.dustEarned;
            }

            // 2. Handle Achievements (Only happens on Win)
            if (data.newUnlocks && data.newUnlocks.length > 0) {
                data.newUnlocks.forEach(ach => {
                    if (window.showUnlockNotification) {
                        window.showUnlockNotification(ach.name, ach.icon_url);
                    }
                });
                if (window.loadAchievements) window.loadAchievements();
            }

            // 3. Update UI (Always update stats)
            this.loadUserStats(); 
            this.loadGameHistory(); 
            
            // 4. Update Story (Only on Win)
            if (isVictory && window.storyManager) window.storyManager.updateStory(payload.time);


        } catch (err) { console.error("Failed to save game:", err); }
    }

    // --- POWER UP LOGIC ---
    async spendDust(cost) {
        const userId = localStorage.getItem('userId');
        try {
            const response = await fetch('/api/powerup/buy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, cost: cost }) 
            });
            const data = await response.json();
            
            if (data.success) {
                // Update UI
                document.getElementById('dust-count').innerText = data.newBalance;
                return true;
            } else {
                // Use the Toast Notification for errors too!
                if (window.showUnlockNotification) {
                    window.showUnlockNotification("Need more Dust!", "🚫");
                } else {
                    alert("Not enough Magic Dust!");
                }
                return false;
            }
        } catch (err) { return false; }
    }

    async activateFreeze() {
        if (!this.isGameActive) return;
        
        if (await this.spendDust(50)) {
            // Logic: Stop timer logic temporarily
            clearInterval(this.timerInterval);
            this.timerEl.style.color = "#3498db"; // Ice Blue
            this.timerEl.style.textShadow = "0 0 10px #3498db";
            
            // Visual Feedback
            if(window.showUnlockNotification) window.showUnlockNotification("Time Frozen!", "❄️");

            // Resume after 10 seconds
            setTimeout(() => { 
                if (this.isGameActive) { 
                    this.startTimer(); 
                    this.timerEl.style.color = ""; 
                    this.timerEl.style.textShadow = "";
                } 
            }, 10000);
        }
    }

    async activateHint() {
        if (!this.isGameActive) return;
        
        if (await this.spendDust(30)) {
            // Logic: Highlight a valid neighbor
            const neighbors = this.getNeighbors(this.emptyIndex);
            // Pick the first valid move (simple hint)
            const tileIndex = neighbors[0]; 
            const tile = this.gridEl.children[tileIndex];
            
            if (tile) {
                tile.classList.add('hint-glow');
                if(window.showUnlockNotification) window.showUnlockNotification("Tile Revealed!", "💡");
                
                // Remove glow after 2 seconds
                setTimeout(() => tile.classList.remove('hint-glow'), 2000);
            }
        }
    }
    
    async activatePreview() {
        if (!this.isGameActive) return;

        if (await this.spendDust(75)) {
            // 1. Save current state
            const currentTiles = [...this.tiles];
            
            // 2. Create solved state
            const tileCount = (this.gridSize * this.gridSize) - 1;
            this.tiles = Array.from({length: tileCount}, (_, i) => i + 1).concat([0]);
            
            // 3. VISUALS: Add the specific class for the "Golden" look
            this.gridEl.classList.add('golden-preview'); 
            this.render(); // Redraw the grid with solved numbers
            
            if(window.showUnlockNotification) window.showUnlockNotification("Golden Peek!", "🌟");

            // 4. Revert after 3 seconds
            setTimeout(() => {
                this.tiles = currentTiles;
                this.gridEl.classList.remove('golden-preview'); // Remove class
                this.render(); // Redraw original messy state
            }, 3000);
        }
    }

    handleGameOver(reason) {
        this.isGameActive = false;
        clearInterval(this.timerInterval);
        document.body.classList.remove('state-panic');

        // STOP RADIO ON LOSS TOO 🎵
        if (window.audioManager) {
            window.audioManager.stopBGM();
        }

        this.timerEl.textContent = "00:00";
        this.gridEl.style.opacity = "0.5";
        
        if(window.showUnlockNotification) window.showUnlockNotification(reason, "💀");
        else alert(reason);

        this.saveGameSession(false);
        this.startBtn.textContent = "Try Again";
    }
}


if (!window.gameInstance) {
    window.gameInstance = new SantaPuzzle();
}