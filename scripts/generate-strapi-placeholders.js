require('dotenv').config();
const fetch = require('node-fetch');
const FormData = require('form-data');
const { faker } = require('@faker-js/faker');

const API_URL = 'http://127.0.0.1:1337/api/posts';
const UPLOAD_URL = 'http://127.0.0.1:1337/api/upload';
const count = parseInt(process.argv[2], 10) || 10;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '';

// Define various dimensions for aspect ratio variety
const imageDimensions = [
  { width: 600, height: 600 }, // Square 1:1
  { width: 800, height: 600 }, // Landscape 4:3
  { width: 600, height: 400 }, // Landscape 3:2 (original)
  { width: 640, height: 360 }, // Landscape 16:9
  { width: 600, height: 800 }, // Portrait 3:4
  { width: 400, height: 600 }, // Portrait 2:3
  { width: 360, height: 640 }  // Portrait 9:16
];

// Sample content themes for more realistic posts
const contentThemes = [
  {
    category: 'technology',
    titles: [
      'The Future of AI in Web Development',
      'Building Scalable React Applications',
      'Understanding Modern CSS Grid Layouts',
      'API Design Best Practices',
      'The Rise of Edge Computing'
    ],
    topics: ['artificial intelligence', 'machine learning', 'web development', 'user experience', 'performance optimization']
  },
  {
    category: 'design',
    titles: [
      'Minimalist Design Principles',
      'Color Theory in Digital Design',
      'Typography That Tells a Story',
      'The Psychology of User Interface Design',
      'Creating Accessible Design Systems'
    ],
    topics: ['visual design', 'user experience', 'accessibility', 'branding', 'creative process']
  },
  {
    category: 'business',
    titles: [
      'Building a Sustainable Startup',
      'Remote Work Culture Best Practices',
      'Data-Driven Decision Making',
      'Customer Success Strategies',
      'The Evolution of Digital Marketing'
    ],
    topics: ['entrepreneurship', 'strategy', 'leadership', 'marketing', 'growth']
  }
];

// Video embed options for realistic content
const sampleVideoEmbeds = [
  { provider: 'youtube', provider_uid: 'dQw4w9WgXcQ', title: 'Introduction to Modern Web Development' },
  { provider: 'vimeo', provider_uid: '148751763', title: 'Design System Fundamentals' },
  { provider: 'youtube', provider_uid: 'JJ9c_qUNkhI', title: 'React Performance Optimization' },
  { provider: 'youtube', provider_uid: 'fJEqQjCb6gU', title: 'CSS Grid Layout Tutorial' }
];

// Sample callout types and content
const calloutTypes = ['info', 'warning', 'success', 'danger'];
const calloutContent = [
  { title: 'Pro Tip', content: 'Always test your applications across different devices and browsers for the best user experience.' },
  { title: 'Important Note', content: 'Remember to backup your data before making major changes to your production environment.' },
  { title: 'Best Practice', content: 'Use semantic HTML elements to improve accessibility and SEO performance.' },
  { title: 'Warning', content: 'Be cautious when implementing third-party scripts as they can impact page performance.' }
];

// Download random picsum image and upload to Strapi, return its media ID
async function uploadRandomImage() {
  // Select random dimensions
  const { width, height } = imageDimensions[Math.floor(Math.random() * imageDimensions.length)];
  
  // fetch a random image buffer with varied dimensions
  const imgRes = await fetch(`https://picsum.photos/${width}/${height}`);
  const buf = await imgRes.buffer();
  // prepare multipart form
  const form = new FormData();
  form.append('files', buf, {
    filename: `placeholder-${Date.now()}.jpg`,
    contentType: imgRes.headers.get('content-type'),
  });
  const headers = form.getHeaders();
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
  const res = await fetch(UPLOAD_URL, { method: 'POST', headers, body: form });
  if (res.status === 403) {
    console.warn('Upload forbidden (403). Skipping image. Check STRAPI_TOKEN and public role upload permissions.');
    return null;
  }
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const uploaded = await res.json();
  // Strapi returns an array of uploaded files
  return uploaded[0]?.id;
}

// Create a sample PDF file for book-flip component
async function createSamplePDF() {
  // Create a 4-page PDF as required by the book-flip component
  const pdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R 5 0 R 7 0 R 9 0 R]
/Count 4
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 80
>>
stream
BT
/F1 18 Tf
72 720 Td
(Sample Book - Page 1) Tj
0 -50 Td
/F1 12 Tf
(Introduction to the topic) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 6 0 R
>>
endobj
6 0 obj
<<
/Length 85
>>
stream
BT
/F1 18 Tf
72 720 Td
(Sample Book - Page 2) Tj
0 -50 Td
/F1 12 Tf
(Detailed explanation here) Tj
ET
endstream
endobj
7 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 8 0 R
>>
endobj
8 0 obj
<<
/Length 75
>>
stream
BT
/F1 18 Tf
72 720 Td
(Sample Book - Page 3) Tj
0 -50 Td
/F1 12 Tf
(More content follows) Tj
ET
endstream
endobj
9 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 10 0 R
>>
endobj
10 0 obj
<<
/Length 70
>>
stream
BT
/F1 18 Tf
72 720 Td
(Sample Book - Page 4) Tj
0 -50 Td
/F1 12 Tf
(Conclusion notes) Tj
ET
endstream
endobj
xref
0 11
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000232 00000 n 
0000000364 00000 n 
0000000471 00000 n 
0000000608 00000 n 
0000000715 00000 n 
0000000842 00000 n 
0000000949 00000 n 
trailer
<<
/Size 11
/Root 1 0 R
>>
startxref
1071
%%EOF`);

  const form = new FormData();
  form.append('files', pdfContent, {
    filename: `sample-book-${Date.now()}.pdf`,
    contentType: 'application/pdf',
  });
  
  const headers = form.getHeaders();
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
  
  try {
    const res = await fetch(UPLOAD_URL, { method: 'POST', headers, body: form });
    if (!res.ok) throw new Error(`PDF upload failed (${res.status})`);
    const uploaded = await res.json();
    return uploaded[0]?.id;
  } catch (e) {
    console.warn('PDF upload failed:', e.message);
    return null;
  }
}

// Generate rich Lexical content for post_body2
function generateLexicalContent(theme) {
  const nodes = [];
  
  // Add a main heading (h1)
  nodes.push({
    type: 'heading',
    tag: 'h1',
    children: [
      { 
        type: 'text', 
        text: faker.lorem.sentence().replace('.', ''),
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        version: 1
      }
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1
  });
  
  // Add introduction paragraph
  nodes.push({
    type: 'paragraph',
    children: [
      { 
        type: 'text', 
        text: faker.lorem.paragraph(),
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        version: 1
      }
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    textFormat: 0,
    textStyle: ''
  });
  
  // Add a subheading (h2)
  nodes.push({
    type: 'heading',
    tag: 'h2',
    children: [
      { 
        type: 'text', 
        text: faker.lorem.words(3).split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        version: 1
      }
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1
  });
  
  // Add paragraph with formatted text
  nodes.push({
    type: 'paragraph',
    children: [
      { 
        type: 'text', 
        text: faker.lorem.sentences(2) + ' ',
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        version: 1
      },
      { 
        type: 'text', 
        text: 'This is important information',
        detail: 0,
        format: 1, // Bold
        mode: 'normal',
        style: '',
        version: 1
      },
      { 
        type: 'text', 
        text: ' that you should ',
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        version: 1
      },
      { 
        type: 'text', 
        text: 'definitely remember',
        detail: 0,
        format: 2, // Italic
        mode: 'normal',
        style: '',
        version: 1
      },
      { 
        type: 'text', 
        text: '. ' + faker.lorem.sentence(),
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        version: 1
      }
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    textFormat: 0,
    textStyle: ''
  });
  
  // Add a bullet list
  nodes.push({
    type: 'list',
    listType: 'bullet',
    start: 1,
    tag: 'ul',
    children: [
      {
        type: 'listitem',
        children: [
          { 
            type: 'text', 
            text: faker.lorem.sentence(),
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1
          }
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1
      },
      {
        type: 'listitem',
        children: [
          { 
            type: 'text', 
            text: faker.lorem.sentence(),
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1
          }
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1
      },
      {
        type: 'listitem',
        children: [
          { 
            type: 'text', 
            text: faker.lorem.sentence(),
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1
          }
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1
      }
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1
  });
  
  // Add horizontal rule
  nodes.push({ 
    type: 'horizontalrule',
    version: 1
  });
  
  // Add quote
  nodes.push({
    type: 'quote',
    children: [
      { 
        type: 'text', 
        text: faker.lorem.sentence(),
        detail: 0,
        format: 2, // Italic
        mode: 'normal',
        style: '',
        version: 1
      }
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1
  });
  
  // Add concluding paragraph
  nodes.push({
    type: 'paragraph',
    children: [
      { 
        type: 'text', 
        text: faker.lorem.paragraph(),
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        version: 1
      }
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    textFormat: 0,
    textStyle: ''
  });
  
  return {
    root: {
      type: 'root',
      children: nodes,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1
    }
  };
}

// Generate rich_content dynamic zone components
async function generateRichContent(shouldIncludeBookFlip = false) {
  const components = [];
  
  // Start with a simple rich text component using plain text
  components.push({
    __component: 'shared.rich-text',
    body: faker.lorem.paragraphs(2)
  });
  
  // Maybe add a callout
  if (Math.random() > 0.5) {
    const callout = faker.helpers.arrayElement(calloutContent);
    components.push({
      __component: 'shared.callout',
      title: callout.title,
      content: callout.content,
      type: faker.helpers.arrayElement(calloutTypes)
    });
  }
  
  // Maybe add a video embed
  if (Math.random() > 0.7) {
    const video = faker.helpers.arrayElement(sampleVideoEmbeds);
    components.push({
      __component: 'shared.video-embed',
      provider: video.provider,
      provider_uid: video.provider_uid,
      title: video.title,
      caption: faker.lorem.sentence()
    });
  }
  
  // Maybe add a media component
  if (Math.random() > 0.6) {
    try {
      const mediaId = await uploadRandomImage();
      if (mediaId) {
        components.push({
          __component: 'shared.media',
          file: mediaId,
          caption: faker.lorem.sentence()
        });
      }
    } catch (e) {
      console.warn('Failed to add media component:', e.message);
    }
  }
  
  // Add book-flip component if requested
  if (shouldIncludeBookFlip) {
    try {
      const pdfId = await createSamplePDF();
      if (pdfId) {
        components.push({
          __component: 'shared.book-flip',
          title: `${faker.lorem.words(2)} Guide`,
          pdf_file: pdfId
        });
      }
    } catch (e) {
      console.warn('Failed to add book-flip component:', e.message);
    }
  }
  
  // Add another rich text component
  components.push({
    __component: 'shared.rich-text',
    body: `# ${faker.lorem.words(4)}\n\n${faker.lorem.paragraphs(1)}`
  });
  
  return components;
}

async function createPost(i) {
  // Choose a random theme
  const theme = faker.helpers.arrayElement(contentThemes);
  const baseTitle = faker.helpers.arrayElement(theme.titles);
  
  // Make title unique by adding descriptive words and ensuring uniqueness
  const descriptors = ['Advanced', 'Modern', 'Complete', 'Essential', 'Practical', 'Ultimate', 'Professional', 'Expert'];
  const timeframes = ['2024', 'Today', 'Now', 'Updated'];
  
  // Create unique title variations
  const titleVariations = [
    `${faker.helpers.arrayElement(descriptors)} ${baseTitle}`,
    `${baseTitle}: ${faker.helpers.arrayElement(['A Complete Guide', 'Best Practices', 'Step by Step', 'What You Need to Know'])}`,
    `${baseTitle} in ${faker.helpers.arrayElement(timeframes)}`,
    `${faker.helpers.arrayElement(['How to Master', 'Getting Started with', 'Deep Dive into'])} ${baseTitle.replace(/^(The |Building |Understanding |Creating )/, '')}`,
    `${baseTitle} ${faker.helpers.arrayElement(['Tips and Tricks', 'for Beginners', 'Made Simple', 'Explained'])}`
  ];
  
  // Add timestamp to ensure absolute uniqueness
  const title = `${faker.helpers.arrayElement(titleVariations)} (${i}-${Date.now().toString().slice(-4)})`;
  
  // upload 1–3 random images and collect their IDs
  const imageCount = faker.number.int({ min: 1, max: 3 });
  const imageIds = [];
  for (let j = 0; j < imageCount; j++) {
    try {
      const id = await uploadRandomImage();
      if (id) imageIds.push(id);
    } catch (e) {
      console.warn(`Image upload #${j + 1} failed:`, e.message);
    }
  }

  let headerImageId = null;
  try {
    headerImageId = await uploadRandomImage();
  } catch (e) {
    console.warn(`Header image upload failed:`, e.message);
  }

  // Generate Lexical content for post_body2
  const lexicalContent = generateLexicalContent(theme);
  
  // Decide if this post should have a book-flip component (30% chance)
  const shouldIncludeBookFlip = Math.random() > 0.7;
  
  // Generate rich_content dynamic zone
  const richContent = await generateRichContent(shouldIncludeBookFlip);

  const payload = {
    data: {
      post_title: title,
      post_description: faker.lorem.sentences(2),
      post_body2: lexicalContent,
      rich_content: richContent,
      // attach uploaded images by their IDs
      post_images: imageIds,
      post_header_image: headerImageId
    }
  };

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[${i}] HTTP ${res.status} Error:`, errorText);
      throw new Error(`Status ${res.status}: ${errorText}`);
    }
    const json = await res.json();
    console.log(`[${i}] Created post "${title}" (id=${json.data.id}) with ${imageIds.length} images, ${richContent.length} components${shouldIncludeBookFlip ? ', book-flip included' : ''}`);
  } catch (err) {
    console.error(`[${i}] Failed:`, err.message);
  }
}

(async () => {
  console.log(`Creating ${count} realistic placeholder posts with rich content...`);
  for (let i = 1; i <= count; i++) {
    // Spread out requests a bit
    await createPost(i);
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log('Done.');
})();
