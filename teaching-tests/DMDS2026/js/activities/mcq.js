window.ActivityModules = window.ActivityModules || {};
window.ActivityModules.mcq = function(container) {
  container.dataset.activity = "mcq";

  // --- Robust extraction of raw activity text ---
  // Prefer a hidden .activity-raw node if parser created one.
  let raw = '';
  const rawNode = container.querySelector('.activity-raw');

  if (rawNode && rawNode.textContent && rawNode.textContent.trim()) {
    raw = rawNode.textContent.trim();
  } else {
    // Fallback: convert innerHTML to text, turning <br> into newlines
    let html = container.innerHTML || '';
    // Replace <br> with newline (both <br> and <br/> variants)
    html = html.replace(/<br\s*\/?>/gi, '\n');
    // Remove remaining tags but keep their text
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    raw = tmp.textContent.trim();
  }

  // Clear container (we will render interactive UI)
  container.innerHTML = '';

  // --- Parse into question blocks ---
  // Split on one-or-more blank lines to allow multi-line prompts/options
  const blocks = raw.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

  const questions = [];
  let current = null;

  blocks.forEach(block => {
    // A block may contain multiple lines (a single question block)
    const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      if (line.toLowerCase().startsWith('prompt:')) {
        current = {
          prompt: line.replace(/^[pP]rompt:\s*/,'').trim(),
          options: [],
          explanation: ''
        };
        questions.push(current);
      } else if (line.toLowerCase().startsWith('wrong:')) {
        if (!current) return;
        current.options.push({
          text: line.replace(/^[wW]rong:\s*/,'').trim(),
          correct: false
        });
      } else if (line.toLowerCase().startsWith('correct:')) {
        if (!current) return;
        current.options.push({
          text: line.replace(/^[cC]orrect:\s*/,'').trim(),
          correct: true
        });
      } else if (line.toLowerCase().startsWith('explanation:')) {
        if (!current) return;
        current.explanation = line.replace(/^[eE]xplanation:\s*/,'').trim();
      } else {
        // If a line doesn't have a keyword and current exists, assume it's a continuation of prompt or explanation
        if (!current) return;
        // If current has no options yet, append to prompt (multi-line prompt)
        if (current.options.length === 0) {
          current.prompt += ' ' + line;
        } else {
          // otherwise append to the last option text (multi-line option)
          current.options[current.options.length - 1].text += ' ' + line;
        }
      }
    });
  });

  // If no questions were parsed, nothing to do
  if (!questions.length) {
    container.innerHTML = '<div class="activity-complete">No MCQ questions found.</div>';
    return;
  }

  // Utility: shuffle array
  function shuffle(arr) {
    return arr
      .map(v => [Math.random(), v])
      .sort((a, b) => a[0] - b[0])
      .map(v => v[1]);
  }

  // Shared unlock helper (must exist: ActivityUtils.unlockNext)
  const unlock = (typeof ActivityUtils !== 'undefined' && ActivityUtils.unlockNext)
    ? ActivityUtils.unlockNext
    : (c => {
        // fallback: simple implementation
        if (new URLSearchParams(window.location.search).get('nostop') === 'true') return;
        const acts = Array.from(document.querySelectorAll('.activity-container'));
        const idx = acts.indexOf(c);
        if (idx >= 0 && idx + 1 < acts.length) acts[idx+1].style.display = 'block';
      });

  // --- Render UI and behaviour ---
  let qIndex = 0;

  function renderQuestion() {
    container.innerHTML = ''; // clear UI for the question
    const q = questions[qIndex];

    // Title/prompt
    const promptDiv = document.createElement('div');
    promptDiv.className = 'mcq-prompt';
    promptDiv.textContent = `Q${qIndex + 1}: ${q.prompt}`;
    container.appendChild(promptDiv);

    // Options wrapper
    const optionsWrapper = document.createElement('div');
    optionsWrapper.className = 'mcq-options';
    container.appendChild(optionsWrapper);

    // Shuffle options for this question
    const shuffled = shuffle([...q.options]);

    shuffled.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mcq-option';
      btn.textContent = opt.text;
      btn.setAttribute('aria-pressed', 'false');
      btn.style.display = 'block';
      btn.style.margin = '0.35rem 0';
      btn.addEventListener('click', () => {
        // Toggle selection (allow multi-select)
        const sel = btn.classList.toggle('selected');
        btn.setAttribute('aria-pressed', String(sel));
      });
      optionsWrapper.appendChild(btn);
    });

    // Submit button
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Submit Answer';
    submit.style.marginTop = '0.75rem';
    submit.className = 'mcq-submit';
    container.appendChild(submit);

    // Feedback / explanation area
    const feedback = document.createElement('div');
    feedback.className = 'mcq-explanation';
    feedback.style.marginTop = '0.5rem';
    container.appendChild(feedback);

    // Submit handler
    submit.addEventListener('click', () => {
      const selectedBtns = Array.from(optionsWrapper.querySelectorAll('.mcq-option.selected'));
      if (selectedBtns.length === 0) {
        // optionally show a small hint
        feedback.textContent = 'Please select an answer (or answers) before submitting.';
        return;
      }

      const selectedTexts = selectedBtns.map(b => b.textContent.trim());
      const correctTexts = q.options.filter(o => o.correct).map(o => o.text);

      const isCorrect =
        selectedTexts.length === correctTexts.length &&
        selectedTexts.every(t => correctTexts.includes(t));

      if (isCorrect) {
        // Mark selected as correct
        selectedBtns.forEach(b => b.classList.add('correct'));
        feedback.textContent = 'Correct!';
        // small delay then advance
        setTimeout(() => {
          qIndex++;
          if (qIndex < questions.length) {
            renderQuestion();
          } else {
            container.innerHTML = '<div class="activity-complete">All questions completed ✅</div>';
            unlock(container);
          }
        }, 700);
      } else {
        // Mark selected wrong
        selectedBtns.forEach(b => b.classList.add('wrong'));
        feedback.textContent = q.explanation || 'Incorrect — try again.';

        // Retry button
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry';
        retry.style.marginTop = '0.5rem';
        retry.className = 'mcq-retry';
        retry.addEventListener('click', () => {
          renderQuestion(); // re-render same question
        });

        // Only add one retry button (avoid duplicates)
        const existing = container.querySelector('.mcq-retry');
        if (!existing) container.appendChild(retry);
      }
    });
  }

  // Kick off
  renderQuestion();
};
