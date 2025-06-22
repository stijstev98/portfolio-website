/**
 * Navigation configuration
 * - text: Display text for the navigation item
 * - url: URL path for the navigation item
 * - emphasis: If true, will be styled as a button with emphasis
 * - scrollTarget: ID of element to scroll to (on homepage only)
 */
module.exports = {
  main: [
    {
      text: "Works",
      url: "/works",
      emphasis: false,
      scrollTarget: "masonry-gallery"
    },
    {
      text: "Photography",
      url: "https://www.instagram.com/stanalog_/",
      emphasis: false,
      scrollTarget: null
    },
    {
      text: "Let's Talk",
      url: "/lets-talk",
      emphasis: true,
      scrollTarget: "site-footer"
    }
  ]
};
