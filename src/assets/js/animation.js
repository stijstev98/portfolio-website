/**
 * Scroll Animation Handler
 * Detects when elements with data-scroll-animation attribute enter the viewport
 * and applies the 'visible' class to trigger animations
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check if IntersectionObserver is supported
  if (!('IntersectionObserver' in window)) {
    // If not supported, make all elements visible
    document.querySelectorAll('[data-scroll-animation]').forEach(el => {
      el.classList.add('visible');
    });
    return;
  }
  
  // Intersection Observer for scroll animations
  const scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Add 'visible' class when element enters viewport
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          scrollObserver.unobserve(entry.target); // Stop observing once animated
        }
      });
    },
    { 
      root: null, // viewport
      threshold: 0.15, // Trigger when 15% of the element is visible
      rootMargin: '0px 0px -50px 0px' // Slightly offset when the animation triggers
    }
  );
  
  // Target all elements with data-scroll-animation attribute
  document.querySelectorAll('[data-scroll-animation]').forEach((element) => {
    // Make sure element becomes visible when scrolled into view
    scrollObserver.observe(element);
    
    // Add a fallback in case the observer doesn't trigger
    setTimeout(() => {
      if (!element.classList.contains('visible')) {
        element.classList.add('visible');
      }
    }, 2000); // 2 second fallback
  });
  
  // Debug message to confirm script is running
  console.log('Scroll animations initialized');
});
