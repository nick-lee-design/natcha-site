import type { ReactNode } from 'react';

// Paragraphs allow bold, italic and links only. Anything else stays literal text.
const TAG = /<(\/?)(strong|b|em|i|a)\b([^>]*)>|<br\s*\/?>/gi;
const HREF = /\bhref="([^"]*)"/i;

type Node = { tag: string; href?: string; children: (Node | string)[] };

const decode = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e] ?? _);

function parse(html: string): Node {
  const root: Node = { tag: 'root', children: [] };
  const stack = [root];
  let last = 0;
  for (const m of html.matchAll(TAG)) {
    const top = stack[stack.length - 1];
    if (m.index > last) top.children.push(decode(html.slice(last, m.index)));
    last = m.index + m[0].length;
    if (!m[2]) {
      top.children.push({ tag: 'br', children: [] });
    } else if (m[1]) {
      const i = stack.findLastIndex((n) => n.tag === m[2].toLowerCase());
      if (i > 0) stack.length = i;
    } else {
      const node: Node = { tag: m[2].toLowerCase(), href: m[3]?.match(HREF)?.[1], children: [] };
      top.children.push(node);
      stack.push(node);
    }
  }
  if (last < html.length) stack[stack.length - 1].children.push(decode(html.slice(last)));
  return root;
}

const safeHref = (href?: string) => (href && /^(https?:|mailto:|tel:)/i.test(href) ? href : undefined);

function render(nodes: (Node | string)[]): ReactNode[] {
  return nodes.map((n, i) => {
    if (typeof n === 'string') return n;
    const kids = render(n.children);
    switch (n.tag) {
      case 'strong':
      case 'b':
        return <strong key={i}>{kids}</strong>;
      case 'em':
      case 'i':
        return <em key={i}>{kids}</em>;
      case 'a':
        return (
          <a key={i} href={safeHref(n.href)} target="_blank" rel="noopener noreferrer">
            {kids}
          </a>
        );
      case 'br':
        return <br key={i} />;
      default:
        return kids;
    }
  });
}

export function RichText({ html }: { html: string }) {
  return <>{render(parse(html).children)}</>;
}
