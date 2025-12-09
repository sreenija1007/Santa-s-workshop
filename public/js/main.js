// Check Auth
const userId = localStorage.getItem('userId');
if (!userId) {
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("🎅 Santa's Workshop Interface Loaded!");
    
    if (window.StoryManager) {
        window.storyManager = new StoryManager();
    }
    
    if (window.SantaPuzzle) {
        window.gameInstance = new SantaPuzzle(); 
    }
    
    // Update the Username in the Header
    const username = localStorage.getItem('username') || 'Guest';
    const userDisplay = document.getElementById('username-display');
    if (userDisplay) userDisplay.innerText = username;
});

// Global Power-up Handler
function usePowerUp(type) {
    alert(`Used power-up: ${type}. (Inventory Logic to be added in Phase 4)`);
}

// --- LOGOUT LOGIC ---
const logoutBtn = document.getElementById('logout-btn');

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        // 1. Clear the storage
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        
        // 2. Redirect to Login
        window.location.href = 'login.html';
    });
}

// --- BACKGROUND MUSIC MANAGER 
class AudioManager {
    constructor() {
        this.tracks = [
            // 1. LOCAL FILE (Best & Most Reliable)
            { name: "🎵 Jingle Bells", url: "/assets/jingle.mp3" }
        ]
        
        this.currentTrackIdx = 0;
        this.bgm = new Audio(this.tracks[0].url);
        this.bgm.loop = true; 
        this.bgm.volume = 0.3; 
        
        // UI Elements
        this.visualizer = document.querySelector('.visualizer-container');
        this.trackName = document.getElementById('track-name');
        this.playBtn = document.getElementById('play-btn');
        this.volumeSlider = document.getElementById('volume-slider');

        this.initEvents();
    }

    initEvents() {
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => {
                this.bgm.volume = e.target.value;
            });
        }
    }

    playBGM() {
        if(this.trackName) this.trackName.innerText = this.tracks[this.currentTrackIdx].name;
        if(this.playBtn) this.playBtn.innerText = "⏸️";
        if(this.visualizer) this.visualizer.classList.add('playing');
        
        this.bgm.play().catch(error => {
            console.log("Autoplay blocked. Click 'Start' or interacting with page will fix this.");
        });
    }

    stopBGM() {
        this.bgm.pause();
        this.bgm.currentTime = 0; 
        if(this.playBtn) this.playBtn.innerText = "▶️";
        if(this.visualizer) this.visualizer.classList.remove('playing');
    }

    nextTrack() {
        this.currentTrackIdx = (this.currentTrackIdx + 1) % this.tracks.length;
        this.changeSource();
    }
    
    togglePlay() {
        if (this.bgm.paused) this.playBGM();
        else this.bgm.pause();
    }

    changeSource() {
        const wasPlaying = !this.bgm.paused;
        this.bgm.src = this.tracks[this.currentTrackIdx].url;
        this.trackName.innerText = this.tracks[this.currentTrackIdx].name;
        if (wasPlaying) this.playBGM();
    }
}

// Initialize
window.audioManager = new AudioManager();

async function loadUserTheme() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
        const res = await fetch(`/api/preferences/${userId}`);
        const data = await res.json();
        applyTheme(data.theme);
        
        // Update dropdown if it exists
        const selector = document.getElementById('theme-selector');
        if (selector) selector.value = data.theme;
    } catch (err) {
        console.error("Theme load error:", err);
    }
}

function applyTheme(themeName) {
    // Remove old themes
    document.body.classList.remove('theme-santa', 'theme-frozen', 'theme-midnight');
    // Add new theme
    document.body.classList.add(`theme-${themeName}`);
}

async function changeTheme(newTheme) {
    applyTheme(newTheme);
    const userId = localStorage.getItem('userId');
    
    // Save to DB
    await fetch('/api/preferences/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, theme: newTheme })
    });
}

// Call this on load
document.addEventListener('DOMContentLoaded', loadUserTheme);

// A. Load Achievements UI
async function loadAchievements() {
    const userId = localStorage.getItem('userId');
    const gallery = document.getElementById('gift-gallery');
    if (!userId || !gallery) return;

    try {
        const res = await fetch(`/api/achievements/${userId}`);
        const data = await res.json();
        
        gallery.innerHTML = ''; 

        data.forEach(ach => {
            const card = document.createElement('div');
            // If locked, show lock icon, else show real icon
            const icon = ach.is_unlocked ? ach.icon_url : '🔒'; 
            const statusClass = ach.is_unlocked ? 'unlocked' : 'locked';
            
            card.className = `achievement-card ${statusClass}`;
            card.setAttribute('data-desc', ach.description); // For CSS Tooltip
            
            card.innerHTML = `
                <span class="achievement-icon">${icon}</span>
                <span style="font-size: 0.7rem; font-weight: bold;">${ach.name}</span>
            `;
            gallery.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to load achievements", err);
    }
}

// B. Show Popup (Call this when game ends)
function showUnlockNotification(achievementName, icon) {
    let container = document.getElementById('toast-container');
    
    // Create container if it doesn't exist
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div style="font-size: 2rem;">${icon}</div>
        <div>
            <h4 style="margin:0; color: var(--primary-color)">Achievement Unlocked!</h4>
            <p style="margin:0; font-size: 0.9rem;">${achievementName}</p>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Remove from DOM after animation (5s)
    setTimeout(() => { toast.remove(); }, 5000);
}

// Add to startup
document.addEventListener('DOMContentLoaded', () => {
    loadAchievements();
});

async function loadLeaderboard(type = 'global') {
    const listEl = document.getElementById('leaderboard-list');
    const friendUI = document.getElementById('friend-add-ui');
    const requestListEl = document.getElementById('requests-list'); // Needs HTML
    const userId = localStorage.getItem('userId');
    
    if (!listEl) return;
    listEl.innerHTML = '<li style="color:#999">Loading...</li>';

    try {
        // 1. Setup UI based on Tab
        if (type === 'friends') {
            friendUI.style.display = 'flex';
            // Load Requests only when on Friends tab
            loadFriendRequests();
        } else {
            friendUI.style.display = 'none';
            if(requestListEl) requestListEl.innerHTML = ''; // Clear requests when not looking
        }

        // 2. Fetch Leaderboard Data
        let url = type === 'friends' ? `/api/friends/leaderboard/${userId}` : '/api/leaderboard';
        const res = await fetch(url);
        const players = await res.json();
        
        // 3. Render Leaderboard
        listEl.innerHTML = '';
        if(players.length === 0) {
            listEl.innerHTML = '<li>No friends yet! Send a request above.</li>';
            return;
        }

        players.forEach((p, index) => {
            const li = document.createElement('li');
            const isMe = p.username === localStorage.getItem('username');
            const bg = isMe ? 'background:rgba(255,215,0,0.1);' : '';
            
            let rank = `#${index + 1}`;
            if (index === 0) rank = "🥇";
            if (index === 1) rank = "🥈";
            if (index === 2) rank = "🥉";

            li.style.cssText = `margin-bottom:8px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; padding:2px; ${bg}`;
            li.innerHTML = `
                <span>${rank} <strong>${p.username}</strong></span>
                <span style="color: var(--accent-gold); font-weight:bold;">${p.magic_dust} ✨</span>
            `;
            listEl.appendChild(li);
        });
    } catch (err) { console.error("Leaderboard error", err); }
}

async function loadFriendRequests() {
    const userId = localStorage.getItem('userId');
    const listEl = document.getElementById('requests-list');
    if (!listEl) return;

    const res = await fetch(`/api/friends/requests/${userId}`);
    const requests = await res.json();
    
    listEl.innerHTML = '';
    
    if (requests.length > 0) {
        requests.forEach(req => {
            const div = document.createElement('div');
            div.style.cssText = "background:#e8f5e9; padding:5px; margin-bottom:5px; border-radius:4px; font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;";
            div.innerHTML = `
                <span>📩 <strong>${req.username}</strong> wants to connect!</span>
                <button onclick="acceptFriend(${req.user_id})" style="background:var(--secondary-color); color:white; border:none; border-radius:3px; cursor:pointer;">Accept</button>
            `;
            listEl.appendChild(div);
        });
    }
}

async function sendFriendRequest() {
    const input = document.getElementById('friend-input');
    const name = input.value.trim();
    const userId = localStorage.getItem('userId');
    if (!name) return;

    try {
        const res = await fetch('/api/friends/request', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId, friendName: name })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if(data.success) input.value = '';
    } catch (err) { alert("Error sending request"); }
}

async function acceptFriend(requesterId) {
    const userId = localStorage.getItem('userId');
    try {
        const res = await fetch('/api/friends/accept', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId, requesterId })
        });
        const data = await res.json();
        if (data.success) {
            alert("Friend Accepted!");
            loadLeaderboard('friends'); // Refresh list
        }
    } catch (err) { alert("Error accepting"); }
}

 window.switchTab = function(tabName) {
    const historyList = document.getElementById('history-list');
    const leaderContainer = document.getElementById('leaderboard-container');
    const tabMe = document.getElementById('tab-me');
    const tabTop = document.getElementById('tab-top');
    const tabFriends = document.getElementById('tab-friends');
    
    // Safety Check: If HTML is missing, stop to prevent errors
    if (!historyList || !leaderContainer || !tabMe || !tabTop || !tabFriends) {
        console.error("❌ Tab elements missing! Check index.html IDs.");
        return;
    }

    // 1. Reset all buttons to gray
    tabMe.style.color = '#666';
    tabTop.style.color = '#666';
    tabFriends.style.color = '#666';

    // 2. Hide everything first
    historyList.style.display = 'none';
    leaderContainer.style.display = 'none';

    // 3. Activate the specific tab
    if (tabName === 'history') {
        tabMe.style.color = 'var(--primary-color)'; // Highlight "Me"
        historyList.style.display = 'block';
        if(window.gameInstance) window.gameInstance.loadGameHistory();
    } 
    else if (tabName === 'leaderboard') {
        tabTop.style.color = 'var(--primary-color)'; // Highlight "Global"
        leaderContainer.style.display = 'block';
        loadLeaderboard('global');
    }
    else if (tabName === 'friends') {
        tabFriends.style.color = 'var(--primary-color)'; // Highlight "Friends"
        leaderContainer.style.display = 'block';
        loadLeaderboard('friends');
    }
};

// Challenge Feature (Copy to Clipboard)
window.shareChallenge = function(moves, time) {
    const text = `🎄 I just solved the Santa Puzzle in ${time}s and ${moves} moves! Can you beat me? #SantasWorkshop`;
    navigator.clipboard.writeText(text).then(() => {
        if(window.showUnlockNotification) window.showUnlockNotification("Challenge Copied!", "📋");
        else alert("Copied to clipboard!");
    });
};

// Initialize Global Audio Manager
const audioManager = new AudioManager();