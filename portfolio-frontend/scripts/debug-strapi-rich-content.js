// Debug script to find why posts with rich_content aren't showing in the API
const fetch = require('node-fetch');

const API_URL = 'http://127.0.0.1:1337';
const headers = {
  'Content-Type': 'application/json'
};

// Various population strategies we'll test
const testPopulateStrategies = [
  // Basic queries
  { name: 'Default - no populate', query: '/api/posts' },
  { name: 'Basic populate=*', query: '/api/posts?populate=*' },
  
  // Dynamic zone specific strategies  
  { name: 'Specific populate for rich_content', query: '/api/posts?populate[0]=rich_content' },
  { name: 'Deep populate for rich_content', query: '/api/posts?populate[rich_content][populate]=*' },
  
  // Alternative population syntax
  { name: 'Alternative 1', query: '/api/posts?populate=rich_content' },
  { name: 'Alternative 2', query: '/api/posts?populate=rich_content.book_pages' },
  { name: 'Alternative 3', query: '/api/posts?populate=rich_content.components' },
  
  // Component-specific population
  { name: 'Populate book-flip', query: '/api/posts?populate[rich_content][filters][__component][$eq]=shared.book-flip' },
  
  // Include drafts
  { name: 'Draft posts with populate=*', query: '/api/posts?publicationState=preview&populate=*' },
  
  // Try specific post IDs with various population methods
  { name: 'Specific post with ID=1 - basic', query: '/api/posts/1?populate=*' },
  { name: 'Specific post with ID=6 - basic', query: '/api/posts/6?populate=*' },
  { name: 'Test post ID=26', query: '/api/posts/26?populate=*' }
];

// Let's check the content-type permissions
async function checkContentTypePermissions() {
  try {
    const response = await fetch(`${API_URL}/api/users-permissions/roles`, { headers });
    if (response.ok) {
      const data = await response.json();
      console.log('=== Permission Check ===');
      
      // Check Public role permissions
      const publicRole = data.roles?.find(role => role.name === 'Public');
      if (publicRole) {
        console.log('Public role found, checking permissions...');
        
        // Check post type permissions
        const postPermission = publicRole.permissions?.application?.controllers?.['api::post.post'] || {};
        console.log('Post permissions:', Object.keys(postPermission).filter(key => postPermission[key].enabled));
        
        // Check component permissions
        const componentPermissions = publicRole.permissions?.application?.controllers || {};
        Object.keys(componentPermissions).forEach(key => {
          if (key.includes('shared.')) {
            console.log(`Component ${key} permissions:`, Object.keys(componentPermissions[key]).filter(p => componentPermissions[key][p].enabled));
          }
        });
      } else {
        console.log('Public role not found in the response');
      }
    } else {
      console.log('Could not check permissions, status:', response.status);
    }
  } catch (error) {
    console.log('Error checking permissions:', error.message);
  }
}

// Fetch posts for all test strategies
async function testPopulationStrategies() {
  console.log('\n=== Testing Population Strategies ===');
  
  for (const strategy of testPopulateStrategies) {
    try {
      console.log(`\n--- Testing: ${strategy.name} ---`);
      console.log(`URL: ${API_URL}${strategy.query}`);
      
      const response = await fetch(`${API_URL}${strategy.query}`, { headers });
      console.log(`Status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`Error: ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      
      // Handle array or single item responses
      const items = Array.isArray(data.data) ? data.data : [data.data].filter(Boolean);
      console.log(`Found ${items.length} items`);
      
      // Check for rich_content
      let itemsWithRichContent = 0;
      
      items.forEach((item, index) => {
        if (index < 3) { // Limit to first 3 for brevity
          console.log(`\nItem ${index + 1} (ID: ${item.id}):`);
          
          // Check for attributes structure
          if (item.attributes) {
            console.log(`Title: ${item.attributes.post_title}`);
            console.log(`Has rich_content in attributes: ${!!item.attributes.rich_content}`);
            
            if (item.attributes.rich_content) {
              itemsWithRichContent++;
              console.log(`  rich_content type: ${typeof item.attributes.rich_content}`);
              
              if (Array.isArray(item.attributes.rich_content)) {
                console.log(`  rich_content length: ${item.attributes.rich_content.length}`);
                item.attributes.rich_content.forEach((component, i) => {
                  console.log(`    Component ${i+1}: ${component.__component}`);
                  
                  // For book-flip components, check if book_pages exists
                  if (component.__component === 'shared.book-flip') {
                    console.log(`    Has book_pages: ${!!component.book_pages}`);
                    if (component.book_pages) {
                      console.log(`    Book pages count: ${Array.isArray(component.book_pages) ? component.book_pages.length : 'Not an array'}`);
                    }
                  }
                });
              } else {
                console.log(`  rich_content is not an array: ${JSON.stringify(item.attributes.rich_content).substring(0, 100)}...`);
              }
            }
          } else {
            // Direct structure (no attributes wrapper)
            console.log(`Title: ${item.post_title}`);
            console.log(`Has rich_content directly: ${!!item.rich_content}`);
            
            if (item.rich_content) {
              itemsWithRichContent++;
              console.log(`  rich_content type: ${typeof item.rich_content}`);
              
              if (Array.isArray(item.rich_content)) {
                console.log(`  rich_content length: ${item.rich_content.length}`);
                item.rich_content.forEach((component, i) => {
                  console.log(`    Component ${i+1}: ${component.__component}`);
                  
                  if (component.__component === 'shared.book-flip') {
                    console.log(`    Has book_pages: ${!!component.book_pages}`);
                    if (component.book_pages) {
                      console.log(`    Book pages count: ${Array.isArray(component.book_pages) ? component.book_pages.length : 'Not an array'}`);
                    }
                  }
                });
              } else {
                console.log(`  rich_content is not an array: ${JSON.stringify(item.rich_content).substring(0, 100)}...`);
              }
            }
          }
        }
      });
      
      console.log(`\nSummary for ${strategy.name}:`);
      console.log(`Total items: ${items.length}`);
      console.log(`Items with rich_content: ${itemsWithRichContent}`);
      
    } catch (error) {
      console.log(`Error with strategy ${strategy.name}:`, error.message);
    }
  }
}

// Try to fetch detailed info for the first post that should have rich_content
async function testDirectFetch() {
  try {
    console.log('\n=== Direct Fetch Test ===');
    const response = await fetch(`${API_URL}/api/posts?populate[rich_content][populate]=*`, { headers });
    if (!response.ok) {
      console.log(`Error fetching: ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    const firstItem = data.data?.[0];
    
    if (firstItem) {
      console.log(`First item ID: ${firstItem.id}`);
      
      // Now try to fetch this specific post with deep population
      console.log(`\nFetching specific post with ID=${firstItem.id}`);
      const specificResponse = await fetch(`${API_URL}/api/posts/${firstItem.id}?populate=deep`, { headers });
      
      if (specificResponse.ok) {
        const specificData = await specificResponse.json();
        console.log('Full data structure for this post:');
        console.log(JSON.stringify(specificData, null, 2));
      } else {
        console.log(`Error fetching specific post: ${specificResponse.statusText}`);
      }
    } else {
      console.log('No posts found');
    }
  } catch (error) {
    console.log('Error with direct fetch:', error.message);
  }
}

// Main execution
async function main() {
  console.log('=== Debugging Strapi Rich Content ===');
  await checkContentTypePermissions();
  await testPopulationStrategies();
  await testDirectFetch();
}

main().catch(console.error);
