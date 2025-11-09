/* app.js
   Data-driven interactive checklist for the coursework prep tool.
   - Expects data.json in the same folder.
   - Works with your HTML that contains:
     #steps, #intro, #items, #status, #score, #download,
     #timer-display, #start-timer, #stop-timer, #reset-timer, #timer-note
*/

window.STATE = window.STATE || { values: {}, warnings: {} };

document.addEventListener('DOMContentLoaded', () => {
  init();
});

const STORAGE_KEY = 'proposal_prep_state_v1';
let DATA = null;
const STATE = {
  values: {},    // itemId -> value (boolean/string/array)
  warnings: {}   // itemId -> warning message (from conditions)
};
let practiceTimer = { id: null, remaining: 0 };

// ---- Initialization -------------------------------------------------------
async function init() {
  loadSavedState();
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch data.json (${res.status})`);
    DATA = await res.json();

    // Basic sanity of DATA
    if (!DATA || !Array.isArray(DATA.steps) || DATA.steps.length === 0) {
      showFatalError('data.json is missing or has no steps array.');
      return;
    }
	
	const faqData = DATA.faq;
    if (faqData) {
      renderFAQ(faqData);
    };
	
    renderStepsNav();
    // select first step by default
    selectStep(DATA.steps[0].id);
    setupDownload();
    setupPracticeTimer();
    evaluateAllConditions(); // in case saved state triggers warnings
    updateStatusAndScore();
  } catch (err) {
    console.error('Error loading data.json:', err);
    showFatalError('Error loading data.json — check console for details.');
  }
}

function showFatalError(msg) {
  const intro = document.getElementById('intro');
  if (intro) intro.innerHTML = `<div style="color: #b00020"><strong>${escapeHtml(msg)}</strong></div>`;
}

// ---- Save / Load ---------------------------------------------------------
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ values: STATE.values }));
  } catch (e) {
    console.warn('Failed to save state', e);
  }
}

function loadSavedState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return;
    const parsed = JSON.parse(s);
    if (parsed && parsed.values) STATE.values = parsed.values;
  } catch (e) {
    console.warn('Failed to load saved state', e);
  }
}

// ---- Rendering: Steps nav -------------------------------------------------
function renderStepsNav() {
  const el = document.getElementById('steps');
  if (!el) {
    console.error('#steps element not found in HTML.');
    return;
  }
  el.innerHTML = '';
  DATA.steps.forEach(step => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'step';
    btn.textContent = step.title || step.id;
    btn.dataset.stepId = step.id;
    btn.addEventListener('click', () => selectStep(step.id));
    el.appendChild(btn);
  });
}

function selectStep(stepId) {
  if (!DATA) return;
  const step = DATA.steps.find(s => s.id === stepId);
  if (!step) {
    console.error('Step not found:', stepId);
    return;
  }

  // mark active in nav
  document.querySelectorAll('#steps .step').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.stepId === stepId);
  });

  // render intro
  const intro = document.getElementById('intro');
  if (intro) {
    intro.innerHTML = `<h2>${escapeHtml(step.title || '')}</h2>
                       <p class="small">${escapeHtml(step.intro || '')}</p>`;
  }

  // render items
  renderItems(step);
  evaluateAllConditions();
  updateStatusAndScore();
}

// ---- Render items for a step ---------------------------------------------
function renderItems(step) {
  const container = document.getElementById('items');
  if (!container) {
    console.error('#items element not found in HTML.');
    return;
  }
  container.innerHTML = ''; // clear

  (step.items || []).forEach(item => {
    // root wrapper
    const wrapper = document.createElement('div');
    wrapper.className = `item ${item.importance || ''}`.trim();
    wrapper.dataset.itemId = item.id;

    // left: meta/label
    const meta = document.createElement('div');
    meta.className = 'meta';
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = item.text || item.title || '(no text)';
    meta.appendChild(label);
    if (item.message) {
      const msg = document.createElement('div');
      msg.className = 'small';
      msg.textContent = item.message;
      meta.appendChild(msg);
    }
    wrapper.appendChild(meta);

    // right: controls / actions
    const actions = document.createElement('div');
    actions.className = 'actions';

    // Render control by type
    const type = item.type || 'check';
    if (type === 'check') {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `chk_${item.id}`;
      cb.checked = !!STATE.values[item.id];
      cb.addEventListener('change', () => updateValue(item.id, cb.checked));
      actions.appendChild(cb);

    } else if (type === 'select') {
      const sel = document.createElement('select');
      sel.id = `sel_${item.id}`;
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- choose --';
      sel.appendChild(defaultOpt);
      (item.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        sel.appendChild(o);
      });
      sel.value = STATE.values[item.id] || '';
      sel.addEventListener('change', () => updateValue(item.id, sel.value));
      actions.appendChild(sel);

    } else if (type === 'multiselect') {
      const box = document.createElement('div');
      box.className = 'multi';
      const existing = STATE.values[item.id] || [];
      (item.options || []).forEach((opt, i) => {
        const labelOpt = document.createElement('label');
        labelOpt.className = 'small';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = opt;
        cb.checked = Array.isArray(existing) && existing.includes(opt);
        cb.addEventListener('change', () => {
          const checked = Array.from(box.querySelectorAll('input[type=checkbox]:checked')).map(x => x.value);
          updateValue(item.id, checked);
        });
        labelOpt.appendChild(cb);
        labelOpt.appendChild(document.createTextNode(' ' + opt));
        box.appendChild(labelOpt);
      });
      actions.appendChild(box);

    } else if (type === 'image-choice') {
      const grid = document.createElement('div');
      grid.className = 'image-grid';
      const chosen = STATE.values[item.id] || null;
      (item.images || []).forEach(img => {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'image-choice';
        imgWrap.dataset.itemId = item.id;
        imgWrap.dataset.imageId = img.id || img.src;
        if (chosen && chosen === (img.id || img.src)) imgWrap.classList.add('selected');

        const imageEl = document.createElement('img');
        imageEl.src = img.src;
        imageEl.alt = img.label || '';
        imageEl.width = 140;
        imageEl.height = 100;
        imageEl.loading = 'lazy';
        imgWrap.appendChild(imageEl);

        const caption = document.createElement('div');
        caption.className = 'small';
        caption.textContent = img.label || '';
        imgWrap.appendChild(caption);

        imgWrap.addEventListener('click', () => {
          updateValue(item.id, img.id || img.src);
          // refresh selection visuals
          const siblings = grid.querySelectorAll('.image-choice');
          siblings.forEach(s => s.classList.remove('selected'));
          imgWrap.classList.add('selected');
        });

        grid.appendChild(imgWrap);
      });
      actions.appendChild(grid);

    } else if (type === 'timer-check') {
      // Render a confirm checkbox (students manually confirm they kept audio under limit)
      const limit = (DATA && DATA.metadata && DATA.metadata.audio_limit_seconds) || 360;
      const labelConfirm = document.createElement('label');
      labelConfirm.className = 'small';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!STATE.values[item.id];
      cb.addEventListener('change', () => updateValue(item.id, cb.checked));
      labelConfirm.appendChild(cb);
      labelConfirm.appendChild(document.createTextNode(` I confirm my audio is ≤ ${formatSeconds(limit)} `));
      actions.appendChild(labelConfirm);

      // also show the configured penalty/note
      if (DATA && DATA.metadata) {
        const note = document.createElement('div');
        note.className = 'small';
        note.textContent = `Penalty for exceeding: ${DATA.metadata.audio_penalty_marks || 0} marks`;
        actions.appendChild(note);
      }

    } else {
      // fallback: show static note
      const note = document.createElement('div');
      note.className = 'small';
      note.textContent = `Unsupported item type: ${type}`;
      actions.appendChild(note);
    }

    wrapper.appendChild(actions);
    container.appendChild(wrapper);
  });
}

// ---- Update state when user changes something ----------------------------
function updateValue(itemId, value) {
  // store and persist
  STATE.values[itemId] = value;
  saveState();
  evaluateAllConditions();
  updateStatusAndScore();
}

// ---- Conditions / Warnings evaluation ------------------------------------
function evaluateAllConditions() {
  STATE.warnings = {};
  if (!DATA) return;
  for (const step of DATA.steps) {
    for (const item of (step.items || [])) {
      if (!item.conditions) continue;
      // item.conditions is expected to be an array of simple conditions like:
      // { "field": "design_choice", "equals": "Longitudinal ..." }
      for (const cond of item.conditions) {
        const field = cond.field;
        const expected = cond.equals;
        const actual = STATE.values[field];

        let match = false;
        if (actual === undefined || actual === null) match = false;
        else if (Array.isArray(actual)) match = actual.includes(expected);
        else match = String(actual) === String(expected);

        if (match) {
          // add a warning for this item (use item's message if present or cond.message)
          STATE.warnings[item.id] = item.message || cond.message || `Condition triggered: ${field} = ${expected}`;
        } else {
          // if previously set warning for this item from other conds, do nothing here;
          // we'll remove below if no cond matched
        }
      }
      // Remove warning if none of item's conditions currently match:
      const anyMatch = (item.conditions || []).some(cond => {
        const val = STATE.values[cond.field];
        if (val === undefined || val === null) return false;
        if (Array.isArray(val)) return val.includes(cond.equals);
        return String(val) === String(cond.equals);
      });
      if (!anyMatch && STATE.warnings[item.id]) {
        delete STATE.warnings[item.id];
      }
    }
  }
}

// ---- Status & scoring display --------------------------------------------
function updateStatusAndScore() {
  const statusEl = document.getElementById('status');
  const scoreEl = document.getElementById('score');
  if (!DATA) return;

  let totalMust = 0, gotMust = 0;
  let totalShould = 0, gotShould = 0;
  const missingMust = [];
  const missingShould = [];
  const warningList = Object.values(STATE.warnings || {});

  for (const step of DATA.steps) {
    for (const item of (step.items || [])) {
      const importance = (item.importance || '').toLowerCase();
      const ok = checkItemOk(item);

      if (importance === 'must') {
        totalMust++;
        if (ok) gotMust++;
        else missingMust.push(item.text || item.id);
      } else if (importance === 'should') {
        totalShould++;
        if (ok) gotShould++;
        else missingShould.push(item.text || item.id);
      }
    }
  }

  const mustPct = totalMust ? Math.round((gotMust / totalMust) * 100) : 100;
  const shouldPct = totalShould ? Math.round((gotShould / totalShould) * 100) : 100;

  if (statusEl) {
    let html = `<div class="line"><strong>Must items completed:</strong> ${gotMust}/${totalMust} (${mustPct}%)</div>`;
    html += `<div class="line"><strong>Recommended (should) completed:</strong> ${gotShould}/${totalShould} (${shouldPct}%)</div>`;
    if (missingMust.length) html += `<div class="line"><strong>Missing must items:</strong><ul>${missingMust.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul></div>`;
    if (missingShould.length) html += `<div class="line"><strong>Missing recommended items:</strong><ul>${missingShould.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul></div>`;
    if (warningList.length) html += `<div class="line"><strong>Warnings:</strong><ul>${warningList.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`;
    statusEl.innerHTML = html;
  }

  if (scoreEl) {
    scoreEl.innerHTML = `<div class="line"><strong>Must completion:</strong> ${mustPct}%</div>
                         <div class="line"><strong>Recommended completion:</strong> ${shouldPct}%</div>`;
  }
}

// ---- Check whether a single item is satisfied ----------------------------
function checkItemOk(item) {
  const val = STATE.values[item.id];

  const type = item.type || 'check';
  if (type === 'check' || type === 'timer-check') {
    return !!val;
  } else if (type === 'select') {
    return val !== undefined && val !== null && String(val).trim() !== '';
  } else if (type === 'multiselect') {
    return Array.isArray(val) && val.length > 0;
  } else if (type === 'image-choice') {
    return val !== undefined && val !== null && String(val).trim() !== '';
  }
  // fallback: consider present value as OK
  return val !== undefined && val !== null && String(val) !== '';
}

// ---- Download readiness summary ------------------------------------------
function setupDownload() {
  const btn = document.getElementById('download');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const out = {
      timestamp: new Date().toISOString(),
      metadata: DATA && DATA.metadata ? DATA.metadata : {},
      values: STATE.values,
      warnings: STATE.warnings
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proposal-readiness.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

// ---- Practice timer (6-minute audio practice) ----------------------------
function setupPracticeTimer() {
  const limit = (DATA && DATA.metadata && DATA.metadata.audio_limit_seconds) || 360;
  const penalty = (DATA && DATA.metadata && DATA.metadata.audio_penalty_marks) || 0;
  practiceTimer.remaining = limit;

  const display = document.getElementById('timer-display');
  const startBtn = document.getElementById('start-timer');
  const stopBtn = document.getElementById('stop-timer');
  const resetBtn = document.getElementById('reset-timer');
  const note = document.getElementById('timer-note');

  if (display) display.textContent = formatSeconds(practiceTimer.remaining);
  if (note) note.textContent = `Practice timer. Penalty if final audio > limit: ${penalty} marks`;

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (practiceTimer.id) return; // already running
      practiceTimer.id = setInterval(() => {
        practiceTimer.remaining--;
        if (display) display.textContent = formatSeconds(Math.max(0, practiceTimer.remaining));
        if (practiceTimer.remaining <= 0) {
          clearInterval(practiceTimer.id);
          practiceTimer.id = null;
          alert(`Practice timer reached ${formatSeconds(limit)}. Reminder: exceeding the limit on submission may incur a ${penalty}-mark penalty.`);
        }
      }, 1000);
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      if (practiceTimer.id) {
        clearInterval(practiceTimer.id);
        practiceTimer.id = null;
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (practiceTimer.id) {
        clearInterval(practiceTimer.id);
        practiceTimer.id = null;
      }
      practiceTimer.remaining = limit;
      if (display) display.textContent = formatSeconds(practiceTimer.remaining);
    });
  }
}

/* ---------- Robust Clear-All + Save/Load helpers ----------*/
function clearAllItems() {
  // --- 1. Uncheck all checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach(box => {
    box.checked = false;
  });

  // --- 2. Reset all <select> dropdowns to their default
  document.querySelectorAll('select').forEach(select => {
    select.selectedIndex = 0;
  });

  // --- 3. Clear "image-grid" selections (assuming selected items have a 'selected' class)
  document.querySelectorAll('.image-grid .selected').forEach(el => {
    el.classList.remove('selected');
  });

  // --- 4. Remove any saved state (localStorage or sessionStorage)
  localStorage.clear();
  sessionStorage.clear();

  // --- 5. Optionally, reset any global progress-tracking variables (if you use them)
  if (window.checklistProgress) window.checklistProgress = {};

  // --- 6. Update live status and score panels
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = '✅ All items and progress cleared.';

  const scoreEl = document.getElementById('score');
  if (scoreEl) scoreEl.textContent = 'Progress: 0% complete.';

  console.log('Checklist fully cleared (checkboxes, selects, images, and saved state).');
}

// Attach event listener safely
window.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('clear-all');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const confirmClear = confirm('Are you sure you want to clear all saved progress and selections?');
      if (confirmClear) {
        clearAllItems();
		window.location.reload();
      }
    });
  }
});

/*Printing the checklist*/
(function(){
  async function fetchChecklistData() {
    try {
      const response = await fetch("data.json");
      if (!response.ok) throw new Error("Unable to fetch data.json");
      return await response.json();
    } catch (err) {
      console.error("Error loading data.json:", err);
      alert("Could not load data.json. Make sure it is in the same folder as this page.");
      return null;
    }
  }

  // Convert image URL to Base64 data URI
  async function toBase64Image(url) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn(`⚠️ Could not embed image ${url}`, err);
      return url; // fallback to original URL
    }
  }

  async function generatePrintableHTML(data) {
    if (!data || !data.steps) return "<p>No data available.</p>";

    let htmlHeader = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${data.metadata?.title || "Printable Checklist"}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 2em; color: #222; line-height: 1.5; }
          h1 { text-align: center; margin-bottom: 0.5em; }
          h2 { border-bottom: 2px solid #ccc; padding-bottom: 0.2em; margin-top: 1.5em; color: #333; }
          p.intro { color: #555; margin-bottom: 0.5em; }
          ul { list-style: none; padding-left: 0; }
          li { margin: 0.4em 0; padding: 0.3em 0.6em; border-left: 3px solid #007acc; background: #f9f9f9; display: flex; align-items: flex-start; gap: 0.6em; }
          input[type="checkbox"] { transform: scale(1.2); margin-top: 0.2em; }
          .section { margin-bottom: 1.5em; }
          .meta { font-size: 0.9em; color: #555; margin-bottom: 2em; text-align: center; }
          .importance { font-weight: bold; color: #b00; margin-left: 0.4em; }
          .options { font-style: italic; color: #555; font-size: 0.9em; margin-top: 0.2em; }
          .message { color: #444; font-size: 0.9em; margin-left: 2em; }
          img.thumb { max-width: 160px; display: block; margin: 0.4em 0; border-radius: 8px; }
          .imageset { display: flex; gap: 1em; flex-wrap: wrap; margin-top: 0.5em; }
          .img-label { text-align: center; font-size: 0.85em; margin-top: 0.2em; color: #333; }
          button { margin: 1em auto; display: block; padding: 0.6em 1.2em; background: #007acc; color: #fff; border: none; border-radius: 5px; font-size: 1em; cursor: pointer; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>Proposal Preparation Checklist</h1>
        <div class="meta">
          Generated on ${new Date().toLocaleString()}<br/>
          Required file format: ${data.metadata?.required_file_format || "N/A"} |
          Reference style: ${data.metadata?.reference_style || "N/A"}
        </div>
    `;

    let htmlBody = "";

    for (const step of data.steps) {
      htmlBody += `<div class="section">
        <h2>${step.title || step.id}</h2>
        ${step.intro ? `<p class="intro">${step.intro}</p>` : ""}
        <ul>
      `;

      for (const item of step.items || []) {
        // Checkbox rendering if type == "check"
        const checkbox = item.type === "check" ? `<input type="checkbox" />` : "";

        htmlBody += `<li>
          ${checkbox}
          <div>
            ${item.text || item.label || "<em>Untitled item</em>"}
            ${item.importance ? ` <span class="importance">(${item.importance.toUpperCase()})</span>` : ""}
            ${item.message ? `<div class="message">${item.message}</div>` : ""}
        `;

        // Include options for selects or multiselects
        if (item.options && Array.isArray(item.options)) {
          htmlBody += `<div class="options">Options: ${item.options.join(", ")}</div>`;
        }

        // Include images for image-choice (Base64 embedded)
        if (item.images && Array.isArray(item.images)) {
          htmlBody += `<div class="imageset">`;
          for (const img of item.images) {
            const base64 = await toBase64Image(img.src);
            htmlBody += `
              <div>
                <img class="thumb" src="${base64}" alt="${img.label}">
                <div class="img-label">${img.label}</div>
              </div>
            `;
          }
          htmlBody += `</div>`;
        }

        htmlBody += `</div></li>`;
      }

      htmlBody += `</ul></div>`;
    }

    const htmlFooter = `
        <div class="meta">
          <button onclick="window.print()">🖨️ Print this checklist</button>
        </div>
      </body>
      </html>
    `;

    return htmlHeader + htmlBody + htmlFooter;
  }

  async function openPrintableChecklist() {
    const data = await fetchChecklistData();
    if (!data) return;

    const html = await generatePrintableHTML(data);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("download-printable");
    if (btn) btn.addEventListener("click", openPrintableChecklist);
  });
})();


/*FAQ*/




function renderFAQ(faqData) {
  const itemsEl = document.getElementById('faq-items');
  const searchEl = document.getElementById('faq-search');
  
  const faqTitleEl = document.getElementById('faq-title');
  const faqIntroEl = document.getElementById('faq-intro');

  faqTitleEl.innerHTML = faqData.title;
  faqIntroEl.innerHTML = faqData.intro;
  
  // Render FAQ items
  itemsEl.innerHTML = '';
  faqData.items.forEach((item, index) => {
    const container = document.createElement('div');
    container.className = 'faq-item';

    const question = document.createElement('div');
    question.className = 'faq-question';
    question.textContent = item.question;

    const answer = document.createElement('div');
    answer.className = 'faq-answer';
    answer.textContent = item.answer;

    // Expand/collapse
    question.addEventListener('click', () => {
      answer.classList.toggle('show');
    });

    container.appendChild(question);
    container.appendChild(answer);
    itemsEl.appendChild(container);
  });

  // Search with highlights
  searchEl.addEventListener('input', () => {
    const query = searchEl.value.trim().toLowerCase();

    faqData.items.forEach((item, index) => {
      const container = itemsEl.children[index];
      const questionEl = container.querySelector('.faq-question');
      const answerEl = container.querySelector('.faq-answer');

      // Reset text first
      questionEl.textContent = item.question;
      answerEl.textContent = item.answer;

      // Check match
      const match = item.question.toLowerCase().includes(query) ||
                    item.answer.toLowerCase().includes(query);
      container.style.display = match || query === '' ? '' : 'none';

      // Highlight matches
      if (query) {
        if (item.question.toLowerCase().includes(query)) {
          questionEl.innerHTML = highlight(item.question, query);
        }
        if (item.answer.toLowerCase().includes(query)) {
          answerEl.innerHTML = highlight(item.answer, query);
        }
      }
    });
  });

  function highlight(text, query) {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }
}

// ---- Utilities ------------------------------------------------------------
function formatSeconds(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
