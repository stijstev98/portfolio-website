require('dotenv').config();
const fetch = require('node-fetch');
const FormData = require('form-data');
const { faker } = require('@faker-js/faker');

const API_URL = 'http://127.0.0.1:1337/api/posts';
const UPLOAD_URL = 'http://127.0.0.1:1337/api/upload';
const count = parseInt(process.argv[2], 10) || 7; // Default to 7 projects (all portfolio projects)
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

// Real project data from Stijn's portfolio
const realProjects = [
  {
    title: 'Baltic Archiscapes',
    subtitle: 'Analog Photography Collection Book',
    description: 'Squeezed between the Russian Federation, the Republic of Belarus and the Russian exclave of Kaliningrad exists a curious cluster of three nations. Often mentioned in one breath – Estonia, Latvia and Lithuania make up the Baltic states.',
    fullDescription: `In early summer of 2023, I set off with a camera, a bag of film and a healthy dose of eagerness to capture the architecture and landscapes of the EU's only former Soviet territories. In 2024, I turned the collection into a physical look book filled with facts and research.

After completing my first photography book in early 2023, the desire to explore new places and continue my photographic journeys only grew stronger. By early summer, I set out for the Baltic states, driven by a vision to document Europe's only former Soviet nations. This project took on greater significance in the context of Russia's 2022 invasion of Ukraine, highlighting the region's unique history and geopolitical identity.

I aimed to build upon the foundation of my previous work by pushing myself further. I wanted this book to not only be longer but also crafted with higher-quality materials and with deeper research.

The result is a 116-page hardcover book, registered with an ISBN, containing over 100 photographs and stories that connect the images to the region's rich history and culture. It's a continuation of my journey to explore and document places with depth and perspective.

The book went into a first production run, in which 10 copies were produced. All works were captured on film in June of 2023.`,
    category: 'photography',
    hasBook: true,
    specs: '116-page hardcover book, registered with an ISBN, containing over 100 photographs',
    techniques: 'Analog photography on film, digital scanning and color correction',
    url: 'https://stijnstevens.be/works/baltic-archiscapes/'
  },
  {
    title: 'Sans Soucis Typeface',
    subtitle: 'Typeface Design | Personal Project',
    description: 'In the 21st century it is hard to express your own voice through written language. Unless if you are handwriting all your e-mails, thesis papers and Instagram DMs; our written communication is conveyed by a font designed by a typeface designer.',
    fullDescription: `While typeface designers are often grandmasters of their craft, it removes the personal element of communication. Written text doesn't carry my voice, nor does it carry the shapes and quirks of my personal handwriting.

As such, I decided to design my own typeface. A font that can carry my voice in the digital age. A typeface that embodies how I wish to communicate: compact, legible, no frills and suited for both online and offline media.

When I set out to develop "Sans Soucis", I had the intention of creating a highly legible typeface with a personality. The difficulty turned out being balancing "personality" and "legibility": improving on one usually meant deteriorating the other.

In the end, the push for legibility is the very thing that became its character: squat curves, large open counters and an increased x-height.

To assure good legibility, I printed sample texts at several stages in the design process. With a magnifying glass I was able to spot problem areas where glyphs had become hard to read or where kerning required more attention.

Sans Soucis is continuously a work in progress. However after almost 2 years I'm happy to say that with its 840 glyphs divided over 4 weights it is a typeface that I am more than happy to use in my personal communication. Including all body texts on this website.`,
    category: 'typography',
    hasBook: false,
    specs: '4 weights • 210+ glyphs • 840 total glyphs across all weights',
    techniques: 'Typeface design, kerning optimization, legibility testing through print proofs',
    url: 'https://stijnstevens.be/works/sans-soucis/'
  },
  {
    title: 'Delicious Ramen Branding',
    subtitle: 'Branding | Personal Project',
    description: 'After my visit to Japan and in the light of the 2020 Tokyo Olympics, I decided that there is a market for a new kind of eating establishment in Japan\'s capital: A restaurant that introduces tourists and expats to the mouthwatering gems of the Japanese cuisine.',
    fullDescription: `The restaurant serves a selection of ramen dishes, tempura and Japanese drinks. As an exercise I developed the branding for their first location.

The typography and color use is a stark difference to other Japanese graphic design which tends to be very busy and overloaded with information. For our target demographic, this won't fly.

As we're trying to reach foreigners visiting Japan, we'll stick to more Western graphic design principles while respecting the Japanese culinary tradition.

This project explores the intersection of cultural appreciation and accessible design, creating a brand identity that bridges Eastern cuisine with Western design sensibilities.`,
    category: 'branding',
    hasBook: false,
    specs: 'Complete brand identity system including logo, typography, and color palette',
    techniques: 'Brand strategy, logo design, typography selection, cultural design adaptation',
    url: 'https://stijnstevens.be/works/delicious-ramen/'
  },
  {
    title: 'Embrace Typeface',
    subtitle: 'Typeface Design | Personal Project',
    description: 'Embrace is a friendly typeface born out of a fruitful conversation with a friend. When we talked about typography we discovered that her ideal typeface didn\'t exist yet.',
    fullDescription: `What followed was 2 months of back and forth, getting closer and closer to the typeface of her desire.

At last, Embrace emerged. A typeface with playful curves that doesn't take itself too seriously, yet holds up in more serious applications.

Satisfied with the result, it became the display typeface of choice for my website.

Embrace currently consists of one weight and a total of 166 glyphs. These include all characters for the Dutch, English, French, German, Danish, Swedish and Norwegian languages.

As of now, Embrace supports ligatures and superscript notation.

The design process was collaborative and iterative, focusing on creating a typeface that feels warm and approachable while maintaining professional versatility.`,
    category: 'typography',
    hasBook: false,
    specs: '1 weight • 160+ glyphs • 7 languages • Ligatures & superscript support',
    techniques: 'Collaborative design process, multi-language character support, ligature development',
    url: 'https://stijnstevens.be/works/embrace/'
  },
  {
    title: 'Logo Animation for Billie Bonkers',
    subtitle: 'Motion Graphics | Client Work',
    description: 'A dynamic logo animation created for Billie Bonkers, a communication agency focused on meaningful projects and environmental communication.',
    fullDescription: `Billie Bonkers specializes in environmental communication, helping organizations navigate the complex emotions and reactions that come with changes in living environments. From street redesigns to new residential projects, their work touches on the human side of urban development.

For this project, I was tasked with creating a logo animation that would capture the essence of their approach to communication - one that embraces emotions and human connections in professional settings.

The animation needed to work across digital platforms while maintaining the agency's focus on meaningful, impactful communication. The design balances professionalism with the warmth and approachability that defines Billie Bonkers' brand identity.

This project showcases the intersection of motion graphics and brand identity, creating a dynamic visual element that enhances the client's digital presence.`,
    category: 'motion graphics',
    hasBook: false,
    specs: 'Animated logo sequence optimized for web and social media platforms',
    techniques: 'Motion graphics design, brand animation, digital optimization',
    url: 'https://stijnstevens.be/'
  },
  {
    title: 'DJ Digibot Skateboard Design',
    subtitle: 'Graphic Design | Product Design',
    description: 'A custom skateboard deck design featuring bold graphics and digital-inspired aesthetics for DJ Digibot, blending music culture with street art elements.',
    fullDescription: `This skateboard design project represents the intersection of music culture, street art, and graphic design. Created for DJ Digibot, the design captures the energy and digital aesthetic of electronic music culture.

The project involved understanding the unique requirements of skateboard graphics - designs that need to work both as functional art on the deck and as standalone visual pieces. The graphics needed to be bold enough to be visible during motion while maintaining artistic integrity.

Working within the constraints of skateboard deck dimensions and printing requirements, the design incorporates digital glitch effects, bold typography, and vibrant colors that reflect the electronic music scene.

This project demonstrates the application of graphic design principles to product design, creating functional art that resonates with both skate culture and electronic music communities.`,
    category: 'product design',
    hasBook: false,
    specs: 'Custom skateboard deck graphics, full-color digital print on maple deck',
    techniques: 'Product graphic design, digital illustration, print production',
    url: 'https://stijnstevens.be/'
  },
  {
    title: 'Japanese Convenience Store Illustration',
    subtitle: 'Digital Illustration | Cultural Study',
    description: 'A detailed digital illustration capturing the unique atmosphere and visual density of Japanese convenience stores, exploring the intersection of consumer culture and urban design.',
    fullDescription: `Japanese convenience stores, or "konbini," represent a fascinating microcosm of Japanese consumer culture and efficiency. This illustration project aimed to capture the overwhelming visual density and organized chaos that defines these spaces.

The project involved studying the unique layouts, signage systems, and product arrangements that make Japanese convenience stores so distinctively different from their Western counterparts. Every element from the bright fluorescent lighting to the carefully organized product displays tells a story about Japanese design philosophy and consumer behavior.

The illustration style balances realism with stylized elements, creating a visual narrative that foreign visitors can relate to while respecting the cultural significance of these spaces in Japanese daily life.

This project represents my ongoing interest in cultural documentation through design, using illustration as a tool to explore and share cross-cultural experiences in an accessible and engaging way.`,
    category: 'illustration',
    hasBook: false,
    specs: 'High-resolution digital illustration, detailed environmental design',
    techniques: 'Digital illustration, cultural research, environmental design',
    url: 'https://stijnstevens.be/'
  }
];

// Real images scraped from the portfolio website
const projectImages = {
  'Baltic Archiscapes': [
    'https://mlbbhsg9jsam.i.optimole.com/w:731/h:1080/q:mauto/f:best/ig:avif/https://stijnstevens.be/wp-content/uploads/2024/12/Baltic-15-kopie2.jpg',
    'https://stijnstevens.be/wp-content/uploads/2024/12/Baltic-15-kopie2.jpg' // Non-optimized version as fallback
  ],
  'Sans Soucis Typeface': [
    'https://mlbbhsg9jsam.i.optimole.com/w:auto/h:auto/q:mauto/f:best/ig:avif/https://stijnstevens.be/wp-content/uploads/2021/09/SHEET.png',
    'https://stijnstevens.be/wp-content/uploads/2021/09/SHEET.png' // Non-optimized version as fallback
  ],
  'Delicious Ramen Branding': [
    // No specific images found in the crawl, will use placeholders that fit the theme
    'https://picsum.photos/800/600?random=7', // Restaurant branding placeholder
    'https://picsum.photos/600/600?random=8'  // Logo design placeholder
  ],
  'Embrace Typeface': [
    // No specific images found in the crawl, will use placeholders that fit the theme
    'https://picsum.photos/800/600?random=10', // Typeface sample placeholder
    'https://picsum.photos/600/800?random=11'  // Character set placeholder
  ],
  'Logo Animation for Billie Bonkers': [
    'https://www.billiebonkers.be/uploads/images/social/_1200x630_crop_center-center_none/6630/BB-2560x1440-high-2_201110_084756.png', // Billie Bonkers brand image
    'https://picsum.photos/800/600?random=13' // Motion graphics placeholder
  ],
  'DJ Digibot Skateboard Design': [
    'https://picsum.photos/600/800?random=14', // Skateboard design placeholder (portrait for deck)
    'https://picsum.photos/800/600?random=15'  // Design process placeholder
  ],
  'Japanese Convenience Store Illustration': [
    'https://picsum.photos/800/600?random=16', // Convenience store illustration placeholder
    'https://picsum.photos/600/600?random=17'  // Detail illustration placeholder
  ]
};

// Video embed options for realistic content
const sampleVideoEmbeds = [
  { provider: 'youtube', provider_uid: 'dQw4w9WgXcQ', title: 'Typography Design Process' },
  { provider: 'vimeo', provider_uid: '148751763', title: 'Analog Photography Techniques' },
  { provider: 'youtube', provider_uid: 'JJ9c_qUNkhI', title: 'Brand Identity Development' },
  { provider: 'youtube', provider_uid: 'fJEqQjCb6gU', title: 'Photography in the Baltic States' }
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

// Download image from URL and upload to Strapi, return its media ID
async function uploadImageFromUrl(imageUrl, filename) {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
    
    const buf = await imgRes.buffer();
    const form = new FormData();
    form.append('files', buf, {
      filename: filename || `project-image-${Date.now()}.jpg`,
      contentType: imgRes.headers.get('content-type') || 'image/jpeg',
    });
    
    const headers = form.getHeaders();
    if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
    
    const res = await fetch(UPLOAD_URL, { method: 'POST', headers, body: form });
    if (res.status === 403) {
      console.warn('Upload forbidden (403). Falling back to placeholder image.');
      return await uploadRandomImage();
    }
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    
    const uploaded = await res.json();
    return uploaded[0]?.id;
  } catch (e) {
    console.warn(`Failed to upload image from URL: ${e.message}. Using placeholder.`);
    return await uploadRandomImage();
  }
}

// Generate rich_content dynamic zone components
async function generateRichContent(project) {
  const components = [];
  
  // Start with the main project description
  components.push({
    __component: 'shared.rich-text',
    body: `# ${project.subtitle}\n\n${project.fullDescription.split('\n\n')[0]}`
  });
  
  // Add detailed content sections
  const sections = project.fullDescription.split('\n\n').slice(1);
  sections.forEach(section => {
    if (section.trim()) {
      components.push({
        __component: 'shared.rich-text',
        body: section.trim()
      });
    }
  });
  
  // Maybe add a video embed based on project category
  if (Math.random() > 0.6) {
    const relevantVideos = sampleVideoEmbeds.filter(video => 
      video.title.toLowerCase().includes(project.category) || 
      video.title.toLowerCase().includes(project.title.toLowerCase().split(' ')[0])
    );
    if (relevantVideos.length > 0) {
      const video = faker.helpers.arrayElement(relevantVideos);
      components.push({
        __component: 'shared.video-embed',
        provider: video.provider,
        provider_uid: video.provider_uid,
        title: video.title,
        caption: `Learn more about the ${project.category} process behind ${project.title}`
      });
    }
  }
  
  // Maybe add a media component using project-specific images
  if (Math.random() > 0.5) {
    try {
      const projectImageUrls = projectImages[project.title] || [];
      let mediaId = null;
      
      if (projectImageUrls.length > 0) {
        // Use a random project-specific image
        const randomImageUrl = faker.helpers.arrayElement(projectImageUrls);
        const filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-content.jpg`;
        mediaId = await uploadImageFromUrl(randomImageUrl, filename);
      } else {
        // Fallback to random image
        mediaId = await uploadRandomImage();
      }
      
      if (mediaId) {
        components.push({
          __component: 'shared.media',
          file: mediaId,
          caption: `Visual example from the ${project.title} project`
        });
      }
    } catch (e) {
      console.warn('Failed to add media component:', e.message);
    }
  }
  
  // Add book-flip component for projects that have books
  if (project.hasBook) {
    try {
      const pdfId = await createSamplePDF();
      if (pdfId) {
        components.push({
          __component: 'shared.book-flip',
          title: `${project.title} - Complete Collection`,
          pdf_file: pdfId
        });
      }
    } catch (e) {
      console.warn('Failed to add book-flip component:', e.message);
    }
  }
  
  // Add project specifications as rich text
  if (project.specs) {
    components.push({
      __component: 'shared.rich-text',
      body: `## Project Specifications\n\n**Technical Details:** ${project.specs}\n\n**Techniques Used:** ${project.techniques}`
    });
  }
  
  return components;
}

async function createPost(i) {
  // Use projects in order, then repeat if needed
  const projectIndex = (i - 1) % realProjects.length;
  const project = realProjects[projectIndex];
  
  // Create variations of the title to make each post unique
  const titleVariations = [
    project.title,
    `${project.title} - ${project.subtitle}`,
    `Case Study: ${project.title}`,
    `Behind the Scenes: ${project.title}`,
    `The Making of ${project.title}`
  ];
  
  // Add timestamp to ensure absolute uniqueness if running multiple times
  const title = `${faker.helpers.arrayElement(titleVariations)} (${i}-${Date.now().toString().slice(-4)})`;
  
  // Upload project-specific images
  const projectImageUrls = projectImages[project.title] || [];
  const imageIds = [];
  
  for (let j = 0; j < projectImageUrls.length; j++) {
    try {
      const imageUrl = projectImageUrls[j];
      const filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-${j + 1}.jpg`;
      const id = await uploadImageFromUrl(imageUrl, filename);
      if (id) imageIds.push(id);
    } catch (e) {
      console.warn(`Project image upload #${j + 1} failed:`, e.message);
      // Fallback to random image
      try {
        const fallbackId = await uploadRandomImage();
        if (fallbackId) imageIds.push(fallbackId);
      } catch (fallbackError) {
        console.warn(`Fallback image upload failed:`, fallbackError.message);
      }
    }
  }

  // Upload header image (project-specific or random)
  let headerImageId = null;
  try {
    if (projectImageUrls.length > 0) {
      // Use the first project image as header
      const headerFilename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-header.jpg`;
      headerImageId = await uploadImageFromUrl(projectImageUrls[0], headerFilename);
    } else {
      headerImageId = await uploadRandomImage();
    }
  } catch (e) {
    console.warn(`Header image upload failed:`, e.message);
  }
  
  // Generate rich_content dynamic zone using project data
  const richContent = await generateRichContent(project);

  const payload = {
    data: {
      post_title: title,
      post_description: project.description,
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
    console.log(`[${i}] Created post "${title}" (id=${json.data.id}) with ${imageIds.length} images, ${richContent.length} components${project.hasBook ? ', book-flip included' : ''} - Project: ${project.title}`);
  } catch (err) {
    console.error(`[${i}] Failed:`, err.message);
  }
}

(async () => {
  console.log(`Creating ${count} posts based on real portfolio projects...`);
  for (let i = 1; i <= count; i++) {
    // Spread out requests a bit
    await createPost(i);
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log('Done.');
})();
