document.addEventListener('DOMContentLoaded', () => {
  // Initialize all books on the page
  document.querySelectorAll('.book-flip-container').forEach(container => {
    initializeBook(container);
  });
  
  function initializeBook(container) {
    const book = container.querySelector('.book');
    if (!book) return;
    
    // Book state
    const state = {
      currentPage: 0,
      totalPages: 0,
      isUserInteracted: false,
      autoFlipInterval: null,
      autoFlipDelay: 1500, // 1.5 seconds between auto-flips (faster)
      performancePageRange: 3 // Only render pages within this range of current page
    };
    
    // Get elements
    const pages = book.querySelectorAll('.page');
    const progressTrack = container.querySelector('.progress-track');
    const progressFill = container.querySelector('.progress-fill');
    const currentPageSpan = container.querySelector('.current-page');
    const totalPagesSpan = container.querySelector('.total-pages');
    
    // Calculate total book pages (each .page element represents a book page with front/back)
    state.totalPages = pages.length;
    
    if (totalPagesSpan) {
      totalPagesSpan.textContent = state.totalPages;
    }
    
    // Initialize book
    updateBookState();
    setupPageIndices();
    setupEventListeners();
    startAutoFlip();
    
    function updateBookState() {
      book.style.setProperty('--c', state.currentPage.toString());
      
      // Update progress bar
      if (progressFill) {
        const progress = state.totalPages > 1 ? state.currentPage / (state.totalPages - 1) : 0;
        progressFill.style.width = `${progress * 100}%`;
      }
      
      // Update page counter
      if (currentPageSpan) {
        currentPageSpan.textContent = state.currentPage + 1;
      }
      
      // Performance: Hide/show pages based on current view
      updatePageVisibility();
    }
    
    function updatePageVisibility() {
      pages.forEach((page, i) => {
        const distance = Math.abs(i - state.currentPage);
        const shouldHide = distance > state.performancePageRange;
        
        page.classList.toggle('page-hidden', shouldHide);
      });
    }
    
    function setupPageIndices() {
      pages.forEach((page, i) => {
        page.style.setProperty('--i', i.toString());
        resetPageCurl(page);
      });
    }
    
    function resetPageCurl(page) {
      page.style.setProperty('--curl-angle', '0deg');
      page.style.setProperty('--curl-translate-y', '0px');
      page.style.setProperty('--curl-shadow-opacity', '0');
    }
    
    function setupEventListeners() {
      pages.forEach((page, i) => {
        // Mouse movement for curl effect and cursor - DON'T trigger userInteracted
        page.addEventListener('mousemove', e => handlePageMouseMove(page, e, i));
        page.addEventListener('mouseleave', () => handlePageMouseLeave(page));
        
        // Click events for page turning - DO trigger userInteracted
        page.addEventListener('click', e => handlePageClick(page, e, i));
        
        // Prevent context menu and selection
        page.addEventListener('contextmenu', e => e.preventDefault());
        page.addEventListener('selectstart', e => e.preventDefault());
        page.addEventListener('dragstart', e => e.preventDefault());
      });
      
      // Progress bar events - simplified for smoother interaction
      if (progressTrack) {
        let isDragging = false;
        
        // Mouse events
        progressTrack.addEventListener('mousedown', e => {
          isDragging = true;
          userInteracted(); // Only trigger when actually dragging starts
          handleProgressInteraction(e);
        });
        
        progressTrack.addEventListener('mousemove', e => {
          if (isDragging) {
            handleProgressInteraction(e);
          }
        });
        
        document.addEventListener('mouseup', () => {
          if (isDragging) {
            isDragging = false;
            resetAllPageCurls();
          }
        });
        
        // Touch events for mobile
        progressTrack.addEventListener('touchstart', e => {
          isDragging = true;
          userInteracted(); // Only trigger when actually dragging starts
          e.preventDefault();
          if (e.touches[0]) {
            handleProgressInteraction(e.touches[0]);
          }
        });
        
        progressTrack.addEventListener('touchmove', e => {
          if (isDragging && e.touches[0]) {
            e.preventDefault();
            handleProgressInteraction(e.touches[0]);
          }
        });
        
        document.addEventListener('touchend', () => {
          if (isDragging) {
            isDragging = false;
            resetAllPageCurls();
          }
        });
      }
      
      // Touch events for mobile page flipping - DO trigger userInteracted
      pages.forEach((page, i) => {
        page.addEventListener('touchstart', e => handlePageTouch(e, i), { passive: false });
      });
    }
    
    function handleProgressInteraction(e) {
      const rect = progressTrack.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const progress = Math.max(0, Math.min(1, x / rect.width));
      const targetPage = Math.round(progress * (state.totalPages - 1));
      
      if (targetPage !== state.currentPage) {
        state.currentPage = targetPage;
        updateBookState();
      }
    }
    
    function handlePageMouseMove(page, e, pageIndex) {
      const rect = page.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;
      const isRightHalf = x > width / 2;
      
      // Update cursor based on position
      updatePageCursor(page, isRightHalf, pageIndex);
      
      // Apply curl effect only to relevant pages
      if (pageIndex === state.currentPage || pageIndex === state.currentPage - 1) {
        applyCurlEffect(page, x, y, width, height, pageIndex);
      }
    }
    
    function updatePageCursor(page, isRightHalf, pageIndex) {
      // Remove existing cursor classes
      page.classList.remove('cursor-left', 'cursor-right');
      
      // Determine if we can navigate in each direction
      const canGoLeft = state.currentPage > 0 && (pageIndex === state.currentPage - 1);
      const canGoRight = state.currentPage < state.totalPages - 1 && (pageIndex === state.currentPage);
      
      if (isRightHalf && canGoRight) {
        page.classList.add('cursor-right');
      } else if (!isRightHalf && canGoLeft) {
        page.classList.add('cursor-left');
      }
    }
    
    function applyCurlEffect(page, x, y, width, height, pageIndex) {
      let curlAngle = 0;
      let curlTranslateY = 0;
      let shadowOpacity = 0;
      
      // Curl from right edge when it's the current page
      if (pageIndex === state.currentPage && x > width * 0.7) {
        const progress = (x - width * 0.7) / (width * 0.3);
        curlAngle = progress * -35;
        curlTranslateY = progress * 10;
        shadowOpacity = progress * 0.3;
      } 
      // Curl from left edge when it's the page before current
      else if (pageIndex === state.currentPage - 1 && x < width * 0.3) {
        const progress = (width * 0.3 - x) / (width * 0.3);
        curlAngle = progress * 35;
        curlTranslateY = progress * 10;
        shadowOpacity = progress * 0.3;
      }
      
      page.style.setProperty('--curl-angle', `${curlAngle}deg`);
      page.style.setProperty('--curl-translate-y', `${curlTranslateY}px`);
      page.style.setProperty('--curl-shadow-opacity', `${shadowOpacity}`);
    }
    
    function handlePageMouseLeave(page) {
      resetPageCurl(page);
      page.classList.remove('cursor-left', 'cursor-right');
    }
    
    function handlePageClick(page, e, pageIndex) {
      e.preventDefault();
      userInteracted();
      
      // Prevent navigation when clicking on links
      if (e.target.tagName === 'A' || e.target.closest('a')) {
        e.stopPropagation();
        return;
      }
      
      const rect = page.getBoundingClientRect();
      const isRightHalf = e.clientX - rect.left > rect.width / 2;
      
      navigateToPage(pageIndex, isRightHalf);
    }
    
    function handlePageTouch(e, pageIndex) {
      e.preventDefault();
      userInteracted();
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        const isRightHalf = touch.clientX - rect.left > rect.width / 2;
        
        navigateToPage(pageIndex, isRightHalf);
      }
    }
    
    function navigateToPage(pageIndex, isRightHalf) {
      let targetPage = state.currentPage;
      
      if (isRightHalf && pageIndex === state.currentPage) {
        targetPage = Math.min(state.currentPage + 1, state.totalPages - 1);
      } else if (!isRightHalf && pageIndex === state.currentPage - 1) {
        targetPage = Math.max(state.currentPage - 1, 0);
      } else if (pageIndex !== state.currentPage) {
        targetPage = pageIndex;
      }
      
      if (targetPage !== state.currentPage) {
        state.currentPage = targetPage;
        resetAllPageCurls();
        updateBookState();
      }
    }
    
    function resetAllPageCurls() {
      pages.forEach(page => {
        resetPageCurl(page);
        page.classList.remove('cursor-left', 'cursor-right');
      });
    }
    
    function startAutoFlip() {
      if (state.isUserInteracted || state.totalPages <= 1) return;
      
      state.autoFlipInterval = setInterval(() => {
        if (state.isUserInteracted) {
          stopAutoFlip();
          return;
        }
        
        // Move to next page, or restart from beginning
        if (state.currentPage < state.totalPages - 1) {
          state.currentPage++;
        } else {
          state.currentPage = 0;
        }
        
        resetAllPageCurls();
        updateBookState();
      }, state.autoFlipDelay);
    }
    
    function stopAutoFlip() {
      if (state.autoFlipInterval) {
        clearInterval(state.autoFlipInterval);
        state.autoFlipInterval = null;
      }
    }
    
    function userInteracted() {
      if (!state.isUserInteracted) {
        state.isUserInteracted = true;
        stopAutoFlip();
      }
    }
    
    // Keyboard navigation - DO trigger userInteracted
    document.addEventListener('keydown', e => {
      if (!isBookInView()) return;
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        userInteracted(); // Keyboard navigation stops auto-flip
        if (state.currentPage > 0) {
          state.currentPage--;
          resetAllPageCurls();
          updateBookState();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        userInteracted(); // Keyboard navigation stops auto-flip
        if (state.currentPage < state.totalPages - 1) {
          state.currentPage++;
          resetAllPageCurls();
          updateBookState();
        }
      }
    });
    
    function isBookInView() {
      const rect = book.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    }
  }
  
  // Expose initialization function for dynamic content
  window.initializeBookFlip = function(book) {
    const container = book.closest('.book-flip-container');
    if (container) {
      initializeBook(container);
    }
  };
});