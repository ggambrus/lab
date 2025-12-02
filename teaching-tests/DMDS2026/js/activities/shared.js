window.ActivityUtils = window.ActivityUtils || {};

window.ActivityUtils.unlockNext = function(container) {
  // Respect the nostop override
  if (new URLSearchParams(window.location.search).get('nostop') === 'true') return;

  // Ensure we have a container
  if (!container || !(container instanceof Element)) return;

  // Mark this activity container as complete (in case module didn't set a marker)
  try {
    container.dataset.complete = 'true';
  } catch (e) {
    // ignore
  }

  // Find the parent lecture section of this activity
  const section = container.closest('.lecture-section');

  // If we can't find a section, fallback to the old behaviour (reveal next activity)
  if (!section) {
    const activities = Array.from(document.querySelectorAll('.activity-container'));
    const idx = activities.indexOf(container);
    if (idx >= 0 && idx + 1 < activities.length) {
      const next = activities[idx + 1];
      next.style.display = 'block';
    }
    return;
  }

  // Check whether all activity containers in this section are complete.
  const activitiesInSection = Array.from(section.querySelectorAll('.activity-container'));
  const allComplete = activitiesInSection.length === 0 ? true : activitiesInSection.every(a => {
    // Consider a completed activity if:
    //  - it has data-complete="true" OR
    //  - it contains an element with class 'activity-complete'
    return a.dataset.complete === 'true' || !!a.querySelector('.activity-complete');
  });

  if (!allComplete) {
    // Do not unlock the next section yet
    return;
  }

  // All activities in this section are complete — reveal the next .lecture-section
  // Find next sibling that is a lecture-section
  let nextSection = section.nextElementSibling;
  while (nextSection && !nextSection.classList.contains('lecture-section')) {
    nextSection = nextSection.nextElementSibling;
  }

  if (nextSection) {
    nextSection.style.display = '';
  }
};
