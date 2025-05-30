# Rich Content Masonry Gallery Component

## Overview

The Rich Content Masonry Gallery component is a new Strapi shared component that creates a masonry-style grid layout for images and videos within rich content. It combines the best features of the existing masonry gallery and scrolling gallery components.

## Features

- **Masonry Grid Layout**: Automatically tiles media based on aspect ratios
- **Size Options**: Small (inline), Medium (+5vw), Large (full width)
- **Interactive Hover**: Shows alt text and captions when hovering (if available)
- **Dark Overlay**: Dims other panels when hovering over one
- **Lightbox View**: Click any panel to view in full-screen lightbox with title and caption
- **Video Support**: Supports both images and videos with auto-play in grid
- **Responsive**: Adapts to different screen sizes
- **Reusable Lightbox**: Uses shared lightbox component for consistency

## Strapi Component Structure

### Component Name
`shared.masonry-gallery`

### Fields
- **masonry_images** (Media, Multiple, Required)
  - Type: Media (multiple)
  - Allowed types: Images, Videos, Files, Audios
  - Required: No (can be empty)
  
- **size** (Enumeration, Required)
  - Type: Enumeration
  - Options: 'small', 'medium', 'large'
  - Default: 'large'
  - Required: Yes

## Size Behavior

### Small
- Renders inline with the rest of the text content
- Stays within normal content width
- Good for supplementary media that doesn't need to dominate

### Medium  
- Extends 5vw beyond normal inline content on each side
- Creates visual emphasis while maintaining readability
- Responsive: becomes small size on mobile devices

### Large
- Takes up full 100vw width like existing masonry gallery
- Maximum visual impact
- Best for showcasing primary media content

## Usage in Strapi

1. **Add to Dynamic Zone**:
   - The component is included in the `rich_content` dynamic zone in the Post content type
   
2. **Create Content**:
   - In Strapi admin, when editing a post, add a "Masonry Gallery" component to the rich_content field
   - Upload multiple images/videos to the `masonry_images` field
   - Select desired size: small, medium, or large
   - Add alt text and captions to your media files for hover infobox display

## Technical Implementation

### Files Created/Modified

1. **Strapi Components**:
   - `strapi-cms/src/components/shared/masonry-gallery.json` (updated with size field)
   - `strapi-cms/src/api/post/content-types/post/schema.json` (added to rich_content)
   - `strapi-cms/types/generated/components.d.ts` (updated interface)

2. **Frontend Components**:
   - `src/_includes/components/masonry-gallery-rich.ejs` (new component)
   - `src/_includes/components/lightbox.ejs` (new reusable lightbox)
   - `src/_includes/components/scrolling-gallery.ejs` (updated to use new lightbox)

3. **Data Processing**:
   - `src/_data/posts.js` (added masonry gallery processing)
   - `src/post-pages.ejs` (added rendering case)

4. **Styling**:
   - `src/assets/styles/rich-content.css` (added masonry gallery sizing)
   - Component includes embedded styles for layout and responsive behavior

### Grid System

The component uses CSS Grid with:
- 4 columns on desktop (large screens)
- 3 columns on tablet (medium screens) 
- 2 columns on mobile (small screens)

Aspect ratio detection automatically assigns:
- **default-aspect**: 1 row span (square-ish images)
- **wide-aspect**: 2 column span (wide images/videos)
- **tall-aspect**: 2 row span (tall images)
- **Combined**: wide and tall items can span 2x2 grid cells

### Interaction Features

1. **Hover Effects**:
   - Shows expand icon overlay
   - Displays infobox with alt text (title) and caption (description)
   - Dims other gallery items
   - Slight scale and shadow animation

2. **Lightbox**:
   - Click opens full-screen lightbox
   - Shows title (alt text) and caption
   - Video controls for video content
   - ESC key or click overlay to close
   - Prevents body scroll when open

3. **Accessibility**:
   - Proper alt text on images
   - Keyboard navigation support (ESC to close)
   - Focus management in lightbox

## Responsive Behavior

- **Desktop (>992px)**: 4-column grid, all size variants work as designed
- **Tablet (768-992px)**: 3-column grid, medium size reduces expansion
- **Mobile (<768px)**: 2-column grid, medium becomes small, wide items don't span
- **Small Mobile (<576px)**: 2-column grid, tall items don't span vertically

## Integration with Existing Components

The new component:
- Shares the reusable lightbox with scrolling gallery
- Uses the same hover infobox component pattern
- Follows the same CSS variable and styling conventions
- Integrates seamlessly with the rich content rendering system

## Performance Considerations

- Images use lazy loading (`loading="lazy"`)
- Videos use `preload="metadata"` for faster initial load
- Hover effects use CSS transforms for hardware acceleration
- Grid layout is efficient and responsive without JavaScript
- Lightbox videos are paused and reset when closed to save resources 