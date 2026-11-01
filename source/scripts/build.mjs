// Build : esbuild (TS/React) + Tailwind v4 (API compile) -> dist/index.html autonome
import { build } from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const twBase = path.join(root, 'node_modules/tailwindcss');
const prod = !process.argv.includes('--dev');

const js = await build({
  entryPoints: [path.join(root, 'src/main.tsx')], bundle: true, minify: prod, format: 'iife', target: ['es2020'],
  jsx: 'automatic', write: false, define: { 'process.env.NODE_ENV': prod ? '"production"' : '"development"' }, legalComments: 'none', logLevel: 'warning',
});
const code = js.outputFiles[0].text;

// Candidats Tailwind : tous les "mots" du code source
const files = [];
const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.(tsx?|html)$/.test(f) && files.push(p); } };
walk(path.join(root, 'src'));
const cand = new Set();
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/[^\s"'`{}<>]+/g)) { const t = m[0].replace(/[,;]$/, ''); cand.add(t); cand.add(t.replace(/^\(+|\)+$/g, '')); }

const loadStylesheet = async (id, base) => {
  let p = id === 'tailwindcss' ? path.join(twBase, 'index.css') : id.startsWith('tailwindcss/') ? path.join(twBase, id.slice(12)) : path.resolve(base, id);
  if (!p.endsWith('.css')) p += '.css';
  return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
};
const compiler = await compile(fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8'), { base: path.join(root, 'src'), loadStylesheet });
let css = compiler.build([...cand]);
if (prod) css = (await build({ stdin: { contents: css, loader: 'css' }, minify: true, write: false, logLevel: 'silent' })).outputFiles[0].text;

const html = `<!doctype html>
<html lang="fr" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0b0d12" />
<meta name="description" content="WORKPRICE PRO — calcul de tarifs, devis et factures pour indépendants et entreprises." />
<title>WORKPRICE PRO</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#7c5cff"/><path d="M6 10l4 12 6-11 6 11 4-12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>')}" />
<link rel="manifest" href="manifest.webmanifest" />
<link rel="apple-touch-icon" href="apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
<script>try{var d=JSON.parse(localStorage.getItem('workprice-pro:v1:default')||'{}').settings;if(d){document.documentElement.dataset.theme=d.theme||'dark';if(d.accentColor)document.documentElement.style.setProperty('--wp-accent',d.accentColor)}}catch(e){}</script>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<noscript>WORKPRICE PRO nécessite JavaScript.</noscript>
<script>if("serviceWorker" in navigator&&location.protocol==="https:")addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));</script>
<script>${code.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
for (const f of fs.readdirSync(path.join(root, 'public'))) fs.copyFileSync(path.join(root, 'public', f), path.join(root, 'dist', f));
console.log(`dist/index.html — ${(html.length / 1024).toFixed(0)} Ko (css ${(css.length / 1024).toFixed(0)} Ko, js ${(code.length / 1024).toFixed(0)} Ko)`);
