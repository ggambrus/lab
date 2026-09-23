window.ActivityModules = window.ActivityModules || {};

window.ActivityModules.completetext = function(container) {

  container.dataset.activity = "completetext";

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

  const lines = raw.split(/\n/)
                   .map(l => l.trim())
                   .filter(Boolean);

  let promptText = '';
  let textBlock = '';

  lines.forEach(line => {

    if (line.toLowerCase().startsWith('prompt:')) {

      promptText =
        line.replace(/^[pP]rompt:\s*/, '');

    } else if (line.toLowerCase().startsWith('text:')) {

      textBlock +=
        line.replace(/^[tT]ext:\s*/, '') + '\n';

    } else {

      textBlock += line + '\n';
    }
  });

  textBlock = textBlock.trim();

  const answers = [];

  const cleanText =
    textBlock.replace(/\{([^}]+)\}/g,
      (m,p1) => {

        answers.push(p1.trim());

        return '___SLOT___';
      });

  function shuffle(arr) {
    return arr
      .map(v => [Math.random(), v])
      .sort((a,b) => a[0]-b[0])
      .map(v => v[1]);
  }

  let poolItems = shuffle([...answers]);
  let attemptCount = 0;

  const isTouch =
    ('ontouchstart' in window ||
     navigator.maxTouchPoints > 0) &&
    !window.matchMedia('(pointer: fine)').matches;

  const promptDiv = document.createElement('div');
  promptDiv.className = 'completetext-prompt';
  promptDiv.textContent = promptText;
  container.appendChild(promptDiv);

  const textDiv = document.createElement('div');
  textDiv.className = 'completetext-text';
  container.appendChild(textDiv);

  const poolDiv = document.createElement('div');
  poolDiv.className = 'completetext-pool';
  container.appendChild(poolDiv);

  const slots = [];

  cleanText.split('___SLOT___')
    .forEach((segment, i, arr) => {

      textDiv.appendChild(
        document.createTextNode(segment)
      );

      if (i < arr.length - 1) {

        const slot = document.createElement('span');

        slot.className = 'completetext-slot';

        slot.dataset.index = i;

        textDiv.appendChild(slot);

        slots.push(slot);
      }
    });

  function renderPool() {

    poolDiv.innerHTML = '';

    poolItems.forEach(word => {

      const item = document.createElement('span');

      item.className = 'completetext-item';

      item.textContent = word;

      item.dataset.value = word;

      item.draggable = !isTouch;

      poolDiv.appendChild(item);
    });
  }

  renderPool();

  function clearHighlights() {

    slots.forEach(slot => {

      slot.style.background = '';
      slot.style.border = '';
    });

    container
      .querySelectorAll('.completetext-item')
      .forEach(item => {

        item.style.background = '';
        item.style.border = '';
      });
  }

  function placeIntoSlot(item, slot) {

    if (slot.firstChild) return;

    slot.appendChild(item);

    item.classList.remove('selected');
  }

  function returnToPool(item) {

    poolDiv.appendChild(item);

    item.classList.remove('selected');
  }

  function resetActivity() {

    clearHighlights();

    feedback.textContent = '';

    attemptCount = 0;

    showSolutionBtn.style.display = 'none';

    slots.forEach(slot => {

      const item = slot.firstChild;

      if (item) {
        returnToPool(item);
      }
    });

    poolItems = shuffle([...answers]);

    renderPool();
  }

  function showSolution() {

    clearHighlights();

    slots.forEach((slot, idx) => {

      const currentItem = slot.firstChild;

      if (
        currentItem &&
        currentItem.dataset.value !== answers[idx]
      ) {

        currentItem.style.background = '#f8d7da';
        currentItem.style.border =
          '2px solid #dc3545';

        returnToPool(currentItem);
      }
    });

    answers.forEach((answer, idx) => {

      const slot = slots[idx];

      if (
        slot.firstChild &&
        slot.firstChild.dataset.value === answer
      ) {

        slot.firstChild.style.background =
          '#d4edda';

        slot.firstChild.style.border =
          '2px solid #28a745';

        return;
      }

      const correctItem =
        Array.from(
          poolDiv.querySelectorAll(
            '.completetext-item'
          )
        ).find(
          item => item.dataset.value === answer
        );

      if (correctItem) {

        slot.appendChild(correctItem);

        correctItem.style.background =
          '#d4edda';

        correctItem.style.border =
          '2px solid #28a745';
      }
    });

    feedback.textContent =
      'Solution shown. Green = correct answers. Red = answers you previously placed incorrectly.';
  }

  if (!isTouch) {

  textDiv.addEventListener('click', e => {

    const slot =
      e.target.closest('.completetext-slot');

    if (!slot) return;

    const item = slot.firstChild;

    if (item) {
      returnToPool(item);
    }
  });

  }

  if (!isTouch) {

    let dragged = null;

    poolDiv.addEventListener('dragstart', e => {

      const item =
        e.target.closest('.completetext-item');

      if (!item) return;

      dragged = item;

      e.dataTransfer.setData(
        'text/plain',
        item.dataset.value
      );
    });

    document.addEventListener('dragend', () => {
      dragged = null;
    });

    slots.forEach(slot => {

      slot.addEventListener(
        'dragover',
        e => e.preventDefault()
      );

      slot.addEventListener('drop', e => {

        e.preventDefault();

        if (!dragged) return;

        placeIntoSlot(dragged, slot);
      });
    });
  }

  if (isTouch) {

  let selected = null;

  poolDiv.addEventListener('click', e => {

    const item =
      e.target.closest('.completetext-item');

    if (!item) return;

    poolDiv
      .querySelectorAll('.completetext-item')
      .forEach(i => i.classList.remove('selected'));

    selected = item;

    item.classList.add('selected');
  });

  slots.forEach(slot => {

    slot.addEventListener('click', e => {

      e.stopPropagation();

      if (selected) {

        if (!slot.firstChild) {

          placeIntoSlot(selected, slot);

          selected.classList.remove('selected');

          selected = null;
        }

        return;
      }

      const existingItem = slot.firstChild;

      if (existingItem) {

        returnToPool(existingItem);
      }

    });

  });

  }

  const controls = document.createElement('div');

  controls.style.display = 'flex';
  controls.style.flexWrap = 'wrap';
  controls.style.gap = '0.5rem';
  controls.style.marginTop = '1rem';

  container.appendChild(controls);

  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'Check Text';

  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Activity';

  const showSolutionBtn =
    document.createElement('button');

  showSolutionBtn.textContent = 'Show Solution';
  showSolutionBtn.style.display = 'none';

  controls.appendChild(checkBtn);
  controls.appendChild(resetBtn);
  controls.appendChild(showSolutionBtn);

  const feedback = document.createElement('div');

  feedback.className =
    'completetext-feedback';

  feedback.style.marginTop = '0.75rem';

  container.appendChild(feedback);

  resetBtn.addEventListener(
    'click',
    resetActivity
  );

  showSolutionBtn.addEventListener(
    'click',
    showSolution
  );

  checkBtn.addEventListener('click', () => {

    clearHighlights();

    let correct = true;

    slots.forEach((slot, idx) => {

      const item = slot.firstChild;

      if (
        !item ||
        item.dataset.value !== answers[idx]
      ) {

        correct = false;

        slot.style.background =
          '#f8d7da';

      } else {

        slot.style.background =
          '#d4edda';
      }
    });

    if (correct && poolDiv.children.length === 0) {

      feedback.textContent =
        '✅ Text completed correctly!';

      setTimeout(() => {

        container.innerHTML =
          '<div class="activity-complete">Complete text activity completed ✅</div>';

        if (
          ActivityUtils &&
          ActivityUtils.unlockNext
        ) {
          ActivityUtils.unlockNext(container);
        }

      }, 800);

    } else {

      attemptCount++;

      feedback.textContent =
        '❌ Some parts are incorrect. Try again.';

      if (attemptCount >= 1) {
        showSolutionBtn.style.display = '';
      }
    }
  });
};