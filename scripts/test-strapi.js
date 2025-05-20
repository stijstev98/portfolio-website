// Simple script to test Strapi API connectivity
const fetch = require('node-fetch');

async function testStrapiConnection() {
  try {
    console.log('Testing connection to Strapi API...');
    const response = await fetch('http://localhost:1337/api/posts');
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Data retrieved successfully. Found', data.data ? data.data.length : 0, 'posts');
    } else {
      console.log('Response not OK:', await response.text());
    }
  } catch (error) {
    console.error('Error connecting to Strapi:', error.message);
  }
}

testStrapiConnection();
