window.ActivityModules = window.ActivityModules || {};

window.ActivityModules.timeline = function(container) {

  container.dataset.activity = "timeline";

  /* ==========================================
     RAW EXTRACTION
     ========================================== */

  let raw = '';

  const rawNode =
    container.querySelector('.activity-raw');

  if (
    rawNode &&
    rawNode.textContent.trim()
  ) {

    raw = rawNode.textContent.trim();

  } else {

    let html =
      container.innerHTML || '';

    html = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '');

    raw = html.trim();
  }

  raw = raw
    .replace(/\[activity:[^\]]+\]/gi, '')
    .replace(/\[end activity\]/gi, '')
    .trim();

  container.innerHTML = '';

  /* ==========================================
     PARSE
     ========================================== */

  const lines =
    raw.split(/\n/)
       .map(l => l.trim())
       .filter(Boolean);

  let promptText = '';

  const items = [];

  lines.forEach(line => {

    if (
      line.toLowerCase()
          .startsWith('prompt:')
    ) {

      promptText =
        line.replace(
          /^[pP]rompt:\s*/,
          ''
        );

    } else if (
      line.includes('|')
    ) {

      const parts =
        line.split('|')
            .map(p => p.trim());

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

    container.innerHTML =
      '<div class="activity-complete">No items found for timeline activity.</div>';

    return;
  }

  const correctOrder =
    [...items].sort(
      (a,b) =>
        Number(a.year) -
        Number(b.year)
    );

  /* ==========================================
     SHUFFLE (FISHER-YATES)
     ========================================== */

  function shuffle(arr) {

    const copy = [...arr];

    for (
      let i = copy.length - 1;
      i > 0;
      i--
    ) {

      const j =
        Math.floor(
          Math.random() * (i + 1)
        );

      [copy[i], copy[j]] =
        [copy[j], copy[i]];
    }

    return copy;
  }

  let poolItems =
    shuffle([...items]);

  let attempts = 0;

  /* ==========================================
     TOUCH DETECTION
     ========================================== */

  const isTouch =
    (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    ) &&
    !window.matchMedia(
      '(pointer:fine)'
    ).matches;

  /* ==========================================
     BUILD UI
     ========================================== */

  const promptDiv =
    document.createElement('div');

  promptDiv.className =
    'timeline-prompt';

  promptDiv.textContent =
    promptText;

  container.appendChild(
    promptDiv
  );

  const wrapper =
    document.createElement('div');

  wrapper.className =
    'timeline-wrapper';

  container.appendChild(
    wrapper
  );

  const timelineArea =
    document.createElement('div');

  timelineArea.className =
    'timeline-dropzone';

  wrapper.appendChild(
    timelineArea
  );

  const poolArea =
    document.createElement('div');

  poolArea.className =
    'timeline-pool';

  wrapper.appendChild(
    poolArea
  );

  const slots = [];

  correctOrder.forEach(
    (_, idx) => {

      const slot =
        document.createElement('div');

      slot.className =
        'timeline-slot';

      slot.dataset.index =
        idx;

      slot.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-slot-inner">
          Drop here
        </div>
      `;

      timelineArea.appendChild(
        slot
      );

      slots.push(slot);
    }
  );

  /* ==========================================
     POOL RENDER
     ========================================== */

  function renderPool() {

    poolArea.innerHTML = '';

    poolItems.forEach(item => {

      const el =
        document.createElement('div');

      el.className =
        'timeline-item';

      el.textContent =
        item.text;

      el.dataset.id =
        item.id;

      el.dataset.year =
        item.year;

      el.draggable =
        !isTouch;

      poolArea.appendChild(el);
    });
  }

  renderPool();

  /* ==========================================
     HELPERS
     ========================================== */

  function clearHighlights() {

    container
      .querySelectorAll('.timeline-item')
      .forEach(item => {

        item.style.background = '';
        item.style.border = '';
      });
  }

  function placeItemInSlot(
    itemEl,
    slot
  ) {

    const inner =
      slot.querySelector(
        '.timeline-slot-inner'
      );

    if (
      inner.querySelector(
        '.timeline-item'
      )
    ) {
      return;
    }

    inner.textContent = '';

    inner.appendChild(itemEl);
  }

  function returnToPool(
    itemEl
  ) {

    poolArea.appendChild(
      itemEl
    );

    itemEl.classList.remove(
      'selected'
    );
  }

  /* ==========================================
     RESET
     ========================================== */

  function resetActivity() {

    attempts = 0;

    feedback.textContent = '';

    solutionBtn.style.display =
      'none';

    clearHighlights();

    slots.forEach(slot => {

      const inner =
        slot.querySelector(
          '.timeline-slot-inner'
        );

      const child =
        inner.querySelector(
          '.timeline-item'
        );

      if (child) {

        poolArea.appendChild(
          child
        );
      }

      inner.textContent =
        'Drop here';
    });

    poolItems =
      shuffle([...items]);

    renderPool();
  }

  /* ==========================================
     SHOW SOLUTION
     ========================================== */

  function showSolution() {

    clearHighlights();

    const previousCorrect =
      new Set();

    slots.forEach(
      (slot, idx) => {

        const inner =
          slot.querySelector(
            '.timeline-slot-inner'
          );

        const child =
          inner.querySelector(
            '.timeline-item'
          );

        if (
          child &&
          child.dataset.id ===
          correctOrder[idx].id
        ) {

          previousCorrect.add(
            child.dataset.id
          );
        }
      }
    );

    slots.forEach(slot => {

      const inner =
        slot.querySelector(
          '.timeline-slot-inner'
        );

      const child =
        inner.querySelector(
          '.timeline-item'
        );

      if (child) {

        poolArea.appendChild(
          child
        );
      }

      inner.textContent =
        'Drop here';
    });

    correctOrder.forEach(
      (correctItem, idx) => {

        const item =
          Array.from(
            poolArea.querySelectorAll(
              '.timeline-item'
            )
          ).find(
            el =>
              el.dataset.id ===
              correctItem.id
          );

        const slot =
          slots[idx];

        placeItemInSlot(
          item,
          slot
        );

        if (
          previousCorrect.has(
            correctItem.id
          )
        ) {

          item.style.background =
            '#d4edda';

          item.style.border =
            '2px solid #28a745';

        } else {

          item.style.background =
            '#f8d7da';

          item.style.border =
            '2px solid #dc3545';
        }
      }
    );

    feedback.textContent =
      'Solution shown. Green = already correct. Red = incorrect placement.';
  }

  /* ==========================================
     DESKTOP
     ========================================== */

  if (!isTouch) {

    let dragged = null;

    container.addEventListener(
      'dragstart',
      e => {

        const item =
          e.target.closest(
            '.timeline-item'
          );

        if (!item) return;

        dragged = item;

        item.classList.add(
          'dragging'
        );
      }
    );

    document.addEventListener(
      'dragend',
      () => {

        if (dragged) {

          dragged.classList.remove(
            'dragging'
          );
        }

        dragged = null;
      }
    );

    slots.forEach(slot => {

      slot.addEventListener(
        'dragover',
        e => e.preventDefault()
      );

      slot.addEventListener(
        'drop',
        e => {

          e.preventDefault();

          if (!dragged) return;

          placeItemInSlot(
            dragged,
            slot
          );
        }
      );

      slot.addEventListener(
        'click',
        () => {

          const inner =
            slot.querySelector(
              '.timeline-slot-inner'
            );

          const child =
            inner.querySelector(
              '.timeline-item'
            );

          if (!child) return;

          inner.textContent =
            'Drop here';

          returnToPool(child);
        }
      );
    });
  }

  /* ==========================================
     MOBILE
     ========================================== */

  if (isTouch) {

    let selected = null;

    poolArea.addEventListener(
      'click',
      e => {

        const item =
          e.target.closest(
            '.timeline-item'
          );

        if (!item) return;

        poolArea
          .querySelectorAll(
            '.timeline-item'
          )
          .forEach(i =>
            i.classList.remove(
              'selected'
            )
          );

        selected = item;

        item.classList.add(
          'selected'
        );
      }
    );

    slots.forEach(slot => {

      slot.addEventListener(
        'click',
        () => {

          const inner =
            slot.querySelector(
              '.timeline-slot-inner'
            );

          const existing =
            inner.querySelector(
              '.timeline-item'
            );

          if (selected) {

            if (!existing) {

              placeItemInSlot(
                selected,
                slot
              );

              selected.classList.remove(
                'selected'
              );

              selected = null;
            }

            return;
          }

          if (existing) {

            inner.textContent =
              'Drop here';

            returnToPool(
              existing
            );
          }
        }
      );
    });
  }

  /* ==========================================
     CONTROLS
     ========================================== */

  const controls =
    document.createElement('div');

  controls.style.display =
    'flex';

  controls.style.flexWrap =
    'wrap';

  controls.style.gap =
    '0.5rem';

  controls.style.marginTop =
    '1rem';

  container.appendChild(
    controls
  );

  const checkBtn =
    document.createElement(
      'button'
    );

  checkBtn.textContent =
    'Check Timeline';

  controls.appendChild(
    checkBtn
  );

  const resetBtn =
    document.createElement(
      'button'
    );

  resetBtn.textContent =
    'Reset Activity';

  controls.appendChild(
    resetBtn
  );

  const solutionBtn =
    document.createElement(
      'button'
    );

  solutionBtn.textContent =
    'Show Solution';

  solutionBtn.style.display =
    'none';

  controls.appendChild(
    solutionBtn
  );

  const feedback =
    document.createElement(
      'div'
    );

  feedback.className =
    'timeline-feedback';

  feedback.style.marginTop =
    '0.75rem';

  container.appendChild(
    feedback
  );

  resetBtn.addEventListener(
    'click',
    resetActivity
  );

  solutionBtn.addEventListener(
    'click',
    showSolution
  );

  /* ==========================================
     CHECK
     ========================================== */

  checkBtn.addEventListener(
    'click',
    () => {

      clearHighlights();

      let correct = true;

      slots.forEach(
        (slot, idx) => {

          const child =
            slot.querySelector(
              '.timeline-item'
            );

          if (!child) {

            correct = false;
            return;
          }

          if (
            child.dataset.id !==
            correctOrder[idx].id
          ) {

            correct = false;
          }
        }
      );

      if (correct) {

        feedback.textContent =
          '✅ Timeline is correct!';

        slots.forEach(slot => {

          const item =
            slot.querySelector(
              '.timeline-item'
            );

          if (!item) return;

          item.style.background =
            '#d4edda';

          item.style.border =
            '2px solid #28a745';

          if (
            !item.dataset.revealed
          ) {

            item.textContent =
              `${item.dataset.year} • ${item.textContent}`;

            item.dataset.revealed =
              'true';
          }
        });

        setTimeout(() => {

          container.innerHTML =
            '<div class="activity-complete">Timeline completed ✅</div>';

          if (
            ActivityUtils &&
            ActivityUtils.unlockNext
          ) {

            ActivityUtils.unlockNext(
              container
            );
          }

        }, 1000);

      } else {

        attempts++;

        feedback.textContent =
          '❌ Incorrect order. Try again.';

        if (attempts >= 1) {

          solutionBtn.style.display =
            '';
        }
      }
    }
  );
};