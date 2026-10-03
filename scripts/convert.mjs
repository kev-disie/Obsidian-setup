import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import MarkdownIt from 'markdown-it';

const SRC_DIR = process.cwd();
const OUT_DIR = path.join(process.cwd(), '_site');
const EXCLUDE_DIRS = new Set(['.git', '.github', '.obsidian', 'node_modules', '_site', 'scripts']);

const md = new MarkdownIt({ html: true, linkify: true });

const defaultValidateLink = md.validateLink;
md.validateLink = (url) =>
  /^data:image\/[a-z0-9.+-]+;base64,/i.test(url) || defaultValidateLink(url);

function walk(dir, relBase = '') {
  const entries = readdirSync(dir);
  let mdFiles = [];
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const rel = relBase ? `${relBase}/${entry}` : entry;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      mdFiles = mdFiles.concat(walk(full, rel));
    } else if (entry.toLowerCase().endsWith('.md')) {
      mdFiles.push(rel);
    }
  }
  return mdFiles;
}

function getPublishedDate(relPath) {
  try {
    const out = execSync(`git log --follow --diff-filter=A --format=%aI -- "${relPath}"`, {
      cwd: SRC_DIR,
    })
      .toString()
      .trim();
    const dates = out.split('\n').filter(Boolean);
    const first = dates[dates.length - 1] || '';
    return first ? first.slice(0, 10) : '';
  } catch {
    return '';
  }
}

// --- the access-gate challenges ---
const CHALLENGES = [
  { q: 'You are the superuser. What command do you run to become one?', a: 'sudo', hint: 'root of all evil' },
  { q: 'What command shows you who you currently are logged in as?', a: 'whoami', hint: "it's quite literally what it sounds like" },
  { q: "What's the standard port for SSH?", a: '22', hint: 'half of 44, and every pentester\'s favorite door' },
];

const GATE_SCRIPT = `
<div id="gate-overlay" style="position:fixed;inset:0;background:#0d1117;z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:-apple-system,system-ui,sans-serif;">
  <div style="max-width:420px;width:90%;text-align:center;">
    <p style="color:#58a6ff;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem;">Access check</p>
    <p id="gate-q" style="color:#e6edf3;font-size:1.1rem;margin-bottom:1rem;"></p>
    <input id="gate-input" type="text" autocomplete="off" style="width:100%;padding:0.6rem;background:#161b22;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;font-family:monospace;font-size:1rem;box-sizing:border-box;" placeholder="your answer">
    <button id="gate-hint-btn" style="margin-top:0.75rem;background:none;border:none;color:#8b949e;font-size:0.8rem;cursor:pointer;text-decoration:underline;">need a hint?</button>
    <p id="gate-hint" style="color:#8b949e;font-size:0.85rem;margin-top:0.5rem;display:none;"></p>
    <p id="gate-error" style="color:#f85149;font-size:0.85rem;margin-top:0.5rem;height:1em;"></p>
  </div>
</div>
<script>
(function () {
  if (sessionStorage.getItem('gate-passed') === '1') return;
  var challenges = ${JSON.stringify(CHALLENGES)};
  var pick = challenges[Math.floor(Math.random() * challenges.length)];
  document.getElementById('gate-q').textContent = pick.q;
  document.getElementById('gate-hint').textContent = pick.hint;
  document.body.style.overflow = 'hidden';
  var input = document.getElementById('gate-input');
  var err = document.getElementById('gate-error');
  document.getElementById('gate-hint-btn').addEventListener('click', function () {
    document.getElementById('gate-hint').style.display = 'block';
  });
  function check() {
    if (input.value.trim().toLowerCase() === pick.a.toLowerCase()) {
      sessionStorage.setItem('gate-passed', '1');
      document.getElementById('gate-overlay').remove();
      document.body.style.overflow = '';
    } else {
      err.textContent = 'nope, try again';
      input.value = '';
    }
  }
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') check();
  });
  setTimeout(function () { input.focus(); }, 50);
})();
</script>`;

// --- double-tap / double-click image zoom lightbox ---
const ZOOM_SCRIPT = `
<script>
(function () {
  document.addEventListener('dblclick', function (e) {
    var img = e.target.closest('img');
    if (!img || img.closest('.card')) return;
    e.preventDefault();
    var existing = document.getElementById('img-zoom-overlay');
    if (existing) { existing.remove(); return; }
    var overlay = document.createElement('div');
    overlay.id = 'img-zoom-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    var big = document.createElement('img');
    big.src = img.src;
    big.style.cssText = 'max-width:95vw;max-height:95vh;object-fit:contain;border-radius:4px;';
    overlay.appendChild(big);
    overlay.addEventListener('click', function () { overlay.remove(); });
    document.body.appendChild(overlay);
  });
})();
</script>`;

const page = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; font-family: -apple-system, system-ui, sans-serif; line-height: 1.6; background: #0d1117; color: #c9d1d9; }
  h1, h2, h3, h4, h5, h6 { color: #e6edf3; }
  img { max-width: 100%; height: auto; border-radius: 4px; touch-action: manipulation; cursor: zoom-in; }
  pre { background: #161b22; padding: 1rem; overflow-x: auto; border-radius: 6px; border: 1px solid #30363d; color: #c9d1d9; }
  code { background: #161b22; padding: 0.15rem 0.35rem; border-radius: 4px; color: #c9d1d9; }
  a { color: #58a6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  blockquote { border-left: 3px solid #30363d; margin-left: 0; padding-left: 1rem; color: #8b949e; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #30363d; padding: 0.4rem 0.8rem; }
  .folder-list a { display: block; padding: 0.35rem 0; }
  .section-label { color: #8b949e; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin: 1.5rem 0 0.75rem; }
  .breadcrumb { margin-bottom: 1rem; }
  .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; text-decoration: none; transition: border-color 0.15s; }
  .card:hover { border-color: #58a6ff; text-decoration: none; }
  .card-img { width: 100%; height: 150px; object-fit: cover; background: #0d1117; cursor: default; }
  .card-img-placeholder { width: 100%; height: 150px; background: linear-gradient(135deg,#161b22,#21262d); }
  .card-body { padding: 0.9rem 1rem 1rem; flex: 1; display: flex; flex-direction: column; }
  .card-title { color: #e6edf3; font-size: 1rem; font-weight: 600; margin: 0 0 0.4rem; }
  .card-excerpt { color: #8b949e; font-size: 0.85rem; margin: 0 0 0.75rem; flex: 1; }
  .card-meta { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #8b949e; }
  .read-pill { background: #0d1117; border: 1px solid #30363d; border-radius: 999px; padding: 0.15rem 0.6rem; }
</style>
</head>
<body>
${GATE_SCRIPT}
${body}
${ZOOM_SCRIPT}
</body>
</html>`;

const mdFiles = walk(SRC_DIR);
const filesByDir = {};

for (const relPath of mdFiles) {
  const srcPath = path.join(SRC_DIR, relPath);
  const raw = readFileSync(srcPath, 'utf-8');
  const html = md.render(raw);
  const outRelPath = relPath.replace(/\.md$/i, '.html');
  const outPath = path.join(OUT_DIR, outRelPath);
  mkdirSync(path.dirname(outPath), { recursive: true });
  const title = path.basename(relPath, '.md');

  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(' ').filter(Boolean).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));
  const excerpt = text.slice(0, 160) + (text.length > 160 ? '…' : '');
  const imgMatch = html.match(/<img[^>]+src="([^"]+)"/i);
  const thumbnail = imgMatch ? imgMatch[1] : null;
  const date = getPublishedDate(relPath);

  const depth = relPath.split('/').length - 1;
  const backLink = `<p class="breadcrumb"><a href="${'../'.repeat(depth)}index.html">&uarr; Back</a></p>`;
  const meta = `<p style="color:#8b949e;font-size:0.85rem;">${date ? date + ' &middot; ' : ''}${readTime} min read</p>`;
  writeFileSync(outPath, page(title, backLink + `<h1>${title}</h1>` + meta + html));

  const dir = path.dirname(relPath) === '.' ? '' : path.dirname(relPath);
  const fileName = path.basename(relPath).replace(/\.md$/i, '.html');
  if (!filesByDir[dir]) filesByDir[dir] = [];
  filesByDir[dir].push({ title, href: fileName, excerpt, date, readTime, thumbnail });
}

for (const dir of Object.keys(filesByDir)) {
  filesByDir[dir].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function buildTree(files) {
  const root = { dirs: {} };
  for (const relPath of files) {
    const parts = relPath.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!node.dirs[part]) node.dirs[part] = { dirs: {} };
      node = node.dirs[part];
    }
  }
  return root;
}

function renderCards(cards) {
  if (!cards || !cards.length) return '';
  const items = cards
    .map((c) => {
      const img = c.thumbnail
        ? `<img class="card-img" src="${c.thumbnail}" alt="">`
        : `<div class="card-img-placeholder"></div>`;
      return `<a class="card" href="${c.href}">
        ${img}
        <div class="card-body">
          <p class="card-title">${c.title}</p>
          <p class="card-excerpt">${c.excerpt}</p>
          <div class="card-meta">
            <span>${c.date || ''}</span>
            <span class="read-pill">${c.readTime} min</span>
          </div>
        </div>
      </a>`;
    })
    .join('\n');
  return `<div class="section-label">Documents</div><div class="card-grid">${items}</div>`;
}

function writeIndexes(node, relDir) {
  const dirNames = Object.keys(node.dirs).sort();
  const depth = relDir ? relDir.split('/').length : 0;
  const breadcrumb = relDir
    ? `<p class="breadcrumb"><a href="${'../'.repeat(depth)}index.html">&uarr; Documentation</a></p>`
    : '';

  const dirLinks = dirNames.length
    ? `<div class="section-label">Folders</div><div class="folder-list">` +
      dirNames.map((d) => `<a href="${d}/index.html">&#128193; ${d}</a>`).join('\n') +
      `</div>`
    : '';

  const cardsHtml = renderCards(filesByDir[relDir]);
  const title = relDir ? relDir.split('/').pop() : 'Documentation';
  const body = `<h1>${title}</h1>${breadcrumb}${dirLinks}${cardsHtml}`;

  const outDir = relDir ? path.join(OUT_DIR, relDir) : OUT_DIR;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), page(title, body));

  for (const d of dirNames) {
    writeIndexes(node.dirs[d], relDir ? `${relDir}/${d}` : d);
  }
}

writeIndexes(buildTree(mdFiles), '');

console.log(`Converted ${mdFiles.length} file(s) into ${OUT_DIR}`);
