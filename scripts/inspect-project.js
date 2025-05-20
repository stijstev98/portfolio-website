const fetch = require('node-fetch');
const fs = require('fs');

const PROJECT_URL = 'https://stijnstevens.be/works/baltic-archiscapes';

async function inspectProjectPage() {
  try {
    console.log(`Fetching ${PROJECT_URL}...`);
    
    const response = await fetch(PROJECT_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Save the HTML to a file for inspection
    fs.writeFileSync('project-page.html', html);
    console.log('Saved HTML content to project-page.html');
    
    // Look for image patterns manually
    const imgTags = html.match(/<img[^>]+src=["']([^"']+)["']/g);
    console.log('\nFound image tags:', imgTags?.length || 0);
    if (imgTags && imgTags.length > 0) {
      imgTags.forEach((tag) => {
        const srcMatch = tag.match(/src=["']([^"']+)["']/);
        if (srcMatch && srcMatch[1]) {
          console.log(`- ${srcMatch[1]}`);
        }
      });    
    }

    // Look for background images
    const bgStyles = html.match(/background(?:-image)?:\s*url\(['"]?([^'")]+)['"]?\)/g);
    console.log('\nFound background styles:', bgStyles?.length || 0);
    if (bgStyles && bgStyles.length > 0) {
      bgStyles.forEach((style) => {
        const urlMatch = style.match(/url\(['"]?([^'")]+)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          console.log(`- ${urlMatch[1]}`);    
        }
      });
    }

    // Check for lazy loading or other image techniques
    if (html.includes('data-src')) {
      console.log('\nDetected lazy loading (data-src attributes)');
      const dataSrc = html.match(/data-src=["']([^"']+)["']/g);
      if (dataSrc && dataSrc.length > 0) {
        dataSrc.forEach((tag) => {
          const srcMatch = tag.match(/data-src=["']([^"']+)["']/);
          if (srcMatch && srcMatch[1]) {    
            console.log(`- ${srcMatch[1]}`);
          }
        });
      }
    }

    // Check for JavaScript-loaded images
    if (html.includes('srcset')) {
      console.log('\nDetected srcset attributes (responsive images)');
      const srcsets = html.match(/srcset=["']([^"']+)["']/g);
      if (srcsets && srcsets.length > 0) {
        srcsets.forEach((tag) => {
          const srcset = tag.match(/srcset=["']([^"']+)["']/)[1];
          console.log(`- ${srcset}`); console.error('Error:', error.message);
        }); }
      }}
    }
  } catch (error) {inspectProjectPage();






inspectProjectPage();}  }    console.error('Error:', error.message);