// progressPlot.js
function loadProgressPlot(quizId) {
  const svg = document.getElementById("progressSVG");
  const slider = document.getElementById("progressSlider");
  svg.innerHTML = "";

  const data = JSON.parse(localStorage.getItem(`${quizId}_history`) || "[]");
  if (data.length === 0) {
    svg.innerHTML = '<text x="10" y="50">No data yet.</text>';
    return;
  }

  // === Group by day ===
  const grouped = {};
  data.forEach(entry => {
    const d = new Date(entry.timestamp);
    const key = d.toISOString().slice(0, 10);
    grouped[key] = grouped[key] || [];
    grouped[key].push(entry.percent);
  });

  // === Compute daily stats ===
  const days = Object.keys(grouped).sort();
  const stats = days.map(day => {
    const arr = grouped[day].sort((a,b)=>a-b);
    const min = arr[0];
    const max = arr[arr.length - 1];
    const median = arr[Math.floor(arr.length / 2)];
    return { day, min, max, median, dateObj: new Date(day) };
  });

  // === SVG Sizing & Scrolling ===
  const container = svg.parentElement;
  const visibleWidth = container.clientWidth || 600;
  const numDays = stats.length;

  const idealWidth = numDays * 100;
  const maxVisible = 14 * 100; // up to 2-week visible span
  const fullWidth = Math.max(visibleWidth, Math.min(idealWidth, maxVisible));
  const scrollable = idealWidth > fullWidth;

  svg.setAttribute("width", scrollable ? idealWidth : "100%");
  svg.setAttribute("height", 200);
  svg.style.display = "block";
  svg.style.overflow = "hidden";

  // === Axis Scaling ===
  const W = idealWidth;
  const H = 200;
  const margin = { left: 40, right: 15, top: 10, bottom: 25 };

  const minDate = stats[0].dateObj.getTime();
  const maxDate = stats[stats.length - 1].dateObj.getTime();
  const dateRange = maxDate - minDate || 1;

  const xScale = t =>
    margin.left + ((t - minDate) / dateRange) * (W - margin.left - margin.right);
  const yScale = p =>
    H - margin.bottom - (p / 100) * (H - margin.top - margin.bottom);

  // === Draw Paths ===
  const topPoints = stats.map(d => [xScale(d.dateObj.getTime()), yScale(d.max)]);
  const bottomPoints = stats.map(d => [xScale(d.dateObj.getTime()), yScale(d.min)]).reverse();
  const bandPath = [
    "M", topPoints.map(p => p.join(",")).join(" L "),
    "L", bottomPoints.map(p => p.join(",")).join(" L "),
    "Z"
  ].join(" ");
  const medianPath = stats.map(d => `${xScale(d.dateObj.getTime())},${yScale(d.median)}`).join(" L ");

  const yTicks = [0, 20, 40, 60, 80, 100];
  svg.innerHTML = `
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
    ${yTicks.map(p => `
      <line x1="${margin.left}" y1="${yScale(p)}" x2="${W - margin.right}" y2="${yScale(p)}" stroke="#eee"/>
      <text x="${margin.left - 30}" y="${yScale(p) + 4}" font-size="10">${p}%</text>
    `).join('')}
    <path d="${bandPath}" fill="rgba(100,150,255,0.3)" stroke="none"/>
    <path d="M ${medianPath}" stroke="black" stroke-width="2" fill="none"/>
    ${stats.map(d => `
      <circle cx="${xScale(d.dateObj.getTime())}" cy="${yScale(d.median)}" r="3" fill="black"/>
      <text x="${xScale(d.dateObj.getTime()) - 18}" y="${H - 5}" font-size="10">${d.day.slice(5)}</text>
    `).join('')}
  `;

  // === Scroll Behavior ===
  if (scrollable) {
    slider.style.display = "block";
    const maxScroll = idealWidth - fullWidth;
    slider.max = maxScroll;
    
    // Start at rightmost position (showing most recent days)
    const startScroll = Math.max(0, maxScroll);
    slider.value = startScroll;
    svg.setAttribute("viewBox", `${startScroll} 0 ${fullWidth} 200`);

    // Slider event → move the visible window
    slider.oninput = () => {
      svg.setAttribute("viewBox", `${slider.value} 0 ${fullWidth} 200`);
    };
  } else {
    slider.style.display = "none";
    svg.setAttribute("viewBox", `0 0 ${fullWidth} 200`);
  }
}
