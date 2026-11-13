import { Marked } from 'marked';
import hljs from 'highlight.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyHeading(text, usedSlugs) {
  const plain = String(text)
    .replace(/<[^>]+>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-');
  const base = plain || 'section';
  const count = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

const CALLOUT_LABELS = {
  NOTE: { title: '说明', cls: 'callout-note' },
  TIP: { title: '技巧', cls: 'callout-tip' },
  IMPORTANT: { title: '重要', cls: 'callout-important' },
  WARNING: { title: '注意', cls: 'callout-warning' },
  CAUTION: { title: '警告', cls: 'callout-caution' },
};

/**
 * 将 Markdown 渲染为 HTML，并提取目录（headings）与估算阅读时长。
 * 支持 highlight.js 代码高亮与 GitHub/Obsidian 风格 `> [!TIP]` 提示框。
 */
export function renderMarkdown(markdownText = '') {
  const headings = [];
  const usedSlugs = new Map();

  const renderer = {
    heading({ tokens, depth }) {
      const innerHtml = this.parser.parseInline(tokens);
      const rawText = innerHtml.replace(/<[^>]+>/g, '').trim();
      const slug = slugifyHeading(rawText, usedSlugs);
      if (depth >= 2 && depth <= 3) {
        headings.push({ depth, text: rawText, slug });
      }
      return `<h${depth} id="${escapeHtml(slug)}"><a class="heading-anchor" href="#${escapeHtml(slug)}" aria-hidden="true">#</a>${innerHtml}</h${depth}>\n`;
    },

    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : '';
      const highlighted = language
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value;
      const langBadge = language ? `<span class="code-lang">${escapeHtml(language)}</span>` : '';
      return `<div class="code-block"><div class="code-toolbar">${langBadge}<button type="button" class="copy-code-btn">复制</button></div><pre><code class="hljs ${language ? `language-${escapeHtml(language)}` : ''}">${highlighted}</code></pre></div>\n`;
    },

    blockquote({ tokens }) {
      const bodyHtml = this.parser.parse(tokens);
      const match = bodyHtml.match(
        /^<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:[ \t]*([^\n<]*))?(?:<br\s*\/?>|\n)?([\s\S]*)$/i
      );
      if (!match) {
        return `<blockquote>${bodyHtml}</blockquote>\n`;
      }
      const kind = match[1].toUpperCase();
      const meta = CALLOUT_LABELS[kind] ?? CALLOUT_LABELS.NOTE;
      const customTitle = match[2]?.trim();
      const restBody = match[3] ? `<p>${match[3]}` : '';
      return `<aside class="callout ${meta.cls}"><div class="callout-title">${escapeHtml(customTitle || meta.title)}</div><div class="callout-body">${restBody}</div></aside>\n`;
    },
  };

  const parser = new Marked({
    gfm: true,
    breaks: false,
  });
  parser.use({ renderer });

  const html = parser.parse(String(markdownText ?? ''));
  return {
    html,
    headings,
    readingMinutes: estimateReadingMinutes(markdownText),
  };
}

export function estimateReadingMinutes(text = '') {
  const clean = String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`>\-\[\]()]/g, ' ');
  const cjk = (clean.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = clean
    .replace(/[\u4e00-\u9fa5]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(cjk / 350 + words / 200));
}
