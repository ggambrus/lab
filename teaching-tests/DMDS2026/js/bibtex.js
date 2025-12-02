import { getCitationNumber } from './citations.js';

export function parseBibTeX(bibtexString) {
  const entries = [];
  const entryRegex = /@(\w+)\s*\{\s*([^,]+),([\s\S]*?)\n\}/g;
  let match;
  while ((match = entryRegex.exec(bibtexString)) !== null) {
    const type = match[1];
    const key = match[2].trim();
    const content = match[3];
    const fields = {};
    const fieldRegex = /(\w+)\s*=\s*\{([\s\S]*?)\}/g;
    let fMatch;
    while ((fMatch = fieldRegex.exec(content)) !== null) {
      fields[fMatch[1].toLowerCase()] = fMatch[2].trim();
    }
    entries.push({ type, key, fields });
  }
  return entries;
}

export function formatReferences(bibEntries) {
  return bibEntries.map(entry => {
    const num = getCitationNumber(entry.key);
    const author = entry.fields.author || 'Unknown Author';
    const title = entry.fields.title || 'No Title';
    const journal = entry.fields.journal || entry.fields.booktitle || 'No Journal';
    const year = entry.fields.year || 'n.d.';
    const pages = entry.fields.pages ? `, pp. ${entry.fields.pages}` : '';
    const fullText = `${author}. ${title}. ${journal}${pages}, ${year}.`;
    return `<div class="bib-entry" id="cite-${entry.key}">
      [${num}] <span title="${fullText}">${author}. <i>${title}</i>. ${journal}${pages}, ${year}.</span>
    </div>`;
  }).join('');
}
