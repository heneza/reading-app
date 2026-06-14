import sanitizeHtml from 'sanitize-html';

// Allow only the formatting our editor produces. Everything else (scripts,
// event handlers, links, images, etc.) is stripped, so a post can never
// inject anything dangerous when rendered to other users.
export function sanitizePostHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? '', {
    allowedTags: [
      'b', 'strong', 'i', 'em', 'u', 's', 'span', 'p', 'div', 'br',
      'ul', 'ol', 'li', 'blockquote',
    ],
    allowedAttributes: { '*': ['style'] },
    allowedStyles: {
      '*': {
        color: [
          /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i,
          /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
          /^(black|red|green|blue|pink)$/i,
        ],
        'text-decoration': [/^(underline|overline|line-through)(\s+(underline|overline|line-through))*$/i],
        'font-style': [/^(italic|normal)$/i],
        'font-weight': [/^(bold|normal|[1-9]00)$/i],
        'font-family': [/^["']?Times New Roman["']?(\s*,\s*serif)?$/i, /^serif$/i, /^inherit$/i],
        'font-size': [/^(?:0?\.\d+|\d{1,2}(?:\.\d+)?)(px|em|rem)$/i],
      },
    },
    allowedSchemes: [],
    disallowedTagsMode: 'discard',
  });
}

// Rough plain-text length, used for the 280-character / article rule.
export function htmlToText(html: string): string {
  return (html ?? '')
    .replace(/<\/(p|div|li|ul|ol|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
