window.ActivityModules = window.ActivityModules || {};

window.ActivityModules.timeline = function(container) {
  container.dataset.activity = "timeline";

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
  const items = [];

  lines.forEach(line => {
    if (line.toLowerCase().startsWith('prompt:')) {
      promptText = line.replace(/^[pP]rompt:\s*/, '');
    } else if (line.includes('|')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length === 3) {
        items.push({
          id: parts[0],
          text: parts[1],
          year: parts[2]
        });
      }
    }
  });

  if (!items.length) {
    container.innerHTML = '<div class="activity-complete">No items found for timeline activity.</div>';
    return;
  }

  const correctOrder = [...items].sort((a,b)=> Number(a.year) - Number(b.year));

  function shuffle(arr) {
    return arr.map(v => [Math.random(), v])
              .sort((a,b)=>a[0]-b[0])
              .map(v=>v[1]);
  }

  let poolItems = shuffle([...items]);

  /* ---------- Touch detection ---------- */
  const isTouch = (
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    !window.matchMedia('(pointer: fine)').matches
  );

  /* ---------- Build UI ---------- */
  const promptDiv = document.createElement('div');
  promptDiv.className = 'timeline-prompt';
  promptDiv.textContent = promptText;
  container.appendChild(promptDiv);

  const wrapper = document.createElement('div');
  wrapper.className = 'timeline-wrapper';
  container.appendChild(wrapper);

  const timelineArea = document.createElement('div');
  timelineArea.className = 'timeline-dropzone';
  wrapper.appendChild(timelineArea);

  const poolArea = document.createElement('div');
  poolArea.className = 'timeline-pool';
  wrapper.appendChild(poolArea);

  /* ---------- Create slots ---------- */
  const slots = [];
  correctOrder.forEach((item, idx) => {
    const slot = document.createElement('div');
    slot.className = 'timeline-slot';
    slot.dataset.index = idx;
    slot.innerHTML = `<div class="timeline-dot"></div><div class="timeline-slot-inner">Drop here</div>`;
    timelineArea.appendChild(slot);
    slots.push(slot);
  });

  /* ---------- Render pool ---------- */
  function renderPool() {
    poolArea.innerHTML = '';
    poolItems.forEach(item => {
      const el = document.createElement('div');
      el.className = 'timeline-item';
      el.textContent = item.text;
      el.dataset.id = item.id;
      el.dataset.year = item.year;
      el.draggable = !isTouch;
      poolArea.appendChild(el);
    });
  }

  renderPool();

  /* ===============================
     SHARED PLACE / REMOVE LOGIC
     =============================== */
  function placeItemInSlot(itemEl, slot) {
    const inner = slot.querySelector('.timeline-slot-inner');
    if (inner.querySelector('.timeline-item')) return;

    inner.textContent = '';
    inner.appendChild(itemEl);
  }

  function returnToPool(itemEl) {
    poolArea.appendChild(itemEl);
    itemEl.classList.remove('selected');
  }

  function enableReturnClick(itemEl) {
    itemEl.addEventListener('click', () => {
      const parentSlot = itemEl.closest('.timeline-slot');
      if (!parentSlot) return;

      const inner = parentSlot.querySelector('.timeline-slot-inner');
      inner.textContent = 'Drop here';
      returnToPool(itemEl);
    });
  }

  /* =========================================================
     DESKTOP — Drag & Drop
     ========================================================= */
  if (!isTouch) {
    let dragged = null;

    poolArea.addEventListener('dragstart', e => {
      const item = e.target.closest('.timeline-item');
      if (!item) return;
      dragged = item;
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });

    document.addEventListener('dragend', () => {
      if (dragged) dragged.classList.remove('dragging');
      dragged = null;
    });

    slots.forEach(slot => {
      const inner = slot.querySelector('.timeline-slot-inner');

      slot.addEventListener('dragover', e => e.preventDefault());

      slot.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragged) return;

        if (inner.querySelector('.timeline-item')) return;

        placeItemInSlot(dragged, slot);
        enableReturnClick(dragged);
      });
    });
  }

  /* =========================================================
     TOUCH — Tap → Select → Slot
     ========================================================= */
  if (isTouch) {
    let selected = null;

    poolArea.addEventListener('click', e => {
      const item = e.target.closest('.timeline-item');
      if (!item) return;

      poolArea.querySelectorAll('.timeline-item')
        .forEach(i => i.classList.remove('selected'));

      selected = item;
      item.classList.add('selected');
    });

    slots.forEach(slot => {
      const inner = slot.querySelector('.timeline-slot-inner');

      slot.addEventListener('click', () => {
        if (!selected) return;
        if (inner.querySelector('.timeline-item')) return;

        placeItemInSlot(selected, slot);
        enableReturnClick(selected);
        selected.classList.remove('selected');
        selected = null;
      });
    });
  }

  /* ---------- Feedback / Check ---------- */
  const feedback = document.createElement('div');
  feedback.className = 'timeline-feedback';
  feedback.style.marginTop = '0.5rem';
  container.appendChild(feedback);

  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'Check Timeline';
  checkBtn.className = 'timeline-check';
  checkBtn.style.marginTop = '0.5rem';
  container.appendChild(checkBtn);

  checkBtn.addEventListener('click', () => {
    let correct = true;

    slots.forEach((slot, idx) => {
      const inner = slot.querySelector('.timeline-slot-inner');
      const child = inner.querySelector('.timeline-item');
      if (!child) correct = false;
      else if (child.dataset.id !== correctOrder[idx].id) correct = false;
    });

    if (correct) {
      feedback.textContent = '✅ Timeline is correct!';

      // Reveal years
      slots.forEach(slot => {
        const itemEl = slot.querySelector('.timeline-item');
        if (!itemEl) return;
        itemEl.textContent = `${itemEl.dataset.year} • ${itemEl.textContent}`;
      });

      setTimeout(() => {
        container.innerHTML = '<div class="activity-complete">Timeline completed ✅</div>';
        if (ActivityUtils && ActivityUtils.unlockNext)
          ActivityUtils.unlockNext(container);
      }, 900);
    } else {
      feedback.textContent = '❌ Incorrect order. Try again.';
    }
  });
};
