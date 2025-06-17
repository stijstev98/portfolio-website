const fetch = require('node-fetch');
const slugify = require('slugify');
const renderRichText = require('./utils/renderRichText');
const { convertPdfToImages } = require('./utils/pdfProcessor');
const path = require('path');

// Use consistent base URL for Strapi
const STRAPI_BASE_URL = 'http://127.0.0.1:1337';

/**
 * Extract media documentIds from Lexical content
 * @param {Object} lexicalContent - The Lexical JSON content
 * @returns {Array} Array of documentIds
 */
function extractMediaDocumentIds(lexicalContent) {
  const documentIds = [];
  
  function traverseNodes(nodes) {
    if (!Array.isArray(nodes)) return;
    
    for (const node of nodes) {
      if (node.type === 'strapi-image' && node.documentId) {
        documentIds.push(node.documentId);
      }
      
      // Recursively check children
      if (node.children) {
        traverseNodes(node.children);
      }
    }
  }
  
  if (lexicalContent && lexicalContent.root && lexicalContent.root.children) {
    traverseNodes(lexicalContent.root.children);
  }
  
  return [...new Set(documentIds)]; // Remove duplicates
}

module.exports = async function() {
  console.log("Fetching posts from Strapi...");
  try {
    // Updated populate strategy for Strapi 5.13.0 to handle dynamic zone media properly
    const populateParams = [
      'post_header_image',
      'post_preview_image', 
      'post_images',
      'rich_content',
      'rich_content.file', // For shared.media components
      'rich_content.pdf_file', // For shared.book-flip components
      'rich_content.gallery_content', // For shared.scrolling-gallery components
      'rich_content.masonry_images', // For shared.masonry-gallery components
      'rich_content.media_files' // For shared.simple-media components
    ];
    
    const apiUrl = `${STRAPI_BASE_URL}/api/posts?${populateParams.map((param, index) => `populate[${index}]=${param}`).join('&')}&pagination[limit]=100`;
    
    console.log('Attempting to fetch from:', apiUrl);
    
    // Try to fetch from Strapi
    let response;
    try {
      response = await fetch(apiUrl, { 
        timeout: 10000 
      });
    } catch (e) {
      console.log("Connection failed to Strapi. Make sure Strapi is running on port 1337.");
      throw e;
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      console.error(`URL attempted: ${response.url}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Log the raw data from Strapi for inspection
    console.log("Raw data structure:", JSON.stringify(data.data[0], null, 2));

    if (!data.data || !Array.isArray(data.data)) {
      console.error("Strapi response data.data is not an array or is missing:", data.data);
      return [];
    }
    
    const postsData = await Promise.all(data.data.map(async (post, index) => {
      if (!post) {
        console.warn(`Skipping invalid post object at index ${index}:`, post);
        return null;
      }

      // Ensure post_title exists for slug generation, otherwise use a fallback
      const titleForSlug = post.post_title || `post-${post.id || index}`;
      const slug = slugify(titleForSlug, { lower: true, strict: true });
      
      // Helper function to construct image URL
      const constructImageUrl = (imageUrl) => {
        if (!imageUrl) return null;
        return imageUrl.startsWith('http') ? imageUrl : `${STRAPI_BASE_URL}${imageUrl}`;
      };
      
      // Get image URLs from the correct structure with better error handling
      const headerImageUrl = post.post_header_image?.url 
        ? constructImageUrl(post.post_header_image.url)
        : null;
      
      const previewImageUrl = post.post_preview_image?.url
        ? constructImageUrl(post.post_preview_image.url)
        : null; // Don't fall back to header image - keep them separate
      
      // For responsive images, optionally get medium and small formats
      const headerImageMedium = post.post_header_image?.formats?.medium?.url
        ? constructImageUrl(post.post_header_image.formats.medium.url)
        : null;
      
      const previewImageMedium = post.post_preview_image?.formats?.medium?.url
        ? constructImageUrl(post.post_preview_image.formats.medium.url)
        : null;
      
      // Extract image dimensions and mime types for video support
      const headerImageWidth = post.post_header_image?.width || 0;
      const headerImageHeight = post.post_header_image?.height || 0;
      const headerImageMime = post.post_header_image?.mime || null;
      
      const previewImageWidth = post.post_preview_image?.width || 0;
      const previewImageHeight = post.post_preview_image?.height || 0;
      const previewImageMime = post.post_preview_image?.mime || null;
      
      // Build gallery from post_images (handle both array and nested data)
      const gallerySource = Array.isArray(post.post_images)
        ? post.post_images
        : post.post_images?.data || [];
      const galleryImages = gallerySource.map(img => {
        // Strapi v4 images may be under attributes or direct
        const src = img.attributes?.url || img.url || '';
        const mediumSrc = img.attributes?.formats?.medium?.url
          || img.formats?.medium?.url
          || null;
        return {
          url: src ? constructImageUrl(src) : null,
          medium: mediumSrc ? constructImageUrl(mediumSrc) : null,
          width: img.attributes?.width || img.width || 0,
          height: img.attributes?.height || img.height || 0,
          mime: img.attributes?.mime || img.mime || null
        };
      }).filter(img => img.url); // Filter out any images without URLs
      
      // Process rich_content dynamic zone if it exists
      let richContentComponents = [];
      if (post.rich_content && Array.isArray(post.rich_content) && post.rich_content.length > 0) {
        console.log(`Processing ${post.rich_content.length} rich_content components for post "${post.post_title}"`);
        
        richContentComponents = await Promise.all(post.rich_content.map(async (component, index) => {
          console.log(`Component ${index}:`, component.__component, component);
          
          // Each component has a __component field indicating its type
          switch (component.__component) {
            case 'shared.rich-text':
              // Handle Lexical content with media asset processing
              let richTextContent = '';
              let componentMediaAssets = [];
              
              if (component.body) {
                // Extract media documentIds from this component's Lexical content
                const mediaDocumentIds = extractMediaDocumentIds(component.body);
                
                if (mediaDocumentIds.length > 0) {
                  console.log(`Found ${mediaDocumentIds.length} media references in rich-text component:`, mediaDocumentIds);
                  
                  try {
                    // Fetch media assets for these documentIds
                    const mediaApiUrl = `${STRAPI_BASE_URL}/api/upload/files?filters[documentId][$in]=${mediaDocumentIds.join(',')}`;
                    const mediaResponse = await fetch(mediaApiUrl, { timeout: 5000 });
                    
                    if (mediaResponse.ok) {
                      const mediaData = await mediaResponse.json();
                      componentMediaAssets = mediaData.map(media => ({
                        documentId: media.documentId,
                        url: media.url,
                        name: media.name,
                        alternativeText: media.alternativeText,
                        width: media.width,
                        height: media.height,
                        caption: media.caption
                      }));
                      console.log(`Successfully fetched ${componentMediaAssets.length} media assets for rich-text component`);
                    } else {
                      console.warn(`Failed to fetch media assets for rich-text component: ${mediaResponse.status}`);
                    }
                  } catch (error) {
                    console.warn(`Error fetching media assets for rich-text component:`, error.message);
                  }
                }
                
                // Render the Lexical content with media assets
                richTextContent = renderRichText(component.body, {
                  media: componentMediaAssets,
                  links: {} // Add link processing if needed later
                });
              }
              
              return {
                type: 'rich-text',
                content: richTextContent,
                rawContent: component.body,
                mediaAssets: componentMediaAssets,
                responsiveDisplay: component.responsive_display || 'default'
              };
            case 'shared.video-embed':
              return {
                type: 'video-embed',
                provider: component.provider,
                provider_uid: component.provider_uid,
                title: component.title,
                caption: component.caption,
                responsiveDisplay: component.responsive_display || 'default'
              };
            case 'shared.media':
              const mediaUrl = component.file?.url 
                ? constructImageUrl(component.file.url)
                : null;
              return {
                type: 'media',
                media: mediaUrl ? {
                  url: mediaUrl,
                  name: component.file.name || '',
                  width: component.file.width || 0,
                  height: component.file.height || 0
                } : null,
                caption: component.caption,
                responsiveDisplay: component.responsive_display || 'default'
              };
            case 'shared.scrolling-gallery':
              // Process gallery content media
              let galleryContent = component.gallery_content || [];
              
              console.log(`Debug: scrolling-gallery component data:`, JSON.stringify(component, null, 2));
              
              // If gallery_content is not populated or empty, fetch it separately
              if ((!galleryContent || galleryContent.length === 0) && component.id) {
                console.log(`Gallery content is empty or missing, attempting to fetch separately for component ${component.id}`);
                try {
                  const componentApiUrl = `${STRAPI_BASE_URL}/api/posts/${post.documentId}?populate[rich_content][populate]=*`;
                  const componentResponse = await fetch(componentApiUrl, { timeout: 5000 });
                  
                  if (componentResponse.ok) {
                    const componentData = await componentResponse.json();
                    const populatedComponent = componentData.data.rich_content?.find(
                      (c) => c.__component === 'shared.scrolling-gallery' && c.id === component.id
                    );
                    
                    console.log(`Found populated component:`, JSON.stringify(populatedComponent, null, 2));
                    
                    if (populatedComponent?.gallery_content) {
                      galleryContent = populatedComponent.gallery_content;
                      console.log(`Successfully fetched ${galleryContent.length} gallery items`);
                    }
                  }
                } catch (error) {
                  console.warn('Failed to fetch scrolling-gallery component details:', error.message);
                }
              }
              
              const processedGalleryContent = galleryContent.map(media => ({
                id: media.id,
                url: constructImageUrl(media.url),
                name: media.name || '',
                alternativeText: media.alternativeText || '',
                caption: media.caption || '',
                mime: media.mime || '',
                width: media.width || 0,
                height: media.height || 0
              }));
              
              console.log(`Processed ${processedGalleryContent.length} gallery items for scrolling gallery component`);
              
              return {
                type: 'scrolling-gallery',
                gallery_content: processedGalleryContent,
                gallery_height: component.gallery_height || '300px',
                responsiveDisplay: component.responsive_display || 'default'
              };
            case 'shared.book-flip':
              // If pdf_file is not populated, fetch it separately
              if (!component.pdf_file && component.id) {
                try {
                  const componentApiUrl = `${STRAPI_BASE_URL}/api/posts/${post.documentId}?populate[rich_content][populate]=*`;
                  const componentResponse = await fetch(componentApiUrl, { timeout: 5000 });
                  
                  if (componentResponse.ok) {
                    const componentData = await componentResponse.json();
                    const populatedComponent = componentData.data.rich_content?.find(
                      (c) => c.__component === 'shared.book-flip' && c.id === component.id
                    );
                    
                    if (populatedComponent?.pdf_file) {
                      component = populatedComponent; // Replace with populated component
                    }
                  }
                } catch (error) {
                  console.warn('Failed to fetch book-flip component details:', error.message);
                }
              }
              
              // Handle PDF file
              if (component.pdf_file?.url) {
                const pdfUrl = constructImageUrl(component.pdf_file.url);
                
                // Extract file metadata including update date
                const fileMetadata = {
                  updatedAt: component.pdf_file.updatedAt || component.pdf_file.updated_at || null,
                  name: component.pdf_file.name || null,
                  size: component.pdf_file.size || null
                };
                
                try {
                  const pdfData = await convertPdfToImages(pdfUrl, fileMetadata);
                  
                  // Create page data for the book component
                  const bookPages = pdfData.pages.map((page, idx) => ({
                    url: `/pdf-cache/${path.basename(path.dirname(page.path))}/${page.filename}`,
                    pageNumber: page.pageNumber,
                    width: page.width,
                    height: page.height,
                    name: `Page ${page.pageNumber}`,
                    alt: `Page ${page.pageNumber}`
                  }));
                  
                  return {
                    type: 'shared.book-flip',
                    pages: bookPages,
                    totalPages: bookPages.length,
                    aspectRatio: pdfData.aspectRatio,
                    title: component.title || 'Book',
                    responsiveDisplay: component.responsive_display || 'default'
                  };
                } catch (error) {
                  console.error('Error processing PDF for book-flip:', error);
                  return {
                    type: 'shared.book-flip',
                    error: error.message,
                    pages: [],
                    totalPages: 0
                  };
                }
              }
              
              return {
                type: 'shared.book-flip',
                pages: [],
                totalPages: 0,
                error: 'No PDF file provided',
                responsiveDisplay: component.responsive_display || 'default'
              };
            case 'shared.masonry-gallery':
              // Process masonry gallery media
              let masonryImages = component.masonry_images || [];
              
              console.log(`Debug: masonry-gallery component data:`, JSON.stringify(component, null, 2));
              
              // If masonry_images is not populated or empty, fetch it separately
              if ((!masonryImages || masonryImages.length === 0) && component.id) {
                console.log(`Masonry images is empty or missing, attempting to fetch separately for component ${component.id}`);
                try {
                  const componentApiUrl = `${STRAPI_BASE_URL}/api/posts/${post.documentId}?populate[rich_content][populate]=*`;
                  const componentResponse = await fetch(componentApiUrl, { timeout: 5000 });
                  
                  if (componentResponse.ok) {
                    const componentData = await componentResponse.json();
                    const populatedComponent = componentData.data.rich_content?.find(
                      (c) => c.__component === 'shared.masonry-gallery' && c.id === component.id
                    );
                    
                    console.log(`Found populated component:`, JSON.stringify(populatedComponent, null, 2));
                    
                    if (populatedComponent?.masonry_images) {
                      masonryImages = populatedComponent.masonry_images;
                      console.log(`Successfully fetched ${masonryImages.length} masonry items`);
                    }
                  }
                } catch (error) {
                  console.warn('Failed to fetch masonry-gallery component details:', error.message);
                }
              }
              
              const processedMasonryImages = masonryImages.map(media => ({
                id: media.id,
                url: constructImageUrl(media.url),
                name: media.name || '',
                alternativeText: media.alternativeText || '',
                caption: media.caption || '',
                mime: media.mime || '',
                width: media.width || 0,
                height: media.height || 0
              }));
              
              console.log(`Processed ${processedMasonryImages.length} media items for masonry gallery component`);
              
              return {
                type: 'masonry-gallery',
                masonry_images: processedMasonryImages,
                size: component.size || 'large',
                responsiveDisplay: component.responsive_display || 'default'
              };
            case 'shared.simple-media':
              // Process simple media files (limit to 3)
              let mediaFiles = component.media_files || [];
              
              console.log(`Debug: simple-media component data:`, JSON.stringify(component, null, 2));
              
              // If media_files is not populated or empty, fetch it separately
              if ((!mediaFiles || mediaFiles.length === 0) && component.id) {
                console.log(`Media files is empty or missing, attempting to fetch separately for component ${component.id}`);
                try {
                  const componentApiUrl = `${STRAPI_BASE_URL}/api/posts/${post.documentId}?populate[rich_content][populate]=*`;
                  const componentResponse = await fetch(componentApiUrl, { timeout: 5000 });
                  
                  if (componentResponse.ok) {
                    const componentData = await componentResponse.json();
                    const populatedComponent = componentData.data.rich_content?.find(
                      (c) => c.__component === 'shared.simple-media' && c.id === component.id
                    );
                    
                    console.log(`Found populated component:`, JSON.stringify(populatedComponent, null, 2));
                    
                    if (populatedComponent?.media_files) {
                      mediaFiles = populatedComponent.media_files;
                      console.log(`Successfully fetched ${mediaFiles.length} media files`);
                    }
                  }
                } catch (error) {
                  console.warn('Failed to fetch simple-media component details:', error.message);
                }
              }
              
              // Limit to 3 media files and process them
              const limitedMediaFiles = mediaFiles.slice(0, 3);
              const processedMediaFiles = limitedMediaFiles.map(media => ({
                id: media.id,
                url: constructImageUrl(media.url),
                name: media.name || '',
                alternativeText: media.alternativeText || '',
                caption: media.caption || '',
                mime: media.mime || '',
                width: media.width || 0,
                height: media.height || 0
              }));
              
              console.log(`Processed ${processedMediaFiles.length} media files for simple media component`);
              
              return {
                type: 'simple-media',
                media_files: processedMediaFiles,
                size: component.size || 'medium',
                show_caption: component.show_caption || false,
                show_infobox: component.show_infobox || false,
                responsiveDisplay: component.responsive_display || 'default'
              };
            default:
              return {
                type: 'unknown',
                component: component.__component,
                data: component
              };
          }
        }));
      }
      
      return {
        data: {
          title: post.post_title,
          description: post.post_description,
          date: post.publishedAt || post.createdAt || new Date(),
          richContent: richContentComponents,
          hasRichContent: richContentComponents.length > 0,
          headerImage: headerImageUrl,
          headerImageMedium: headerImageMedium,
          headerImageWidth: headerImageWidth,
          headerImageHeight: headerImageHeight,
          headerImageMime: headerImageMime,
          previewImage: previewImageUrl,
          previewImageMedium: previewImageMedium,
          previewImageWidth: previewImageWidth,
          previewImageHeight: previewImageHeight,
          previewImageMime: previewImageMime,
          images: galleryImages
        },
        url: `/posts/${slug}/`,
        slug: slug,
        id: post.id
      };
    }));
    
    // Apply the filter to the resolved promises result
    const posts = postsData.filter(post => post !== null && post.data.title);

    const postsWithRichContent = posts.filter(post => post.data.hasRichContent);
    console.log(`Fetched and processed ${posts.length} posts from Strapi.`);
    console.log(`Found ${postsWithRichContent.length} posts with rich_content dynamic zone data.`);
    
    if (postsWithRichContent.length > 0) {
      console.log('Posts with rich_content:');
      postsWithRichContent.forEach(post => {
        console.log(`- "${post.data.title}" has ${post.data.richContent.length} components`);
      });
    }
    
    return posts;
  } catch (error) {
    console.error("Error fetching posts from Strapi:", error);
    // Provide fallback data so the site can still build
    return [
      {
        id: 'fallback-1',
        slug: 'temporary-post',
        title: 'Temporary Post',
        description: 'This is a temporary post shown while waiting for Strapi to connect',
        date: new Date().toISOString(),
        content: 'The Strapi CMS connection is currently unavailable. Please make sure Strapi is running properly.',
        headerImageUrl: null,
        previewImageUrl: null
      }
    ];
  }
};