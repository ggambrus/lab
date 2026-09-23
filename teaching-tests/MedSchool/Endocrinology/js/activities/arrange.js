window.ActivityModules = window.ActivityModules || {};

/* =========================================================
   TOUCH DETECTION
   ========================================================= */

function isTouchDevice() {
  return (
    ('ontouchstart' in window ||
      navigator.maxTouchPoints > 0) &&
    !window.matchMedia('(pointer: fine)').matches
  );
}

/* =========================================================
   FISHER-YATES SHUFFLE
   ========================================================= */

function shuffle(arr) {

  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {

    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [copy[i], copy[j]] =
      [copy[j], copy[i]];
  }

  return copy;
}

/* =========================================================
   PARSE ARRANGE DATA
   ========================================================= */

function parseArrange(container) {

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

  const lines =
    raw.split(/\n/)
       .map(l => l.trim())
       .filter(Boolean);

  let promptText = '';

  const items = [];

  lines.forEach(line => {

    const lower =
      line.toLowerCase();

    if (
      lower.startsWith('prompt:')
    ) {

      promptText =
        line.replace(
          /^[pP]rompt:\s*/,
          ''
        );

    } else if (
      lower.startsWith('item:')
    ) {

      items.push(
        line.replace(
          /^[iI]tem:\s*/,
          ''
        ).trim()
      );
    }
  });

  return {
    promptText,
    items
  };
}

/* =========================================================
   DESKTOP VERSION
   ========================================================= */

function desktopArrange(container) {

  container.dataset.activity =
    "arrange";

  const {
    promptText,
    items
  } = parseArrange(container);

  if (!items.length) {

    container.innerHTML =
      '<div class="activity-complete">No items found.</div>';

    return;
  }

  container.innerHTML = '';

  let attempts = 0;

  function buildUI() {

    container.innerHTML = '';

    const promptDiv =
      document.createElement('div');

    promptDiv.className =
      'arrange-prompt';

    promptDiv.textContent =
      promptText;

    container.appendChild(
      promptDiv
    );

    const list =
      document.createElement('ul');

    list.className =
      'arrange-list';

    container.appendChild(list);

    const shuffled =
      shuffle([...items]);

    shuffled.forEach(text => {

      const li =
        document.createElement('li');

      li.className =
        'arrange-item';

      li.textContent =
        text;

      li.draggable = true;

      list.appendChild(li);
    });

    const feedback =
      document.createElement('div');

    feedback.className =
      'arrange-feedback';

    feedback.style.marginTop =
      '0.75rem';

    container.appendChild(
      feedback
    );

    const controls =
      document.createElement('div');

    controls.style.display =
      'flex';

    controls.style.flexWrap =
      'wrap';

    controls.style.gap =
      '0.5rem';

    controls.style.marginTop =
      '0.75rem';

    container.appendChild(
      controls
    );

    const checkBtn =
      document.createElement('button');

    checkBtn.textContent =
      'Check Order';

    const resetBtn =
      document.createElement('button');

    resetBtn.textContent =
      'Reset Activity';

    const solutionBtn =
      document.createElement('button');

    solutionBtn.textContent =
      'Show Solution';

    solutionBtn.style.display =
      attempts > 0
        ? ''
        : 'none';

    controls.appendChild(
      checkBtn
    );

    controls.appendChild(
      resetBtn
    );

    controls.appendChild(
      solutionBtn
    );

    /* ---------- drag ---------- */

    let dragged = null;

    list.addEventListener(
      'dragstart',
      e => {

        dragged =
          e.target;

        dragged.classList.add(
          'dragging'
        );
      }
    );

    list.addEventListener(
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

    list.addEventListener(
      'dragover',
      e => {

        e.preventDefault();

        const target =
          e.target.closest(
            '.arrange-item'
          );

        if (
          !target ||
          target === dragged
        ) return;

        const rect =
          target.getBoundingClientRect();

        const after =
          e.clientY >
          rect.top +
          rect.height / 2;

        list.insertBefore(
          dragged,
          after
            ? target.nextSibling
            : target
        );
      }
    );

    function clearMarks() {

      list
        .querySelectorAll(
          '.arrange-item'
        )
        .forEach(li => {

          li.style.background =
            '';

          li.style.border =
            '';
        });
    }

    /* ---------- check ---------- */

    checkBtn.addEventListener(
      'click',
      () => {

        clearMarks();

        const current =
          Array.from(
            list.children
          ).map(
            x => x.textContent
          );

        let correct =
          true;

        current.forEach(
          (text, idx) => {

            const li =
              list.children[idx];

            if (
              text === items[idx]
            ) {

              li.style.background =
                '#d4edda';

              li.style.border =
                '2px solid #28a745';

            } else {

              correct = false;

              li.style.background =
                '#f8d7da';

              li.style.border =
                '2px solid #dc3545';
            }
          }
        );

        if (correct) {

          feedback.textContent =
            '✅ Correct order!';

          setTimeout(() => {

            container.innerHTML =
              '<div class="activity-complete">Arrange activity completed ✅</div>';

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

          solutionBtn.style.display =
            '';

          feedback.textContent =
            '❌ Incorrect order. Try again.';
        }
      }
    );

    /* ---------- solution ---------- */

    solutionBtn.addEventListener(
      'click',
      () => {

        const oldOrder =
          Array.from(
            list.children
          ).map(
            x => x.textContent
          );

        list.innerHTML = '';

        items.forEach(
          (item, idx) => {

            const li =
              document.createElement(
                'li'
              );

            li.className =
              'arrange-item';

            li.textContent =
              item;

            li.draggable =
              false;

            if (
              oldOrder[idx] ===
              item
            ) {

              li.style.background =
                '#d4edda';

              li.style.border =
                '2px solid #28a745';

            } else {

              li.style.background =
                '#f8d7da';

              li.style.border =
                '2px solid #dc3545';
            }

            list.appendChild(
              li
            );
          }
        );

        feedback.textContent =
          'Solution shown. Green = already correct. Red = incorrect position.';
      }
    );

	resetBtn.addEventListener(
	  'click',
	  () => {
		attempts = 0;
		buildUI();
	  }
	);
  }

  buildUI();
}

function touchArrange(container) {

  container.dataset.activity = "arrange";

  const {
    promptText,
    items
  } = parseArrange(container);

  if (!items.length) {

    container.innerHTML =
      '<div class="activity-complete">No items found.</div>';

    return;
  }

  container.innerHTML = '';

  let currentItems =
    shuffle([...items]);

  let attempts = 0;

  function buildUI() {

    container.innerHTML = '';

    const promptDiv =
      document.createElement('div');

    promptDiv.className =
      'arrange-prompt';

    promptDiv.textContent =
      promptText;

    container.appendChild(promptDiv);

    const list =
      document.createElement('ul');

    list.className =
      'arrange-list';

    container.appendChild(list);

    const feedback =
      document.createElement('div');

    feedback.className =
      'arrange-feedback';

    feedback.style.marginTop =
      '0.75rem';

    container.appendChild(feedback);

    const controlsBar =
      document.createElement('div');

    controlsBar.style.display =
      'flex';

    controlsBar.style.flexWrap =
      'wrap';

    controlsBar.style.gap =
      '0.5rem';

    controlsBar.style.marginTop =
      '0.75rem';

    container.appendChild(
      controlsBar
    );

    const checkBtn =
      document.createElement('button');

    checkBtn.textContent =
      'Check Order';

    const resetBtn =
      document.createElement('button');

    resetBtn.textContent =
      'Reset Activity';

    const solutionBtn =
      document.createElement('button');

    solutionBtn.textContent =
      'Show Solution';

    solutionBtn.style.display =
      attempts > 0
        ? ''
        : 'none';

    controlsBar.appendChild(
      checkBtn
    );

    controlsBar.appendChild(
      resetBtn
    );

    controlsBar.appendChild(
      solutionBtn
    );

    /* ====================================
       RENDER LIST
       ==================================== */

    function renderList(
      highlightMap = null
    ) {

      list.innerHTML = '';

      currentItems.forEach(
        (itemText, idx) => {

          const li =
            document.createElement(
              'li'
            );

          li.className =
            'arrange-item';

          li.style.display =
            'flex';

          li.style.alignItems =
            'center';

          li.style.gap =
            '0.75rem';

          li.style.padding =
            '0.5rem';

          li.style.border =
            '1px solid #ddd';

          li.style.borderRadius =
            '8px';

          li.style.marginBottom =
            '0.5rem';

          const controls =
            document.createElement(
              'div'
            );

          controls.style.display =
            'flex';

          controls.style.flexDirection =
            'column';

          controls.style.flex =
            '0 0 48px';

          function makeBtn(
            icon
          ) {

            const btn =
              document.createElement(
                'button'
              );

            btn.type =
              'button';

            btn.innerHTML =
              icon;

            btn.style.minWidth =
              '36px';

            btn.style.minHeight =
              '36px';

            btn.style.border =
              '1px solid #ccc';

            btn.style.borderRadius =
              '6px';

            btn.style.background =
              '#fff';

            return btn;
          }

          const upBtn =
            makeBtn('▲');

          const downBtn =
            makeBtn('▼');

          upBtn.style.marginBottom =
            '6px';

          upBtn.addEventListener(
            'click',
            e => {

              e.stopPropagation();

              if (idx === 0)
                return;

              [
                currentItems[idx - 1],
                currentItems[idx]
              ] =
              [
                currentItems[idx],
                currentItems[idx - 1]
              ];

              renderList();
            }
          );

          downBtn.addEventListener(
            'click',
            e => {

              e.stopPropagation();

              if (
                idx ===
                currentItems.length - 1
              ) return;

              [
                currentItems[idx],
                currentItems[idx + 1]
              ] =
              [
                currentItems[idx + 1],
                currentItems[idx]
              ];

              renderList();
            }
          );

          controls.appendChild(
            upBtn
          );

          controls.appendChild(
            downBtn
          );

          const textDiv =
            document.createElement(
              'div'
            );

          textDiv.style.flex =
            '1';

          textDiv.style.wordBreak =
            'break-word';

          textDiv.textContent =
            itemText;

          li.appendChild(
            controls
          );

          li.appendChild(
            textDiv
          );

          if (
            highlightMap &&
            highlightMap[idx] !==
            undefined
          ) {

            if (
              highlightMap[idx]
            ) {

              li.style.background =
                '#d4edda';

              li.style.border =
                '2px solid #28a745';

            } else {

              li.style.background =
                '#f8d7da';

              li.style.border =
                '2px solid #dc3545';
            }
          }

          list.appendChild(
            li
          );
        }
      );
    }

    renderList();

    /* ====================================
       RESET
       ==================================== */

    resetBtn.addEventListener(
      'click',
      () => {

        attempts = 0;

        currentItems =
          shuffle([...items]);

        buildUI();
      }
    );

    /* ====================================
       SHOW SOLUTION
       ==================================== */

    solutionBtn.addEventListener(
      'click',
      () => {

        const oldOrder =
          [...currentItems];

        const correctness =
          {};

        oldOrder.forEach(
          (item, idx) => {

            correctness[idx] =
              item ===
              items[idx];
          }
        );

        currentItems =
          [...items];

        renderList(
          correctness
        );

        feedback.textContent =
          'Solution shown. Green = already correct. Red = incorrect position.';
      }
    );

    /* ====================================
       CHECK
       ==================================== */

    checkBtn.addEventListener(
      'click',
      () => {

        let correct = true;

        const correctness =
          {};

        currentItems.forEach(
          (item, idx) => {

            const match =
              item ===
              items[idx];

            correctness[idx] =
              match;

            if (!match) {
              correct = false;
            }
          }
        );

        renderList(
          correctness
        );

        if (correct) {

          feedback.textContent =
            '✅ Correct order!';

          setTimeout(() => {

            container.innerHTML =
              '<div class="activity-complete">Arrange activity completed ✅</div>';

            if (
              typeof ActivityUtils !==
                'undefined' &&
              ActivityUtils.unlockNext
            ) {

              ActivityUtils.unlockNext(
                container
              );
            }

          }, 1000);

        } else {

          attempts++;

          solutionBtn.style.display =
            '';

          feedback.textContent =
            '❌ Incorrect order. Try again.';
        }
      }
    );
  }

  buildUI();
}

window.ActivityModules.arrange =
  isTouchDevice()
    ? touchArrange
    : desktopArrange;

console.info(
  'Arrange activity loaded:',
  isTouchDevice()
    ? 'touch version'
    : 'desktop version'
);