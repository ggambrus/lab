/* =========================================================
   REVISION MCQ SCRIPT – FULL VERSION WITH BAR CHART ANIMATION
   ========================================================= */

const MAX_QUESTIONS = 100;

let questionBank = {};
let questions = [];
let selectedTopics = [];

let startTime = null;
let timerInterval = null;

/* -------------------- DOM -------------------- */

const topicContainer = document.getElementById('topicContainer');
const startBtn = document.getElementById('startBtn');
const timerEl = document.getElementById('timer');
const progressEl = document.getElementById('progress');
const questionContainer = document.getElementById('questionContainer');
const resultsDiv = document.getElementById('results');

/* -------------------- HELPERS -------------------- */

function getTopicFile(entry) {
  return typeof entry === 'string' ? entry : entry.file;
}

function getTopicPercentage(entry) {
  return typeof entry === 'object' && entry.percentage != null
    ? entry.percentage
    : null;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/* -------------------- LOAD TOPIC BANK -------------------- */

fetch('mcq-banks.json')
  .then(res => res.json())
  .then(data => {
    questionBank = data;

    Object.keys(data).forEach(topic => {
      const token = document.createElement('div');
      token.className = 'token';
      token.textContent = topic;

      token.addEventListener('click', () => {
        token.classList.toggle('selected');
        selectedTopics = [...document.querySelectorAll('.token.selected')]
          .map(t => t.textContent);
        startBtn.disabled = selectedTopics.length === 0;
      });

      topicContainer.appendChild(token);
    });
	
	// --- Lock all topics (pre-select all) ---
	// Pre-select all topics
	selectedTopics = Object.keys(data);

	// Mark all tokens as selected and disable interaction
	document.querySelectorAll('#topicContainer .token').forEach(token => {
		token.classList.add('selected');
		token.style.pointerEvents = 'none';
		token.style.opacity = '0.8'; // visually indicate disabled
	});

	// Enable start button automatically
	startBtn.disabled = false;

	// Update the label text
	const topicLabel = document.querySelector('.topic-section p');
	if (topicLabel) topicLabel.textContent = 'Topics in this quiz:';
	  
	
	
  })
  .catch(err => {
    console.error('Failed to load mcq-banks.json', err);
    alert('Could not load question bank.');
  });



/* -------------------- START REVISION -------------------- */

startBtn.addEventListener('click', startRevision);

function startRevision() {
  document.getElementById('setup').style.display = 'none';
  document.getElementById('quiz').style.display = 'block';

  const fetches = selectedTopics.map(topic => {
    const entry = questionBank[topic];
    return fetch(getTopicFile(entry)).then(r => r.json());
  });

  Promise.all(fetches).then(results => {
    const topicQuestions = {};
    const topicPercentages = {};

    selectedTopics.forEach((topic, i) => {
      topicQuestions[topic] = shuffle(
        results[i].map(q => ({ ...q, topic }))
      );

      const pct = getTopicPercentage(questionBank[topic]);
      if (pct != null) topicPercentages[topic] = pct;
    });

    let selected = [];

    // --- Percentage-based sampling ---
    selectedTopics.forEach(topic => {
      const pct = topicPercentages[topic];
      const target = pct != null ? Math.round((pct / 100) * MAX_QUESTIONS) : 0;
      const available = topicQuestions[topic];
      selected.push(...available.slice(0, target));
      topicQuestions[topic] = available.slice(target);
    });

    // --- Fill remainder ---
    if (selected.length < MAX_QUESTIONS) {
      const leftovers = Object.values(topicQuestions).flat();
      shuffle(leftovers)
        .slice(0, MAX_QUESTIONS - selected.length)
        .forEach(q => selected.push(q));
    }

    questions = shuffle(selected).slice(0, MAX_QUESTIONS);
    questions.forEach(q => { q.options = shuffle(q.options); });

    renderQuestions();
    startTimer();
    updateProgress();
  });
}

/* -------------------- TIMER -------------------- */

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = `Time: ${formatTime(elapsed)}`;
  }, 1000);
}

/* -------------------- RENDER QUESTIONS -------------------- */

function renderQuestions() {
  questionContainer.innerHTML = '';

  questions.forEach((q, idx) => {
    const div = document.createElement('div');
    div.className = 'question';
    div.dataset.index = idx;

    div.innerHTML = `
      <h3>Q${idx + 1}. ${q.question}</h3>
      <div class="options">
        ${q.options.map(opt => `
          <div class="option" data-value="${opt}">
            ${opt}
          </div>
        `).join('')}
      </div>
    `;

    div.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        if (div.classList.contains('locked')) return;
        div.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        div.dataset.answer = opt.dataset.value;
        updateProgress();
      });
    });

    questionContainer.appendChild(div);
  });
}

/* -------------------- PROGRESS -------------------- */

function updateProgress() {
  const answered = document.querySelectorAll('.question[data-answer]').length;
  progressEl.textContent = `Answered: ${answered} / ${questions.length}`;
}

/* -------------------- SUBMIT & MARK -------------------- */

document.getElementById('quizForm').addEventListener('submit', e => {
  e.preventDefault();
  finishRevision();
});

function finishRevision() {
  clearInterval(timerInterval);

  let correct = 0;
  const topicStats = {};

  document.querySelectorAll('.question').forEach((qDiv, idx) => {
    const question = questions[idx];
    const selected = qDiv.dataset.answer;
    const options = qDiv.querySelectorAll('.option');
    const topic = question.topic || 'Unspecified';

    if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
    topicStats[topic].total++;

    qDiv.classList.add('locked');

    options.forEach(opt => {
      const value = opt.dataset.value;
      if (value === question.answer) opt.classList.add('correct');
      if (selected === value && value !== question.answer) opt.classList.add('incorrect');
    });

    if (selected === question.answer) {
      correct++;
      topicStats[topic].correct++;
      qDiv.dataset.correct = 'true';
    } else {
      qDiv.dataset.correct = 'false';
      if (!selected) {
        const note = document.createElement('div');
        note.className = 'not-answered';
        note.textContent = 'Not answered';
        qDiv.appendChild(note);
      }
    }
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  document.getElementById('scoreText').textContent = `Score: ${correct} / ${questions.length}`;
  document.getElementById('timeText').textContent = `Completion time: ${formatTime(elapsed)}`;

  // --- Topic breakdown + animated bar chart ---
  const breakdownDiv = document.getElementById('topicBreakdown');
  breakdownDiv.innerHTML = '';

  Object.entries(topicStats).forEach(([topic, stats]) => {
    const pct = Math.round((stats.correct / stats.total) * 100);

    const row = document.createElement('div');
    row.className = 'bar-chart-row';

    const label = document.createElement('div');
    label.className = 'bar-chart-label';
    label.textContent = topic;

    const barContainer = document.createElement('div');
    barContainer.style.flex = '1';
    barContainer.style.background = '#ddd';
    barContainer.style.borderRadius = '6px';
    barContainer.style.overflow = 'hidden';
    barContainer.style.height = '20px';
    barContainer.style.marginLeft = '8px';
    barContainer.style.position = 'relative';

    const bar = document.createElement('div');
    bar.className = 'bar-chart-bar';
    bar.style.width = '0%'; // start at 0%
    bar.style.height = '100%';
    bar.style.background = 'linear-gradient(90deg, #42a5f5, #1976d2)';
    bar.style.transition = 'width 1s ease-out';

    const percText = document.createElement('div');
    percText.className = 'bar-chart-percentage';
    percText.style.position = 'absolute';
    percText.style.right = '8px';
    percText.style.top = '0';
    percText.style.fontWeight = '500';
    percText.textContent = pct + '%';

    barContainer.appendChild(bar);
    barContainer.appendChild(percText);

    row.appendChild(label);
    row.appendChild(barContainer);
    breakdownDiv.appendChild(row);

    // Animate bar after short delay
    setTimeout(() => {
      bar.style.width = pct + '%';
    }, 100);
  });

  resultsDiv.style.display = 'block';
}

/* -------------------- REVIEW TOGGLE -------------------- */

document
  .getElementById('reviewIncorrectOnly')
  .addEventListener('change', e => {
    const onlyIncorrect = e.target.checked;
    document.querySelectorAll('.question').forEach(q => {
      const isCorrect = q.dataset.correct === 'true';
      q.classList.toggle('hidden', onlyIncorrect && isCorrect);
    });
  });

/* -------------------- RESTART -------------------- */

document.getElementById('restartBtn').addEventListener('click', () => {
  location.reload();
});
