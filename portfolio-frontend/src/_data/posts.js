const fetch = require('node-fetch');
const slugify = require('slugify');
const renderRichText = require('./utils/renderRichText');
const { convertPdfToImages } = require("./utils/pdfProcessor");
const { transformToLocalUrl, transformMediaObject, transformMediaArray } = require('./utils/urlTransform');
const path = require('path');

// Use consistent base URL for Strapi
const STRAPI_BASE_URL = process.env.STRAPI_URL || 'https://admin.stijnstevens.be';

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
    // First, fetch all posts with basic population to get the list
    const basicApiUrl = `${STRAPI_BASE_URL}/api/posts?populate=*&pagination[limit]=100`;
    
    console.log('Attempting to fetch from:', basicApiUrl);
    
    // Try to fetch from Strapi
    let response;
    try {
      response = await fetch(basicApiUrl, { 
        timeout: 10000 
      });
    } catch (e) {
      console.warn("⚠️  Connection failed to Strapi. Make sure Strapi is running on port 1337.");
      console.warn("Building with fallback content...");
      // Return fallback data immediately instead of throwing
      return [
        {
          slug: 'strapi-unavailable',
          data: {
            title: 'Strapi CMS Unavailable',
            description: 'The content management system is currently unavailable. Please check that Strapi is running.',
            date: new Date().toISOString(),
            richContent: [],
            hasRichContent: false,
            headerImage: null,
            previewImage: null
          }
        }
      ];
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      console.error(`URL attempted: ${response.url}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      console.error("Strapi response data.data is not an array or is missing:", data.data);
      return [];
    }
    
    console.log(`Found ${data.data.length} posts, checking for posts with rich content...`);
    
    // For posts that have rich_content, fetch them individually with deep population
    const postsData = await Promise.all(data.data.map(async (post, index) => {
      if (!post) {
        console.warn(`Skipping invalid post object at index ${index}:`, post);
        return null;
      }

      // Ensure post_title exists for slug generation, otherwise use a fallback
      const titleForSlug = post.post_title || `post-${post.id || index}`;
      const slug = slugify(`${titleForSlug}-${post.id || index}`, { lower: true, strict: true });
      
      // Helper function to construct image URL using local transformation
      const constructImageUrl = (imageUrl) => {
        if (!imageUrl) return null;
        // Use the transformToLocalUrl utility to convert Strapi URLs to local paths
        return transformToLocalUrl(imageUrl);
      };
      
      let fullPost = post;
      
      // If this post has rich_content, fetch it individually with deep population
      if (post.rich_content && Array.isArray(post.rich_content) && post.rich_content.length > 0) {
        console.log(`Fetching detailed content for post "${post.post_title}" with ${post.rich_content.length} components...`);
        
        try {
          const deepApiUrl = `${STRAPI_BASE_URL}/api/posts/${post.documentId}?populate[rich_content][populate]=*`;
          const deepResponse = await fetch(deepApiUrl, { timeout: 10000 });
          
          if (deepResponse.ok) {
            const deepData = await deepResponse.json();
            // Merge the deeply populated rich_content with the original post data
            fullPost = {
              ...post,
              rich_content: deepData.data.rich_content
            };
            console.log(`Successfully fetched deep rich_content for "${post.post_title}"`);
          } else {
            console.warn(`Failed to fetch deep data for "${post.post_title}": ${deepResponse.status}`);
          }
        } catch (error) {
          console.warn(`Error fetching deep data for "${post.post_title}":`, error.message);
        }
      }
      
      // Get image URLs from the correct structure with better error handling
      const headerImageUrl = fullPost.post_header_image?.url 
        ? constructImageUrl(fullPost.post_header_image.url)
        : null;
      
      const previewImageUrl = fullPost.post_preview_image?.url
        ? constructImageUrl(fullPost.post_preview_image.url)
        : null; // Don't fall back to header image - keep them separate
      
      // For responsive images, optionally get medium and small formats
      const headerImageMedium = fullPost.post_header_image?.formats?.medium?.url
        ? constructImageUrl(fullPost.post_header_image.formats.medium.url)
        : null;
      
      const previewImageMedium = fullPost.post_preview_image?.formats?.medium?.url
        ? constructImageUrl(fullPost.post_preview_image.formats.medium.url)
        : null;
      
      // Extract image dimensions and mime types for video support
      const headerImageWidth = fullPost.post_header_image?.width || 0;
      const headerImageHeight = fullPost.post_header_image?.height || 0;
      const headerImageMime = fullPost.post_header_image?.mime || null;
      const headerImageCaption = fullPost.post_header_image?.caption || null;
      
      const previewImageWidth = fullPost.post_preview_image?.width || 0;
      const previewImageHeight = fullPost.post_preview_image?.height || 0;
      const previewImageMime = fullPost.post_preview_image?.mime || null;
      const previewImageCaption = fullPost.post_preview_image?.caption || null;
      
      // Build gallery from post_images (handle both array and nested data)
      const gallerySource = Array.isArray(fullPost.post_images)
        ? fullPost.post_images
        : fullPost.post_images?.data || [];
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
          mime: img.attributes?.mime || img.mime || null,
          caption: img.attributes?.caption || img.caption || null
        };
      }).filter(img => img.url); // Filter out any images without URLs
      
      // Process rich_content dynamic zone if it exists
      let richContentComponents = [];
      if (fullPost.rich_content && Array.isArray(fullPost.rich_content) && fullPost.rich_content.length > 0) {
        console.log(`Processing ${fullPost.rich_content.length} rich_content components for post "${fullPost.post_title}"`);
        
        richContentComponents = await Promise.all(fullPost.rich_content.map(async (component, index) => {
          console.log(`Component ${index}:`, component.__component, component.id);
          
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
            case 'book-flip':
              // Process book-flip component and return standardized data for template
              let pages = [];
              let aspectRatio = null;
              if (component.pdf_file?.url) {
                try {
                  const pdfUrl = new URL(component.pdf_file.url, STRAPI_BASE_URL).href;
                  console.log(`Processing PDF for book-flip from URL: ${pdfUrl}`);
                  pages = await convertPdfToImages(pdfUrl, component.pdf_file.updatedAt);
                  if (pages.length > 0) {
                    // Optionally calculate aspect ratio from first image if needed
                    // aspectRatio = width/height from metadata if available
                  }
                } catch (error) {
                  console.error(`Error processing PDF for book-flip:`, error);
                }
              }
              
              return {
                type: 'book-flip',
                pages: pages,
                aspectRatio: aspectRatio,
                title: component.title || 'Book Flip',
                responsiveDisplay: component.responsive_display,
                error: pages.length === 0 ? 'No pages processed' : null
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
              // Process simple media files (limit to 3, should be populated with the deep populate strategy)
              const mediaFiles = component.media_files || [];
              
              if (!mediaFiles || mediaFiles.length === 0) {
                console.warn(`No media files found for simple-media component ${component.id}`);
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
              console.warn(`Unknown component type: ${component.__component}`);
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
          title: fullPost.post_title,
          description: fullPost.post_description,
          date: fullPost.publishedAt || fullPost.createdAt || new Date(),
          richContent: richContentComponents,
          hasRichContent: richContentComponents.length > 0,
          headerImage: headerImageUrl,
          headerImageMedium: headerImageMedium,
          headerImageWidth: headerImageWidth,
          headerImageHeight: headerImageHeight,
          headerImageMime: headerImageMime,
          headerImageCaption: headerImageCaption,
          previewImage: previewImageUrl,
          previewImageMedium: previewImageMedium,
          previewImageWidth: previewImageWidth,
          previewImageHeight: previewImageHeight,
          previewImageMime: previewImageMime,
          previewImageCaption: previewImageCaption,
          images: galleryImages
        },
        url: `/posts/${slug}/`,
        slug: slug,
        id: fullPost.id
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
        slug: 'temporary-post',
        data: {
          title: 'Temporary Post',
          description: 'This is a temporary post shown while waiting for Strapi to connect',
          date: new Date().toISOString(),
          richContent: [],
          hasRichContent: false,
          headerImage: null,
          previewImage: null
        }
      }
    ];
  }
};
