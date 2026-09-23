window.ActivityModules = window.ActivityModules || {};

window.ActivityModules.mcq = function(container) {

  container.dataset.activity = "mcq";

  /* =====================================================
     RAW EXTRACTION
     ===================================================== */

  let raw = '';

  const rawNode =
    container.querySelector('.activity-raw');

  if (
    rawNode &&
    rawNode.textContent &&
    rawNode.textContent.trim()
  ) {

    raw = rawNode.textContent.trim();

  } else {

    let html = container.innerHTML || '';

    html = html.replace(
      /<br\s*\/?>/gi,
      '\n'
    );

    const tmp =
      document.createElement('div');

    tmp.innerHTML = html;

    raw = tmp.textContent.trim();
  }

  container.innerHTML = '';

  /* =====================================================
     PARSE QUESTIONS
     ===================================================== */

  const blocks =
    raw.split(/\n\s*\n/)
       .map(b => b.trim())
       .filter(Boolean);

  const questions = [];

  let current = null;

  blocks.forEach(block => {

    block.split(/\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => {

        if (
          line.toLowerCase()
              .startsWith('prompt:')
        ) {

          current = {
            prompt :
              line.replace(
                /^[pP]rompt:\s*/,
                ''
              ),
            options : [],
            explanation : ''
          };

          questions.push(current);

        } else if (
          line.toLowerCase()
              .startsWith('correct:')
        ) {

          current.options.push({
            text :
              line.replace(
                /^[cC]orrect:\s*/,
                ''
              ),
            correct : true
          });

        } else if (
          line.toLowerCase()
              .startsWith('wrong:')
        ) {

          current.options.push({
            text :
              line.replace(
                /^[wW]rong:\s*/,
                ''
              ),
            correct : false
          });

        } else if (
          line.toLowerCase()
              .startsWith('explanation:')
        ) {

          current.explanation =
            line.replace(
              /^[eE]xplanation:\s*/,
              ''
            );

        } else if (current) {

          if (
            current.options.length === 0
          ) {

            current.prompt +=
              ' ' + line;

          } else {

            current.options[
              current.options.length - 1
            ].text += ' ' + line;
          }
        }
      });
  });

  if (!questions.length) {

    container.innerHTML =
      '<div class="activity-complete">No MCQ questions found.</div>';

    return;
  }

  /* =====================================================
     FISHER-YATES SHUFFLE
     ===================================================== */

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

  /* =====================================================
     UNLOCK
     ===================================================== */

  const unlock =
    (
      typeof ActivityUtils !==
      'undefined' &&
      ActivityUtils.unlockNext
    )
      ? ActivityUtils.unlockNext
      : () => {};

  let qIndex = 0;

  function renderQuestion() {

    container.innerHTML = '';

    const q =
      questions[qIndex];

    let attemptCount = 0;

    const promptDiv =
      document.createElement('div');

    promptDiv.className =
      'mcq-prompt';

    promptDiv.textContent =
      `Q${qIndex + 1}: ${q.prompt}`;

    container.appendChild(
      promptDiv
    );

    const optionsWrapper =
      document.createElement('div');

    optionsWrapper.className =
      'mcq-options';

    container.appendChild(
      optionsWrapper
    );

    const shuffled =
      shuffle([...q.options]);

    shuffled.forEach(opt => {

      const btn =
        document.createElement(
          'button'
        );

      btn.type = 'button';

      btn.className =
        'mcq-option';

      btn.textContent =
        opt.text;

      btn.style.display =
        'block';

      btn.style.width =
        '100%';

      btn.style.margin =
        '0.35rem 0';

      btn.dataset.correct =
        String(opt.correct);

      btn.addEventListener(
        'click',
        () => {

          btn.classList.toggle(
            'selected'
          );
        }
      );

      optionsWrapper.appendChild(
        btn
      );
    });

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

    const submitBtn =
      document.createElement(
        'button'
      );

    submitBtn.textContent =
      'Submit Answer';

    controls.appendChild(
      submitBtn
    );

    const resetBtn =
      document.createElement(
        'button'
      );

    resetBtn.textContent =
      'Reset Question';

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
      'mcq-feedback';

    feedback.style.marginTop =
      '0.75rem';

    container.appendChild(
      feedback
    );

    function clearMarks() {

      optionsWrapper
        .querySelectorAll(
          '.mcq-option'
        )
        .forEach(btn => {

          btn.classList.remove(
            'correct',
            'wrong',
            'selected'
          );

          btn.style.background =
            '';

          btn.style.border =
            '';
        });

      feedback.textContent =
        '';
    }

    resetBtn.addEventListener(
      'click',
      clearMarks
    );

    solutionBtn.addEventListener(
      'click',
      () => {

        optionsWrapper
          .querySelectorAll(
            '.mcq-option'
          )
          .forEach(btn => {

            const correct =
              btn.dataset.correct
              === 'true';

            if (correct) {

              btn.style.background =
                '#d4edda';

              btn.style.border =
                '2px solid #28a745';

            }
          });

        feedback.textContent =
          q.explanation ||
          'Correct answers highlighted in green.';
      }
    );

    submitBtn.addEventListener(
      'click',
      () => {

        const selected =
          Array.from(
            optionsWrapper
            .querySelectorAll(
              '.selected'
            )
          );

        if (
          selected.length === 0
        ) {

          feedback.textContent =
            'Please select at least one answer.';

          return;
        }

        const selectedTexts =
          selected.map(
            b =>
              b.textContent.trim()
          );

        const correctTexts =
          q.options
            .filter(
              o => o.correct
            )
            .map(
              o => o.text
            );

        const isCorrect =
          selectedTexts.length ===
          correctTexts.length &&
          selectedTexts.every(
            t =>
              correctTexts.includes(
                t
              )
          );

        optionsWrapper
          .querySelectorAll(
            '.mcq-option'
          )
          .forEach(btn => {

            const isCorrectOption =
              btn.dataset.correct
              === 'true';

            const isSelected =
              btn.classList.contains(
                'selected'
              );

            btn.style.background =
              '';

            btn.style.border = '';

            if (
              isSelected &&
              !isCorrectOption
            ) {

              btn.style.background =
                '#f8d7da';

              btn.style.border =
                '2px solid #dc3545';
            }

            if (isCorrectOption) {

              btn.style.background =
                '#d4edda';

              btn.style.border =
                '2px solid #28a745';
            }
          });

        if (isCorrect) {

          feedback.textContent =
            '✅ Correct!';

          submitBtn.disabled =
            true;

          setTimeout(() => {

            qIndex++;

            if (
              qIndex <
              questions.length
            ) {

              renderQuestion();

            } else {

              container.innerHTML =
                '<div class="activity-complete">All questions completed ✅</div>';

              unlock(container);
            }

          }, 1000);

        } else {

          attemptCount++;

          feedback.textContent =
            q.explanation ||
            '❌ Incorrect. Try again.';

          if (
            attemptCount >= 1
          ) {
            solutionBtn.style.display =
              '';
          }
        }
      });
  }

  renderQuestion();
};