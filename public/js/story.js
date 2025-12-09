class StoryManager {
    constructor() {
        this.storyTextEl = document.getElementById('story-text');
        this.choicesEl = document.getElementById('story-choices');
        this.userId = localStorage.getItem('userId');
        
        this.loadInitialStory();
        
        // Make reset global
        window.resetStory = () => this.resetStory();
    }

    async loadInitialStory() {
        if(!this.userId) return;
        try {
            const response = await fetch(`/api/story/${this.userId}`); 
            const data = await response.json();
            
            if(this.storyTextEl) {
                this.storyTextEl.innerHTML = `<strong>Chapter ${data.chapter || 1}:</strong> ${data.text}`;
            }
        } catch (err) { console.error("Story load failed", err); }
    }    

    async updateStory(timeTaken) {
        console.log("📖 Sending Story Update...");
        await this.sendUpdate({ timeTaken });
    }

    async handleChoice(action, nextChapter) {
        console.log("👉 User chose:", action);
        await this.sendUpdate({ choiceMade: action });
    }

    async sendUpdate(payload) {
        try {
            payload.userId = this.userId;
            const response = await fetch('/api/story/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            console.log("📖 Received Data:", data);

            // A. Update Text (Force Update)
            if (data.text) {
                // Remove animation logic to prevent 'invisible text' bug
                this.storyTextEl.innerHTML = `<strong>Chapter ${data.chapter}:</strong> ${data.text}`;
                
                // Highlight the box briefly to show update
                this.storyTextEl.parentElement.style.border = "2px solid gold";
                setTimeout(() => this.storyTextEl.parentElement.style.border = "", 1000);

                // B. Render Choices
                this.renderChoices(data.choices);

                // C. Change Difficulty
                if (data.newDifficulty) {
                    this.triggerGameChange(data.newDifficulty);
                }
            }

        } catch (err) { console.error("Story update failed", err); }
    }

    renderChoices(choices) {
        if (!this.choicesEl) return;
        
        // Clear previous buttons
        this.choicesEl.innerHTML = ''; 
        this.choicesEl.style.display = 'block'; // Force visible

        if (choices && choices.length > 0) {
            console.log("Rendering Buttons:", choices);
            choices.forEach(choice => {
                const btn = document.createElement('button');
                btn.className = 'btn-primary';
                btn.style.marginTop = "10px";
                btn.style.width = "100%";
                btn.style.fontSize = "0.9rem";
                btn.style.background = "#d4af37"; // Gold color for attention
                btn.innerText = choice.text;
                
                btn.onclick = () => {
                    this.handleChoice(choice.action, choice.nextChapter);
                    this.choicesEl.innerHTML = ''; 
                    this.choicesEl.style.display = 'none';
                };
                this.choicesEl.appendChild(btn);
            });
        }
    }

    triggerGameChange(size) {
        const diffSelect = document.getElementById('difficulty-select');
        if (diffSelect && window.gameInstance) {
            diffSelect.value = size;
            localStorage.setItem('lastDifficulty', size);
            alert(`⚠️ STORY EVENT: Switching to ${size}x${size} mode!`);
            window.gameInstance.startGame(); 
        }
    }

    async resetStory() {
        if(!confirm("Reset story to Chapter 1?")) return;
        try {
            await fetch('/api/story/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId })
            });
            window.location.reload();
        } catch(err) { alert("Reset failed"); }
    }
}

// Initialize
if (!window.storyManager) {
    window.storyManager = new StoryManager();
}