window.ActivityModules = window.ActivityModules || {};

window.ActivityModules.bucket = function(container) {

  container.dataset.activity = "bucket";

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
  const buckets = [];
  const itemMap = new Map();

  lines.forEach(line => {

    if (line.toLowerCase().startsWith('prompt:')) {

      promptText = line.replace(/^[pP]rompt:\s*/, '');

    } else if (line.includes('|')) {

      const [bucketName, rest] = line.split('|').map(s => s.trim());

      const items =
        rest.split(';')
            .map(i => i.trim())
            .filter(Boolean);

      buckets.push({
        name: bucketName,
        items
      });

      items.forEach(item => {
        itemMap.set(item, bucketName);
      });
    }
  });

  const allItems = Array.from(itemMap.keys());

  if (!buckets.length || !allItems.length) {
    container.innerHTML =
      '<div class="activity-complete">No bucket data found.</div>';
    return;
  }

  function shuffle(arr) {
    return arr
      .map(v => [Math.random(), v])
      .sort((a,b) => a[0]-b[0])
      .map(v => v[1]);
  }

  let poolItems = shuffle([...allItems]);

  let attemptCount = 0;

  /* ---------- Touch detection ---------- */

  const isTouch =
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    !window.matchMedia('(pointer: fine)').matches;

  /* ---------- Build UI ---------- */

  const promptDiv = document.createElement('div');
  promptDiv.className = 'bucket-prompt';
  promptDiv.textContent = promptText;
  container.appendChild(promptDiv);

  const bucketArea = document.createElement('div');
  bucketArea.className = 'bucket-area';
  container.appendChild(bucketArea);

  const poolArea = document.createElement('div');
  poolArea.className = 'bucket-pool';
  container.appendChild(poolArea);

  const bucketEls = [];

  buckets.forEach(b => {

    const bucket = document.createElement('div');
    bucket.className = 'bucket';

    const title = document.createElement('div');
    title.className = 'bucket-title';
    title.textContent = b.name;

    bucket.appendChild(title);

    const drop = document.createElement('div');
    drop.className = 'bucket-dropzone';

    bucket.appendChild(drop);

    bucketArea.appendChild(bucket);

    bucketEls.push({
      bucket,
      drop,
      name: b.name
    });
  });

  function renderPool() {

    poolArea.innerHTML = '';

    poolItems.forEach(item => {

      const el = document.createElement('div');

      el.className = 'bucket-item';
      el.textContent = item;
      el.dataset.value = item;
      el.draggable = !isTouch;

      poolArea.appendChild(el);
    });
  }

  renderPool();

  /* ---------- Shared logic ---------- */

  function moveItemToBucket(itemEl, bucketDrop) {
    bucketDrop.appendChild(itemEl);
    itemEl.classList.remove('selected');
  }

  function moveItemToPool(itemEl) {
    poolArea.appendChild(itemEl);
    itemEl.classList.remove('selected');
  }

  function clearHighlights() {

    container.querySelectorAll('.bucket-item').forEach(el => {
      el.style.background = '';
      el.style.border = '';
      el.style.color = '';
    });
  }

  function enableReturnClick(itemEl) {

    itemEl.addEventListener('click', () => {

      const parentBucket =
        itemEl.closest('.bucket-dropzone');

      if (parentBucket) {
        moveItemToPool(itemEl);
      }
    });
  }

  function resetActivity() {

    clearHighlights();

    feedback.textContent = '';

    attemptCount = 0;

    showSolutionBtn.style.display = 'none';

    poolItems = shuffle([...allItems]);

    bucketEls.forEach(({drop}) => {

      Array.from(drop.querySelectorAll('.bucket-item'))
        .forEach(item => moveItemToPool(item));
    });

    poolArea.innerHTML = '';

    renderPool();
  }

  function showSolution() {

    clearHighlights();

    const correctness = new Map();

    bucketEls.forEach(({drop, name}) => {

      Array.from(drop.querySelectorAll('.bucket-item'))
        .forEach(item => {

          correctness.set(
            item.dataset.value,
            itemMap.get(item.dataset.value) === name
          );
        });
    });

    Array.from(poolArea.querySelectorAll('.bucket-item'))
      .forEach(item => {
        correctness.set(item.dataset.value, false);
      });

    container.querySelectorAll('.bucket-item').forEach(item => {

      const correctBucket =
        itemMap.get(item.dataset.value);

      const targetBucket =
        bucketEls.find(b => b.name === correctBucket);

      targetBucket.drop.appendChild(item);

      if (correctness.get(item.dataset.value)) {

        item.style.background = '#d4edda';
        item.style.border = '2px solid #28a745';

      } else {

        item.style.background = '#f8d7da';
        item.style.border = '2px solid #dc3545';
      }
    });

    feedback.textContent =
      'Solution shown. Green = correct. Red = incorrect placement.';
  }

  /* ---------- DESKTOP ---------- */

  if (!isTouch) {

    let dragged = null;

    poolArea.addEventListener('dragstart', e => {

      const item =
        e.target.closest('.bucket-item');

      if (!item) return;

      dragged = item;

      item.classList.add('dragging');

      e.dataTransfer.setData(
        'text/plain',
        item.dataset.value
      );
    });

    document.addEventListener('dragend', () => {

      if (dragged) {
        dragged.classList.remove('dragging');
      }

      dragged = null;
    });

    bucketEls.forEach(({drop}) => {

      drop.addEventListener(
        'dragover',
        e => e.preventDefault()
      );

      drop.addEventListener('drop', e => {

        e.preventDefault();

        if (!dragged) return;

        moveItemToBucket(dragged, drop);

        enableReturnClick(dragged);
      });
    });
  }

  /* ---------- MOBILE ---------- */

  if (isTouch) {

    let selected = null;

    poolArea.addEventListener('click', e => {

      const item =
        e.target.closest('.bucket-item');

      if (!item) return;

      poolArea.querySelectorAll('.bucket-item')
        .forEach(i => i.classList.remove('selected'));

      selected = item;

      item.classList.add('selected');
    });

    bucketEls.forEach(({drop}) => {

      drop.addEventListener('click', () => {

        if (!selected) return;

        moveItemToBucket(selected, drop);

        enableReturnClick(selected);

        selected = null;
      });
    });
  }

  /* ---------- Controls ---------- */

  const controls = document.createElement('div');
  controls.style.marginTop = '1rem';
  controls.style.display = 'flex';
  controls.style.flexWrap = 'wrap';
  controls.style.gap = '0.5rem';

  container.appendChild(controls);

  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'Check Buckets';

  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Activity';

  const showSolutionBtn = document.createElement('button');
  showSolutionBtn.textContent = 'Show Solution';
  showSolutionBtn.style.display = 'none';

  controls.appendChild(checkBtn);
  controls.appendChild(resetBtn);
  controls.appendChild(showSolutionBtn);

  const feedback = document.createElement('div');
  feedback.className = 'bucket-feedback';
  feedback.style.marginTop = '0.75rem';

  container.appendChild(feedback);

  /* ---------- Button handlers ---------- */

  resetBtn.addEventListener('click', resetActivity);

  showSolutionBtn.addEventListener(
    'click',
    showSolution
  );

  checkBtn.addEventListener('click', () => {

    clearHighlights();

    let correct = true;

    bucketEls.forEach(({drop, name}) => {

      const placed =
        Array.from(
          drop.querySelectorAll('.bucket-item')
        );

      placed.forEach(itemEl => {

        const correctBucket =
          itemMap.get(itemEl.dataset.value);

        if (correctBucket !== name) {
          correct = false;
        }
      });
    });

    if (correct && poolArea.children.length === 0) {

      feedback.textContent =
        '✅ All items placed correctly!';

      setTimeout(() => {

        container.innerHTML =
          '<div class="activity-complete">Bucket activity completed ✅</div>';

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
        '❌ Some items are misplaced. Try again.';

      if (attemptCount >= 1) {
        showSolutionBtn.style.display = '';
      }
    }
  });
};