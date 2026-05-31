/**
 * Rendu léger Markdown + détection de blocs de code dans les énoncés.
 * Sécurisé : échappement HTML puis transformation ciblée.
 */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Lignes ressemblant à du code (Python, HTML, shell, etc.) */
function looksLikeCodeLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^```/.test(t)) return true;
  if (/^(def |class |for |while |if |elif |else:|import |from |return |print\(|#)/.test(t)) return true;
  if (/^<[a-zA-Z][^>]*>/.test(t) || /^<\/[a-zA-Z]/.test(t)) return true;
  if (/^(mkdir|chmod|cd |ls |rm |cp |mv |cat |pwd|grep )/.test(t)) return true;
  if (/^\s{2,}\S/.test(line)) return true;
  if (/^[a-zA-Z_][\w]*\s*=\s*.+/.test(t)) return true;
  if (/^[a-zA-Z_][\w]*\([^)]*\)\s*$/.test(t)) return true;
  if (/^\s*(for|if|while)\s*\(/.test(t)) return true;
  if (/^[\w.]+\[[\w.]+\]/.test(t)) return true;
  if (/^t\s*=\s*\[/.test(t)) return true;
  if (/^\[.*\]\s*$/.test(t) && (t.includes(',') || t.includes('['))) return true;
  return false;
}

/**
 * Découpe un énoncé en paragraphes et blocs de code.
 * @param {string} text
 * @returns {{ type: 'text' | 'code', content: string }[]}
 */
export function splitEnonceBlocks(text) {
  const lines = text.split('\n');
  /** @type {{ type: 'text' | 'code', content: string }[]} */
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (looksLikeCodeLine(line)) {
      const codeLines = [];
      while (i < lines.length && (looksLikeCodeLine(lines[i]) || (lines[i].trim() === '' && i + 1 < lines.length && looksLikeCodeLine(lines[i + 1])))) {
        if (lines[i].trim() !== '' || codeLines.length > 0) codeLines.push(lines[i]);
        i += 1;
        if (i < lines.length && lines[i].trim() === '' && !(i + 1 < lines.length && looksLikeCodeLine(lines[i + 1]))) break;
      }
      const code = codeLines.join('\n').replace(/\n+$/, '');
      if (code.trim()) blocks.push({ type: 'code', content: code });
      continue;
    }
    const textLines = [];
    while (i < lines.length && !looksLikeCodeLine(lines[i])) {
      textLines.push(lines[i]);
      i += 1;
    }
    const para = textLines.join('\n').trim();
    if (para) blocks.push({ type: 'text', content: para });
  }
  return blocks;
}

/**
 * Markdown léger : titres, gras, listes, code inline, blocs ```.
 * @param {string} raw
 */
export function renderMarkdown(raw) {
  if (!raw || !raw.trim()) return '';

  const fences = [];
  let text = raw.replace(/```([\s\S]*?)```/g, (_, code) => {
    const id = fences.length;
    fences.push(code.replace(/^\n|\n$/g, ''));
    return `\x00FENCE${id}\x00`;
  });

  const lines = text.split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;

  function closeLists() {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^\x00FENCE(\d+)\x00$/);
    if (fenceMatch) {
      closeLists();
      const code = fences[Number(fenceMatch[1])];
      out.push(`<pre class="code-block"><code>${escapeHtml(code)}</code></pre>`);
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      closeLists();
      out.push(`<h3 class="md-h3">${inlineFormat(escapeHtml(h3[1]))}</h3>`);
      continue;
    }

    const h4 = line.match(/^####\s+(.+)$/);
    if (h4) {
      closeLists();
      out.push(`<h4 class="md-h4">${inlineFormat(escapeHtml(h4[1]))}</h4>`);
      continue;
    }

    const ol = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (ol) {
      if (!inOl) {
        closeLists();
        out.push('<ol class="md-list">');
        inOl = true;
      }
      out.push(`<li>${inlineFormat(escapeHtml(ol[2]))}</li>`);
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) {
      if (!inUl) {
        closeLists();
        out.push('<ul class="md-list">');
        inUl = true;
      }
      out.push(`<li>${inlineFormat(escapeHtml(ul[1]))}</li>`);
      continue;
    }

    if (line.trim() === '') {
      closeLists();
      continue;
    }

    closeLists();
    out.push(`<p>${inlineFormat(escapeHtml(line))}</p>`);
  }
  closeLists();
  return out.join('\n');
}

function inlineFormat(escaped) {
  return escaped
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\\rightarrow/g, '\u2192');
}

/**
 * @param {string} text
 * @param {'enonce' | 'explanation'} kind
 */
export function renderRichContent(text, kind = 'explanation') {
  const container = document.createElement('div');
  container.className = kind === 'enonce' ? 'rich-text rich-text--enonce' : 'rich-text rich-text--explanation';

  if (kind === 'enonce') {
    const blocks = splitEnonceBlocks(text);
    for (const block of blocks) {
      if (block.type === 'code') {
        const pre = document.createElement('pre');
        pre.className = 'code-block';
        const code = document.createElement('code');
        code.textContent = block.content;
        pre.appendChild(code);
        container.appendChild(pre);
      } else {
        const div = document.createElement('div');
        div.className = 'rich-text__para';
        div.innerHTML = renderMarkdown(block.content);
        container.appendChild(div);
      }
    }
  } else {
    container.innerHTML = renderMarkdown(text);
  }

  return container;
}

/**
 * @param {HTMLElement} el
 * @param {string} text
 * @param {'enonce' | 'explanation'} kind
 */
export function setRichContent(el, text, kind = 'explanation') {
  el.replaceChildren(renderRichContent(text, kind));
}
