const { marked } = require('marked');

/**
 * Utility function to convert Strapi's Rich Text content to HTML
 * @param {Object} content - The rich text content from Strapi
 * @returns {String} HTML content
 */
module.exports = function renderRichText(content) {
  if (!content) return '';
  
  // If it's a string (plain markdown), convert it
  if (typeof content === 'string') {
    return marked(content);
  }
  
  // Handle Strapi blocks format
  if (content && Array.isArray(content)) {
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
        const url = `http://localhost:1337${block.image.url}`;
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
  
  return '';
}
