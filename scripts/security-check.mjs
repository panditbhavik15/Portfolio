import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = ['index.html', '404.html'];
const errors = [];

const requiredDirectives = new Map([
  ['default-src', ["'self'"]],
  ['script-src', ["'self'"]],
  ['script-src-elem', ["'self'"]],
  ['script-src-attr', ["'none'"]],
  ['style-src', ["'self'", "'unsafe-inline'"]],
  ['style-src-elem', ["'self'", "'unsafe-inline'"]],
  ['style-src-attr', ["'none'"]],
  ['font-src', ["'self'"]],
  ['img-src', ["'self'", 'data:']],
  ['connect-src', ["'none'"]],
  ['media-src', ["'none'"]],
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'none'"]],
  ['frame-src', ["'none'"]],
  ['worker-src', ["'none'"]],
  ['manifest-src', ["'none'"]]
]);

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function isLocal(url) {
  return Boolean(url) && !/^(?:https?:)?\/\//i.test(url);
}

for (const file of htmlFiles) {
  const html = await readFile(path.join(root, file), 'utf8');
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]);
  const cspTag = metaTags.find(tag => attribute(tag, 'http-equiv').toLowerCase() === 'content-security-policy');
  const referrerTag = metaTags.find(tag => attribute(tag, 'name').toLowerCase() === 'referrer');

  if (!cspTag) {
    errors.push(`${file}: missing Content-Security-Policy meta tag`);
  } else {
    const directives = new Map();
    for (const directive of attribute(cspTag, 'content').toLowerCase().split(';')) {
      const [name, ...values] = directive.trim().split(/\s+/).filter(Boolean);
      if (name) directives.set(name, new Set(values));
    }

    for (const [name, values] of requiredDirectives) {
      for (const value of values) {
        if (!directives.get(name)?.has(value)) {
          errors.push(`${file}: CSP ${name} must include ${value}`);
        }
      }
    }

    if (!directives.has('upgrade-insecure-requests')) {
      errors.push(`${file}: CSP must include upgrade-insecure-requests`);
    }
  }

  if (!referrerTag || attribute(referrerTag, 'content').toLowerCase() !== 'no-referrer') {
    errors.push(`${file}: referrer policy must be no-referrer`);
  }

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = match[1];
    const type = attribute(attrs, 'type').toLowerCase();
    const src = attribute(attrs, 'src');
    if (src && !isLocal(src)) errors.push(`${file}: external script source is not allowed`);
    if (!src && type !== 'application/ld+json') errors.push(`${file}: inline executable script is not allowed`);
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (attribute(tag, 'rel').toLowerCase().includes('stylesheet') && !isLocal(attribute(tag, 'href'))) {
      errors.push(`${file}: external stylesheet is not allowed`);
    }
  }

  for (const match of html.matchAll(/<[^>]+>/g)) {
    const tag = match[0];
    if (/\son[a-z]+\s*=/i.test(tag)) errors.push(`${file}: inline event handler is not allowed`);
    if (/(?:href|src)\s*=\s*["']\s*javascript:/i.test(tag)) errors.push(`${file}: javascript: URL is not allowed`);
    if (/^<(?:iframe|object|embed)\b/i.test(tag)) errors.push(`${file}: embedded active content is not allowed`);
  }

  for (const match of html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)) {
    const rel = attribute(match[0], 'rel').toLowerCase().split(/\s+/);
    if (!rel.includes('noopener') || !rel.includes('noreferrer')) {
      errors.push(`${file}: target=_blank links need noopener noreferrer`);
    }
  }

  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(html)) {
    errors.push(`${file}: third-party font requests are not allowed`);
  }
}

const indexHtml = await readFile(path.join(root, 'index.html'), 'utf8');
for (const id of ['name', 'email', 'message']) {
  const tag = [...indexHtml.matchAll(/<(?:input|textarea)\b[^>]*>/gi)]
    .map(match => match[0])
    .find(tag => attribute(tag, 'id') === id);
  if (!tag || !attribute(tag, 'maxlength')) errors.push(`index.html: ${id} needs a maxlength limit`);
}

const scripts = await readdir(path.join(root, 'assets'));
for (const file of scripts.filter(file => file.endsWith('.js'))) {
  const source = await readFile(path.join(root, 'assets', file), 'utf8');
  for (const [name, pattern] of [
    ['innerHTML', /\binnerHTML\b/],
    ['outerHTML', /\bouterHTML\b/],
    ['insertAdjacentHTML', /\binsertAdjacentHTML\b/],
    ['document.write', /\bdocument\.write\b/],
    ['eval', /\beval\s*\(/],
    ['Function constructor', /\bnew\s+Function\b/]
  ]) {
    if (pattern.test(source)) errors.push(`assets/${file}: dangerous DOM API ${name} is not allowed`);
  }
}

const fontCss = await readFile(path.join(root, 'assets', 'fonts.css'), 'utf8');
if (/https?:\/\//i.test(fontCss)) errors.push('assets/fonts.css: fonts must be self-hosted');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Security checks passed.');
}
