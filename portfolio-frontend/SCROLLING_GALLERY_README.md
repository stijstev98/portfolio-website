# Scrolling Gallery Component

## Overview

The Scrolling Gallery component is a new Strapi shared component that creates a horizontally scrolling gallery of images and videos. The gallery scrolls automatically from right to left and supports interactive features like hover effects and lightbox viewing.

## Features

- **Auto-scrolling**: Gallery scrolls continuously from right to left
- **Seamless looping**: Content repeats seamlessly for infinite scrolling
- **Pause on hover**: Scrolling pauses when user hovers over any panel
- **Interactive infobox**: Shows image captions when hovering (if captions exist)
- **Lightbox view**: Click any panel to view in full-screen lightbox
- **Video support**: Supports both images and videos
- **Responsive**: Adapts to different screen sizes
- **Full-width**: Takes up entire screen width

## Strapi Component Structure

### Component Name
`shared.scrolling-gallery`

### Fields
- **gallery_content** (Media, Multiple, Required)
  - Type: Media (multiple)
  - Allowed types: Images, Videos
  - Required: Yes
  
- **gallery_height** (String, Optional)
  - Type: String
  - Default: "300px"
  - Purpose: Set the height of the gallery

## Usage in Strapi

1. **Add the component to your content type**:
   - The component is already added to the `rich_content` dynamic zone in the Post content type
   
2. **Create content**:
   - In Strapi admin, when editing a post, add a "Scrolling Gallery" component to the rich_content field
   - Upload multiple images/videos to the `gallery_content` field
   - Optionally set a custom `gallery_height` (defaults to 300px)
   - Add captions to your media files if you want them to show in the hover infobox

## Technical Implementation

### Files Created/Modified

1. **Strapi Component**:
   - `strapi-cms/src/components/shared/scrolling-gallery.json`
   - `strapi-cms/src/api/post/content-types/post/schema.json` (updated)
   - `strapi-cms/types/generated/components.d.ts` (updated)

2. **Frontend Components**:
   - `src/_includes/components/scrolling-gallery.ejs`
   - `src/assets/styles/scrolling-gallery.css`

3. **Data Processing**:
   - `src/_data/posts.js` (updated to handle the new component)
   - `src/post-pages.ejs` (updated to render the component)

4. **Build System**:
   - `src/assets/styles/main.css` (updated to include the CSS)
   - `scripts/create-rich-content.js` (updated to create the component)

### How It Works

1. **Data Processing**: The `posts.js` file processes the Strapi component data and transforms media URLs
2. **Rendering**: The EJS template renders the gallery with duplicated content for seamless looping
3. **Animation**: CSS transforms and JavaScript requestAnimationFrame create smooth scrolling
4. **Interactions**: JavaScript handles hover events, lightbox functionality, and scroll pausing

### CSS Classes

- `.scrolling-gallery-container`: Main container (full-width)
- `.scrolling-gallery-track`: Scrolling track that moves
- `.scrolling-gallery-item`: Individual media panels
- `.scrolling-gallery-media`: Media wrapper within each panel
- `.has-hovered-item`: Applied to container when an item is hovered
- `.is-hovered`: Applied to the currently hovered item

## Demo

A demo page is available at `/scrolling-gallery-demo/` to test the component with placeholder images.

## Customization

### Gallery Height
Set custom height via the `gallery_height` field in Strapi:
```
200px    // Short gallery
400px    // Tall gallery
50vh     // Half viewport height
```

### Scroll Speed
Modify the scroll speed in the JavaScript (line with `scrollPosition += 0.5`):
```javascript
scrollPosition += 1.0;   // Faster
scrollPosition += 0.25;  // Slower
```

### Panel Spacing
Adjust panel gaps in CSS:
```css
.scrolling-gallery-item {
  margin-right: 12px; /* Increase gap */
}
```

## Browser Support

- Modern browsers with CSS Grid and Flexbox support
- JavaScript ES6+ features
- CSS transforms and animations
- requestAnimationFrame API

## Performance Considerations

- Images are lazy-loaded where possible
- Videos use `preload="metadata"` to minimize initial load
- CSS `will-change: transform` optimizes animations
- Gallery pauses when not in view (via hover detection)

## Troubleshooting

1. **Gallery not appearing**: Check that the CSS file is properly imported in `main.css`
2. **No hover effects**: Ensure the hover infobox component is included
3. **Lightbox not working**: Check for JavaScript errors in browser console
4. **Videos not playing**: Verify video files are properly uploaded to Strapi media library 