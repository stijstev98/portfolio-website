require('dotenv').config();
const fetch = require('node-fetch');
const FormData = require('form-data');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

const WEBSITE_URL = 'https://stijnstevens.be';
const API_URL = 'http://127.0.0.1:1337/api/posts';
const UPLOAD_URL = 'http://127.0.0.1:1337/api/upload';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '';

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = args.find(arg => arg.startsWith('--limit='))?.split('=')[1] 
  ? parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1], 10) 
  : null;
const SPECIFIC_PROJECT = args.find(arg => arg.startsWith('--project='))?.split('=')[1] || null;

// Display startup information
if (DRY_RUN) {
  console.log('DRY RUN MODE: No actual uploads or Strapi posts will be created');
}

if (LIMIT) {
  console.log(`LIMIT MODE: Only processing ${LIMIT} project(s)`);
}

if (SPECIFIC_PROJECT) {
  console.log(`PROJECT MODE: Only processing project with path "${SPECIFIC_PROJECT}"`);
}

// Function to download an image and save it temporarily
async function downloadImage(imageUrl) {
  try {
    console.log(`Downloading image: ${imageUrl}`);
    
    // In dry run mode, don't actually download
    if (DRY_RUN) {
      console.log('DRY RUN: Skipping image download');
      return {
        buffer: Buffer.from('fake-image-data'),
        contentType: 'image/jpeg'
      };
    }
    
    // Process Optimole URLs to get original images if possible
    if (imageUrl.includes('optimole.com')) {
      imageUrl = extractOriginalImageUrl(imageUrl);
      console.log(`Using original image URL: ${imageUrl}`);
    }
    
    // Add a timeout to the fetch request to avoid hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(imageUrl, { 
      signal: controller.signal,
      headers: {
        // Add user-agent to avoid being blocked by some servers
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    
    // Check if the response is actually an image
    if (!contentType || !contentType.includes('image/')) {
      throw new Error(`Not an image: Content-Type is ${contentType}`);
    }
    
    const buf = await response.buffer();
    
    // Verify we have actual image data
    if (!buf || buf.length < 100) {
      throw new Error('Downloaded file is too small to be a valid image');
    }
    
    return {
      buffer: buf,
      contentType
    };
  } catch (error) {
    console.error(`Error downloading image: ${error.message}`);
    return null;
  }
}

// Function to upload an image to Strapi
async function uploadImageToStrapi(imageBuffer, contentType, filename) {
  try {
    console.log(`Uploading image: ${filename}`);
    
    // If in dry run mode, skip actual upload
    if (DRY_RUN) {
      console.log('DRY RUN: Skipping image upload');
      return Math.floor(Math.random() * 1000); // Return fake ID for testing
    }
    
    const form = new FormData();
    form.append('files', imageBuffer, {
      filename,
      contentType
    });
    
    const headers = form.getHeaders();
    if (STRAPI_TOKEN) {
      headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
    }
    
    const res = await fetch(UPLOAD_URL, { 
      method: 'POST', 
      headers,
      body: form
    });
    
    if (res.status === 403) {
      console.warn('Upload forbidden (403). Check STRAPI_TOKEN and public role upload permissions.');
      const errorText = await res.text().catch(() => 'No error details available');
      console.error(`Error details: ${errorText}`);
      return null;
    }
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error details available');
      console.error(`HTTP Status: ${res.status} ${res.statusText}`);
      console.error(`Error details: ${errorText}`);
      throw new Error(`Upload failed (${res.status})`);
    }
    
    const uploaded = await res.json();
    return uploaded[0]?.id;
  } catch (error) {
    console.error(`Error uploading image to Strapi: ${error.message}`);
    return null;
  }
}

// Function to fetch a page and parse it with Cheerio
async function fetchPage(url) {
  try {
    console.log(`Fetching page: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }
    
    const html = await response.text();
    return cheerio.load(html);
  } catch (error) {
    console.error(`Error fetching page: ${error.message}`);
    return null;
  }
}

// Helper function to extract original image URL from Optimole URL
function extractOriginalImageUrl(optimoleUrl) {
  // Optimole URLs format: https://mlbbhsg9jsam.i.optimole.com/w:731/h:1080/q:mauto/f:best/ig:avif/https://stijnstevens.be/wp-content/uploads/...
  try {
    // Find the original URL part after the optimole params
    const matches = optimoleUrl.match(/https:\/\/mlbbhsg9jsam\.i\.optimole\.com\/.*\/ig:avif\/(https:.*)/);
    if (matches && matches[1]) {
      return matches[1]; // Return the original URL
    }
    return optimoleUrl; // Return the original if not an Optimole URL
  } catch (error) {
    console.log('Error extracting original URL:', error.message);
    return optimoleUrl;
  }
}

// Function to parse a project detail page
async function parseProjectPage($, url) {
  try {
    // Extract title from various potential elements
    let title = $('h1').first().text().trim();
    if (!title) {
      title = $('.project-title, .work-title, .title').first().text().trim();
    }
    if (!title) {
      // Try to extract from URL as last resort
      const urlParts = url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      title = lastPart.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
    }
    
    // Extract description from meta tags or from intro text
    let description = $('meta[name="description"]').attr('content') || '';
    if (!description) {
      description = $('.project-description, .work-description, .intro, .summary').first().text().trim();
    }
    if (!description && $('.project p, .work p, article p').length > 0) {
      // Use the first paragraph as description if nothing else is found
      description = $('.project p, .work p, article p').first().text().trim();
    }
    
    console.log('Found title:', title);
    
    // Get the main content area - try various potential selectors
    const contentSection = $('.project-content, .project-description, .work-content, .content, article, .project, .work').first();
    let body = [];
    
    // Build the body content as paragraphs
    if (contentSection.length > 0) {
      contentSection.find('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text) {
          body.push({
            type: 'paragraph',
            children: [{ type: 'text', text }]
          });
        }
      });
    }
    
    // If we couldn't find paragraphs, try to get any text content
    if (body.length === 0) {
      const projectText = $('.project, .work').text().trim();
      if (projectText) {
        body.push({
          type: 'paragraph',
          children: [{ type: 'text', text: projectText }]
        });
      }
    }
    
    // Find all images in the project - check a wider variety of selectors
    const images = [];
    
    // First try standard image tags (handle Optimole image URLs)
    $('img').each((i, img) => {
      let imgSrc = $(img).attr('src') || $(img).attr('data-src');
      
      if (imgSrc && !imgSrc.startsWith('http')) {
        imgSrc = new URL(imgSrc, url).href;
      }
      
      // Handle Optimole URLs - extract the original image if possible
      if (imgSrc && imgSrc.includes('optimole.com')) {
        imgSrc = extractOriginalImageUrl(imgSrc);
      }
      
      if (imgSrc && !images.includes(imgSrc)) {
        images.push(imgSrc);
      }
    });
    
    // Check for lazy-loaded images with data-src attribute
    $('img[data-src]').each((i, img) => {
      let imgSrc = $(img).attr('data-src');
      
      if (imgSrc && !imgSrc.startsWith('http')) {
        imgSrc = new URL(imgSrc, url).href;
      }
      
      // Handle Optimole URLs
      if (imgSrc && imgSrc.includes('optimole.com')) {
        imgSrc = extractOriginalImageUrl(imgSrc);
      }
      
      if (imgSrc && !images.includes(imgSrc)) {
        images.push(imgSrc);
      }
    });
    
    // Also check for background images in divs
    $('[style*="background"], [style*="background-image"]').each((i, el) => {
      const style = $(el).attr('style');
      if (style) {
        const match = style.match(/url\(['"]?([^'")]+)['"]?\)/i);
        if (match && match[1]) {
          let imgUrl = match[1];
          if (!imgUrl.startsWith('http')) {
            imgUrl = new URL(imgUrl, url).href;
          }
          
          // Handle Optimole URLs
          if (imgUrl && imgUrl.includes('optimole.com')) {
            imgUrl = extractOriginalImageUrl(imgUrl);
          }
          
          if (imgUrl && !images.includes(imgUrl)) {
            images.push(imgUrl);
          }
        }
      }
    });
    
    // Deduplicate images (sometimes the same image appears multiple times)
    const uniqueImages = [...new Set(images)];
    console.log(`Found ${uniqueImages.length} unique images (${images.length} total)`);
    
    // Look for a header/feature image - check multiple possible selectors
    let headerImage = null;
    const headerSelectors = [
      '.project-header img', '.work-header img', '.hero img', 
      '.featured-image img', '.cover img', '.banner img',
      '.header-image img', '.project-feature img', '.work-feature img',
      '.project-hero img', '.work-hero img', '.wp-block-cover img'
    ];
    
    for (const selector of headerSelectors) {
      const headerEl = $(selector).first();
      if (headerEl.length) {
        let imgSrc = headerEl.attr('src') || headerEl.attr('data-src');
        if (imgSrc && !imgSrc.startsWith('http')) {
          imgSrc = new URL(imgSrc, url).href;
        }
        
        // Handle Optimole URLs
        if (imgSrc && imgSrc.includes('optimole.com')) {
          imgSrc = extractOriginalImageUrl(imgSrc);
        }
        
        if (imgSrc) {
          headerImage = imgSrc;
          break;
        }
      }
    }
    
    // If no header image was found with specific selectors, check for background images
    if (!headerImage) {
      const bgSelectors = [
        '.project-header', '.work-header', '.hero', '.featured-image', 
        '.cover', '.banner', '.header-image', '.wp-block-cover'
      ];
      
      for (const selector of bgSelectors) {
        const bgEl = $(selector).first();
        if (bgEl.length) {
          const style = bgEl.attr('style');
          if (style) {
            const match = style.match(/url\(['"]?([^'")]+)['"]?\)/i);
            if (match && match[1]) {
              let imgUrl = match[1];
              if (!imgUrl.startsWith('http')) {
                imgUrl = new URL(imgUrl, url).href;
              }
              
              // Handle Optimole URLs
              if (imgUrl && imgUrl.includes('optimole.com')) {
                imgUrl = extractOriginalImageUrl(imgUrl);
              }
              
              if (imgUrl) {
                headerImage = imgUrl;
                break;
              }
            }
          }
        }
      }
    }
    
    // If we still don't have a header image but we have other images, use the first one
    if (!headerImage && uniqueImages.length > 0) {
      headerImage = uniqueImages[0];
    }
    
    if (headerImage) {
      console.log('Found header image:', headerImage);
    } else {
      console.log('No header image found');
    }
    
    return {
      title,
      description,
      body,
      headerImage,
      images: uniqueImages
    };
  } catch (error) {
    console.error(`Error parsing project page: ${error.message}`);
    return null;
  }
}

// Function to find all project links from the main page
async function findProjectLinks($) {
  const projectLinks = [];
  
  // First check for any structured navigation to works or projects
  const navSelectors = [
    'nav a', '.navigation a', '.menu a', '.nav a', 
    '.navbar a', '.header a', '#header a', '#menu a'
  ];
  
  // Look for links with work/project related keywords in their text or href
  for (const selector of navSelectors) {
    $(selector).each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().toLowerCase();
      
      if (href && 
          (href.includes('/works/') || 
           href.includes('/work/') || 
           href.includes('/projects/') || 
           href.includes('/project/') ||
           href.includes('/portfolio/') ||
           text.includes('work') ||
           text.includes('project') ||
           text.includes('portfolio'))) {
        
        // Check if this is a collection page or individual project
        if (!href.includes('#') && href !== '/' && href !== '#') {
          const absoluteUrl = href.startsWith('http') ? href : new URL(href, WEBSITE_URL).href;
          projectLinks.push(absoluteUrl);
        }
      }
    });
  }
  
  // If we found navigation links to collections, try to follow them and get individual projects
  const collectionLinks = [];
  for (const link of projectLinks) {
    if (link.includes('/works') || link.includes('/projects') || link.includes('/portfolio')) {
      collectionLinks.push(link);
    }
  }
  
  // Look for project cards/items in specific containers
  const projectItemSelectors = [
    '.project-item', '.project', '.work-item', '.work', '.portfolio-item',
    '.grid-item', '.card', '.gallery-item', '.case-study', '.showcase-item'
  ];
  
  for (const selector of projectItemSelectors) {
    $(selector).each((i, el) => {
      // First check for direct link on the item
      const directLink = $(el).attr('href');
      if (directLink) {
        const absoluteUrl = directLink.startsWith('http') ? directLink : new URL(directLink, WEBSITE_URL).href;
        if (!projectLinks.includes(absoluteUrl)) {
          projectLinks.push(absoluteUrl);
        }
      }
      
      // Then check for nested links
      const link = $(el).find('a').attr('href');
      if (link) {
        const absoluteUrl = link.startsWith('http') ? link : new URL(link, WEBSITE_URL).href;
        if (!projectLinks.includes(absoluteUrl)) {
          projectLinks.push(absoluteUrl);
        }
      }
    });
  }
  
  // Also look generally for any anchor that might be a project link
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim().toLowerCase();
    const classes = $(el).attr('class') || '';
    
    // Check if the link might be a project link
    if (href && 
        (href.includes('/works/') || 
         href.includes('/work/') || 
         href.includes('/projects/') || 
         href.includes('/project/') ||
         href.includes('/portfolio/') ||
         classes.includes('project') ||
         classes.includes('work') ||
         text.includes('view project') ||
         text.includes('view work') ||
         text.includes('read more'))) {
      
      // Make sure we have absolute URLs
      if (!href.includes('#') && href !== '/' && href !== '#') {
        const absoluteUrl = href.startsWith('http') ? href : new URL(href, WEBSITE_URL).href;
        if (!projectLinks.includes(absoluteUrl)) {
          projectLinks.push(absoluteUrl);
        }
      }
    }
  });
  
  // If we didn't find any links, we should try to visit collection pages
  if (projectLinks.length === 0 && collectionLinks.length > 0) {
    console.log('No direct project links found. Trying to visit collection pages...');
    for (const collectionUrl of collectionLinks) {
      console.log(`Checking collection page: ${collectionUrl}`);
      const collPage$ = await fetchPage(collectionUrl);
      if (collPage$) {
        collPage$('a').each((i, el) => {
          const href = collPage$(el).attr('href');
          if (href && 
              !href.includes('#') && 
              href !== '/' && 
              href !== '#' && 
              !href.includes('/tag/') && 
              !href.includes('/category/')) {
            const absoluteUrl = href.startsWith('http') ? href : new URL(href, collectionUrl).href;
            if (!projectLinks.includes(absoluteUrl)) {
              projectLinks.push(absoluteUrl);
            }
          }
        });
      }
    }
  }
  
  return [...new Set(projectLinks)]; // Return unique links
}

// Function to create a post in Strapi
async function createStrapiPost(project) {
  try {
    // Upload header image if it exists
    let headerImageId = null;
    if (project.headerImage) {
      const headerImageData = await downloadImage(project.headerImage);
      if (headerImageData) {
        const filename = `header-${Date.now()}.jpg`;
        headerImageId = await uploadImageToStrapi(
          headerImageData.buffer, 
          headerImageData.contentType, 
          filename
        );
      }
    }
    
    // Upload project images
    const imageIds = [];
    for (let i = 0; i < project.images.length; i++) {
      if (project.headerImage === project.images[i]) {
        // Skip if this image is the same as the header
        continue;
      }
      
      const imageData = await downloadImage(project.images[i]);
      if (imageData) {
        const filename = `project-${Date.now()}-${i}.jpg`;
        const imageId = await uploadImageToStrapi(
          imageData.buffer,
          imageData.contentType,
          filename
        );
        
        if (imageId) {
          imageIds.push(imageId);
        }
      }
    }
    
    // Create the post payload
    const payload = {
      data: {
        post_title: project.title,
        post_description: project.description,
        post_body: project.body,
        post_images: imageIds,
        post_header_image: headerImageId
      }
    };
    
    // If in dry run mode, output what would be sent but don't actually send it
    if (DRY_RUN) {
      console.log('DRY RUN: Would create post with title:', project.title);
      console.log('Payload:', JSON.stringify(payload, null, 2));
      return 999; // Return fake ID for testing
    }
    
    // Send the post to Strapi
    const headers = { 'Content-Type': 'application/json' };
    if (STRAPI_TOKEN) {
      headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
    }
    
    console.log('Sending post to Strapi...');
    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error details available');
      console.error(`HTTP Status: ${res.status} ${res.statusText}`);
      console.error(`Error details: ${errorText}`);
      throw new Error(`Failed to create post: ${res.statusText}`);
    }
    
    const json = await res.json();
    console.log(`Created post id=${json.data.id} with title "${project.title}"`);
    return json.data.id;
  } catch (error) {
    console.error(`Error creating Strapi post: ${error.message}`);
    return null;
  }
}

// Main function to scrape projects and create Strapi posts
async function scrapeProjects() {
  try {
    console.log('Starting to scrape projects from', WEBSITE_URL);
    
    // Check if cheerio is installed
    try {
      require('cheerio');
    } catch (e) {
      console.log('Installing cheerio module...');
      await new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        exec('npm install cheerio', (err, stdout) => {
          if (err) {
            console.error('Failed to install cheerio:', err);
            reject(err);
            return;
          }
          console.log('Successfully installed cheerio');
          resolve();
        });
      });
    }
    
    // If we're processing a specific project only
    if (SPECIFIC_PROJECT) {
      const projectUrl = new URL(SPECIFIC_PROJECT.startsWith('http') 
        ? SPECIFIC_PROJECT
        : `/works/${SPECIFIC_PROJECT}`, 
        WEBSITE_URL).href;
        
      console.log(`Processing specific project: ${projectUrl}`);
      const projectPage$ = await fetchPage(projectUrl);
      
      if (!projectPage$) {
        console.error('Failed to fetch the specified project page');
        return;
      }
      
      const project = await parseProjectPage(projectPage$, projectUrl);
      if (!project) {
        console.error(`Failed to parse project at ${projectUrl}`);
        return;
      }
      
      console.log(`Project: ${project.title}`);
      console.log(`Description: ${project.description.substring(0, 100)}...`);
      console.log(`Images found: ${project.images.length}`);
      
      // Create the post in Strapi
      await createStrapiPost(project);
      console.log('Finished processing specified project');
      return;
    }
    
    // Standard flow for processing all or limited projects
    // Fetch the main page
    const $ = await fetchPage(WEBSITE_URL);
    if (!$) return;
    
    // Find all project links
    let projectLinks = await findProjectLinks($);
    console.log(`Found ${projectLinks.length} potential project links`);
    
    if (projectLinks.length === 0) {
      console.log('No project links found. Trying alternate approach...');
      // Try to find project sections or portfolio sections
      $('.projects, .portfolio, .work, #projects, #portfolio, #work').each((i, section) => {
        $(section).find('a').each((j, link) => {
          const href = $(link).attr('href');
          if (href) {
            const absoluteUrl = href.startsWith('http') ? href : new URL(href, WEBSITE_URL).href;
            projectLinks.push(absoluteUrl);
          }
        });
      });
      
      if (projectLinks.length === 0) {
        console.error('Could not find any project links on the website');
        return;
      }
    }
    
    // Apply limit if specified
    if (LIMIT && projectLinks.length > LIMIT) {
      console.log(`Limiting to first ${LIMIT} projects`);
      projectLinks = projectLinks.slice(0, LIMIT);
    }
    
    console.log(`Processing ${projectLinks.length} projects`);
    
    // Process each project page
    for (let i = 0; i < projectLinks.length; i++) {
      const projectUrl = projectLinks[i];
      console.log(`\nProcessing project ${i + 1}/${projectLinks.length}: ${projectUrl}`);
      
      // Skip non-project links like social media
      if (projectUrl.includes('instagram.com') || 
          projectUrl.includes('facebook.com') || 
          projectUrl.includes('linkedin.com') ||
          projectUrl.includes('twitter.com')) {
        console.log('Skipping social media link');
        continue;
      }
      
      // If we're looking for a specific project and this isn't it, skip
      if (SPECIFIC_PROJECT && 
          !projectUrl.toLowerCase().includes(SPECIFIC_PROJECT.toLowerCase()) &&
          !projectUrl.toLowerCase().endsWith('/' + SPECIFIC_PROJECT.toLowerCase())) {
        console.log(`Skipping non-matching project (looking for ${SPECIFIC_PROJECT})`);
        continue;
      }
      
      // Fetch and parse the project page
      const projectPage$ = await fetchPage(projectUrl);
      if (!projectPage$) continue;
      
      const project = await parseProjectPage(projectPage$, projectUrl);
      if (!project) {
        console.error(`Failed to parse project at ${projectUrl}`);
        continue;
      }
      
      // Skip if no title was found
      if (!project.title) {
        console.log('Skipping project with no title');
        continue;
      }
      
      console.log(`Project: ${project.title}`);
      console.log(`Description: ${project.description.substring(0, 100)}...`);
      console.log(`Images found: ${project.images.length}`);
      
      // Create the post in Strapi
      await createStrapiPost(project);
      
      // If we're only processing a specific project and we found it, we can stop
      if (SPECIFIC_PROJECT) {
        console.log('Found and processed requested project. Finished.');
        break;
      }
      
      // Wait a bit between requests to avoid overwhelming the website
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\nFinished processing all projects');
  } catch (error) {
    console.error('Error in scrapeProjects:', error);
  }
}

// Run the scraper
scrapeProjects();
