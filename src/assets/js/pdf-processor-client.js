/**
 * Client-side PDF processor for rich content editor book flip components
 */

window.processPDF = async function(pdfUrl, title, container) {
  if (!container) {
    console.error('Container element not found for PDF processing');
    return;
  }

  try {
    // Show processing state
    container.innerHTML = `
      <div class="book-loading">
        <p>📖 Processing: ${title}</p>
        <p>Converting PDF to book flip...</p>
        <div class="loading-spinner"></div>
      </div>
    `;

    // Call the backend API to process the PDF
    const response = await fetch('/api/process-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        pdfUrl: pdfUrl,
        title: title 
      })
    });

    if (!response.ok) {
      throw new Error(`PDF processing failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success && result.pages) {
      // Create the book flip HTML structure
      const bookHtml = createBookFlipHTML(result.pages, result.aspectRatio, title);
      container.innerHTML = bookHtml;
      
      // Initialize the book flip functionality
      if (window.initializeBookFlip) {
        window.initializeBookFlip(container.querySelector('.book'));
      }
    } else {
      throw new Error(result.error || 'Unknown error processing PDF');
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    container.innerHTML = `
      <div class="book-error">
        <p>❌ Error processing PDF: ${title}</p>
        <p>${error.message}</p>
        <p>Please check the PDF URL and try again.</p>
      </div>
    `;
  }
};

function createBookFlipHTML(pages, aspectRatio, title) {
  const aspectRatioStyle = aspectRatio ? `style="--aspect-ratio: ${aspectRatio};"` : '';
  
  let pagesHtml = '';
  
  // Process pages to ensure proper front/back pairing
  for (let i = 0; i < pages.length; i += 2) {
    const frontPage = pages[i];
    const backPage = pages[i + 1];
    
    pagesHtml += `
      <div class="page">
        <div class="front">
          <img src="${frontPage.url}" 
               alt="${frontPage.alt || frontPage.name || 'Page ' + frontPage.pageNumber}" 
               style="width: 100%; height: 100%; object-fit: cover;"
               onerror="this.onerror=null; this.src='/images/posts/error.png';"
               loading="lazy">
        </div>
        <div class="back">
          ${backPage ? `
            <img src="${backPage.url}" 
                 alt="${backPage.alt || backPage.name || 'Page ' + backPage.pageNumber}" 
                 style="width: 100%; height: 100%; object-fit: cover;"
                 onerror="this.onerror=null; this.src='/images/posts/error.png';"
                 loading="lazy">
          ` : ''}
        </div>
      </div>
    `;
  }
  
  return `
    <div class="book-flip-container" data-aspect-ratio="${aspectRatio || ''}">
      <div class="book" ${aspectRatioStyle}>
        ${pagesHtml}
      </div>
    </div>
    <script src="/assets/js/book-flip.js"></script>
  `;
}

// Auto-process any book flip placeholders on page load
document.addEventListener('DOMContentLoaded', function() {
  const bookPlaceholders = document.querySelectorAll('.book-loading[data-title]');
  
  bookPlaceholders.forEach(placeholder => {
    const container = placeholder.closest('[data-pdf-url]');
    if (container) {
      const pdfUrl = container.getAttribute('data-pdf-url');
      const title = placeholder.getAttribute('data-title');
      
      if (pdfUrl && title) {
        window.processPDF(pdfUrl, title, container);
      }
    }
  });
}); 