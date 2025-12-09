-- 1. Create Database
CREATE DATABASE IF NOT EXISTS christmas_puzzle_db;
USE christmas_puzzle_db;

-- 2. Users & Preferences
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    magic_dust INT DEFAULT 100
);

CREATE TABLE user_preferences (
    user_id INT PRIMARY KEY,
    theme_choice VARCHAR(20) DEFAULT 'santa',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Game Sessions (Analytics)
CREATE TABLE game_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    difficulty_level VARCHAR(20),
    moves_count INT,
    time_taken_seconds INT,
    is_won BOOLEAN,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 4. Achievements
CREATE TABLE achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    description TEXT,
    icon_url VARCHAR(255)
);

CREATE TABLE user_achievements (
    user_id INT,
    achievement_id INT,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

-- Pre-fill Achievements
INSERT INTO achievements (id, name, description, icon_url) VALUES 
(1, 'Speed Sleigh', 'Solved a puzzle in under 60 seconds', '⚡'),
(2, 'Magic Hoarder', 'Collected 500 Magic Dust', '✨'),
(3, 'Santa Master', 'Completed the 10x10 puzzle', '🎅'),
(4, 'Elf Recruit', 'Won your very first puzzle', '🟢'),
(5, 'Night Owl', 'Won a game between 10 PM and 4 AM', '🦉'),
(6, 'Marathon', 'Played 10 total games', '🏃'),
(7, 'Deep Freeze', 'Used the Freeze Power-up', '❄️');

-- 5. Story Progress
CREATE TABLE story_progress (
    user_id INT PRIMARY KEY,
    current_chapter INT DEFAULT 1,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. Social (Friends & Challenges)
CREATE TABLE friends (
    user_id INT,
    friend_id INT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
);

CREATE TABLE challenges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT,
    receiver_id INT,
    moves INT,
    time_taken INT,
    difficulty VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);