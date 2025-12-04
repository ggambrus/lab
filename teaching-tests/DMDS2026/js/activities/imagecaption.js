window.ActivityModules = window.ActivityModules || {};

function isTouchDevice() {
  return (
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    !window.matchMedia('(pointer: fine)').matches
  );
}

window.ActivityModules.imagecaption = function (container) {
  container.dataset.activity = "imagecaption";

  /* ---------- RAW EXTRACTION ---------- */
  let raw = '';
  const rawNode = container.querySelector('.activity-raw');
  if (rawNode && rawNode.textContent.trim()) raw = rawNode.textContent.trim();
  else {
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
  let imageSrc = '';
  const labels = [];

  lines.forEach(line => {
    if (line.toLowerCase().startsWith('prompt:'))
      promptText = line.replace(/^[pP]rompt:\s*/, '');

    else if (line.toLowerCase().startsWith('image:'))
      imageSrc = line.replace(/^[iI]mage:\s*/, '').trim();

    else if (line.includes('|')) {
      const parts = line.split('|').map(p => p.trim());
      // Expect "x,y|align-...|Text"
      if (parts.length >= 3) {
        const [pos, align, ...rest] = parts;
        const text = rest.join('|').trim();
        const [xStr, yStr] = pos.split(',').map(s => s.trim());
        const x = parseFloat(xStr);
        const y = parseFloat(yStr);
        labels.push({ x, y, align: align || 'align-center', text });
      }
    }
  });

  if (!labels.length || !imageSrc) {
    container.innerHTML = '<div class="activity-complete">Invalid imagecaption activity.</div>';
    return;
  }

  /* ---------- UI ---------- */
  const promptDiv = document.createElement('div');
  promptDiv.className = 'imagecaption-prompt';
  promptDiv.textContent = promptText;
  container.appendChild(promptDiv);

  const stage = document.createElement('div');
  stage.className = 'imagecaption-stage';
  container.appendChild(stage);

  const img = document.createElement('img');
  img.src = imageSrc;
  img.className = 'imagecaption-image';
  img.alt = promptText || 'image';
  stage.appendChild(img);

  const overlay = document.createElement('div');
  overlay.className = 'imagecaption-overlay';
  stage.appendChild(overlay);

  const pool = document.createElement('div');
  pool.className = 'imagecaption-pool';
  container.appendChild(pool);

  const feedback = document.createElement('div');
  feedback.className = 'imagecaption-feedback';
  container.appendChild(feedback);

  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'Check Answers';
  checkBtn.className = 'imagecaption-check';
  container.appendChild(checkBtn);

  /* ---------- BUILD PLACEHOLDERS AFTER IMAGE LOAD ---------- */
  img.addEventListener('load', () => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    labels.forEach(item => {
      const slot = document.createElement('div');
      slot.className = `imagecaption-slot ${item.align || 'align-center'}`;
      slot.dataset.answer = item.text;
      slot.dataset.px = item.x;
      slot.dataset.py = item.y;

      // a small dot element for the marker
      const dot = document.createElement('div');
      dot.className = 'imagecaption-dot';
      slot.appendChild(dot);

      overlay.appendChild(slot);

      // Use percentage positioning (responsive)
      const leftPct = (item.x / w) * 100;
      const topPct = (item.y / h) * 100;
      slot.style.left = `${leftPct}%`;
      slot.style.top = `${topPct}%`;
    });

    // ensure overlay is on top of image and responsive (in case of CSS changes)
    overlay.style.position = 'absolute';
    overlay.style.left = 0;
    overlay.style.top = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';

    // After slots exist we can populate pool and wire interactions (delegated)
    populatePoolAndWire();
  });

  /* ---------- SHUFFLE AND CREATE LABELS IN POOL ---------- */
  function shuffle(arr) {
    return arr.map(v => [Math.random(), v])
      .sort((a, b) => a[0] - b[0])
      .map(v => v[1]);
  }

  function populatePoolAndWire() {
    pool.innerHTML = '';
    shuffle(labels).forEach(item => {
      const lbl = document.createElement('div');
      lbl.className = 'imagecaption-label';
      lbl.textContent = item.text;
      lbl.dataset.value = item.text;
      lbl.draggable = !isTouchDevice();
      pool.appendChild(lbl);
    });

    // Use event delegation for robustness on touch and after DOM moves
    const isTouch = isTouchDevice();

    // -------------------- DESKTOP DRAG & DROP --------------------
    if (!isTouch) {
      let dragged = null;

      // dragstart on labels (delegated)
      container.addEventListener('dragstart', (e) => {
        const lbl = e.target.closest('.imagecaption-label');
        if (!lbl) return;
        dragged = lbl;
        // set a dummy data to allow drag
        try { e.dataTransfer.setData('text/plain', ''); } catch (err) {}
      });

      // dragover: allow drop only when pointer over a slot
      container.addEventListener('dragover', (e) => {
        if (e.target.closest('.imagecaption-slot')) e.preventDefault();
      });

      // drop handling
      container.addEventListener('drop', (e) => {
        const slot = e.target.closest('.imagecaption-slot');
        if (!slot || !dragged) return;

        // Prevent multiple labels in one slot: if occupied, ignore drop
        if (slot.querySelector('.imagecaption-label')) {
          // optionally: provide feedback
          feedback.textContent = 'Slot already occupied — remove existing label first.';
          return;
        }

        // Move existing label back to pool if the dragged label was previously inside a slot
        const currentParent = dragged.parentElement;
        if (currentParent && currentParent.classList.contains('imagecaption-slot')) {
          // nothing special — moving is simple append
        }

        slot.appendChild(dragged);
        dragged.classList.remove('selected');
        dragged = null;
      });

      // Allow double-click on a placed label to return to pool
      container.addEventListener('dblclick', (e) => {
        const lbl = e.target.closest('.imagecaption-label');
        if (!lbl) return;
        const parentSlot = lbl.closest('.imagecaption-slot');
        if (parentSlot) {
          pool.appendChild(lbl);
        }
      });
    }

    // -------------------- TOUCH (tap-to-place / tap-to-return) --------------------
    else {
      let selected = null;

      // Click in pool or on labels (delegated) — select or deselect
      container.addEventListener('click', (e) => {
        const clickedLabel = e.target.closest('.imagecaption-label');
        const clickedSlot = e.target.closest('.imagecaption-slot');

        // If clicked on a label
        if (clickedLabel) {
          // If label is already placed inside a slot -> return it to pool (tap-out)
          const parentSlot = clickedLabel.closest('.imagecaption-slot');
          if (parentSlot) {
            pool.appendChild(clickedLabel);
            // clear selection if it was selected
            if (selected === clickedLabel) selected = null;
            clickedLabel.classList.remove('selected');
            return;
          }

          // Otherwise it's in the pool -> select it
          pool.querySelectorAll('.imagecaption-label').forEach(l => l.classList.remove('selected'));
          selected = clickedLabel;
          selected.classList.add('selected');
          return;
        }

        // If clicked on a slot area (not on a label), attempt to place selected label
        if (clickedSlot) {
          if (!selected) {
            // nothing selected to place
            return;
          }

          // Prevent placing into occupied slot
          if (clickedSlot.querySelector('.imagecaption-label')) {
            feedback.textContent = 'Slot already occupied — remove existing label first.';
            return;
          }

          clickedSlot.appendChild(selected);
          selected.classList.remove('selected');
          selected = null;
          return;
        }

        // Clicked elsewhere: clear selection
        if (selected) {
          selected.classList.remove('selected');
          selected = null;
        }
      });
    }
  } /* end populatePoolAndWire */

  /* ---------- CHECK ---------- */
  checkBtn.addEventListener('click', () => {
    let correct = true;
    const slotEls = Array.from(container.querySelectorAll('.imagecaption-slot'));
    slotEls.forEach(slot => {
      const lbl = slot.querySelector('.imagecaption-label');
      if (!lbl || lbl.textContent !== slot.dataset.answer) correct = false;
    });

    if (correct) {
      feedback.textContent = '✅ All labels correct!';
      setTimeout(() => {
        container.innerHTML = '<div class="activity-complete">Imagecaption completed ✅</div>';
        if (ActivityUtils && ActivityUtils.unlockNext) ActivityUtils.unlockNext(container);
      }, 800);
    } else {
      feedback.textContent = '❌ Some labels are incorrect. Try again.';
    }
  });

  /* ---------- make reflow safe on resize (slots are percentage-based so they remain positioned)
       but ensure any overlay sizing or other layout-dependent adjustments run on resize if needed. */
  window.addEventListener('resize', () => {
    // nothing required since we used percentage coords for slot positions and the labels are appended into slots.
    // This hook is present for future enhancements (e.g., repositioning label tooltips).
  }, { passive: true });
};
