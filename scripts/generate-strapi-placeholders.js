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

async function createPost(i) {
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

  const payload = {
    data: {
      post_title: faker.lorem.sentence(),
      post_description: faker.lorem.sentences(2),
      post_body: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: faker.lorem.paragraphs(2) }
          ]
        }
      ],
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
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    console.log(`[${i}] Created post id=${json.data.id} with ${imageIds.length} images`);
  } catch (err) {
    console.error(`[${i}] Failed:`, err.message);
  }
}

(async () => {
  console.log(`Creating ${count} placeholder posts...`);
  for (let i = 1; i <= count; i++) {
    // Spread out requests a bit
    await createPost(i);
  }
  console.log('Done.');
})();
