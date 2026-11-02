import { KNOWLEDGE } from './catalog.mjs';

// BM25-style lexical scoring + reciprocal-rank fusion with business tags.
// No embedding model or vector database is used in demo mode.
export function tokenize(text) {
  const normalized = text.toLowerCase().normalize('NFKC');
  const tokens = normalized.match(/[a-z0-9]+/g) || [];
  for (const span of normalized.match(/[\u3400-\u9fff]+/g) || []) {
    if (span.length === 1) tokens.push(span);
    else for (let i = 0; i < span.length - 1; i++) tokens.push(span.slice(i, i + 2));
  }
  return tokens;
}

export function retrieve(query, { limit = 3 } = {}) {
  const q = [...new Set(tokenize(query))];
  if (!q.length) return [];
  const docs = KNOWLEDGE.map(doc => ({ doc, tokens: tokenize(doc.title + ' ' + doc.sections.map(s => s.text).join(' ')) }));
  const avg = docs.reduce((n, d) => n + d.tokens.length, 0) / docs.length;
  const scores = docs.map(({ doc, tokens }) => {
    let bm25 = 0;
    for (const term of q) {
      const tf = tokens.filter(t => t === term).length;
      if (!tf) continue;
      const df = docs.filter(d => d.tokens.includes(term)).length;
      const idf = Math.log(1 + (docs.length - df + .5) / (df + .5));
      bm25 += idf * tf * 2.2 / (tf + 1.2 * (.25 + .75 * tokens.length / avg));
    }
    const tag = doc.tags.reduce((sum, t) => sum + (query.includes(t) ? 2 + t.length / 4 : 0), 0);
    return { doc, bm25, tag };
  });
  const lexical = scores.filter(s => s.bm25 > 0).sort((a, b) => b.bm25 - a.bm25);
  const tagged = scores.filter(s => s.tag > 0).sort((a, b) => b.tag - a.tag);
  const fused = new Map();
  for (const [list, weight] of [[lexical, 1], [tagged, 1.3]]) list.forEach((s, i) => {
    fused.set(s.doc.id, { ...s, score: (fused.get(s.doc.id)?.score || 0) + weight / (30 + i + 1) });
  });
  return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, limit).map(({ doc, score }) => ({ ...doc, score }));
}
