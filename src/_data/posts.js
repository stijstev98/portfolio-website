const fetch = require('node-fetch');
const slugify = require('slugify');
const renderRichText = require('./utils/renderRichText');
const { convertPdfToImages } = require('./utils/pdfProcessor');
const path = require('path');

module.exports = async function() {
  console.log("Fetching posts from Strapi...");
  try {
    // First try with basic populate to get all posts including Lexical fields
    const apiUrl = `http://localhost:1337/api/posts?populate=*&pagination[limit]=100`;
    const apiUrlAlt = `http://127.0.0.1:1337/api/posts?populate=*&pagination[limit]=100`;
    
    console.log('Attempting to fetch from:', apiUrl);
    
    // Try both localhost and 127.0.0.1
    let response;
    try {
      response = await fetch(apiUrl, { 
        timeout: 5000 
      });
    } catch (e) {
      console.log("Trying alternate connection method to Strapi...");
      response = await fetch(apiUrlAlt, { 
        timeout: 5000 
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      console.error(`URL attempted: ${response.url}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Now fetch posts with rich_content separately for those that have it
    const enhancedPosts = [];
    for (const post of data.data) {
      if (post.rich_content && post.rich_content.length > 0) {
        console.log(`Fetching detailed rich_content for post: ${post.post_title}`);
        try {
          const detailUrl = `http://127.0.0.1:1337/api/posts/${post.documentId}?populate[rich_content][populate]=*`;
          const detailResponse = await fetch(detailUrl, { timeout: 5000 });
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            enhancedPosts.push(detailData.data);
          } else {
            console.warn(`Failed to fetch detailed rich_content for post ${post.post_title}`);
            enhancedPosts.push(post);
          }
        } catch (error) {
          console.warn(`Error fetching detailed rich_content for post ${post.post_title}:`, error.message);
          enhancedPosts.push(post);
        }
      } else {
        enhancedPosts.push(post);
      }
    }
    
    // Replace the original data with enhanced data
    data.data = enhancedPosts;
    
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
      
      // Get image URLs from the correct structure
      const headerImageUrl = post.post_header_image?.url 
        ? `http://127.0.0.1:1337${post.post_header_image.url}`
        : null;
      
      const previewImageUrl = post.post_preview_image?.url
        ? `http://127.0.0.1:1337${post.post_preview_image.url}` 
        : headerImageUrl; // Fall back to header image if no preview image
      
      // For responsive images, optionally get medium and small formats
      const headerImageMedium = post.post_header_image?.formats?.medium?.url
        ? `http://127.0.0.1:1337${post.post_header_image.formats.medium.url}`
        : null;
      
      const previewImageMedium = post.post_preview_image?.formats?.medium?.url
        ? `http://127.0.0.1:1337${post.post_preview_image.formats.medium.url}`
        : null;
      
      // Extract header image dimensions
      const headerImageWidth = post.post_header_image?.width || 0;
      const headerImageHeight = post.post_header_image?.height || 0;
      
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
          url: src ? `http://127.0.0.1:1337${src}` : null,
          medium: mediumSrc ? `http://127.0.0.1:1337${mediumSrc}` : null,
          width: img.attributes?.width || img.width || 0,
          height: img.attributes?.height || img.height || 0
        };
      });
      
      // Process the rich text body if it exists (Lexical format)
      let processedBody = '';
      let mediaAssets = [];
      let linkAssets = {};
      
      if (post.post_body2) {
        // For Lexical content, we need to fetch associated media if they have suffixes
        // Check if post has post_body2Media field for media assets
        if (post.post_body2Media && Array.isArray(post.post_body2Media)) {
          mediaAssets = post.post_body2Media.map(media => ({
            documentId: media.documentId || media.id,
            url: media.url,
            name: media.name,
            alternativeText: media.alternativeText,
            width: media.width,
            height: media.height,
            caption: media.caption
          }));
        }
        
        // Check if post has post_body2Links field for internal links
        if (post.post_body2Links && Array.isArray(post.post_body2Links)) {
          linkAssets = post.post_body2Links;
        }
        
        processedBody = renderRichText(post.post_body2, {
          media: mediaAssets,
          links: linkAssets
        });
      } else if (post.post_body) {
        // Fallback to legacy rich text format
        processedBody = renderRichText(post.post_body);
      }
      
      // Process rich_content dynamic zone if it exists
      let richContentComponents = [];
      if (post.rich_content && Array.isArray(post.rich_content) && post.rich_content.length > 0) {
        console.log(`Processing ${post.rich_content.length} rich_content components for post "${post.post_title}"`);
        
        richContentComponents = await Promise.all(post.rich_content.map(async (component, index) => {
          console.log(`Component ${index}:`, component.__component, component);
          
          // Each component has a __component field indicating its type
          switch (component.__component) {
            case 'shared.rich-text':
              return {
                type: 'rich-text',
                content: component.body ? renderRichText(component.body) : '',
                rawContent: component.body
              };
            case 'shared.video-embed':
              return {
                type: 'video-embed',
                provider: component.provider,
                provider_uid: component.provider_uid,
                title: component.title,
                caption: component.caption
              };
            case 'shared.media':
              const mediaUrl = component.file?.url 
                ? `http://127.0.0.1:1337${component.file.url}`
                : null;
              return {
                type: 'media',
                media: mediaUrl ? {
                  url: mediaUrl,
                  name: component.file.name || '',
                  width: component.file.width || 0,
                  height: component.file.height || 0
                } : null,
                caption: component.caption
              };
            case 'shared.callout':
              return {
                type: 'callout',
                title: component.title,
                content: component.content ? renderRichText(component.content) : '',
                calloutType: component.type || 'info'
              };
            case 'shared.book-flip':
              // Handle PDF file
              if (component.pdf_file?.url) {
                const pdfUrl = `http://127.0.0.1:1337${component.pdf_file.url}`;
                
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
                    title: component.title || 'Book'
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
                error: 'No PDF file provided'
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
          body: processedBody,
          rawBody: post.post_body2 || post.post_body, // Prefer Lexical content, fallback to legacy
          lexicalContent: post.post_body2, // Store raw Lexical JSON for reference
          hasLexicalContent: !!post.post_body2, // Helper flag
          mediaAssets: mediaAssets, // Store processed media assets
          linkAssets: linkAssets, // Store link assets
          richContent: richContentComponents, // Rich_content dynamic zone data
          hasRichContent: richContentComponents.length > 0, // Helper flag
          headerImage: headerImageUrl,
          headerImageMedium: headerImageMedium,
          headerImageWidth: headerImageWidth,
          headerImageHeight: headerImageHeight,
          previewImage: previewImageUrl,
          previewImageMedium: previewImageMedium,
          // Store image dimensions if available
          previewImageWidth: post.post_preview_image?.width || 0,
          previewImageHeight: post.post_preview_image?.height || 0,
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
    const postsWithLexicalContent = posts.filter(post => post.data.hasLexicalContent);
    console.log(`Fetched and processed ${posts.length} posts from Strapi.`);
    console.log(`Found ${postsWithRichContent.length} posts with rich_content dynamic zone data.`);
    console.log(`Found ${postsWithLexicalContent.length} posts with Lexical content.`);
    
    if (postsWithRichContent.length > 0) {
      console.log('Posts with rich_content:');
      postsWithRichContent.forEach(post => {
        console.log(`- "${post.data.title}" has ${post.data.richContent.length} components`);
      });
    }
    
    if (postsWithLexicalContent.length > 0) {
      console.log('Posts with Lexical content:');
      postsWithLexicalContent.forEach(post => {
        console.log(`- "${post.data.title}" has Lexical content with ${post.data.mediaAssets.length} media assets`);
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