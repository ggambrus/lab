let questionBank = {};
let questions = [];
let currentQuestionIndex = 0;
let timerInterval;
let timeLeft = 0;
let hideTimer = false;
let selectedTopics = [];
let selectedDuration = 120; // default 2 minutes

const startBtn = document.getElementById('startBtn');
startBtn.disabled = true; // initially disabled

// Load main MCQ banks
fetch('mcq-banks.json')
  .then(res => res.json())
  .then(data => {
    questionBank = data;

    // --- Setup topic tokens ---
    const topicContainer = document.getElementById('topicContainer');
    Object.keys(data).forEach(topic => {
      const token = document.createElement('div');
      token.classList.add('token');
      token.textContent = topic;
      token.addEventListener('click', () => {
        token.classList.toggle('selected');
        // Only consider topic tokens
        selectedTopics = Array.from(document.querySelectorAll('.topic-section .token.selected'))
          .map(t => t.textContent.trim());
        startBtn.disabled = selectedTopics.length === 0;
      });
      topicContainer.appendChild(token);
    });

    // --- Setup duration tokens ---
    const durationContainer = document.getElementById('durationContainer');
    const durations = [
      { label: '1 Min', value: 60 },
      { label: '2 Min', value: 120 }, // default selected
      { label: '5 Min', value: 300 },
      { label: '10 Min', value: 600 }
    ];

    durations.forEach(d => {
      const token = document.createElement('div');
      token.classList.add('token');
      token.textContent = d.label;
      token.dataset.value = d.value;

      if (d.value === 120) {
        token.classList.add('selected');
        selectedDuration = 120;
      }

      token.addEventListener('click', () => {
        Array.from(durationContainer.children).forEach(t => t.classList.remove('selected'));
        token.classList.add('selected');
        selectedDuration = parseInt(token.dataset.value);
      });
      durationContainer.appendChild(token);
    });
  })
  .catch(err => {
    console.error("Failed to load mcq-banks.json:", err);
    alert("Could not load mcq-banks.json. Make sure the file exists and is served via a local server.");
  });

// --- Button listeners ---
document.getElementById('startBtn').addEventListener('click', startQuiz);
document.getElementById('restartBtn').addEventListener('click', restartQuiz);
document.getElementById('timerBtn').addEventListener('click', () => {
  hideTimer = !hideTimer;
  document.getElementById('timerBtn').textContent = hideTimer ? 'Timer Hidden' : `Time: ${formatTime(timeLeft)}`;
});
document.getElementById('nextBtn').addEventListener('click', () => {
  currentQuestionIndex++;
  showQuestion();
});

// --- Quiz start ---
function startQuiz() {
  if (selectedTopics.length === 0) return alert('Please select at least one topic!');

  // Lock topic & duration controls
  document.querySelectorAll('.topic-section .token, .duration-section .token').forEach(el => {
    el.style.pointerEvents = 'none';
    el.style.opacity = '0.6';
  });
  startBtn.disabled = true;

  // Fetch questions
  questions = [];
  let fetches = selectedTopics.map(topic => {
    const path = questionBank[topic];
    if (!path) {
      console.error(`No path found for topic "${topic}"`);
      return Promise.reject(new Error(`No JSON file mapped for topic "${topic}"`));
    }
    return fetch(path)
      .then(res => res.text())
      .then(txt => {
        txt = txt.trim();
        if (!txt.startsWith('[') && !txt.startsWith('{')) {
          throw new Error(`Invalid JSON in ${path}`);
        }
        return JSON.parse(txt);
      });
  });

  Promise.all(fetches)
    .then(results => {
      results.forEach(arr => questions.push(...arr));
      // ensure each question is a separate object and reset flags
      questions = questions.map(q => ({ ...q, repeated: false, answered: false }));
      questions = shuffleArray(questions);
      questions.forEach(q => q.options = shuffleArray(q.options));
      currentQuestionIndex = 0;
      document.getElementById('quizContainer').style.display = 'block';
      document.getElementById('resultContainer').style.display = 'none';
      timeLeft = selectedDuration;
      startTimer();
      showQuestion();
    })
    .catch(err => {
      console.error("Error loading question files:", err);
      alert("Failed to load question files. Check console for details.");
    });
}

// --- Restart quiz ---
function restartQuiz() {
  document.getElementById('quizContainer').style.display = 'none';
  document.getElementById('resultContainer').style.display = 'none';
  document.querySelectorAll('.topic-section .token, .duration-section .token').forEach(el => {
    el.style.pointerEvents = 'auto';
    el.style.opacity = '1';
  });
  startBtn.disabled = selectedTopics.length === 0;
}

// --- Timer ---
function startTimer() {
  updateTimerDisplay();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--; // always decrement
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      finishQuiz();
    }
  }, 1000);
}

function updateTimerDisplay() {
  document.getElementById('timerBtn').textContent = hideTimer ? 'Timer Hidden' : `Time: ${formatTime(timeLeft)}`;
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2,'0');
  const s = String(seconds % 60).padStart(2,'0');
  return `${m}:${s}`;
}

// --- Show question ---
function showQuestion() {
  document.getElementById('nextBtn').style.display = 'none';

  if (currentQuestionIndex >= questions.length) {
    finishQuiz();
    return;
  }

  const q = questions[currentQuestionIndex];
  const questionContainer = document.getElementById('questionContainer');
  questionContainer.textContent = q.question;

  if (q.repeated) {
    questionContainer.classList.add('repeat-question');
  } else {
    questionContainer.classList.remove('repeat-question');
  }

  const optionsContainer = document.getElementById('optionsContainer');
  optionsContainer.innerHTML = '';
  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.addEventListener('click', () => handleAnswer(opt, q));
    optionsContainer.appendChild(btn);
  });

  document.getElementById('feedback').textContent = '';
}

// --- Handle answer ---
function handleAnswer(selected, question) {
  // mark as answered here (concrete tracking)
  question.answered = true;

  const buttons = document.querySelectorAll('#optionsContainer button');
  buttons.forEach(btn => btn.disabled = true);

  const feedback = document.getElementById('feedback');
  if (selected === question.answer) {
    feedback.textContent = 'Correct!';
    feedback.style.color = '#2e7d32';
    buttons.forEach(btn => {
      if (btn.textContent === selected) btn.classList.add('correct');
    });
  } else {
    feedback.textContent = `Incorrect! Correct: ${question.answer}`;
    feedback.style.color = '#c62828';
    buttons.forEach(btn => {
      if (btn.textContent === selected) btn.classList.add('incorrect');
      if (btn.textContent === question.answer) btn.classList.add('correct');
    });

    // Re-introduce question 3–5 questions later
    const insertIndex = Math.min(currentQuestionIndex + Math.floor(Math.random()*3)+3, questions.length);
    // create a fresh copy so marking doesn't affect original instance
    const repeatedQuestion = { ...question, repeated: true, answered: false };
    questions.splice(insertIndex, 0, repeatedQuestion);
  }

  document.getElementById('nextBtn').style.display = 'inline-block';
}

// --- Finish quiz ---
function finishQuiz() {
  clearInterval(timerInterval);
  document.getElementById('quizContainer').style.display = 'none';
  document.getElementById('resultContainer').style.display = 'block';
  // count only actually answered question instances
  const answeredCount = questions.filter(q => q.answered).length;
  document.getElementById('scoreText').textContent = `You answered ${answeredCount} questions in time!`;
}

// --- Utility ---
function shuffleArray(arr) {
  let a = [...arr];
  for (let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
