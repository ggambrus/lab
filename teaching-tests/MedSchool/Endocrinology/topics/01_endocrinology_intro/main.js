import { parseLecture, renderMarkdown } from '../../js/parser.js';
import { formatReferences } from '../../js/bibtex.js';
import '../../js/activities/flashcards.js';
import '../../js/activities/mcq.js';
import '../../js/activities/arrange.js';
import '../../js/activities/connect.js';
import '../../js/activities/timeline.js';
import '../../js/activities/bucket.js';
import '../../js/activities/completetext.js';
import '../../js/activities/imagecaption.js';
import '../../js/activities/survey.js';

const lectureContainer = document.getElementById('lecture-container');
const noStop = new URLSearchParams(window.location.search).get('nostop') === 'true';

async function loadLecture(filename) {
  const res = await fetch(filename);
  const mdext = await res.text();

  const { text, bibEntries } = parseLecture(mdext);

  // Render the processed markdown (this will contain <div class="lecture-section"...> wrappers)
  lectureContainer.innerHTML = renderMarkdown(text);

  // Render bibliography
  const bibDiv = document.getElementById('bibliography');
  if (bibDiv) bibDiv.innerHTML = formatReferences(bibEntries);

  // If not noStop, hide all sections except the first
  if (!noStop) sequentialUnlock();

  // Mount activities after sections are in place
  const activities = document.querySelectorAll('.activity-container');
  activities.forEach(act => {
    const type = act.dataset.activity;
    if (window.ActivityModules && window.ActivityModules[type]) {
      loadActivityCSS(type);
      // Call module with container
      window.ActivityModules[type](act);
    }
  });

  // For debugging: expose the final injected mdext string in console (parser already sets window.__mdext_injected)
  // also log sections info
  try {
    console.info('Injected mdext available as window.__mdext_injected (inspect for debugging).');
    const secs = Array.from(document.querySelectorAll('.lecture-section')).map(s => s.id);
    console.info('Detected sections:', secs);
  } catch (e) {
    // ignore
  }
}

function loadActivityCSS(type) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `../../style/activities/${type}.css`;
  document.head.appendChild(link);
}

function sequentialUnlock() {
  const sections = Array.from(document.querySelectorAll('.lecture-section'));
  // Hide all but the first section
  sections.forEach((sec, i) => {
    if (i === 0) {
      // Make sure first section is visible
      sec.style.display = '';
    } else {
      sec.style.display = 'none';
    }
  });
}

loadLecture('lecture.mdext');
