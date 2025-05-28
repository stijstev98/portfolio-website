const { marked } = require('marked');

// Use consistent base URL for Strapi
const STRAPI_BASE_URL = 'http://127.0.0.1:1337';

/**
 * Utility function to convert Strapi's Rich Text content to HTML
 * Supports both legacy Strapi blocks format and new Lexical JSON format
 * @param {Object|Array|String} content - The rich text content from Strapi
 * @param {Object} options - Optional configuration
 * @param {Array} options.media - Media assets for Lexical strapi-image nodes
 * @param {Object} options.links - Internal links for Lexical link resolution
 * @returns {String} HTML content
 */
module.exports = function renderRichText(content, options = {}) {
  if (!content) return '';
  
  // If it's a string (plain markdown), convert it
  if (typeof content === 'string') {
    return marked(content);
  }
  
  // Check if it's Lexical format (has root.children structure)
  if (content && content.root && content.root.children) {
    return renderLexicalContent(content, options);
  }
  
  // Handle legacy Strapi blocks format
  if (content && Array.isArray(content)) {
    return renderStrapiBlocks(content);
  }
  
  return '';
};

/**
 * Render Lexical JSON content to HTML
 */
function renderLexicalContent(content, options = {}) {
  if (!content.root || !content.root.children) return '';
  
  return renderLexicalNodes(content.root.children, options);
}

/**
 * Recursively render Lexical nodes
 */
function renderLexicalNodes(nodes, options = {}, parentContext = {}) {
  if (!Array.isArray(nodes)) return '';
  
  return nodes.map(node => renderLexicalNode(node, options, parentContext)).join('');
}

/**
 * Render a single Lexical node
 */
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
      return formatTextNode(node);
      
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
      // For unknown node types, try to render children if they exist
      if (node.children && Array.isArray(node.children)) {
        return renderLexicalNodes(node.children, options, parentContext);
      }
      return '';
  }
}

/**
 * Format text node with inline styling
 */
function formatTextNode(node) {
  if (!node.text) return '';
  
  let text = escapeHtml(node.text);
  
  // Handle [flip-book] shortcode - just pass it through without escaping
  // It will be replaced in the template
  if (text.includes('[flip-book]')) {
    text = text.replace(/\[flip-book\]/g, '[flip-book]');
  }
  
  // Apply formatting based on format bitmask
  // Lexical uses bit flags: 1=bold, 2=italic, 4=strikethrough, 8=underline, 16=code, etc.
  if (node.format) {
    if (node.format & 1) text = `<strong>${text}</strong>`; // Bold
    if (node.format & 2) text = `<em>${text}</em>`; // Italic
    if (node.format & 4) text = `<s>${text}</s>`; // Strikethrough
    if (node.format & 8) text = `<u>${text}</u>`; // Underline
    if (node.format & 16) text = `<code>${text}</code>`; // Code
    if (node.format & 32) text = `<sub>${text}</sub>`; // Subscript
    if (node.format & 64) text = `<sup>${text}</sup>`; // Superscript
  }
  
  // Handle legacy boolean format properties (fallback)
  if (node.bold) text = `<strong>${text}</strong>`;
  if (node.italic) text = `<em>${text}</em>`;
  if (node.strikethrough) text = `<s>${text}</s>`;
  if (node.underline) text = `<u>${text}</u>`;
  if (node.code) text = `<code>${text}</code>`;
  
  return text;
}

/**
 * Get CSS class for text alignment
 */
function getAlignmentClass(format) {
  if (!format) return '';
  
  // Handle string format
  if (typeof format === 'string') {
    switch (format) {
      case 'left': return 'text-start';
      case 'center': return 'text-center';
      case 'right': return 'text-end';
      case 'justify': return 'text-justify';
      default: return '';
    }
  }
  
  // Handle Lexical format bitmask
  // Alignment flags: 1=left, 2=center, 4=right, 8=justify
  if (typeof format === 'number') {
    if (format & 2) return 'text-center';
    if (format & 4) return 'text-end';
    if (format & 8) return 'text-justify';
    if (format & 1) return 'text-start';
  }
  
  return '';
}

/**
 * Process link URLs, converting internal Strapi links
 */
function processLinkUrl(url, links = {}) {
  if (!url) return '#';
  
  // Handle internal Strapi links: strapi://collectionName/documentId
  if (url.startsWith('strapi://')) {
    const [collectionName, documentId] = url.replace('strapi://', '').split('/');
    
    if (links[collectionName]) {
      const foundDocument = links[collectionName].find(doc => doc.documentId === documentId);
      if (foundDocument) {
        // Generate proper URL based on collection type
        switch (collectionName) {
          case 'posts':
            return `/posts/${foundDocument.slug || documentId}/`;
          case 'pages':
            return `/${foundDocument.slug || documentId}/`;
          default:
            return `/${collectionName}/${foundDocument.slug || documentId}/`;
        }
      }
    }
    
    // Fallback for unresolved internal links
    return `/${collectionName}/${documentId}/`;
  }
  
  return url;
}

/**
 * Render Strapi image nodes
 */
function renderStrapiImage(node, media = []) {
  if (!node.documentId) return '';
  
  // Find the media asset
  const mediaAsset = media.find(m => m.documentId === node.documentId);
  if (!mediaAsset) {
    console.warn(`Media asset not found for documentId: ${node.documentId}`);
    return '';
  }
  
  // Helper function to construct image URL
  const constructImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    return imageUrl.startsWith('http') ? imageUrl : `${STRAPI_BASE_URL}${imageUrl}`;
  };
  
  const src = constructImageUrl(mediaAsset.url);
  const alt = mediaAsset.alternativeText || mediaAsset.name || '';
  const width = mediaAsset.width || '';
  const height = mediaAsset.height || '';
  
  // Build responsive image with optional dimensions
  const dimensions = width && height ? ` width="${width}" height="${height}"` : '';
  const caption = mediaAsset.caption || node.caption || '';
  
  let imageHtml = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${dimensions} class="rich-content-image">`;
  
  if (caption) {
    imageHtml = `<figure class="rich-content-image">
      ${imageHtml}
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>`;
  }
  
  return imageHtml;
}

/**
 * Render text content only (for code blocks, etc.)
 */
function renderTextOnly(nodes) {
  if (!Array.isArray(nodes)) return '';
  
  return nodes.map(node => {
    if (node.type === 'text') return node.text || '';
    if (node.children) return renderTextOnly(node.children);
    return '';
  }).join('');
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  
  // Don't escape the [flip-book] shortcode
  const hasFlipBook = text.includes('[flip-book]');
  if (hasFlipBook) {
    // Split by shortcode, escape parts, then rejoin
    const parts = text.split('[flip-book]');
    const escapedParts = parts.map(part => 
      part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    );
    return escapedParts.join('[flip-book]');
  }
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Legacy Strapi blocks renderer (keeping for backward compatibility)
 */
function renderStrapiBlocks(content) {
  return content.map(block => {
    if (block.type === 'paragraph') {
      return `<p>${block.children.map(child => {
        if (child.type === 'text') {
          let text = child.text;
          if (child.bold) text = `<strong>${text}</strong>`;
          if (child.italic) text = `<em>${text}</em>`;
          if (child.underline) text = `<u>${text}</u>`;
          if (child.strikethrough) text = `<s>${text}</s>`;
          if (child.code) text = `<code>${text}</code>`;
          return text;
        }
        return '';
      }).join('')}</p>`;
    }
    
    if (block.type === 'heading') {
      const level = block.level;
      return `<h${level}>${block.children.map(child => child.text).join('')}</h${level}>`;
    }
    
    if (block.type === 'list') {
      const listType = block.format === 'ordered' ? 'ol' : 'ul';
      return `<${listType}>${block.children.map(item => {
        return `<li>${item.children.map(child => {
          if (child.type === 'text') return child.text;
          return '';
        }).join('')}</li>`;
      }).join('')}</${listType}>`;
    }
    
    if (block.type === 'image' && block.image) {
      // Helper function to construct image URL
      const constructImageUrl = (imageUrl) => {
        if (!imageUrl) return '';
        return imageUrl.startsWith('http') ? imageUrl : `${STRAPI_BASE_URL}${imageUrl}`;
      };
      
      const url = constructImageUrl(block.image.url);
      const alt = block.image.alternativeText || '';
      return `<img src="${url}" alt="${alt}" />`;
    }
    
    if (block.type === 'code') {
      return `<pre><code class="language-${block.language || ''}">${block.children.map(child => child.text).join('')}</code></pre>`;
    }
    
    if (block.type === 'quote') {
      return `<blockquote>${block.children.map(child => child.children.map(c => c.text).join('')).join('')}</blockquote>`;
    }
    
    return '';
  }).join('');
}
