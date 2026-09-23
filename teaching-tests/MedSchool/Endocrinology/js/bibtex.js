
// bibtex.js — robust and backward-compatible expansion (no Canvas)

import { getCitationNumber } from './citations.js';

/* =============================== Utilities =============================== */

const isNonEmpty = (s) => typeof s === 'string' && s.trim() !== '';
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

const escapeHTML = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const normalizeWhitespace = (s = '') => s.replace(/\s+/g, ' ').trim();
const normalizePages = (s = '') => s.replace(/\s*[-–—]+\s*/g, '–').replace(/\s+/g, '');
const toSentenceCase = (s = '') => {
  // Preserve ALLCAPS/acronyms >= 2 chars, otherwise sentence case (best-effort)
  const trimmed = s.trim();
  if (!trimmed) return s;
  const first = trimmed[0].toUpperCase() + trimmed.slice(1);
  return first.replace(/\b([A-Z]{2,})\b/g, (m) => m); // keep acronyms
};

const MONTH_MAP = {
  jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June',
  jul: 'July', aug: 'August', sep: 'September', sept: 'September', oct: 'October',
  nov: 'November', dec: 'December'
};

/* ------------------------ LaTeX -> Unicode cleanup ----------------------- */

const latexToUnicode = (input = '') => {
  let s = input;

  // Remove outer single-level braces but keep content (case-preserving braces are common)
  s = s.replace(/\{([^{}]*)\}/g, '$1');

  // Dashes
  s = s.replace(/---/g, '—').replace(/--/g, '–');
  s = s.replace(/\\textemdash/g, '—').replace(/\\textendash/g, '–');

  // Symbols / escapes
  s = s
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\\$/g, '$')
    .replace(/\\textregistered/g, '®')
    .replace(/\\texttrademark/g, '™')
    .replace(/\\textcopyright/g, '©');

  // Remove formatting commands but keep content
  s = s
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\itshape\b/g, '')
    .replace(/\\bfseries\b/g, '')
    .replace(/\\url\{([^}]*)\}/g, '$1')
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1');

  // Accents (common coverage)
  const accentPairs = [
    [/\\\"{?a}?/g, 'ä'], [/\\\"{?o}?/g, 'ö'], [/\\\"{?u}?/g, 'ü'],
    [/\\\"{?A}?/g, 'Ä'], [/\\\"{?O}?/g, 'Ö'], [/\\\"{?U}?/g, 'Ü'],
    [/\\'{?a}?/g, 'á'], [/\\'{?e}?/g, 'é'], [/\\'{?i}?/g, 'í'], [/\\'{?o}?/g, 'ó'], [/\\'{?u}?/g, 'ú'],
    [/\\'{?A}?/g, 'Á'], [/\\'{?E}?/g, 'É'], [/\\'{?I}?/g, 'Í'], [/\\'{?O}?/g, 'Ó'], [/\\'{?U}?/g, 'Ú'],
    [/\\`{?a}?/g, 'à'], [/\\`{?e}?/g, 'è'], [/\\`{?i}?/g, 'ì'], [/\\`{?o}?/g, 'ò'], [/\\`{?u}?/g, 'ù'],
    [/\\~{?n}?/g, 'ñ'], [/\\c\{?c\}?/g, 'ç'], [/\\\^{?o}?/g, 'ô'], [/\\\^{?a}?/g, 'â'], [/\\\^{?e}?/g, 'ê'],
    [/\\ss\b/g, 'ß'], [/\\aa\b/g, 'å'], [/\\o\b/g, 'ø'], [/\\AE\b/g, 'Æ'], [/\\ae\b/g, 'æ']
  ];
  for (const [re, repl] of accentPairs) s = s.replace(re, repl);

  return normalizeWhitespace(s);
};

/* ------------------------------ Name parsing ----------------------------- */

// Split on " and " that are not within braces
const splitAuthors = (s = '') => {
  const parts = [];
  let buf = '', depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
    if (depth === 0 && s.slice(i, i + 5).toLowerCase() === ' and ') {
      parts.push(buf.trim());
      buf = '';
      i += 4; // skip " and "
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
};

const parsePerson = (name = '') => {
  const cleaned = latexToUnicode(name).trim();
  // BibTeX supports "von Last, Jr, First" and "First von Last"
  if (cleaned.includes(',')) {
    const bits = cleaned.split(',').map(x => x.trim());
    const [lastPart, firstPart = '', jrPart = ''] = bits;
    return {
      first: firstPart,
      last: lastPart,
      suffix: jrPart
    };
  } else {
    // Heuristic: last word is last name, others are given/middle (handles particles imperfectly)
    const tokens = cleaned.split(/\s+/);
    if (tokens.length === 1) return { first: '', last: tokens[0], suffix: '' };
    const last = tokens.pop();
    return { first: tokens.join(' '), last, suffix: '' };
  }
};

const formatName = (p, style = 'ieee') => {
  if (!p) return '';
  const firstInitials = p.first
    ? p.first.split(/\s+/).map(w => w ? (w[0].toUpperCase() + '.') : '').join(' ')
    : '';
  switch (style) {
    case 'apa':
    case 'mla':
    case 'chicago':
      // "Last, F. M., Jr."
      return [p.last, [firstInitials, p.suffix].filter(isNonEmpty).join(', ')].filter(isNonEmpty).join(', ');
    case 'ieee':
    default:
      // "F. M. Last"
      return [firstInitials, p.last].filter(isNonEmpty).join(' ');
  }
};

const formatAuthors = (authorField = '', { style = 'ieee', maxAuthorsBeforeEtAl } = {}) => {
  if (!isNonEmpty(authorField)) return 'Unknown Author';
  const people = splitAuthors(authorField).map(parsePerson);
  const n = people.length;
  const limits = {
    ieee: 3,
    apa: 6,
    mla: 6,
    chicago: 10
  };
  const limit = clamp(
    Number.isInteger(maxAuthorsBeforeEtAl) ? maxAuthorsBeforeEtAl : limits[style] ?? 3,
    1, 50
  );

  // Determine et al.
  let list = people;
  let etal = false;
  if (n > limit) {
    list = people.slice(0, limit);
    etal = true;
  }

  const formatted = list.map(p => formatName(p, style));
  let joiner = ', ';
  if (style === 'apa' || style === 'mla' || style === 'chicago') {
    if (formatted.length > 1) {
      const last = formatted.pop();
      return (formatted.join(', ') + ', & ' + last) + (etal ? ', et al.' : '');
    }
    return formatted[0] + (etal ? ', et al.' : '');
  } else { // ieee
    if (formatted.length > 1) {
      const last = formatted.pop();
      return (formatted.join(', ') + ', and ' + last) + (etal ? ', et al.' : '');
    }
    return formatted[0] + (etal ? ', et al.' : '');
  }
};

/* ------------------------------- Link utils ------------------------------ */



const normalizeDOI = (raw = '') => {
  let d = String(raw).trim();
  if (!d) return '';
  d = d.replace(/^[{\s"]+|[}\s"]+$/g, '');
  d = d.replace(/^doi:\s*/i, '');
  d = d.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return d;
};


/**
 * Build a DOI anchor.
 */

// Renderer can be 'html' | 'markdown' | 'text'.
const buildDOILink = (doi = '', { renderer = 'markdown', labelMode = 'url' } = {}) => {
  const id = normalizeDOI(doi);
  if (!id) return '';

  const href = `https://doi.org/${encodeURIComponent(id)}`;
  let visible;

  switch (labelMode) {
    case 'doi':  visible = `doi:${id}`; break;
    case 'url':  visible = href;        break;
    case 'both': visible = `doi:${id}`; break; // keep href as URL; label is "doi:…"
    default:     visible = href;        break;
  }

  if (renderer === 'html') {
    return `${escapeHTML(href)}${escapeHTML(visible)}</a>`;
  }
  if (renderer === 'markdown') {
    // Markdown: label
    // Escape brackets in label just in case.
    const safeLabel = visible.replace(/[\[\]]/g, '');
    return `${safeLabel}`;
  }
  // Plain text fallback
  return visible + ' (' + href + ')';
};

const buildURLLink = (url = '', label = 'URL', { renderer = 'markdown' } = {}) => {
  if (!isNonEmpty(url)) return '';
  if (renderer === 'html') return `${escapeHTML(url)}${escapeHTML(label)}</a>`;
  if (renderer === 'markdown') return `${label}`;
  return `${label}: ${url}`;
};

const buildArXivLink = (eprint = '', primaryClass = '', { renderer = 'markdown' } = {}) => {
  if (!isNonEmpty(eprint)) return '';
  const url = `https://arxiv.org/abs/${encodeURIComponent(eprint)}`;
  const label = isNonEmpty(primaryClass) ? `arXiv:${eprint} [${primaryClass}]` : `arXiv:${eprint}`;
  if (renderer === 'html') return `${escapeHTML(url)}${escapeHTML(label)}</a>`;
  if (renderer === 'markdown') return `${label}`;
  return `${label} (${url})`;
};

function gatherLinks(f, { showLinks = true, doiLabel = 'url', renderer = 'markdown' } = {}) {
  if (!showLinks) return '';
  const parts = [];
  if (isNonEmpty(f.doi)) parts.push(buildDOILink(f.doi, { renderer, labelMode: doiLabel }));
  if (isNonEmpty(f.eprint) && (f.archiveprefix?.toLowerCase() === 'arxiv' || /^\d{4}\.\d{4,5}/.test(f.eprint))) {
    parts.push(buildArXivLink(f.eprint, f.primaryclass || f.primaryClass || '', { renderer }));
  }
  if (isNonEmpty(f.url)) parts.push(buildURLLink(f.url, 'URL', { renderer }));
  return parts.length ? ' ' + parts.join(' · ') : '';
}

/* ================================ Parser =================================
   Robust single-pass scanner that:
   - handles @string (macro expansion), ignores @comment/@preamble
   - supports { ... } and ( ... ) entry delimiters
   - parses fields with nested braces, quoted values, bare words, and # concatenation
============================================================================ */

function scanBalanced(str, startIdx, openChar = '{', closeChar = '}') {
  let depth = 0;
  let i = startIdx;
  for (; i < str.length; i++) {
    const ch = str[i];
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) break;
    } else if (ch === '"' && openChar === '{') {
      // skip quoted strings within brace sections
      i++;
      while (i < str.length && !(str[i] === '"' && str[i - 1] !== '\\')) i++;
    }
  }
  return i;
}

function parseFieldValue(expr, macros) {
  // Supports concatenation with #, e.g., "The " # title
  const parts = [];
  let i = 0;

  const skipWS = () => { while (/\s/.test(expr[i])) i++; };

  while (i < expr.length) {
    skipWS();
    if (i >= expr.length) break;

    const ch = expr[i];
    if (ch === '{') {
      const j = scanBalanced(expr, i, '{', '}');
      const content = expr.slice(i + 1, j);
      parts.push(content);
      i = j + 1;
    } else if (ch === '"') {
      i++;
      let buf = '';
      while (i < expr.length) {
        const c = expr[i];
        if (c === '"' && expr[i - 1] !== '\\') { i++; break; }
        buf += c;
        i++;
      }
      parts.push(buf);
    } else {
      // bareword (could be macro or number)
      let j = i;
      while (j < expr.length && /[^\s#,"}]/.test(expr[j])) j++;
      const token = expr.slice(i, j).trim();
      if (token) {
        // Expand macro if defined
        const lower = token.toLowerCase();
        parts.push(macros.has(lower) ? macros.get(lower) : token);
      }
      i = j;
    }

    skipWS();
    if (expr[i] === '#') { i++; continue; } // concatenation
    else break;
  }

  return normalizeWhitespace(parts.join(''));
}

function parseFields(body, macros) {
  const fields = {};
  let i = 0;

  const len = body.length;
  while (i < len) {
    // skip whitespace and commas
    while (i < len && (/\s/.test(body[i]) || body[i] === ',')) i++;
    if (i >= len) break;

    // parse key
    let kStart = i;
    while (i < len && /[A-Za-z0-9_:-]/.test(body[i])) i++;
    const key = body.slice(kStart, i).trim().toLowerCase();
    while (i < len && /\s/.test(body[i])) i++;

    if (body[i] !== '=') {
      // not a field; bail to next comma
      while (i < len && body[i] !== ',') i++;
      continue;
    }
    i++; // skip '='
    while (i < len && /\s/.test(body[i])) i++;

    // parse value
    let value = '';
    if (body[i] === '{') {
      const j = scanBalanced(body, i, '{', '}');
      value = body.slice(i + 1, j);
      i = j + 1;
    } else if (body[i] === '"') {
      i++;
      let buf = '';
      while (i < len) {
        const c = body[i];
        if (c === '"' && body[i - 1] !== '\\') { i++; break; }
        buf += c; i++;
      }
      value = buf;
    } else {
      // bare or concatenated expression
      let j = i;
      // Read until comma or end, but we need to allow # concatenation parsing
      while (j < len && body[j] !== ',') j++;
      const expr = body.slice(i, j);
      value = parseFieldValue(expr, macros);
      i = j;
    }

    fields[key] = normalizeWhitespace(value);
    // move to next comma
    while (i < len && body[i] !== ',') i++;
    // comma consumed at next loop
  }
  return fields;
}

/**
 * PUBLIC: parseBibTeX
 * Returns: [{ type, key, fields }]
 * - Preserves your original return shape.
 */
export function parseBibTeX(bibtexString) {
  const text = String(bibtexString || '');
  const entries = [];
  const macros = new Map(); // @string macros (lowercased keys)

  let i = 0;
  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at === -1) break;
    i = at + 1;

    // read entry type
    let tStart = i;
    while (i < text.length && /[A-Za-z]/.test(text[i])) i++;
    const rawType = text.slice(tStart, i);
    if (!rawType) { i++; continue; }
    const type = rawType.toLowerCase();

    // skip whitespace
    while (i < text.length && /\s/.test(text[i])) i++;

    const delimiter = text[i];
    if (delimiter !== '{' && delimiter !== '(') { i++; continue; }
    const closeDelim = delimiter === '{' ? '}' : ')';

    // Find matching close
    const endIdx = scanBalanced(text, i, delimiter, closeDelim);
    const inner = text.slice(i + 1, endIdx);
    i = endIdx + 1;

    if (type === 'comment' || type === 'preamble') {
      continue;
    }

    if (type === 'string') {
      // macros: key = value
      const eq = inner.indexOf('=');
      if (eq > -1) {
        const k = inner.slice(0, eq).trim().toLowerCase();
        const v = parseFieldValue(inner.slice(eq + 1), macros);
        macros.set(k, v);
      }
      continue;
    }

    // Regular entry: key, then fields...
    // Key is up to first comma (not in braces/quotes)
    let depth = 0, q = false, j = 0, key = '';
    for (; j < inner.length; j++) {
      const ch = inner[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth = Math.max(0, depth - 1);
      else if (ch === '"' && inner[j - 1] !== '\\') q = !q;
      if (depth === 0 && !q && ch === ',') {
        key = inner.slice(0, j).trim();
        break;
      }
    }
    const body = inner.slice(j + 1);
    const fields = parseFields(body, macros);

    // Post-process some standard fields
    if (fields.pages) fields.pages = normalizePages(fields.pages);
    if (fields.month) {
      const m = fields.month.toLowerCase().replace(/[{}"]/g, '').slice(0, 4);
      fields.month = MONTH_MAP[m] || fields.month;
    }

    entries.push({ type: rawType, key: key.trim(), fields });
  }

  return entries;
}

/* =============================== Formatting ============================== */

const choose = (...vals) => vals.find(isNonEmpty) || '';

const italic = (s) => `<i>${escapeHTML(s)}</i>`;
const quote = (s) => `“${escapeHTML(s)}”`;

const titleForStyle = (title = '', style = 'ieee') => {
  if (!isNonEmpty(title)) return 'No Title';
  const clean = latexToUnicode(title);
  switch (style) {
    case 'apa':
    case 'mla':
    case 'chicago':
      return escapeHTML(toSentenceCase(clean));
    case 'ieee':
    default:
      return escapeHTML(clean);
  }
};

function joinParts(parts, sep = ' ') {
  return parts.filter(isNonEmpty).join(sep).replace(/\s+,/g, ',');
}

function formatVenueCommon(f) {
  // For articles & inproceedings
  const volNo = isNonEmpty(f.volume) ? ` ${escapeHTML(f.volume)}` : '';
  const no = isNonEmpty(f.number) || isNonEmpty(f.issue)
    ? `(${escapeHTML(f.number || f.issue)})` : '';
  const pages = isNonEmpty(f.pages) ? `: ${escapeHTML(f.pages)}` : '';
  return `${volNo}${no}${pages}`;
}


function yearMonth(f) {
  const y = f.year || 'n.d.';
  const m = f.month ? ` ${f.month}` : '';
  return `${y}${m}`;
}

/* ------------------------------ Style: IEEE ------------------------------ */

function formatIEEE(entry, opts) {
  const f = entry.fields;
  const authors = formatAuthors(f.author, { style: 'ieee', maxAuthorsBeforeEtAl: opts.maxAuthorsBeforeEtAl });
  const title = titleForStyle(f.title, 'ieee');

  const type = entry.type.toLowerCase();
  let main = '';

  if (type === 'article') {
    const journal = choose(f.journal, f.journaltitle, f.journalTitle, 'No Journal');
    const venue = formatVenueCommon(f);
    main = `${authors}. ${quote(title)}. ${italic(latexToUnicode(journal))}${venue ? ',' + venue : ''}, ${yearMonth(f)}.`;
  } else if (type === 'inproceedings' || type === 'conference' || type === 'incollection') {
    const book = choose(f.booktitle, f.bookTitle, 'Proceedings');
    const editors = f.editor ? `, in ${escapeHTML(latexToUnicode(f.editor))} (eds.),` : '';
    const venue = formatVenueCommon(f);
    const pages = isNonEmpty(f.pages) ? `, pp. ${escapeHTML(f.pages)}` : '';
    main = `${authors}. ${quote(title)}. In ${italic(latexToUnicode(book))}${editors}${pages}${venue ? ',' + venue : ''}, ${yearMonth(f)}.`;
  } else if (type === 'book') {
    const publisher = choose(f.publisher, f.organization, 'Publisher');
    const edition = isNonEmpty(f.edition) ? `, ${escapeHTML(f.edition)} ed.` : '';
    const address = isNonEmpty(f.address || f.location) ? `, ${escapeHTML(f.address || f.location)}` : '';
    main = `${authors}. ${italic(title)}.${edition} ${escapeHTML(latexToUnicode(publisher))}${address}, ${yearMonth(f)}.`;
  } else if (type === 'phdthesis' || type === 'mastersthesis' || type === 'thesis') {
    const degree = type === 'phdthesis' ? 'PhD thesis' : type === 'mastersthesis' ? "Master's thesis" : 'Thesis';
    const school = choose(f.school, f.institution, 'Institution');
    main = `${authors}. ${italic(title)}. ${degree}, ${escapeHTML(latexToUnicode(school))}, ${yearMonth(f)}.`;
  } else if (type === 'techreport' || type === 'report') {
    const inst = choose(f.institution, f.organization, 'Institution');
    const num = isNonEmpty(f.number) ? `, No. ${escapeHTML(f.number)}` : '';
    main = `${authors}. ${quote(title)}. ${escapeHTML(latexToUnicode(inst))}${num}, ${yearMonth(f)}.`;
  } else {
    // misc/online/preprint
    const host = choose(f.howpublished, f.note, f.journal, f.booktitle, f.publisher, '');
    main = `${authors}. ${quote(title)}.${isNonEmpty(host) ? ' ' + escapeHTML(latexToUnicode(host)) + '.' : ''} ${yearMonth(f)}.`;
  }

  return main + gatherLinks(f, opts);
}

/* ------------------------------ Style: APA ------------------------------- */

function formatAPA(entry, opts) {
  const f = entry.fields;
  const authors = formatAuthors(f.author, { style: 'apa', maxAuthorsBeforeEtAl: opts.maxAuthorsBeforeEtAl });
  const year = ` (${f.year || 'n.d.'})`;
  const title = titleForStyle(f.title, 'apa');

  if (entry.type.toLowerCase() === 'article') {
    const journal = choose(f.journal, f.journaltitle, 'No Journal');
    const vol = isNonEmpty(f.volume) ? `, <i>${escapeHTML(f.volume)}</i>` : '';
    const no = isNonEmpty(f.number || f.issue) ? `(${escapeHTML(f.number || f.issue)})` : '';
    const pages = isNonEmpty(f.pages) ? `, ${escapeHTML(f.pages)}` : '';
    return `${authors}.${year}. ${title}. <i>${escapeHTML(latexToUnicode(journal))}</i>${vol}${no}${pages}.` + gatherLinks(f, opts);
  }

  if (entry.type.toLowerCase() === 'book') {
    const publisher = choose(f.publisher, f.organization, 'Publisher');
    const edition = isNonEmpty(f.edition) ? ` (${escapeHTML(f.edition)} ed.)` : '';
    return `${authors}.${year}. <i>${title}</i>${edition}. ${escapeHTML(latexToUnicode(publisher))}.` + gatherLinks(f, opts);
  }

  if (entry.type.toLowerCase() === 'inproceedings' || entry.type.toLowerCase() === 'incollection') {
    const book = choose(f.booktitle, 'Proceedings');
    const pages = isNonEmpty(f.pages) ? ` (pp. ${escapeHTML(f.pages)})` : '';
    return `${authors}.${year}. ${title}. In <i>${escapeHTML(latexToUnicode(book))}</i>${pages}.` + gatherLinks(f, opts);
  }

  if (entry.type.toLowerCase().includes('thesis')) {
    const kind = entry.type.toLowerCase() === 'phdthesis' ? 'Doctoral dissertation' : "Master's thesis";
    const school = choose(f.school, f.institution, 'Institution');
    return `${authors}.${year}. <i>${title}</i> [${kind}, ${escapeHTML(latexToUnicode(school))}].` + gatherLinks(f, opts);
  }

  if (entry.type.toLowerCase().includes('report')) {
    const inst = choose(f.institution, f.organization, 'Institution');
    const num = isNonEmpty(f.number) ? ` (Report No. ${escapeHTML(f.number)})` : '';
    return `${authors}.${year}. ${title}.${num} ${escapeHTML(latexToUnicode(inst))}.` + gatherLinks(f, opts);
  }

  // misc/online
  const site = choose(f.publisher, f.journal, f.booktitle, f.howpublished, '');
  const accessed = isNonEmpty(f.urldate) ? ` Accessed ${escapeHTML(f.urldate)}.` : '';
  return `${authors}.${year}. ${title}.${isNonEmpty(site) ? ' ' + escapeHTML(latexToUnicode(site)) + '.' : ''}${gatherLinks(f, opts)}${accessed}`;
}

/* ------------------------------ Style: MLA ------------------------------- */

function formatMLA(entry, opts) {
  const f = entry.fields;
  const authors = formatAuthors(f.author, { style: 'mla', maxAuthorsBeforeEtAl: opts.maxAuthorsBeforeEtAl });
  const title = titleForStyle(f.title, 'mla');

  if (entry.type.toLowerCase() === 'article') {
    const journal = choose(f.journal, 'No Journal');
    const vol = isNonEmpty(f.volume) ? `, vol. ${escapeHTML(f.volume)}` : '';
    const no = isNonEmpty(f.number || f.issue) ? `, no. ${escapeHTML(f.number || f.issue)}` : '';
    const year = isNonEmpty(f.year) ? `, ${escapeHTML(f.year)}` : '';
    const pages = isNonEmpty(f.pages) ? `, pp. ${escapeHTML(f.pages)}` : '';
    return `${authors}. “${title}.” <i>${escapeHTML(latexToUnicode(journal))}</i>${vol}${no}${year}${pages}.` + gatherLinks(f, opts);
  }

  if (entry.type.toLowerCase() === 'book') {
    const publisher = choose(f.publisher, 'Publisher');
    const year = isNonEmpty(f.year) ? `, ${escapeHTML(f.year)}` : '';
    const edition = isNonEmpty(f.edition) ? `, ${escapeHTML(f.edition)} ed.` : '';
    return `${authors}. <i>${title}</i>${edition}. ${escapeHTML(latexToUnicode(publisher))}${year}.` + gatherLinks(f, opts);
  }

  if (entry.type.toLowerCase() === 'inproceedings' || entry.type.toLowerCase() === 'incollection') {
    const book = choose(f.booktitle, 'Proceedings');
    const pages = isNonEmpty(f.pages) ? `, pp. ${escapeHTML(f.pages)}` : '';
    const year = isNonEmpty(f.year) ? `, ${escapeHTML(f.year)}` : '';
    return `${authors}. “${title}.” <i>${escapeHTML(latexToUnicode(book))}</i>${pages}${year}.` + gatherLinks(f, opts);
  }

  // misc/online
  const site = choose(f.journal, f.booktitle, f.publisher, f.howpublished, '');
  const year = isNonEmpty(f.year) ? `, ${escapeHTML(f.year)}` : '';
  return `${authors}. “${title}.” ${isNonEmpty(site) ? '<i>' + escapeHTML(latexToUnicode(site)) + '</i>' : ''}${year}.` + gatherLinks(f, opts);
}

/* ---------------------------- Style: Chicago ----------------------------- */

function formatChicago(entry, opts) {
  const f = entry.fields;
  const authors = formatAuthors(f.author, { style: 'chicago', maxAuthorsBeforeEtAl: opts.maxAuthorsBeforeEtAl });
  const year = f.year || 'n.d.';
  const title = titleForStyle(f.title, 'chicago');

  if (entry.type.toLowerCase() === 'article') {
    const journal = choose(f.journal, 'No Journal');
    const vol = isNonEmpty(f.volume) ? ` ${escapeHTML(f.volume)}` : '';
    const no = isNonEmpty(f.number || f.issue) ? `, no. ${escapeHTML(f.number || f.issue)}` : '';
    const pages = isNonEmpty(f.pages) ? `: ${escapeHTML(f.pages)}` : '';
    return `${authors}. ${year}. “${title}.” <i>${escapeHTML(latexToUnicode(journal))}</i>${vol}${no}${pages}.` + gatherLinks(f, opts);
  }

  if (entry.type.toLowerCase() === 'book') {
    const publisher = choose(f.publisher, 'Publisher');
    const address = isNonEmpty(f.address || f.location) ? `: ${escapeHTML(f.address || f.location)}` : '';
    return `${authors}. ${year}. <i>${title}</i>. ${escapeHTML(latexToUnicode(publisher))}${address}.` + gatherLinks(f, opts);
  }

  if (entry.type.toLowerCase() === 'inproceedings' || entry.type.toLowerCase() === 'incollection') {
    const book = choose(f.booktitle, 'Proceedings');
    const pages = isNonEmpty(f.pages) ? `, ${escapeHTML(f.pages)}` : '';
    return `${authors}. ${year}. “${title}.” In <i>${escapeHTML(latexToUnicode(book))}</i>${pages}.` + gatherLinks(f, opts);
  }

  // misc/online
  const site = choose(f.journal, f.booktitle, f.publisher, f.howpublished, '');
  return `${authors}. ${year}. “${title}.” ${isNonEmpty(site) ? '<i>' + escapeHTML(latexToUnicode(site)) + '</i>' : ''}.` + gatherLinks(f, opts);
}

/* ---------------------------- Style dispatcher --------------------------- */

function formatEntryByStyle(entry, opts) {
  const style = (opts.style || 'ieee').toLowerCase();
  switch (style) {
    case 'apa': return formatAPA(entry, opts);
    case 'mla': return formatMLA(entry, opts);
    case 'chicago': return formatChicago(entry, opts);
    case 'ieee':
    default: return formatIEEE(entry, opts);
  }
}

/* -------------------------------- Sorting -------------------------------- */

function sortEntries(entries, sortBy = 'citation') {
  const arr = entries.slice();
  switch (sortBy) {
    case 'author':
      return arr.sort((a, b) => {
        const A = latexToUnicode(a.fields.author || '').toLowerCase();
        const B = latexToUnicode(b.fields.author || '').toLowerCase();
        return A.localeCompare(B) || (a.fields.year || '').localeCompare(b.fields.year || '') || a.key.localeCompare(b.key);
      });
    case 'year':
      return arr.sort((a, b) => {
        const A = (a.fields.year || '').toString();
        const B = (b.fields.year || '').toString();
        return A.localeCompare(B) || a.key.localeCompare(b.key);
      });
    case 'key':
      return arr.sort((a, b) => a.key.localeCompare(b.key));
    case 'citation':
    default:
      return arr; // keep input order (backward-compatible)
  }
}

/* ============================ PUBLIC: formatter =========================== */

/**
 * PUBLIC: formatReferences(bibEntries, options?)
 * Returns: HTML string with your original structure.
 * Default style is 'ieee'. Options:
 *  {
 *    style: 'ieee' | 'apa' | 'mla' | 'chicago',
 *    sortBy: 'citation' | 'author' | 'year' | 'key',
 *    maxAuthorsBeforeEtAl: number, // defaults per style
 *    showLinks: boolean,            // default true
 *    showTooltips: boolean,         // default true
 *  }
 */
export function formatReferences(bibEntries, options = {}) {
  const opts = {
    style: 'apa',
    sortBy: 'citation',
    showLinks: true,
    showTooltips: true,
	renderer: 'markdown',
	doiLabel: 'doi',
    ...options
  };

  const sorted = sortEntries(bibEntries, opts.sortBy);

  return sorted.map(entry => {
    const num = getCitationNumber(entry.key);
    const htmlText = formatEntryByStyle(entry, opts);

    // Tooltip: a compact, style-agnostic summary
    const f = entry.fields;
    const tooltip = normalizeWhitespace([
      latexToUnicode(f.author || 'Unknown Author'),
      latexToUnicode(f.title || 'No Title'),
      choose(f.journal, f.booktitle, f.publisher, ''),
      f.year || 'n.d.'
    ].filter(isNonEmpty).join('. ') + '.');

    const spanTitleAttr = opts.showTooltips ? ` title="${escapeHTML(tooltip)}"` : '';

    // Preserve original structure for interoperability
    return `<div class="bib-entry" id="cite-${escapeHTML(entry.key)}">
  [${num}] <span${spanTitleAttr}>${htmlText}</span>
</div>`;
  }).join('');
}
