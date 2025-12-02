window.ActivityModules = window.ActivityModules || {};
window.ActivityModules.arrange = function(container) {
  container.dataset.activity = "arrange";

  // --- Robust extraction of raw activity text ---
  let raw = '';
  const rawNode = container.querySelector('.activity-raw');

  if (rawNode && rawNode.textContent.trim()) {
    raw = rawNode.textContent.trim();
  } else {
    // fallback: convert innerHTML to text, turn <br> and </p> into newlines
    let html = container.innerHTML || '';
    html = html.replace(/<br\s*\/?>/gi, '\n');  // <br> → newline
    html = html.replace(/<\/p>/gi, '\n');       // </p> → newline
    html = html.replace(/<[^>]+>/g, '');        // remove all other HTML tags
    raw = html.trim();
  }

  // --- Remove activity tags ---
  raw = raw.replace(/\[activity:[^\]]+\]/gi, '');
  raw = raw.replace(/\[end activity\]/gi, '');
  raw = raw.trim();

  container.innerHTML = '';

  // --- Parse prompt and items ---
  const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);
  let promptText = '';
  const items = [];

  lines.forEach(line => {
    const lower = line.toLowerCase();
    if (lower.startsWith('prompt:')) {
      promptText = line.replace(/^[pP]rompt:\s*/, '');
    } else if (lower.startsWith('item:')) {
      items.push(line.replace(/^[iI]tem:\s*/, '').trim());
    }
  });

  if (!items.length) {
    container.innerHTML = '<div class="activity-complete">No items found for arrange activity.</div>';
    return;
  }

  // --- Randomize items ---
  function shuffle(arr) {
    return arr
      .map(v => [Math.random(), v])
      .sort((a,b) => a[0]-b[0])
      .map(v => v[1]);
  }

  const shuffledItems = shuffle([...items]);

  // --- Build UI ---
  const promptDiv = document.createElement('div');
  promptDiv.className = 'arrange-prompt';
  promptDiv.textContent = promptText;
  container.appendChild(promptDiv);

  const list = document.createElement('ul');
  list.className = 'arrange-list';
  container.appendChild(list);

  shuffledItems.forEach((itemText, idx) => {
    const li = document.createElement('li');
    li.className = 'arrange-item';
    li.textContent = itemText;
    li.setAttribute('draggable', 'true');
    li.dataset.index = idx;
    list.appendChild(li);
  });

  // --- Drag and drop handlers ---
  let dragged = null;

  list.addEventListener('dragstart', (e) => {
    dragged = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    dragged.classList.add('dragging');
  });

  list.addEventListener('dragend', (e) => {
    dragged.classList.remove('dragging');
    dragged = null;
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.arrange-item');
    if (target && target !== dragged) {
      const rect = target.getBoundingClientRect();
      const next = (e.clientY - rect.top) / rect.height > 0.5;
      list.insertBefore(dragged, next ? target.nextSibling : target);
    }
  });

  // --- Feedback / buttons ---
  const feedback = document.createElement('div');
  feedback.className = 'arrange-feedback';
  feedback.style.marginTop = '0.5rem';
  container.appendChild(feedback);

  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'Check Order';
  checkBtn.style.marginTop = '0.5rem';
  checkBtn.className = 'arrange-check';
  container.appendChild(checkBtn);

  checkBtn.addEventListener('click', () => {
    const lis = Array.from(list.children);
    const currentOrder = lis.map(li => li.textContent);
    let correct = true;
    currentOrder.forEach((text, idx) => {
      if (text !== items[idx]) correct = false;
    });

    if (correct) {
      lis.forEach(li => li.classList.add('correct'));
      feedback.textContent = '✅ Correct order!';
      setTimeout(() => {
        container.innerHTML = '<div class="activity-complete">Arrange activity completed ✅</div>';
        if (ActivityUtils && ActivityUtils.unlockNext) ActivityUtils.unlockNext(container);
      }, 800);
    } else {
      lis.forEach(li => li.classList.remove('correct'));
      feedback.textContent = '❌ Incorrect. Try again.';
    }
  });
};
