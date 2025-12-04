window.ActivityModules = window.ActivityModules || {};

window.ActivityModules.completetext = function(container) {
  container.dataset.activity = "completetext";

  /* ---------- Raw extraction ---------- */
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

  /* ---------- Parse ---------- */
  const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);
  let promptText = '';
  let textBlock = '';

  lines.forEach(line => {
    if (line.toLowerCase().startsWith('prompt:')) {
      promptText = line.replace(/^[pP]rompt:\s*/, '');
    } else if (line.toLowerCase().startsWith('text:')) {
      textBlock += line.replace(/^[tT]ext:\s*/, '') + '\n';
    } else {
      textBlock += line + '\n';
    }
  });

  textBlock = textBlock.trim();

  /* ---------- Extract answers ---------- */
  const answers = [];
  const cleanText = textBlock.replace(/\{([^}]+)\}/g, (m, p1) => {
    answers.push(p1.trim());
    return '___SLOT___';
  });

  function shuffle(arr) {
    return arr.map(v => [Math.random(), v])
              .sort((a,b)=>a[0]-b[0])
              .map(v=>v[1]);
  }

  let poolItems = shuffle([...answers]);

  /* ---------- Touch detection ---------- */
  const isTouch = (
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    !window.matchMedia('(pointer: fine)').matches
  );

  /* ---------- Build UI ---------- */
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

  cleanText.split('___SLOT___').forEach((segment, i, arr) => {
    textDiv.appendChild(document.createTextNode(segment));
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

  /* ---------- Shared move logic ---------- */
  function placeIntoSlot(item, slot) {
    if (slot.firstChild) return;
    slot.appendChild(item);
    item.classList.remove('selected');
  }

  function returnToPool(item) {
    poolDiv.appendChild(item);
    item.classList.remove('selected');
  }

  function enableReturn(slot, item) {
    slot.addEventListener('click', () => {
      returnToPool(item);
    });
  }

  /* =====================================================
     DESKTOP — Drag & Drop
     ===================================================== */
  if (!isTouch) {
    let dragged = null;

    poolDiv.addEventListener('dragstart', e => {
      const item = e.target.closest('.completetext-item');
      if (!item) return;
      dragged = item;
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', item.dataset.value);
    });

    document.addEventListener('dragend', () => {
      if (dragged) dragged.classList.remove('dragging');
      dragged = null;
    });

    slots.forEach(slot => {
      slot.addEventListener('dragover', e => e.preventDefault());

      slot.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragged) return;
        placeIntoSlot(dragged, slot);
        enableReturn(slot, dragged);
      });
    });
  }

  /* =====================================================
     TOUCH — Tap Select → Tap Slot
     ===================================================== */
  if (isTouch) {
    let selected = null;

    poolDiv.addEventListener('click', e => {
      const item = e.target.closest('.completetext-item');
      if (!item) return;

      poolDiv.querySelectorAll('.completetext-item')
        .forEach(i => i.classList.remove('selected'));

      selected = item;
      item.classList.add('selected');
    });

    slots.forEach(slot => {
      slot.addEventListener('click', () => {
        if (!selected) return;
        placeIntoSlot(selected, slot);
        enableReturn(slot, selected);
        selected = null;
      });
    });
  }

  /* ---------- Feedback / Check ---------- */
  const feedback = document.createElement('div');
  feedback.className = 'completetext-feedback';
  feedback.style.marginTop = '0.5rem';
  container.appendChild(feedback);

  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'Check Text';
  checkBtn.className = 'completetext-check';
  checkBtn.style.marginTop = '0.5rem';
  container.appendChild(checkBtn);

  checkBtn.addEventListener('click', () => {
    let correct = true;

    slots.forEach((slot, idx) => {
      const item = slot.firstChild;
      if (!item || item.dataset.value !== answers[idx]) {
        correct = false;
      }
    });

    if (correct && poolDiv.children.length === 0) {
      feedback.textContent = '✅ Text completed correctly!';
      setTimeout(() => {
        container.innerHTML = '<div class="activity-complete">Complete text activity completed ✅</div>';
        if (ActivityUtils && ActivityUtils.unlockNext)
          ActivityUtils.unlockNext(container);
      }, 800);
    } else {
      feedback.textContent = '❌ Some parts are incorrect. Try again.';
    }
  });
};
