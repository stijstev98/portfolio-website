// Script to add a book-flip component to an existing post using Strapi API
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'http://127.0.0.1:1337';
// You'll need to create an API token in your Strapi admin panel
// Admin Panel > Settings > API Tokens > Create new API Token
const API_TOKEN = 'YOUR_API_TOKEN_HERE'; // Replace with your actual token

// Target post ID to update (from our previous debug script)
const POST_ID = 6;

// Example image paths - replace with your actual local image paths
const imagePaths = [
  path.join(__dirname, '../public/assets/images/image1.jpg'),
  path.join(__dirname, '../public/assets/images/image2.jpg'),
  path.join(__dirname, '../public/assets/images/image3.jpg')
];

// Headers for API requests
const headers = {
  'Authorization': `Bearer ${API_TOKEN}`
};

// Step 1: Upload images to Strapi Media Library
async function uploadImages() {
  console.log('Uploading images to Strapi Media Library...');
  const uploadedImages = [];
  
  for (const imagePath of imagePaths) {
    try {
      if (!fs.existsSync(imagePath)) {
        console.log(`Image not found: ${imagePath}`);
        continue;
      }
      
      const form = new FormData();
      form.append('files', fs.createReadStream(imagePath));
      
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          ...headers
        },
        body: form
      });
      
      if (!response.ok) {
        console.log(`Failed to upload image ${imagePath}: ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`Uploaded image ${imagePath} successfully`);
      uploadedImages.push(data[0].id);
    } catch (error) {
      console.log(`Error uploading image ${imagePath}:`, error.message);
    }
  }
  
  return uploadedImages;
}

// Step 2: Update post with book-flip component
async function updatePostWithBookFlip(imageIds) {
  console.log(`Updating post with ID=${POST_ID} with book-flip component...`);
  
  try {
    // First get the current post data
    const getResponse = await fetch(`${API_URL}/api/posts/${POST_ID}?populate=*`, {
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
    
    if (!getResponse.ok) {
      console.log(`Failed to get current post data: ${getResponse.statusText}`);
      return;
    }
    
    const currentPost = await getResponse.json();
    console.log('Current post data retrieved');
    
    // Check if rich_content already has components
    const currentRichContent = currentPost.data?.attributes?.rich_content || [];
    
    // Create new book-flip component
    const bookFlipComponent = {
      __component: 'shared.book-flip',
      book_pages: imageIds.map(id => id)
    };
    
    // Add the new component to rich_content
    const updatedRichContent = [...currentRichContent, bookFlipComponent];
    
    // Update the post
    const updateResponse = await fetch(`${API_URL}/api/posts/${POST_ID}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          rich_content: updatedRichContent
        }
      })
    });
    
    if (!updateResponse.ok) {
      console.log(`Failed to update post: ${updateResponse.statusText}`);
      const errorData = await updateResponse.json();
      console.log('Error details:', JSON.stringify(errorData, null, 2));
      return;
    }
    
    const updatedPost = await updateResponse.json();
    console.log('Post updated successfully with book-flip component!');
    console.log('Updated post data:', JSON.stringify(updatedPost.data, null, 2));
    
  } catch (error) {
    console.log('Error updating post:', error.message);
  }
}

// Main execution function
async function main() {
  if (API_TOKEN === 'YOUR_API_TOKEN_HERE') {
    console.log('\n⚠️ IMPORTANT: You need to set a valid API token first! ⚠️');
    console.log('Go to your Strapi admin panel > Settings > API Tokens');
    console.log('Create a new token with "Full Access" permissions');
    console.log('Then replace "YOUR_API_TOKEN_HERE" in this script with your token');
    return;
  }
  
  console.log(`\n=== Adding Book-Flip Component to Post ID=${POST_ID} ===`);
  
  // Check if target post exists
  try {
    const checkResponse = await fetch(`${API_URL}/api/posts/${POST_ID}`, {
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
    
    if (!checkResponse.ok) {
      console.log(`Post with ID=${POST_ID} not found. Please update the POST_ID variable.`);
      return;
    }
    
    const postData = await checkResponse.json();
    console.log(`Target post found: "${postData.data.attributes.post_title}"`);
    
  } catch (error) {
    console.log('Error checking post:', error.message);
    return;
  }
  
  // Step 1: Upload images
  console.log('\nStep 1: Uploading images');
  const uploadedImageIds = await uploadImages();
  
  if (uploadedImageIds.length === 0) {
    console.log('No images were uploaded. Please check the image paths.');
    return;
  }
  
  console.log(`Uploaded ${uploadedImageIds.length} images successfully`);
  
  // Step 2: Update post with book-flip component
  console.log('\nStep 2: Adding book-flip component to post');
  await updatePostWithBookFlip(uploadedImageIds);
  
  console.log('\nProcess completed!');
}

// Check if form-data is installed
try {
  require.resolve('form-data');
  main().catch(console.error);
} catch (e) {
  console.log('\n⚠️ Missing required package: form-data');
  console.log('Please install it first with:');
  console.log('npm install form-data');
}
