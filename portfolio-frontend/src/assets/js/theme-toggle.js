/**
 * Theme Toggle Functionality
 * Allows users to switch between light and dark themes
 */

class ThemeToggle {
  constructor() {
    this.init();
  }

  init() {
    // Check for saved theme preference or default to dark theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    this.setTheme(savedTheme);
    
    // Create the toggle button
    this.createToggleButton();
    
    // Add event listeners
    this.addEventListeners();
  }

  createToggleButton() {
    // Create the toggle button element
    const toggleButton = document.createElement('button');
    toggleButton.className = 'theme-toggle';
    toggleButton.setAttribute('aria-label', 'Toggle theme');
    toggleButton.setAttribute('title', 'Toggle between light and dark theme');
    
    // Add icon (we'll use Font Awesome icons)
    const icon = document.createElement('i');
    icon.className = this.getCurrentTheme() === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    toggleButton.appendChild(icon);
    
    // Add to document
    document.body.appendChild(toggleButton);
    
    this.toggleButton = toggleButton;
    this.icon = icon;
  }

  addEventListeners() {
    this.toggleButton.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Optional: Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem('theme')) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  getCurrentTheme() {
    return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
  }

  setTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    
    // Update icon if button exists
    if (this.icon) {
      this.icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    // Save preference
    localStorage.setItem('theme', theme);
    
    // Update button title
    if (this.toggleButton) {
      this.toggleButton.setAttribute('title', 
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      );
    }
  }

  toggleTheme() {
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Add switching animation class
    this.toggleButton.classList.add('switching');
    
    // Set new theme after a brief delay for animation
    setTimeout(() => {
      this.setTheme(newTheme);
      this.toggleButton.classList.remove('switching');
    }, 150);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ThemeToggle();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ThemeToggle();
  });
} else {
  new ThemeToggle();
} 