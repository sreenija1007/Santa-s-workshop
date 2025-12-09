# 🎅 Santa’s Adaptive Workshop – Data-Driven N-Puzzle

> Team Project by **Sreenija & Shriya**

A full-stack interactive sliding puzzle game that adapts difficulty using real-time analytics and player performance prediction.

---

## 📖 Overview

Santa’s Adaptive Workshop transforms the classic N-Puzzle into a **data-driven adaptive system**.  
The game continuously analyzes player behavior and uses the **Smart Consultant algorithm** to predict win probability and dynamically recommend difficulty upgrades based on historical performance.

This project demonstrates skills in:

- Full-Stack Web Development  
- SQL Relational Database Design  
- Game & Analytics Algorithms  

---

## 🚀 Key Features

### 🧠 Predictive Analytics Engine
- Calculates **win rate** and **average completion time** across grid sizes (3×3 → 10×10).
- Uses heuristic thresholds to recommend when players are “ready for harder modes.”
- Displays real-time **Win Probability** using player history.

### 📖 Interactive Branching Story
- SQL-backed narrative engine with **3 story chapters**.
- Player choices directly affect puzzle difficulty  
  (ex: selecting risky paths forces 6×6 boards vs 3×3).

### 🏆 Gamification & Social Graph
- **7 achievement badges** including:
  - *Speed Sleigh* – solves under 60s  
  - *Night Owl* – late-night sessions
- **Magic Dust economy** earned through performance efficiency.
- **Friends leaderboard** comparing Dust totals and achievements.

### ⚙ Technical Depth
- **Custom N-Puzzle shuffling + solvability validation algorithm**
- **Transaction-safe SQL state management** for economy & saves.
- **Panic Mode** visuals using JS + CSS animations when time runs low.

---

## 🛠 Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JS (ES6+)
- **Backend:** Node.js, Express.js
- **Database:** MySQL (Normalized relational schema)
- **API:** REST endpoints (Auth, Analytics, Game State)

---

## 💾 Database Schema

| Table | Purpose |
|------|---------|
| **users** | Authentication + Magic Dust totals |
| **game_sessions** | Puzzle telemetry & analytics |
| **achievements** & **user_achievements** | Badge tracking (M:N) |
| **story_progress** | Narrative state management |
| **friends** | Social graph relationships |

---

## ⚡ How to Run

### 1️⃣ Clone Repo
```bash
git clone https://github.com/sreenija1007/Santa-s-workshop
cd Santa-s-workshop
Install Dependencies
npm install

3️⃣ Setup Database

Create database:

CREATE DATABASE christmas_puzzle_db;


Import schema:

mysql -u root -p christmas_puzzle_db < database/schema.sql


Create a .env file:

PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=YOUR_PASSWORD
DB_NAME=christmas_puzzle_db

4️⃣ Run Server
node server.js

5️⃣ Play

Open:

http://localhost:3000
```
🤖 AI Assistance Disclosure

This project was developed with the responsible use of AI tools.

Assistance included:

Generating boilerplate code templates for Express setup.

Debugging support for frontend-backend logic issues.

Documentation formatting assistance.

All AI-generated content was reviewed, modified, tested, and integrated manually to satisfy project constraints including SQL CLI-only usage and custom algorithm requirements.
