const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const path = require('path'); 
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, '../public')));

// --- API ROUTES ---
// 1. Predictive Analytics & User Stats (Advanced)
app.get('/api/analytics/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // A. Get User Profile (Dust & Name)
        const [user] = await db.execute('SELECT magic_dust, username FROM users WHERE id = ?', [userId]);

        // B. Get Stats Grouped by Difficulty
        const [stats] = await db.execute(
            `SELECT difficulty_level, 
                    COUNT(*) as total_played, 
                    SUM(is_won) as wins, 
                    AVG(time_taken_seconds) as avg_time 
             FROM game_sessions 
             WHERE user_id = ? 
             GROUP BY difficulty_level`, 
            [userId]
        );

        // C. Generate "Smart Recommendation"
        // Default recommendation
        let recommendation = "4"; // Classic
        let skillTitle = "Novice Elf";

        // Analyze 4x4 stats (Classic)
        const classicStats = stats.find(s => s.difficulty_level.includes('4x4'));
        if (classicStats) {
            const winRate = classicStats.wins / classicStats.total_played;
            if (winRate > 0.8 && classicStats.avg_time < 60) {
                recommendation = "6"; // Suggest Hard
                skillTitle = "Master Builder";
            } else if (winRate < 0.3) {
                recommendation = "3"; // Suggest Easy
                skillTitle = "Apprentice";
            } else {
                skillTitle = "Workshop Regular";
            }
        }

        // Send structured data map
        const statsMap = {};
        stats.forEach(s => {
            let key = "4"; 
            if (s.difficulty_level.includes("3x3")) key = "3";
            if (s.difficulty_level.includes("6x6")) key = "6";
            if (s.difficulty_level.includes("8x8")) key = "8";
            if (s.difficulty_level.includes("10x10")) key = "10";
            
            statsMap[key] = {
                avgTime: Math.round(s.avg_time),
                winRate: Math.round((s.wins / s.total_played) * 100),
                total: s.total_played
            };
        });

        res.json({
            username: user[0] ? user[0].username : 'Guest',
            magic_dust: user[0] ? user[0].magic_dust : 0,
            stats: statsMap,
            recommendation: recommendation,
            title: skillTitle
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Save Game Session & CHECK ACHIEVEMENTS
app.post('/api/game/save', async (req, res) => {
    const { userId, difficulty, moves, time, isWon } = req.body;
    const connection = await db.getConnection(); 
    
    try {
        await connection.beginTransaction();

        // A. Save the Game
        await connection.execute(
            'INSERT INTO game_sessions (user_id, difficulty_level, moves_count, time_taken_seconds, is_won) VALUES (?, ?, ?, ?, ?)',
            [userId, difficulty, moves, time, isWon]
        );
        
        // B. Update Dust
        let dustEarned = 0;
        if (isWon) {
            dustEarned = Math.max(10, 50 - Math.floor(time / 10)); 
            await connection.execute('UPDATE users SET magic_dust = magic_dust + ? WHERE id = ?', [dustEarned, userId]);
        }

        // C. CHECK ACHIEVEMENTS 
        const newUnlocks = [];

        // Helper to unlock
        const checkAndUnlock = async (achievId) => {
            const [rows] = await connection.execute(
                'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?', 
                [userId, achievId]
            );
            if (rows.length === 0) {
                await connection.execute(
                    'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
                    [userId, achievId]
                );
                // Get name for the frontend popup
                const [ach] = await connection.execute('SELECT name, icon_url FROM achievements WHERE id = ?', [achievId]);
                newUnlocks.push(ach[0]);
            }
        };

        if (isWon) {

            const [winStats] = await connection.execute('SELECT COUNT(*) as wins FROM game_sessions WHERE user_id = ? AND is_won = 1', [userId]);
            if (winStats[0].wins >= 1) await checkAndUnlock(4);
            // ID 1: Speed Sleigh (Under 60s)
            if (time < 60) await checkAndUnlock(1);
            
            // ID 3: Santa Master (10x10 Grid) - Check your difficulty string matches exactly!
            if (difficulty.includes("10x10")) await checkAndUnlock(3);

            // ID 2: Magic Hoarder (Check Total Dust)
            const [userRow] = await connection.execute('SELECT magic_dust FROM users WHERE id = ?', [userId]);
            if (userRow[0].magic_dust >= 500) await checkAndUnlock(2);
        }

        await connection.commit();
        
        res.json({ message: "Game Saved", dustEarned, newUnlocks });

    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// User's Trophy Cabinet
app.get('/api/achievements/:userId', async (req, res) => {
    try {
        // Left Join to see what is unlocked vs locked
        const sql = `
            SELECT a.id, a.name, a.description, a.icon_url, 
            CASE WHEN ua.unlocked_at IS NOT NULL THEN 1 ELSE 0 END as is_unlocked
            FROM achievements a
            LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
        `;
        const [rows] = await db.execute(sql, [req.params.userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Buy Power-up
app.post('/api/powerup/buy', async (req, res) => {
    const { userId, cost } = req.body;
    try {
        const [users] = await db.execute('SELECT magic_dust FROM users WHERE id = ?', [userId]);
        const currentDust = users[0].magic_dust;

        if (currentDust >= cost) {
            await db.execute('UPDATE users SET magic_dust = magic_dust - ? WHERE id = ?', [cost, userId]);
            res.json({ success: true, newBalance: currentDust - cost });
        } else {
            res.json({ success: false, message: "Not enough Magic Dust!" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Interactive Story Progression 
app.post('/api/story/update', async (req, res) => {
    const { userId, timeTaken, choiceMade } = req.body;
    console.log(`📖 Story Req: Choice=${choiceMade}, Time=${timeTaken}`);

    try {
        const [rows] = await db.execute('SELECT * FROM story_progress WHERE user_id = ?', [userId]);
        
        let currentChapter = rows[0] ? rows[0].current_chapter : 1;
        let storyText = "";
        let choices = null; 
        let newDifficulty = null; 
        let shouldUpdateDb = false;

        // ---------------------------------------------------------
        // PRIORITY 1: HANDLE USER CHOICE (Transition from Ch 1 -> 2)
        // ---------------------------------------------------------
        if (choiceMade && currentChapter === 1) {
            if (choiceMade === "hard_mode") {
                storyText = "⚠️ TURBULENCE! You climbed above the storm. The sleigh is shaking! Stabilize the cargo!";
                newDifficulty = 6;
                currentChapter = 2;
                shouldUpdateDb = true;
            } 
            else if (choiceMade === "easy_mode") {
                storyText = "You steered around the storm. Smooth sailing, but we lost time. Perform a quick check.";
                newDifficulty = 3;
                currentChapter = 2;
                shouldUpdateDb = true;
            }
        }

        // ---------------------------------------------------------
        // PRIORITY 2: STATUS CHECKS (If no choice was just made)
        // ---------------------------------------------------------
        
        // --- CHAPTER 1 STATUS ---
        else if (currentChapter === 1) {
            // Any update here means they won a game, so trigger the Blizzard
            storyText = "The engine is running, but a massive BLIZZARD is approaching on the radar! What should we do?";
            choices = [
                { text: "Fly Above (Risk It!)", action: "hard_mode", nextChapter: 2 },
                { text: "Go Around (Play Safe)", action: "easy_mode", nextChapter: 2 }
            ];
        } 
        
        // --- CHAPTER 2 STATUS (Transition Ch 2 -> 3) ---
        else if (currentChapter === 2) {
             // If we are here, it means they just beat the Ch 2 puzzle
             storyText = "🎄 SUCCESS! You stabilized the sleigh and delivered the presents! You are a Hero of the Workshop.";
             currentChapter = 3;
             shouldUpdateDb = true;
        }

        // --- DATABASE SAVE ---
        if (shouldUpdateDb || rows.length === 0) {
            await db.execute(
                'INSERT INTO story_progress (user_id, current_chapter) VALUES (?, ?) ON DUPLICATE KEY UPDATE current_chapter = ?', 
                [userId, currentChapter, currentChapter]
            );
        }

        res.json({ chapter: currentChapter, text: storyText, choices, newDifficulty });
    } catch (err) {
        console.error("Story Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 5. GET STORY STATUS (Fixes page load text)
app.get('/api/story/:userId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM story_progress WHERE user_id = ?', [req.params.userId]);
        
        let text = "The workshop is quiet. Too quiet. Santa needs your help to get the engine running...";
        let chapter = 1;

        if (rows.length > 0) {
            chapter = rows[0].current_chapter;
            
            // Return text based on saved chapter
            if (chapter === 2) {
                text = "⚠️ We are navigating the storm! Keep the sleigh steady!";
            } else if (chapter === 3) {
                text = "🎄 SUCCESS! You saved Christmas. The workshop is fully operational.";
            }
        }
        res.json({ text, chapter });
    } catch (err) {
         res.status(500).json({ error: err.message });
    }
});

// Reset Story Route 
app.post('/api/story/reset', async (req, res) => {
    const { userId } = req.body;
    try {
        await db.execute('DELETE FROM story_progress WHERE user_id = ?', [userId]);
        res.json({ success: true, message: "Story reset to Chapter 1" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. SOCIAL: Send Friend Request
app.post('/api/friends/request', async (req, res) => {
    const { userId, friendName } = req.body;
    try {
        // Find Friend ID
        const [users] = await db.execute('SELECT id FROM users WHERE username = ?', [friendName]);
        if (users.length === 0) return res.status(404).json({ error: "User not found" });
        
        const friendId = users[0].id;
        if (friendId == userId) return res.status(400).json({ error: "You cannot add yourself!" });

        // Check if request exists (in either direction)
        const [existing] = await db.execute(
            'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', 
            [userId, friendId, friendId, userId]
        );
        
        if (existing.length > 0) {
            if (existing[0].status === 'accepted') return res.status(400).json({ error: "Already friends!" });
            return res.status(400).json({ error: "Request already pending." });
        }

        // Create Request (Status defaults to 'pending')
        await db.execute('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)', [userId, friendId, 'pending']);
        
        res.json({ success: true, message: `Request sent to ${friendName}!` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. SOCIAL: Get Pending Requests
app.get('/api/friends/requests/:userId', async (req, res) => {
    try {
        // Find rows where *I* am the friend_id, and status is pending
        const sql = `
            SELECT f.user_id, u.username 
            FROM friends f
            JOIN users u ON f.user_id = u.id
            WHERE f.friend_id = ? AND f.status = 'pending'
        `;
        const [rows] = await db.execute(sql, [req.params.userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. SOCIAL: Accept Request
app.post('/api/friends/accept', async (req, res) => {
    const { userId, requesterId } = req.body; // userId is ME (accepting), requesterId is THEM
    try {
        await db.execute(
            'UPDATE friends SET status = ? WHERE user_id = ? AND friend_id = ?', 
            ['accepted', requesterId, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. SOCIAL: Friends Leaderboard (Updated to show only ACCEPTED friends)
app.get('/api/friends/leaderboard/:userId', async (req, res) => {
    try {
        // Complex Join: Get users where I am the sender OR receiver, AND status is accepted
        const sql = `
            SELECT u.username, u.magic_dust 
            FROM users u
            JOIN friends f ON (u.id = f.friend_id AND f.user_id = ?) OR (u.id = f.user_id AND f.friend_id = ?)
            WHERE f.status = 'accepted'
            
            UNION
            
            SELECT username, magic_dust FROM users WHERE id = ?
            
            ORDER BY magic_dust DESC
            LIMIT 10
        `;
        const [rows] = await db.execute(sql, [req.params.userId, req.params.userId, req.params.userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/story/:userId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM story_progress WHERE user_id = ?', [req.params.userId]);
        let text = "The workshop is quiet. Too quiet. Santa needs your help to get the engine running...";
        if (rows.length > 0) {
            if (rows[0].current_chapter === 2) text = "You are currently on Chapter 2. Solve the next puzzle to save Christmas!";
            if (rows[0].current_chapter === 3) text = "Christmas is Saved! You are a master elf.";
        }
        res.json({ text });
    } catch (err) {
         res.status(500).json({ error: err.message });
    }
});

// 5. AUTHENTICATION ROUTES
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [existing] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) return res.status(400).json({ error: "Username taken" });

        const [result] = await db.execute(
            'INSERT INTO users (username, password_hash, magic_dust) VALUES (?, ?, 100)',
            [username, password]
        );
        await db.execute(
            'INSERT INTO user_preferences (user_id, theme_choice) VALUES (?, ?)',
            [result.insertId, 'dynamic']
        );
        res.json({ success: true, userId: result.insertId, username });
    } catch (err) {
        console.error(err); // Print error to terminal for debugging
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE username = ? AND password_hash = ?', [username, password]);
        if (users.length === 0) return res.status(401).json({ error: "Invalid credentials" });

        res.json({ success: true, userId: users[0].id, username: users[0].username, magicDust: users[0].magic_dust });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 6. Get Game History (Analytics Feature)
app.get('/api/history/:userId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT difficulty_level, moves_count, time_taken_seconds, is_won, played_at 
             FROM game_sessions 
             WHERE user_id = ? 
             ORDER BY played_at DESC 
             LIMIT 5`,
            [req.params.userId]
        );
        res.json(rows);
    } catch (err) {
        console.error("History Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET User Preferences
app.get('/api/preferences/:userId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT theme_choice FROM user_preferences WHERE user_id = ?', [req.params.userId]);
        // Default to 'santa' if no preference found
        res.json({ theme: rows[0] ? rows[0].theme_choice : 'santa' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE User Theme
app.post('/api/preferences/update', async (req, res) => {
    const { userId, theme } = req.body;
    try {
        // Use ON DUPLICATE KEY UPDATE to handle both new and existing rows
        await db.execute(
            `INSERT INTO user_preferences (user_id, theme_choice) VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE theme_choice = ?`,
            [userId, theme, theme]
        );
        res.json({ success: true, theme });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. SOCIAL: Get Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        // Get top 5 users by Magic Dust
        const [rows] = await db.execute(
            'SELECT username, magic_dust FROM users ORDER BY magic_dust DESC LIMIT 5'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🎄 Santa's Workshop Server running on port ${PORT}`);
});