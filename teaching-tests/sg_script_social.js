document.addEventListener('DOMContentLoaded', () => {
    const topicList = document.getElementById('topic-list');
    const cardContainer = document.getElementById('flashcard-container');
    const questionEl = document.getElementById('flashcard-question');
    const answerEl = document.getElementById('flashcard-answer');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const cardCounter = document.getElementById('card-counter');
    const controls = document.getElementById('navigation-controls');
    const areaTitle = document.querySelector('#flashcard-area h2');

    // ✅ Add a reference to the random toggle
    const randomToggle = document.getElementById('random-toggle');

    let allTopicsData = [];
    let currentFlashcards = [];
    let currentCardIndex = 0;
    let isRandom = false; // Default is sequential

    // 1. Fetch JSON Data
    async function fetchFlashcards() {
        try {
            const response = await fetch('social_sg.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            allTopicsData = await response.json();
            renderTopics(allTopicsData);
        } catch (error) {
            console.error("Could not fetch flashcard data:", error);
            topicList.innerHTML = '<p class="error-message">Error loading study guide data.</p>';
        }
    }

    // 2. Render Topics in the Sidebar
    function renderTopics(data) {
        topicList.innerHTML = '';
        data.forEach((topicData, index) => {
            const listItem = document.createElement('li');
            listItem.textContent = topicData.topic;
            listItem.setAttribute('data-index', index);
            listItem.addEventListener('click', () => loadTopic(index));
            topicList.appendChild(listItem);
        });
    }

    function formatMarkdown(text) {
        if (typeof text !== 'string') return text;

        const escapeHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                                 .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

        const urlRegex = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;
        const urls = [];
        let escaped = escapeHtml(text.replace(urlRegex, (match)=> { 
            urls.push(match); 
            return `@@URL${urls.length-1}@@`; 
        }));

        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        escaped = escaped.replace(/_(.*?)_/g, '<i>$1</i>');
        escaped = escaped.replaceAll('|', '<br>');

        escaped = escaped.replace(/@@URL(\d+)@@/g, (m, idx) => {
            const original = urls[idx];
            let href = /^https?:\/\//i.test(original) ? original : 'https://' + original;
            const display = escapeHtml(original);
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${display}</a>`;
        });

        return escaped;
    }

    // ✅ Shuffle utility
    function shuffleArray(array) {
        const shuffled = array.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // 3. Load Selected Topic's Flashcards
    function loadTopic(topicIndex) {
        cardContainer.querySelector('.flashcard').classList.remove('flipped');
        document.querySelectorAll('#topic-list li').forEach(li => li.classList.remove('active'));
        document.querySelector(`#topic-list li[data-index="${topicIndex}"]`).classList.add('active');

        const topicData = allTopicsData[topicIndex];

        // ✅ Apply randomization toggle
        currentFlashcards = isRandom 
            ? shuffleArray(topicData.flashcards)
            : topicData.flashcards.slice();

        currentCardIndex = 0;

        areaTitle.textContent = topicData.topic;
        cardContainer.classList.remove('hidden');
        controls.classList.remove('hidden');
        document.getElementById('no-cards-message').classList.add('hidden');

        if (currentFlashcards.length === 0) {
            document.getElementById('no-cards-message').classList.remove('hidden');
            cardContainer.classList.add('hidden');
            controls.classList.add('hidden');
            return;
        }

        updateFlashcard();
    }

    // 4. Update Flashcard Content
    function updateFlashcard() {
        const card = currentFlashcards[currentCardIndex];
        questionEl.innerHTML = formatMarkdown(card.question);
        answerEl.innerHTML = formatMarkdown(card.answer);

        cardCounter.textContent = `${currentCardIndex + 1} / ${currentFlashcards.length}`;
        prevBtn.disabled = currentCardIndex === 0;
        nextBtn.disabled = currentCardIndex === currentFlashcards.length - 1;

        cardContainer.querySelector('.flashcard').classList.remove('flipped');
    }

    // 5. Navigation Handlers
    prevBtn.addEventListener('click', () => {
        if (currentCardIndex > 0) {
            currentCardIndex--;
            updateFlashcard();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentCardIndex < currentFlashcards.length - 1) {
            currentCardIndex++;
            updateFlashcard();
        }
    });

    // ✅ 6. Randomization Toggle Handler
    randomToggle.addEventListener('change', (e) => {
        isRandom = e.target.checked;
        // If a topic is currently loaded, reload it in the new order
        const activeTopic = document.querySelector('#topic-list li.active');
        if (activeTopic) {
            const topicIndex = parseInt(activeTopic.getAttribute('data-index'));
            loadTopic(topicIndex);
        }
    });

    // Start the application
    fetchFlashcards();
});
