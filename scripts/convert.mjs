import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import MarkdownIt from 'markdown-it';

const SRC_DIR = process.cwd();
const OUT_DIR = path.join(process.cwd(), '_site');
const EXCLUDE_DIRS = new Set(['.git', '.github', '.obsidian', 'node_modules', '_site', 'scripts']);

const md = new MarkdownIt({ html: true, linkify: true });

// markdown-it blocks `data:` URIs in ![]() syntax by default (security default).
// Explicitly allow base64 image data URIs through.
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

const mdFiles = walk(SRC_DIR);

const page = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { max-width: 860px; margin: 2rem auto; padding: 0 1rem; font-family: -apple-system, system-ui, sans-serif; line-height: 1.6; background: #0d1117; color: #c9d1d9; }
  h1, h2, h3, h4, h5, h6 { color: #e6edf3; }
  img { max-width: 100%; height: auto; border-radius: 4px; }
  pre { background: #161b22; padding: 1rem; overflow-x: auto; border-radius: 6px; border: 1px solid #30363d; color: #c9d1d9; }
  code { background: #161b22; padding: 0.15rem 0.35rem; border-radius: 4px; color: #c9d1d9; }
  a { color: #58a6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  blockquote { border-left: 3px solid #30363d; margin-left: 0; padding-left: 1rem; color: #8b949e; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #30363d; padding: 0.4rem 0.8rem; }
  .browser a { display: block; padding: 0.35rem 0; }
  .browser .section-label { color: #8b949e; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem; }
  .breadcrumb { margin-bottom: 1rem; }
</style>
</head>
<body>
${body}
</body>
</html>`;

// --- build a folder tree from the flat file list ---
function buildTree(files) {
  const root = { dirs: {}, files: [] };
  for (const relPath of files) {
    const parts = relPath.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!node.dirs[part]) node.dirs[part] = { dirs: {}, files: [] };
      node = node.dirs[part];
    }
    node.files.push(parts[parts.length - 1]);
  }
  return root;
}

// --- recursively write one index.html per folder ---
function writeIndexes(node, relDir) {
  const dirNames = Object.keys(node.dirs).sort();
  const fileNames = node.files.slice().sort();

  const depth = relDir ? relDir.split('/').length : 0;
  const breadcrumb = relDir
    ? `<p class="breadcrumb"><a href="${'../'.repeat(depth)}index.html">&uarr; Documentation</a></p>`
    : '';

  const dirLinks = dirNames.length
    ? `<div class="section-label">Folders</div>` +
      dirNames.map((d) => `<a href="${d}/index.html">&#128193; ${d}</a>`).join('\n')
    : '';

  const fileLinks = fileNames.length
    ? `<div class="section-label">Documents</div>` +
      fileNames
        .map((f) => `<a href="${f.replace(/\.md$/i, '.html')}">&#128196; ${f.replace(/\.md$/i, '')}</a>`)
        .join('\n')
    : '';

  const title = relDir ? relDir.split('/').pop() : 'Documentation';
  const body = `<h1>${title}</h1>
${breadcrumb}
<div class="browser">
${dirLinks}
${fileLinks}
</div>`;

  const outDir = relDir ? path.join(OUT_DIR, relDir) : OUT_DIR;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), page(title, body));

  for (const d of dirNames) {
    writeIndexes(node.dirs[d], relDir ? `${relDir}/${d}` : d);
  }
}

// --- convert each markdown file to its own page ---
for (const relPath of mdFiles) {
  const srcPath = path.join(SRC_DIR, relPath);
  const raw = readFileSync(srcPath, 'utf-8');
  const html = md.render(raw);
  const outRelPath = relPath.replace(/\.md$/i, '.html');
  const outPath = path.join(OUT_DIR, outRelPath);
  mkdirSync(path.dirname(outPath), { recursive: true });
  const title = path.basename(relPath, '.md');

  const depth = relPath.split('/').length - 1;
  const backLink = `<p class="breadcrumb"><a href="${'../'.repeat(depth)}index.html">&uarr; Back</a></p>`;

  writeFileSync(outPath, page(title, backLink + html));
}

const tree = buildTree(mdFiles);
writeIndexes(tree, '');

console.log(`Converted ${mdFiles.length} file(s) into ${OUT_DIR}`);
