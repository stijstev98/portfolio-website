const { marked } = require('marked');

// Use consistent base URL for Strapi
const STRAPI_BASE_URL = 'http://127.0.0.1:1337';

/**
 * Utility function to convert Strapi's Rich Text (Blocks) content to HTML
 * This handles Strapi 5's native blocks format
 * @param {Array} content - The blocks content from Strapi 5 Rich Text (Blocks) field
 * @param {Object} options - Optional configuration
 * @returns {String} HTML content
 */
module.exports = function renderRichText(content, options = {}) {
  if (!content) return '';

  // If it's a string, assume it's HTML from CKEditor or Markdown (legacy fallback)
  if (typeof content === 'string') {
    // Basic check if it looks like HTML, otherwise treat as Markdown
    if (content.trim().startsWith('<')) {
      return content; // It's already HTML
    }
    return marked(content); // It's Markdown
  }

  // Check if it's the new Strapi 5 Blocks format (array of blocks)
  if (Array.isArray(content)) {
    return renderStrapiBlocks(content);
  }

  // Legacy: Check if it's Lexical format (has root.children structure)
  if (content && content.root && content.root.children) {
    return renderLexicalContent(content, options);
  }

  return '';
};

/**
 * Render Strapi 5 Blocks content to HTML
 * @param {Array} blocks - Array of block objects
 * @returns {String} HTML content
 */
function renderStrapiBlocks(blocks) {
  if (!Array.isArray(blocks)) return '';

  return blocks.map(block => renderStrapiBlock(block)).join('');
}

/**
 * Render a single Strapi 5 block
 * @param {Object} block - Block object
 * @returns {String} HTML content
 */
function renderStrapiBlock(block) {
  if (!block || !block.type) return '';

  switch (block.type) {
    case 'paragraph':
      return `<p>${renderInlineContent(block.children || [])}</p>`;
    
    case 'heading':
      const level = Math.min(Math.max(block.level || 1, 1), 6);
      return `<h${level}>${renderInlineContent(block.children || [])}</h${level}>`;
    
    case 'list':
      const listTag = block.format === 'ordered' ? 'ol' : 'ul';
      const listItems = (block.children || []).map(item => 
        `<li>${renderInlineContent(item.children || [])}</li>`
      ).join('');
      return `<${listTag}>${listItems}</${listTag}>`;
    
    case 'quote':
      return `<blockquote>${renderInlineContent(block.children || [])}</blockquote>`;
    
    case 'code':
      const codeContent = getPlainText(block.children || []);
      return `<pre><code>${escapeHtml(codeContent)}</code></pre>`;
    
    case 'image':
      if (block.image) {
        const { url, alternativeText, width, height } = block.image;
        const altText = alternativeText || '';
        const dimensions = width && height ? ` width="${width}" height="${height}"` : '';
        return `<img src="${escapeHtml(url)}" alt="${escapeHtml(altText)}"${dimensions}>`;
      }
      return '';
    
    case 'link':
      const linkUrl = block.url || '#';
      return `<a href="${escapeHtml(linkUrl)}">${renderInlineContent(block.children || [])}</a>`;
    
    default:
      // For unknown block types, try to render children if they exist
      if (block.children && Array.isArray(block.children)) {
        return renderInlineContent(block.children);
      }
      return '';
  }
}

/**
 * Render inline content (text nodes with formatting)
 * @param {Array} children - Array of inline nodes
 * @returns {String} HTML content
 */
function renderInlineContent(children) {
  if (!Array.isArray(children)) return '';

  return children.map(child => {
    if (child.type === 'text') {
      return formatTextNode(child);
    } else if (child.type === 'link') {
      const linkUrl = child.url || '#';
      return `<a href="${escapeHtml(linkUrl)}">${renderInlineContent(child.children || [])}</a>`;
    } else if (child.children) {
      // Handle other inline elements that might have children
      return renderInlineContent(child.children);
    }
    return '';
  }).join('');
}

/**
 * Format text node with inline styling for Strapi 5 Blocks
 * @param {Object} node - Text node
 * @returns {String} Formatted HTML text
 */
function formatTextNode(node) {
  if (!node.text) return '';

  let text = escapeHtml(node.text);

  // Apply formatting based on Strapi 5 Blocks format
  if (node.bold) text = `<strong>${text}</strong>`;
  if (node.italic) text = `<em>${text}</em>`;
  if (node.strikethrough) text = `<s>${text}</s>`;
  if (node.underline) text = `<u>${text}</u>`;
  if (node.code) text = `<code>${text}</code>`;

  return text;
}

/**
 * Get plain text from children (for code blocks)
 * @param {Array} children - Array of nodes
 * @returns {String} Plain text content
 */
function getPlainText(children) {
  if (!Array.isArray(children)) return '';

  return children.map(child => {
    if (child.type === 'text') {
      return child.text || '';
    } else if (child.children) {
      return getPlainText(child.children);
    }
    return '';
  }).join('');
}

/**
 * Escape HTML characters
 * @param {String} text - Text to escape
 * @returns {String} Escaped text
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, match => htmlEscapes[match]);
}

// Legacy support functions for backward compatibility
function renderLexicalContent(content, options = {}) {
  if (!content.root || !content.root.children) return '';
  return renderLexicalNodes(content.root.children, options);
}

function renderLexicalNodes(nodes, options = {}, parentContext = {}) {
  if (!Array.isArray(nodes)) return '';
  return nodes.map(node => renderLexicalNode(node, options, parentContext)).join('');
}

function renderLexicalNode(node, options = {}, parentContext = {}) {
  if (!node || !node.type) return '';

  const { media = [], links = {} } = options;

  switch (node.type) {
    case 'root':
      return renderLexicalNodes(node.children || [], options, parentContext);

    case 'paragraph':
      const pClass = getAlignmentClass(node.format);
      const pAttributes = pClass ? ` class="${pClass}"` : '';
      return `<p${pAttributes}>${renderLexicalNodes(node.children || [], options, { ...parentContext, inParagraph: true })}</p>`;

    case 'heading':
      const level = Math.min(Math.max(node.tag ? parseInt(node.tag.replace('h', '')) : 1, 1), 6);
      const hClass = getAlignmentClass(node.format);
      const hAttributes = hClass ? ` class="${hClass}"` : '';
      return `<h${level}${hAttributes}>${renderLexicalNodes(node.children || [], options, parentContext)}</h${level}>`;

    case 'text':
      return formatLexicalTextNode(node);

    case 'linebreak':
      return '<br>';

    case 'list':
      const listTag = node.listType === 'number' ? 'ol' : 'ul';
      const listClass = getAlignmentClass(node.format);
      const listAttributes = listClass ? ` class="${listClass}"` : '';
      return `<${listTag}${listAttributes}>${renderLexicalNodes(node.children || [], options, { ...parentContext, inList: true })}</${listTag}>`;

    case 'listitem':
      return `<li>${renderLexicalNodes(node.children || [], options, parentContext)}</li>`;

    case 'quote':
      const quoteClass = getAlignmentClass(node.format);
      const quoteAttributes = quoteClass ? ` class="${quoteClass}"` : '';
      return `<blockquote${quoteAttributes}>${renderLexicalNodes(node.children || [], options, parentContext)}</blockquote>`;

    case 'code':
      const language = node.language || '';
      const codeClass = language ? ` class="language-${language}"` : '';
      return `<pre><code${codeClass}>${escapeHtml(renderTextOnly(node.children || []))}</code></pre>`;

    case 'link':
      const url = processLinkUrl(node.url, links);
      const target = node.newTab ? ' target="_blank" rel="noopener noreferrer"' : '';
      const title = node.title ? ` title="${escapeHtml(node.title)}"` : '';
      return `<a href="${escapeHtml(url)}"${target}${title}>${renderLexicalNodes(node.children || [], options, parentContext)}</a>`;

    case 'strapi-image':
      return renderStrapiImage(node, media);

    case 'horizontalrule':
      return '<hr>';

    default:
      if (node.children && Array.isArray(node.children)) {
        return renderLexicalNodes(node.children, options, parentContext);
      }
      return '';
  }
}

function formatLexicalTextNode(node) {
  if (!node.text) return '';

  let text = escapeHtml(node.text);

  if (node.format) {
    if (node.format & 1) text = `<strong>${text}</strong>`;
    if (node.format & 2) text = `<em>${text}</em>`;
    if (node.format & 4) text = `<s>${text}</s>`;
    if (node.format & 8) text = `<u>${text}</u>`;
    if (node.format & 16) text = `<code>${text}</code>`;
    if (node.format & 32) text = `<sub>${text}</sub>`;
    if (node.format & 64) text = `<sup>${text}</sup>`;
  }

  if (node.bold) text = `<strong>${text}</strong>`;
  if (node.italic) text = `<em>${text}</em>`;
  if (node.strikethrough) text = `<s>${text}</s>`;
  if (node.underline) text = `<u>${text}</u>`;
  if (node.code) text = `<code>${text}</code>`;

  return text;
}

function getAlignmentClass(format) {
  if (!format) return '';

  if (typeof format === 'string') {
    switch (format) {
      case 'left': return 'text-start';
      case 'center': return 'text-center';
      case 'right': return 'text-end';
      case 'justify': return 'text-justify';
      default: return '';
    }
  }

  if (typeof format === 'number') {
    if (format & 2) return 'text-center';
    if (format & 4) return 'text-end';
    if (format & 8) return 'text-justify';
    if (format & 1) return 'text-start';
  }

  return '';
}

function processLinkUrl(url, links = {}) {
  if (!url) return '#';

  if (url.startsWith('strapi://')) {
    const [collectionName, documentId] = url.replace('strapi://', '').split('/');

    if (links[collectionName]) {
      const foundDocument = links[collectionName].find(doc => doc.documentId === documentId);
      if (foundDocument) {
        switch (collectionName) {
          case 'posts':
            return `/posts/${foundDocument.slug}/`;
          default:
            return `/${collectionName}/${foundDocument.slug || foundDocument.id}/`;
        }
      }
    }
    return '#'; 
  }

  return url;
}

function renderStrapiImage(node, media = []) {
  const documentId = node.documentId;
  
  if (!documentId) return '';
  
  const constructImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http')) return imageUrl;
    return imageUrl.startsWith('/') ? `${STRAPI_BASE_URL}${imageUrl}` : `${STRAPI_BASE_URL}/${imageUrl}`;
  };

  const mediaAsset = media.find(asset => asset.documentId === documentId);
  
  if (mediaAsset) {
    const imageUrl = constructImageUrl(mediaAsset.url);
    const altText = mediaAsset.alternativeText || '';
    const width = mediaAsset.width || '';
    const height = mediaAsset.height || '';
    const caption = mediaAsset.caption || '';
    
    const dimensions = width && height ? ` width="${width}" height="${height}"` : '';
    let html = `<img src="${imageUrl}" alt="${escapeHtml(altText)}"${dimensions}>`;
    
    if (caption) {
      html = `<figure><img src="${imageUrl}" alt="${escapeHtml(altText)}"${dimensions}><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
    }
    
    return html;
  }
  
  return '';
}

function renderTextOnly(nodes) {
  if (!Array.isArray(nodes)) return '';
  
  return nodes.map(node => {
    if (node.type === 'text') return node.text || '';
    if (node.children) return renderTextOnly(node.children);
    return '';
  }).join('');
}
