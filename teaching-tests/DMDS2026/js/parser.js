import { parseBibTeX } from './bibtex.js';
import { getCitationNumber, resetCitations } from './citations.js';

export function parseLecture(mdext) {
  resetCitations();
  mdext = mdext.replace(/\r\n/g, '\n');

  // Extract BibTeX references (unchanged)
  const referencesMatch = mdext.match(/\[references\]\s*([\s\S]*?)\s*\[end references\]/m);
  let bibEntries = [];
  if (referencesMatch) {
    const bibText = referencesMatch[1].trim();
    bibEntries = parseBibTeX(bibText);
  }

  // Remove references section from mdext (we will keep elsewhere)
  mdext = mdext.replace(/\[references\][\s\S]*?\[end references\]/m, '');

  // --- Section injection logic ---
  // Goal:
  // 1) Insert [start section] at top and [end section] at bottom
  // 2) After each run of one-or-more consecutive [activity:...][end activity] blocks,
  //    insert [end section]\n[start section]\n so sections end after the last activity in a run.
  //
  // We only examine [activity: ... ] ... [end activity] markers to determine splits.

  // Normalize spacing so our tokenization is reliable
  const normalize = s => s.replace(/\r\n/g, '\n');

  let working = normalize(mdext);

  // Tokenize the document into activity blocks and non-activity text blocks.
  // Keep activity blocks intact (including their internal newlines).
  // Regex will catch '[activity:' up to the next '[end activity]' (non-greedy).
  const tokenRegex = /(\[activity:[\s\S]*?\[end activity\])/g;
  const parts = working.split(tokenRegex).filter(p => p !== undefined);

  // Build new text with explicit [start section] and [end section] markers
  const outputParts = [];
  outputParts.push('[start section]\n');

  // We will treat sequences of consecutive activity tokens specially:
  // after the last activity in a consecutive run, insert section boundary.
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // If this part is an activity block (starts with [activity:)
    if (part.trim().startsWith('[activity:')) {
      // append activity block as-is
      outputParts.push(part.trim() + '\n');

      // Lookahead: if next part exists and is also an activity, continue the run.
      // If next part doesn't exist OR next part is not an activity, this is the last
      // activity in a run → close current section and start a new one.
      const next = parts[i + 1];
      const nextIsActivity = next && next.trim().startsWith('[activity:');
      if (!nextIsActivity) {
        // close and open new section boundary
        outputParts.push('\n[end section]\n[start section]\n');
      }
    } else {
      // Non-activity text. Append as-is.
      outputParts.push(part);
    }
  }

  // Ensure we end with a single [end section]
  outputParts.push('\n[end section]\n');

  const injected = outputParts.join('').replace(/\n{3,}/g, '\n\n'); // tidy excessive blank lines

  // Expose the final injected mdext string for debugging in console:
  // (so you can inspect window.__mdext_injected)
  try {
    window.__mdext_injected = injected;
  } catch (e) {
    // ignore if window not available
  }

  return { text: injected, bibEntries };
}

// Render markdown with citations, headings, images, activities
export function renderMarkdown(mdext) {
  let html = mdext;

  // Convert section markers into section divs with incremental ids
  let sectionCounter = 0;
  // Replace [start section] with opening div; assign ids incrementally.
  html = html.replace(/\[start section\]/g, () => {
    const id = `section-${++sectionCounter}`;
    return `<div class="lecture-section" id="${id}">`;
  });
  // Replace [end section] with closing div
  html = html.replace(/\[end section\]/g, '</div>');

  // Headings: fix trailing '='
  html = html.replace(/^(={2,})\s*(.+?)\s*=*\s*$/gm, (_, eqs, title) => `<h${eqs.length}>${title.trim()}</h${eqs.length}>`);

  // Images
  html = html.replace(/!\[(.*?)\]\((.*?) "(.*?)"\)/g, '<figure><img src="$2" alt="$1"><figcaption>$3</figcaption></figure>');

  // Citations
  html = html.replace(/\[cite:(.+?)\]/g, (_, key) => {
    const num = getCitationNumber(key);
    return `<sup class="citation-link"><a href="#cite-${key}" title="Click to see reference">[${num}]</a></sup>`;
  });

  // Activity containers (unchanged)
  html = html.replace(/\[activity:(\w+)(?::id:(\w+))?\]([\s\S]*?)\[end activity\]/g,
    (_, type, id, content) => `<div class="activity-container" data-activity="${type}" ${id ? `id="${id}"` : ''}>${content.trim()}</div>`);

  // Bibliography placeholder
  html = html.replace(/\[insert bibliography\]/g, '<div id="bibliography"></div>');

  // Tables (unchanged logic)
  html = html.replace(/((?:\|.+\|\s*\n)+)/g, (match) => {
    const lines = match.trim().split('\n');
    if (lines.length < 2) return match; // not a table

    // Header
    const headers = lines[0].split('|').slice(1,-1).map(h => h.trim());
    const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;

    // Rows
    const tbodyRows = lines.slice(2).map(line => {
      const cells = line.split('|').slice(1,-1).map(c => c.trim());
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    }).join('');

    return `<table>${thead}<tbody>${tbodyRows}</tbody></table>`;
  });

  // --- Rich-text formatting ---
  const linkPlaceholders = [];
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    const key = `%%LINK${linkPlaceholders.length}%%`;
    linkPlaceholders.push(`<a href="${url}">${text}</a>`);
    return key;
  });

  html = html.replace(/\*\*\*([^\*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  linkPlaceholders.forEach((linkHtml, i) => {
    const key = `%%LINK${i}%%`;
    html = html.replace(key, linkHtml);
  });

  // Convert newlines into <br> (this retains earlier behaviour)
  html = html.replace(/\n/g, '<br>');

  return html;
}
