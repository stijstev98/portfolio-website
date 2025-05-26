// This script demonstrates how the book-flip component will work
// once you add rich_content with book-flip components to your Strapi posts

const mockPostWithBookFlip = {
  id: 1,
  post_title: "My Photo Book",
  post_description: "A collection of beautiful images",
  rich_content: [
    {
      __component: 'shared.book-flip',
      book_pages: [
        {
          url: '/uploads/image1.jpg',
          formats: {
            medium: { url: '/uploads/medium_image1.jpg' },
            small: { url: '/uploads/small_image1.jpg' }
          },
          width: 800,
          height: 600,
          name: 'image1.jpg',
          alternativeText: 'Beautiful landscape'
        },
        {
          url: '/uploads/image2.jpg',
          formats: {
            medium: { url: '/uploads/medium_image2.jpg' },
            small: { url: '/uploads/small_image2.jpg' }
          },
          width: 800,
          height: 600,
          name: 'image2.jpg',
          alternativeText: 'City skyline'
        },
        {
          url: '/uploads/image3.jpg',
          formats: {
            medium: { url: '/uploads/medium_image3.jpg' },
            small: { url: '/uploads/small_image3.jpg' }
          },
          width: 800,
          height: 600,
          name: 'image3.jpg',
          alternativeText: 'Mountain view'
        }
      ]
    }
  ]
};

// Simulate the processing logic from posts.js
function processRichContent(richContent) {
  return richContent.map(component => {
    if (component.__component === 'shared.book-flip') {
      const bookPages = [];
      if (component.book_pages && Array.isArray(component.book_pages)) {
        component.book_pages.forEach(page => {
          if (page.url) {
            bookPages.push({
              url: `http://127.0.0.1:1337${page.url}`,
              medium: page.formats?.medium?.url ? `http://127.0.0.1:1337${page.formats.medium.url}` : null,
              width: page.width || 0,
              height: page.height || 0,
              alt: page.alternativeText || page.name || 'Book page'
            });
          }
        });
      }
      return {
        type: 'book-flip',
        pages: bookPages,
        totalPages: bookPages.length
      };
    }
    return null;
  }).filter(Boolean);
}

console.log('=== Mock Book-Flip Component Processing Test ===\n');

const processedComponents = processRichContent(mockPostWithBookFlip.rich_content);
console.log('Processed components:', JSON.stringify(processedComponents, null, 2));

console.log('\n=== Expected EJS Template Data ===');
if (processedComponents.length > 0) {
  const bookFlipComponent = processedComponents[0];
  console.log('Book-flip component pages:');
  bookFlipComponent.pages.forEach((page, index) => {
    console.log(`  Page ${index + 1}:`);
    console.log(`    URL: ${page.url}`);
    console.log(`    Medium: ${page.medium || 'Same as URL'}`);
    console.log(`    Alt text: ${page.alt}`);
    console.log(`    Dimensions: ${page.width}x${page.height}`);
  });
  
  console.log(`\nTotal book pages needed: ${Math.ceil(bookFlipComponent.pages.length / 2)}`);
  console.log('(Each book page has front and back, so 3 images = 2 book pages)');
}

console.log('\n=== Instructions to Test ===');
console.log('1. Go to your Strapi admin panel');
console.log('2. Edit a post or create a new post');
console.log('3. In the rich_content field, add a "Book Flip" component');
console.log('4. Upload 2-6 images to the "Book Pages" field in that component');
console.log('5. Save and publish the post');
console.log('6. The post page will now display a flip book with your images');
console.log('\nThe book-flip component is ready to work as soon as you add the data!');
