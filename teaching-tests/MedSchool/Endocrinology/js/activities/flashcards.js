window.ActivityModules = window.ActivityModules || {};

window.ActivityModules.flashcards = function(container) {
  const raw = container.innerHTML.split('<br>').map(l => l.trim()).filter(Boolean);
  container.innerHTML = '';

  const cards = [];
  let current = {};
  raw.forEach(line => {
    if (line.startsWith('front:')) current.front = line.replace(/^front:\s*/, '');
    if (line.startsWith('back:')) {
      current.back = line.replace(/^back:\s*/, '');
      cards.push({...current});
      current = {};
    }
  });

  let index = 0;
  let showingFront = true;

  const title = document.createElement('div');
  title.className = 'activity-title';
  title.textContent = 'Flashcards';
  container.appendChild(title);

  const card = document.createElement('div');
  card.className = 'flashcard';
  container.appendChild(card);

  const progress = document.createElement('div');
  progress.className = 'flashcard-progress';
  container.appendChild(progress);

  function render() {
    if (index >= cards.length) {
      container.innerHTML = `<div class="activity-complete">All flashcards completed.</div>`;
      if (window.ActivityUtils && ActivityUtils.unlockNext) ActivityUtils.unlockNext(container);
      return;
    }
    showingFront = true;

    // Apply fade-in animation
    card.style.opacity = 0;
    setTimeout(()=>{ 
      card.innerHTML = cards[index].front;
      card.style.opacity = 1;
    }, 50);

    progress.textContent = `Card ${index + 1} of ${cards.length}`;
  }

  card.addEventListener('click', () => {
    if (showingFront) {
      card.style.opacity = 0;
      setTimeout(()=>{
        card.innerHTML = cards[index].back;
        card.style.opacity = 1;
        showingFront = false;
      }, 50);
    } else {
      index++;
      render();
    }
  });

  render();
};
