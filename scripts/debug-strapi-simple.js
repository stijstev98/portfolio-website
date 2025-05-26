const { config } = require('dotenv').config();

async function testStrapiResponse() {
  const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
  const API_TOKEN = process.env.STRAPI_API_TOKEN || ''; // Set if needed

  const headers = {};
  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }

  console.log('Testing Strapi API structure...\n');

  try {
    // Test 1: Basic fetch to understand structure
    console.log('--- Test 1: Basic fetch ---');
    const response1 = await fetch(`${STRAPI_URL}/api/posts`, { headers });
    const data1 = await response1.json();
    
    if (data1.data && data1.data.length > 0) {
      const firstPost = data1.data[0];
      console.log('First post structure:');
      console.log('- ID:', firstPost.id);
      console.log('- Title:', firstPost.post_title);
      console.log('- Published At:', firstPost.publishedAt);
      console.log('- Document ID:', firstPost.documentId);
      console.log('- Has rich_content:', firstPost.hasOwnProperty('rich_content'));
      console.log('- All available fields:', Object.keys(firstPost).join(', '));
      
      if (firstPost.rich_content) {
        console.log('- rich_content type:', typeof firstPost.rich_content);
        console.log('- rich_content length:', Array.isArray(firstPost.rich_content) ? firstPost.rich_content.length : 'Not an array');
      }
    }

    // Test 2: With populate=*
    console.log('\n--- Test 2: With populate=* ---');
    const response2 = await fetch(`${STRAPI_URL}/api/posts?populate=*`, { headers });
    const data2 = await response2.json();
    
    if (data2.data && data2.data.length > 0) {
      const firstPost = data2.data[0];
      console.log('With populate=*, rich_content field:', firstPost.rich_content ? 'EXISTS' : 'MISSING');
      
      if (firstPost.rich_content && Array.isArray(firstPost.rich_content)) {
        console.log('rich_content components found:', firstPost.rich_content.length);
        firstPost.rich_content.forEach((comp, i) => {
          console.log(`  Component ${i + 1}: ${comp.__component || 'Unknown'}`);
        });
      }
    }

    // Test 3: Look for posts with rich_content specifically
    console.log('\n--- Test 3: Searching for posts with rich_content ---');
    let postsWithRichContent = 0;
    let totalPosts = data2.data.length;
    
    data2.data.forEach((post, index) => {
      if (post.rich_content && Array.isArray(post.rich_content) && post.rich_content.length > 0) {
        postsWithRichContent++;
        console.log(`Post ${index + 1} (ID: ${post.id}, Title: "${post.post_title}") has ${post.rich_content.length} rich_content components:`);
        post.rich_content.forEach((comp, compIndex) => {
          console.log(`  - Component ${compIndex + 1}: ${comp.__component}`);
        });
      }
    });
    
    console.log(`\nSUMMARY: Found ${postsWithRichContent} posts with rich_content out of ${totalPosts} total posts.`);
    
    if (postsWithRichContent === 0) {
      console.log('No posts found with rich_content. This could mean:');
      console.log('1. All posts are using the basic post_body field instead of rich_content');
      console.log('2. The rich_content field exists but is empty for all posts');
      console.log('3. All posts with rich_content are drafts (unpublished)');
      console.log('4. There\'s a permission issue preventing access to rich_content');
      
      // Test 4: Try with preview mode to include drafts
      console.log('\n--- Test 4: Including drafts (publicationState=preview) ---');
      const response4 = await fetch(`${STRAPI_URL}/api/posts?populate=*&publicationState=preview`, { headers });
      const data4 = await response4.json();
      
      if (data4.data) {
        let draftsWithRichContent = 0;
        data4.data.forEach((post) => {
          if (post.rich_content && Array.isArray(post.rich_content) && post.rich_content.length > 0) {
            draftsWithRichContent++;
            console.log(`Draft post "${post.post_title}" has ${post.rich_content.length} rich_content components`);
          }
        });
        console.log(`Found ${draftsWithRichContent} draft posts with rich_content.`);
      }
    }

  } catch (error) {
    console.error('Error testing Strapi API:', error.message);
  }
}

testStrapiResponse();
