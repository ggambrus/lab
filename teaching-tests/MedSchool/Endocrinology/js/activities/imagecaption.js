window.ActivityModules = window.ActivityModules || {};

window.ActivityModules.imagecaption = function(container) {

  container.dataset.activity = "imagecaption";

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
  let imageSrc = '';

  const labels = [];

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
      line.toLowerCase()
          .startsWith('image:')
    ) {

      imageSrc =
        line.replace(
          /^[iI]mage:\s*/,
          ''
        ).trim();

    } else if (
      line.includes('|')
    ) {

      const parts =
        line.split('|')
            .map(p => p.trim());

      if (parts.length >= 3) {

        const [
          pos,
          align,
          ...rest
        ] = parts;

        const text =
          rest.join('|');

        const [x,y] =
          pos.split(',')
             .map(Number);

        labels.push({
          x,
          y,
          align,
          text
        });
      }
    }
  });

  if (
    !labels.length ||
    !imageSrc
  ) {

    container.innerHTML =
      '<div class="activity-complete">Invalid imagecaption activity.</div>';

    return;
  }

  /* ==========================================
     UTILITIES
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

  function isTouch() {

    return (
      (
        'ontouchstart'
        in window ||
        navigator.maxTouchPoints > 0
      ) &&
      !window.matchMedia(
        '(pointer:fine)'
      ).matches
    );
  }

  let attempts = 0;

  /* ==========================================
     UI
     ========================================== */

  const promptDiv =
    document.createElement('div');

  promptDiv.className =
    'imagecaption-prompt';

  promptDiv.textContent =
    promptText;

  container.appendChild(
    promptDiv
  );

  const stage =
    document.createElement('div');

  stage.className =
    'imagecaption-stage';

  container.appendChild(
    stage
  );

  const img =
    document.createElement('img');

  img.className =
    'imagecaption-image';

  img.src = imageSrc;

  stage.appendChild(img);

  const overlay =
    document.createElement('div');

  overlay.className =
    'imagecaption-overlay';

  stage.appendChild(overlay);

  const pool =
    document.createElement('div');

  pool.className =
    'imagecaption-pool';

  container.appendChild(pool);

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
    document.createElement('button');

  checkBtn.textContent =
    'Check Answers';

  controls.appendChild(
    checkBtn
  );

  const resetBtn =
    document.createElement('button');

  resetBtn.textContent =
    'Reset Activity';

  controls.appendChild(
    resetBtn
  );

  const solutionBtn =
    document.createElement('button');

  solutionBtn.textContent =
    'Show Solution';

  solutionBtn.style.display =
    'none';

  controls.appendChild(
    solutionBtn
  );

  const feedback =
    document.createElement('div');

  feedback.className =
    'imagecaption-feedback';

  feedback.style.marginTop =
    '0.75rem';

  container.appendChild(
    feedback
  );

  /* ==========================================
     BUILD
     ========================================== */

  img.addEventListener(
    'load',
    () => {

      const w =
        img.naturalWidth;

      const h =
        img.naturalHeight;

      labels.forEach(label => {

        const slot =
          document.createElement(
            'div'
          );

        slot.className =
          `imagecaption-slot ${label.align}`;

        slot.dataset.answer =
          label.text;

        slot.innerHTML =
          '<div class="imagecaption-dot"></div>';

        slot.style.left =
          `${(label.x / w) * 100}%`;

        slot.style.top =
          `${(label.y / h) * 100}%`;

        overlay.appendChild(
          slot
        );
      });

      renderPool();

      wireEvents();
    }
  );

  function renderPool() {

    pool.innerHTML = '';

    shuffle(labels)
      .forEach(label => {

        const el =
          document.createElement(
            'div'
          );

        el.className =
          'imagecaption-label';

        el.textContent =
          label.text;

        el.dataset.value =
          label.text;

        el.draggable =
          !isTouch();

        pool.appendChild(el);
      });
  }

  function clearHighlights() {

    container
      .querySelectorAll(
        '.imagecaption-label'
      )
      .forEach(el => {

        el.style.background =
          '';

        el.style.border =
          '';
      });
  }

  function resetActivity() {

    attempts = 0;

    solutionBtn.style.display =
      'none';

    feedback.textContent = '';

    clearHighlights();

    container
      .querySelectorAll(
        '.imagecaption-label'
      )
      .forEach(label => {

        pool.appendChild(label);
      });

    renderPool();
  }

  function showSolution() {

    clearHighlights();

    const previouslyCorrect =
      new Set();

    container
      .querySelectorAll(
        '.imagecaption-slot'
      )
      .forEach(slot => {

        const label =
          slot.querySelector(
            '.imagecaption-label'
          );

        if (
          label &&
          label.textContent ===
          slot.dataset.answer
        ) {

          previouslyCorrect.add(
            slot.dataset.answer
          );
        }
      });

    container
      .querySelectorAll(
        '.imagecaption-label'
      )
      .forEach(label =>
        pool.appendChild(label)
      );

    labels.forEach(label => {

      const slot =
        Array.from(
          overlay.querySelectorAll(
            '.imagecaption-slot'
          )
        ).find(
          s =>
            s.dataset.answer ===
            label.text
        );

      const item =
        Array.from(
          pool.querySelectorAll(
            '.imagecaption-label'
          )
        ).find(
          l =>
            l.dataset.value ===
            label.text
        );

      if (
        !slot ||
        !item
      ) return;

      slot.appendChild(item);

      if (
        previouslyCorrect.has(
          label.text
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
    });

    feedback.textContent =
      'Solution shown. Green = already correct. Red = incorrect placement.';
  }

  /* ==========================================
     INTERACTION
     ========================================== */

  function wireEvents() {

    const touch =
      isTouch();

    if (!touch) {

      let dragged = null;

      container.addEventListener(
        'dragstart',
        e => {

          const label =
            e.target.closest(
              '.imagecaption-label'
            );

          if (!label) return;

          dragged = label;
        }
      );

      container.addEventListener(
        'dragover',
        e => {

          if (
            e.target.closest(
              '.imagecaption-slot'
            )
          ) {
            e.preventDefault();
          }
        }
      );

      container.addEventListener(
        'drop',
        e => {

          const slot =
            e.target.closest(
              '.imagecaption-slot'
            );

          if (
            !slot ||
            !dragged
          ) return;

          if (
            slot.querySelector(
              '.imagecaption-label'
            )
          ) return;

          slot.appendChild(
            dragged
          );

          dragged = null;
        }
      );

      container.addEventListener(
        'dblclick',
        e => {

          const label =
            e.target.closest(
              '.imagecaption-label'
            );

          if (
            label &&
            label.closest(
              '.imagecaption-slot'
            )
          ) {

            pool.appendChild(
              label
            );
          }
        }
      );

    } else {

      let selected = null;

      container.addEventListener(
        'click',
        e => {

          const label =
            e.target.closest(
              '.imagecaption-label'
            );

          const slot =
            e.target.closest(
              '.imagecaption-slot'
            );

          if (label) {

            const parentSlot =
              label.closest(
                '.imagecaption-slot'
              );

            if (parentSlot) {

              pool.appendChild(
                label
              );

              label.classList.remove(
                'selected'
              );

              selected = null;

              return;
            }

            pool
              .querySelectorAll(
                '.imagecaption-label'
              )
              .forEach(l =>
                l.classList.remove(
                  'selected'
                )
              );

            selected = label;

            selected.classList.add(
              'selected'
            );

            return;
          }

          if (slot) {

            if (!selected) {

              const existing =
                slot.querySelector(
                  '.imagecaption-label'
                );

              if (existing) {

                pool.appendChild(
                  existing
                );
              }

              return;
            }

            if (
              slot.querySelector(
                '.imagecaption-label'
              )
            ) return;

            slot.appendChild(
              selected
            );

            selected.classList.remove(
              'selected'
            );

            selected = null;
          }
        }
      );
    }
  }

  /* ==========================================
     CHECK
     ========================================== */

  checkBtn.addEventListener('click', () => {

    clearHighlights();

    let correct = true;
    let incomplete = false;

    const slots = Array.from(
      container.querySelectorAll('.imagecaption-slot')
    );

    slots.forEach(slot => {

      const label =
        slot.querySelector('.imagecaption-label');

      if (!label) {

        correct = false;
        incomplete = true;
        return;
      }

      if (
        label.textContent !==
        slot.dataset.answer
      ) {

        correct = false;

        label.style.background =
          '#f8d7da';

        label.style.border =
          '2px solid #dc3545';

      } else {

        label.style.background =
          '#d4edda';

        label.style.border =
          '2px solid #28a745';
      }
    });

    if (correct) {

      feedback.textContent =
        '✅ All labels correct!';

      setTimeout(() => {

        container.innerHTML =
          '<div class="activity-complete">Image caption activity completed ✅</div>';

        if (
          typeof ActivityUtils !== 'undefined' &&
          ActivityUtils.unlockNext
        ) {

          ActivityUtils.unlockNext(
            container
          );
        }

      }, 1000);

      return;
    }

    attempts++;

    if (incomplete) {

      feedback.textContent =
        '❌ Some labels have not been placed yet.';

    } else {

      feedback.textContent =
        '❌ Some labels are incorrect. Try again.';
    }

    if (attempts >= 1) {

      solutionBtn.style.display = '';
    }
  });

  /* ==========================================
     BUTTONS
     ========================================== */

  resetBtn.addEventListener(
    'click',
    resetActivity
  );

  solutionBtn.addEventListener(
    'click',
    showSolution
  );

};