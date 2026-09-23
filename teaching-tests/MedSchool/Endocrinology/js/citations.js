let citationMap = new Map();
let counter = 1;

export function getCitationNumber(key) {
  if (!citationMap.has(key)) {
    citationMap.set(key, counter++);
  }
  return citationMap.get(key);
}

export function resetCitations() {
  citationMap.clear();
  counter = 1;
}
