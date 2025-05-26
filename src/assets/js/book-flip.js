document.addEventListener('DOMContentLoaded', () => {
  // Initialize all books on the page
  document.querySelectorAll('.book-flip-container').forEach(container => {
    initializeBook(container.querySelector('.book'));
  });
  
  function initializeBook(book) {
    if (!book) return;
    
    // Set current page index
    book.style.setProperty('--c', '0');
    
    // Set page indices
    const pages = book.querySelectorAll('.page');
    pages.forEach((page, i) => {
      page.style.setProperty('--i', i);
      page.style.setProperty('--curl-angle', '0deg');
      page.style.setProperty('--curl-translate-y', '0px');
      page.style.setProperty('--curl-shadow-opacity', '0');

      page.addEventListener('mousemove', e => {
        const currentPageIndex = parseInt(book.style.getPropertyValue('--c') || 0);
        const pageIndex = parseInt(page.style.getPropertyValue('--i') || 0);

        // Apply curl only to the current open page (right side) or the page before it (left side when turning back)
        if (pageIndex === currentPageIndex || pageIndex === currentPageIndex -1) {
          const rect = page.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const width = rect.width;
          const height = rect.height;

          let curlAngle = 0;
          let curlTranslateY = 0;
          let shadowOpacity = 0;

          // Curl from right edge when it's the current page
          if (pageIndex === currentPageIndex && x > width * 0.7) {
            const progress = (x - width * 0.7) / (width * 0.3); // 0 to 1 from 70% to 100% width
            curlAngle = progress * -35; // Max curl of -35 degrees
            // Remove X translation to keep spine fixed
            curlTranslateY = progress * 10; // Max translate 10px
            shadowOpacity = progress * 0.3;
          } 
          // Curl from left edge when it's the page before current (turning back)
          else if (pageIndex === currentPageIndex - 1 && x < width * 0.3) {
            const progress = (width * 0.3 - x) / (width * 0.3); // 0 to 1 from 30% to 0% width
            curlAngle = progress * 35; // Max curl of 35 degrees
            // Remove X translation to keep spine fixed
            curlTranslateY = progress * 10;
            shadowOpacity = progress * 0.3;
          }

          page.style.setProperty('--curl-angle', `${curlAngle}deg`);
          // Remove X translation setting
          page.style.setProperty('--curl-translate-y', `${curlTranslateY}px`);
          page.style.setProperty('--curl-shadow-opacity', `${shadowOpacity}`);
        }
      });

      page.addEventListener('mouseleave', () => {
        page.style.setProperty('--curl-angle', '0deg');
        // Remove X translation reset
        page.style.setProperty('--curl-translate-y', '0px');
        page.style.setProperty('--curl-shadow-opacity', '0');
      });
      
      // Add click event to flip pages
      page.addEventListener('click', e => {
        // Reset curl on click before page turn
        page.style.setProperty('--curl-angle', '0deg');
        // Remove X translation reset
        page.style.setProperty('--curl-translate-y', '0px');
        page.style.setProperty('--curl-shadow-opacity', '0');

        // Prevent flipping when clicking links
        if (e.target.tagName === 'A' || e.target.closest('a')) {
          e.stopPropagation();
          return;
        }
        
        const rect = page.getBoundingClientRect();
        const isClickOnRightHalf = e.clientX - rect.left > rect.width / 2;
        
        // Current page index
        const c = parseInt(book.style.getPropertyValue('--c') || 0);
        const i = parseInt(page.style.getPropertyValue('--i') || 0);
        
        // Calculate target page based on click position and current page
        let targetPage = c;
        if (isClickOnRightHalf && i === c) {
          targetPage = Math.min(c + 1, pages.length - 1);
        } else if (!isClickOnRightHalf && i === c - 1) {
          targetPage = Math.max(c - 1, 0);
        } else {
          targetPage = i;
        }
        
        // Set new current page
        book.style.setProperty('--c', targetPage);
      });
    });
  }
});