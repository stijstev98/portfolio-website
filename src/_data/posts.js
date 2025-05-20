const fetch = require('node-fetch');
const slugify = require('slugify');
const renderRichText = require('./utils/renderRichText');

module.exports = async function() {
  console.log("Fetching posts from Strapi...");
  try {
    // Try both localhost and 127.0.0.1
    let response;
    try {
      response = await fetch('http://localhost:1337/api/posts?populate[0]=post_header_image&populate[1]=post_preview_image&populate[2]=post_images', { 
        timeout: 5000 
      });
    } catch (e) {
      console.log("Trying alternate connection method to Strapi...");
      response = await fetch('http://127.0.0.1:1337/api/posts?populate[0]=post_header_image&populate[1]=post_preview_image&populate[2]=post_images', { 
        timeout: 5000 
      });
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Log the raw data from Strapi for inspection
    // console.log("Raw data structure:", JSON.stringify(data.data[0], null, 2));

    if (!data.data || !Array.isArray(data.data)) {
      console.error("Strapi response data.data is not an array or is missing:", data.data);
      return [];
    }
    
    const posts = data.data.map((post, index) => {
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
      
      // Process the rich text body if it exists
      const processedBody = post.post_body ? renderRichText(post.post_body) : '';
      
      return {
        data: {
          title: post.post_title,
          description: post.post_description,
          date: post.publishedAt || post.createdAt || new Date(),
          body: processedBody,
          rawBody: post.post_body, // Keep the original for reference if needed
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
    }).filter(post => post !== null && post.data.title);

    console.log(`Fetched and processed ${posts.length} posts from Strapi with images.`);
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