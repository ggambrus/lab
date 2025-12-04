window.ActivityModules = window.ActivityModules || {};

window.ActivityModules.survey = function(container) {
  container.dataset.activity = "survey";

  /* ---------- RAW EXTRACTION ---------- */
  let raw = '';
  const rawNode = container.querySelector('.activity-raw');

  if (rawNode && rawNode.textContent.trim()) {
    raw = rawNode.textContent.trim();
  } else {
    let html = container.innerHTML || '';
    html = html.replace(/<br\s*\/?>/gi, '\n')
               .replace(/<\/p>/gi, '\n')
               .replace(/<[^>]+>/g, '');
    raw = html.trim();
  }

  raw = raw.replace(/\[activity:[^\]]+\]/gi, '')
           .replace(/\[end activity\]/gi, '')
           .trim();

  container.innerHTML = '';

  /* ---------- PARSE ---------- */
  const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);

  let promptText = '';
  let options = [];
  const items = [];

  lines.forEach(line => {
    const lower = line.toLowerCase();

    if (lower.startsWith('prompt:')) {
      promptText = line.replace(/^[pP]rompt:\s*/, '');

    } else if (lower.startsWith('options:')) {
      options = line
        .replace(/^[oO]ptions:\s*/, '')
        .split(';')
        .map(o => o.trim())
        .filter(Boolean);

    } else if (lower.startsWith('item:')) {
      const content = line.replace(/^[iI]tem:\s*/, '');
      const parts = content.split('|').map(p => p.trim());
      if (parts.length === 2) {
        items.push({
          text: parts[0],
          correct: parts[1]
        });
      }
    }
  });

  if (!items.length || !options.length) {
    container.innerHTML = '<div class="activity-complete">Invalid survey activity.</div>';
    return;
  }

  /* ---------- UI ---------- */
  const promptDiv = document.createElement('div');
  promptDiv.className = 'survey-prompt';
  promptDiv.textContent = promptText;
  container.appendChild(promptDiv);

  const list = document.createElement('div');
  list.className = 'survey-list';
  container.appendChild(list);

  const responses = new Map();

  items.forEach((item, itemIndex) => {
    const row = document.createElement('div');
    row.className = 'survey-item';

    const textDiv = document.createElement('div');
    textDiv.className = 'survey-text';
    textDiv.textContent = item.text;
    row.appendChild(textDiv);

    const optionGroup = document.createElement('div');
    optionGroup.className = 'survey-options';

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'survey-option';
      btn.textContent = opt;

      btn.addEventListener('click', () => {
        // radio behavior
        Array.from(optionGroup.children).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        responses.set(itemIndex, opt);
      });

      optionGroup.appendChild(btn);
    });

    row.appendChild(optionGroup);
    list.appendChild(row);
  });

  const feedback = document.createElement('div');
  feedback.className = 'survey-feedback';
  container.appendChild(feedback);

  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'Check Answers';
  checkBtn.className = 'survey-check';
  container.appendChild(checkBtn);

  /* ---------- CHECK ---------- */
  checkBtn.addEventListener('click', () => {
    let correct = true;

    items.forEach((item, idx) => {
      if (responses.get(idx) !== item.correct) {
        correct = false;
      }
    });

    if (correct && responses.size === items.length) {
      feedback.textContent = '✅ All answers correct!';
      setTimeout(() => {
        container.innerHTML = '<div class="activity-complete">Survey completed ✅</div>';
        if (ActivityUtils && ActivityUtils.unlockNext) {
          ActivityUtils.unlockNext(container);
        }
      }, 700);
    } else {
      feedback.textContent = '❌ Some answers are incorrect or missing. Try again.';
    }
  });
};
