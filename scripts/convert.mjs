import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import MarkdownIt from 'markdown-it';

const SRC_DIR = process.cwd();
const OUT_DIR = path.join(process.cwd(), '_site');
const EXCLUDE_DIRS = new Set(['.git', '.github', '.obsidian', 'node_modules', '_site', 'scripts']);

const md = new MarkdownIt({ html: true, linkify: true });

// markdown-it blocks `data:` URIs in ![]() syntax by default (security default).
// Explicitly allow base64 image data URIs through — this is the one line that
// makes Image Baker's embedded images survive conversion.
const defaultValidateLink = md.validateLink;
md.validateLink = (url) =>
  /^data:image\/[a-z0-9.+-]+;base64,/i.test(url) || defaultValidateLink(url);
// Note: if Image Baker outputs raw <img src="data:..."> HTML tags instead of
// ![]() syntax, `html: true` above already passes those through untouched —
// no patch needed for that case.

function walk(dir, relBase = '') {
  const entries = readdirSync(dir);
  let mdFiles = [];
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const rel = path.join(relBase, entry);
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
  a { color: #58a6ff; }
  blockquote { border-left: 3px solid #30363d; margin-left: 0; padding-left: 1rem; color: #8b949e; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #30363d; padding: 0.4rem 0.8rem; }
  nav a { display: block; margin: 0.25rem 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;

const links = [];

for (const relPath of mdFiles) {
  const srcPath = path.join(SRC_DIR, relPath);
  const raw = readFileSync(srcPath, 'utf-8');
  const html = md.render(raw);
  const outRelPath = relPath.replace(/\.md$/i, '.html');
  const outPath = path.join(OUT_DIR, outRelPath);
  mkdirSync(path.dirname(outPath), { recursive: true });
  const title = path.basename(relPath, '.md');
  writeFileSync(outPath, page(title, html));
  links.push({ href: outRelPath, title: relPath });
}

const indexBody = `<h1>Documentation</h1>\n<nav>\n${links
  .map((l) => `<a href="${l.href}">${l.title}</a>`)
  .join('\n')}\n</nav>`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, 'index.html'), page('Documentation', indexBody));

console.log(`Converted ${mdFiles.length} file(s) into ${OUT_DIR}`);
