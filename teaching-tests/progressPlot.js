// progressPlot.js
(function(){
  // debounce helper
  function debounce(fn, wait){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), wait); }; }

  // main function exported globally
  window.loadProgressPlot = function(quizId) {
    const svg = document.getElementById("progressSVG");
    const slider = document.getElementById("progressSlider");
    const viewport = document.getElementById("progressViewport");
    if (!svg || !slider || !viewport) return;

    // Tooltip
    let tooltip = document.getElementById("tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "tooltip";
      Object.assign(tooltip.style, {
        position: "absolute",
        padding: "6px 8px",
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        borderRadius: "5px",
        fontSize: "12px",
        pointerEvents: "none",
        visibility: "hidden",
        zIndex: 10000
      });
      document.body.appendChild(tooltip);
    }

    // read data
    const raw = JSON.parse(localStorage.getItem(`${quizId}_history`) || "[]");
    if (!raw || raw.length === 0) {
      svg.innerHTML = '<text x="10" y="30" font-size="14">No data yet.</text>';
      slider.style.display = "none";
      return;
    }

    // group by day
    const grouped = {};
    raw.forEach(entry => {
      const d = new Date(entry.timestamp);
      const key = d.toISOString().slice(0,10);
      grouped[key] = grouped[key] || [];
      grouped[key].push(entry.percent);
    });

    const days = Object.keys(grouped).sort();
    const stats = days.map(day => {
      const arr = grouped[day].slice().sort((a,b)=>a-b);
      const min = arr[0], max = arr[arr.length - 1], median = arr[Math.floor(arr.length/2)];
      return { day, min, max, median, attempts: arr.length, dateObj: new Date(day) };
    });

    // constants
    const DAY_PX = 100;      // logical width per day (tweakable)
    const VIEWPORT_MIN = 320; // min visible width on tiny devices
    const VIEWPORT_MAX_DAYS = 14; // after this, scrolling required (but cap visible days)
    const totalHeight = 300;
    const H1 = 200, H2 = 80;
    const margin = { left: 40, right: 15, top: 10, bottom: 25 };

    // compute ideal total width
    const numDays = stats.length;
    const idealWidth = Math.max( Math.round(numDays * DAY_PX), 600 );

    // helper to compute visibleWidth according to rules:
    function computeVisibleWidth() {
      const containerWidth = Math.max(VIEWPORT_MIN, viewport.clientWidth || 600);
      if (numDays <= 7) {
        // fit days to container width (no horizontal scrolling)
        return containerWidth;
      }
      if (numDays <= VIEWPORT_MAX_DAYS) {
        // allow it to expand up to min(containerWidth, idealWidth) but not exceed idealWidth
        return Math.min(containerWidth, idealWidth);
      }
      // > VIEWPORT_MAX_DAYS: visible width becomes min(containerWidth, DAY_PX * VIEWPORT_MAX_DAYS)
      return Math.min(containerWidth, DAY_PX * VIEWPORT_MAX_DAYS);
    }

    // scales (use functions closed over idealWidth & stats later)
    function createScales(idealW) {
      const minDate = stats[0].dateObj.getTime();
      const maxDate = stats[stats.length - 1].dateObj.getTime();
      const dateRange = Math.max(1, maxDate - minDate);
      const xScale = t =>
        margin.left + ((t - minDate) / dateRange) * (idealW - margin.left - margin.right);
      const yScale = p =>
        H1 - margin.bottom - (p / 100) * (H1 - margin.top - margin.bottom);
      const maxAttempts = Math.max(...stats.map(s => s.attempts));
      const yScaleBar = a =>
        H1 + H2 - margin.bottom - (a / Math.max(1, maxAttempts)) * (H2 - margin.top - margin.bottom);
      return { xScale, yScale, yScaleBar };
    }

    // state
    let visibleWidth = computeVisibleWidth();
    let scrollable = idealWidth > visibleWidth;
    let currentViewX = Math.max(0, idealWidth - visibleWidth); // start at rightmost by default

    // draw function draws entire SVG coordinate space sized by idealWidth x totalHeight,
    // then sets a viewBox to [currentViewX,0,visibleWidth,totalHeight].
    function draw() {
      visibleWidth = computeVisibleWidth();
      scrollable = idealWidth > visibleWidth;
      if (scrollable) {
        // clamp currentViewX
        currentViewX = Math.min(currentViewX, Math.max(0, idealWidth - visibleWidth));
      } else {
        currentViewX = 0;
      }

      // set svg physical attributes (internal coordinate space equals idealWidth)
      svg.setAttribute("width", idealWidth);
      svg.setAttribute("height", totalHeight);
      svg.style.display = "block";

      const { xScale, yScale, yScaleBar } = createScales(idealWidth);

      // build paths
      const topPoints = stats.map(s => [xScale(s.dateObj.getTime()), yScale(s.max)]);
      const bottomPoints = stats.map(s => [xScale(s.dateObj.getTime()), yScale(s.min)]).reverse();
      const bandPath = [
        "M", topPoints.map(p => p.join(",")).join(" L "),
        "L", bottomPoints.map(p => p.join(",")).join(" L "),
        "Z"
      ].join(" ");
      const medianPath = stats.map(s => `${xScale(s.dateObj.getTime())},${yScale(s.median)}`).join(" L ");

      // axes and elements
      const yTicks = [0,20,40,60,80,100];
      let inner = `<rect x="0" y="0" width="${idealWidth}" height="${totalHeight}" fill="#fff"/>`;

      inner += yTicks.map(p => `
        <line x1="${margin.left}" y1="${yScale(p)}" x2="${idealWidth - margin.right}" y2="${yScale(p)}" stroke="#eee"/>
        <text x="${margin.left - 30}" y="${yScale(p) + 4}" font-size="10">${p}%</text>
      `).join('');

      inner += `<path d="${bandPath}" fill="rgba(100,150,255,0.32)" stroke="none"/>`;
      inner += `<path d="M ${medianPath}" stroke="black" stroke-width="2" fill="none"/>`;

      // points + labels
      inner += stats.map(s => {
        const cx = xScale(s.dateObj.getTime());
        const cy = yScale(s.median);
        return `<circle class="dayPoint" data-day="${s.day}" cx="${cx}" cy="${cy}" r="3" fill="black"/>
                <text x="${cx - 18}" y="${H1 - 5}" font-size="10">${s.day.slice(5)}</text>`;
      }).join('');

      // bars
      const barWidth = Math.max(8, (idealWidth - margin.left - margin.right) / Math.max(1, numDays) * 0.48);
      inner += stats.map(s => {
        const cx = xScale(s.dateObj.getTime());
        const x = cx - barWidth/2;
        const y = yScaleBar(s.attempts);
        const h = (H1 + H2 - margin.bottom) - y;
        return `<rect class="attemptBar" data-day="${s.day}" x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="rgba(0,0,0,0.55)"/>`;
      }).join('');

      inner += `<line x1="${margin.left}" y1="${H1}" x2="${idealWidth - margin.right}" y2="${H1}" stroke="#888" stroke-dasharray="3,2"/>`;

      svg.innerHTML = inner;

      // set viewBox according to currentViewX and visibleWidth
      svg.setAttribute("viewBox", `${Math.round(currentViewX)} 0 ${Math.round(visibleWidth)} ${totalHeight}`);

      // slider setup
      if (scrollable) {
        slider.style.display = "block";
        const maxScroll = Math.max(0, idealWidth - visibleWidth);
        slider.min = 0;
        slider.max = maxScroll;
        slider.step = 1;
        // if slider was at end (default), keep it at max; otherwise keep previous pos
        // keep slider.value aligned to currentViewX
        slider.value = currentViewX;
      } else {
        slider.style.display = "none";
      }

      attachInteractivity();
    }

    // attach hover tooltip events to circles and bars (re-attach each draw)
    function attachInteractivity() {
      const circles = svg.querySelectorAll(".dayPoint");
      const bars = svg.querySelectorAll(".attemptBar");

      circles.forEach(c => {
        c.onmousemove = (e) => {
          const d = stats.find(s => s.day === c.dataset.day);
          if (!d) return;
          tooltip.innerHTML = `<strong>${d.day}</strong><br>Min: ${d.min.toFixed(1)}%<br>Median: ${d.median.toFixed(1)}%<br>Max: ${d.max.toFixed(1)}%`;
          tooltip.style.visibility = "visible";
          tooltip.style.left = (e.pageX + 10) + "px";
          tooltip.style.top = (e.pageY - 18) + "px";
        };
        c.onmouseleave = () => tooltip.style.visibility = "hidden";
      });

      bars.forEach(b => {
        b.onmousemove = (e) => {
          const d = stats.find(s => s.day === b.dataset.day);
          if (!d) return;
          tooltip.innerHTML = `<strong>${d.day}</strong><br>Attempts: ${d.attempts}`;
          tooltip.style.visibility = "visible";
          tooltip.style.left = (e.pageX + 10) + "px";
          tooltip.style.top = (e.pageY - 18) + "px";
        };
        b.onmouseleave = () => tooltip.style.visibility = "hidden";
      });
    }

    // slider interaction
    slider.oninput = function() {
      currentViewX = Number(this.value);
      svg.setAttribute("viewBox", `${Math.round(currentViewX)} 0 ${Math.round(visibleWidth)} ${totalHeight}`);
    };

    // When viewport resizes, recompute visibleWidth but preserve user's relative position:
    // if they were viewing the end, keep anchored to the end; else preserve distance from left
    let userWasAtEnd = true;
    function updateOnResize() {
      const oldVisible = visibleWidth;
      const oldMaxScroll = Math.max(0, idealWidth - oldVisible);
      userWasAtEnd = Math.abs(currentViewX - oldMaxScroll) < 2; // small tolerance

      visibleWidth = computeVisibleWidth();
      const newMaxScroll = Math.max(0, idealWidth - visibleWidth);

      if (userWasAtEnd) {
        currentViewX = newMaxScroll;
      } else {
        // preserve proportion position relative to old max
        const proportion = (oldMaxScroll === 0) ? 0 : currentViewX / oldMaxScroll;
        currentViewX = Math.round(proportion * newMaxScroll);
      }
      // clamp
      currentViewX = Math.max(0, Math.min(currentViewX, newMaxScroll));
      draw();
    }

    // use ResizeObserver when available
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(debounce(updateOnResize, 120));
      ro.observe(viewport);
      // also observe window in case viewport doesn't change but window orientation does
      window.addEventListener('resize', debounce(updateOnResize, 120));
    } else {
      window.addEventListener('resize', debounce(updateOnResize, 120));
    }

    // initial draw (anchor rightmost)
    currentViewX = Math.max(0, idealWidth - computeVisibleWidth());
    draw();
  };
})();
