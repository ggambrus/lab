window.ActivityModules = window.ActivityModules || {};

/**
 * Robust touchscreen detection:
 * Returns true if device is touch-capable and pointer is not precise (avoids hybrid desktop false positives)
 */
function isTouchDevice() {
  return (
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    !window.matchMedia('(pointer: fine)').matches
  );
}

/**
 * Desktop version: original HTML5 drag-and-drop
 */
function desktopArrange(container) {
  container.dataset.activity = "arrange";

  // --- Extract raw activity text ---
  let raw = '';
  const rawNode = container.querySelector('.activity-raw');

  if (rawNode && rawNode.textContent.trim()) {
    raw = rawNode.textContent.trim();
  } else {
    let html = container.innerHTML || '';
    html = html.replace(/<br\s*\/?>/gi, '\n');  
    html = html.replace(/<\/p>/gi, '\n');       
    html = html.replace(/<[^>]+>/g, '');        
    raw = html.trim();
  }

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

  // --- Shuffle items ---
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

  // --- Drag-and-drop handlers ---
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

  // --- Feedback ---
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
}

/**
 * Touchscreen version: tap-to-select + move up/down buttons
 */
function touchArrange(container) {
  container.dataset.activity = "arrange";

  // --- Extract raw activity text ---
  let raw = '';
  const rawNode = container.querySelector('.activity-raw');

  if (rawNode && rawNode.textContent.trim()) {
    raw = rawNode.textContent.trim();
  } else {
    let html = container.innerHTML || '';
    html = html.replace(/<br\s*\/?>/gi, '\n');  
    html = html.replace(/<\/p>/gi, '\n');       
    html = html.replace(/<[^>]+>/g, '');        
    raw = html.trim();
  }

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

  // --- Shuffle items ---
  function shuffle(arr) {
    return arr
      .map(v => [Math.random(), v])
      .sort((a,b) => a[0]-b[0])
      .map(v => v[1]);
  }

  let currentItems = shuffle([...items]);

  // --- Build UI ---
  const promptDiv = document.createElement('div');
  promptDiv.className = 'arrange-prompt';
  promptDiv.textContent = promptText;
  container.appendChild(promptDiv);

  const list = document.createElement('ul');
  list.className = 'arrange-list';
  container.appendChild(list);

   function renderList() {
   list.innerHTML = '';
   currentItems.forEach((itemText, idx) => {
     const li = document.createElement('li');
     li.className = 'arrange-item';
     li.textContent = itemText;
     li.dataset.index = idx;
 
     // Control container on right
     const controls = document.createElement('div');
     controls.className = 'arrange-controls';
     controls.style.display = 'inline-flex';
     controls.style.flexDirection = 'column';
     controls.style.marginLeft = '1rem';
 
     // Up button
     const upBtn = document.createElement('button');
     upBtn.innerHTML = '&#8679;'; // ↑
     upBtn.className = 'arrange-up';
     upBtn.title = 'Move up';
     upBtn.style.marginBottom = '0.25rem';
     upBtn.addEventListener('click', () => {
       if (idx === 0) return;
       [currentItems[idx-1], currentItems[idx]] = [currentItems[idx], currentItems[idx-1]];
       renderList();
     });
 
     // Down button
     const downBtn = document.createElement('button');
     downBtn.innerHTML = '&#8681;'; // ↓
     downBtn.className = 'arrange-down';
     downBtn.title = 'Move down';
     downBtn.addEventListener('click', () => {
       if (idx === currentItems.length-1) return;
       [currentItems[idx], currentItems[idx+1]] = [currentItems[idx+1], currentItems[idx]];
       renderList();
     });
 
     controls.appendChild(upBtn);
     controls.appendChild(downBtn);
 
     li.appendChild(controls);
     list.appendChild(li);
   });
 }


  renderList();

  // --- Feedback ---
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
    let correct = true;
    currentItems.forEach((text, idx) => {
      if (text !== items[idx]) correct = false;
    });

    if (correct) {
      feedback.textContent = '✅ Correct order!';
      setTimeout(() => {
        container.innerHTML = '<div class="activity-complete">Arrange activity completed ✅</div>';
        if (ActivityUtils && ActivityUtils.unlockNext) ActivityUtils.unlockNext(container);
      }, 500);
    } else {
      feedback.textContent = '❌ Incorrect. Try again.';
    }
  });
}

// --- Module assignment based on device ---
window.ActivityModules.arrange = isTouchDevice() ? touchArrange : desktopArrange;
console.info('Arrange activity loaded:', isTouchDevice() ? 'touch version' : 'desktop version');
