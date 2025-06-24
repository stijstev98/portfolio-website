const fetch = require('node-fetch');

const STRAPI_BASE_URL_LOCALHOST = 'http://localhost:1337';
const STRAPI_BASE_URL_127 = 'http://127.0.0.1:1337';

// IMPORTANT: If your Strapi API requires an authentication token for the public role,
// please replace 'YOUR_API_TOKEN_HERE' with your actual token.
// If your public API is open, you can leave this as null.
const API_TOKEN = null; // Example: 'YOUR_API_TOKEN_HERE';

const headers = {
  'Content-Type': 'application/json',
};
if (API_TOKEN) {
  headers['Authorization'] = `Bearer ${API_TOKEN}`;
}

const testCases = [
  { name: "Basic fetch (no populate)", path: "/api/posts" },
  { name: "Populate all (*)", path: "/api/posts?populate=*" },
  { name: "Populate rich_content (shallow, just the field itself)", path: "/api/posts?populate[rich_content]=*" },
  { name: "Populate rich_content and its components (deep)", path: "/api/posts?populate[rich_content][populate]=*" },
  { name: "Populate all (*) - including drafts", path: "/api/posts?publicationState=preview&populate=*" },
  { name: "Populate rich_content (deep) - including drafts", path: "/api/posts?publicationState=preview&populate[rich_content][populate]=*" },
  // You can add a test for a specific post ID if you have one that's problematic:
  // { name: "Specific Post ID 1 (example) - Populate rich_content (deep)", path: "/api/posts/1?populate[rich_content][populate]=*" }
];

async function runTest(baseUrl, testCase) {
  const url = `${baseUrl}${testCase.path}`;
  console.log(`\n--- Testing: ${testCase.name} ---`);
  console.log(`URL: ${url}`);

  try {
    const response = await fetch(url, { headers, timeout: 7000 }); // Added timeout
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`Error fetching: ${response.statusText}`);
      try {
        const errorBody = await response.json();
        console.error("Error details:", JSON.stringify(errorBody, null, 2));
      } catch (e) {
        // ignore if error body is not json or empty
        const textError = await response.text();
        console.error("Error details (text):", textError);
      }
      return false; // Indicate failure for this base URL
    }

    const responseData = await response.json();

    if (responseData.data) {
      if (Array.isArray(responseData.data)) {
        console.log(`Found ${responseData.data.length} posts.`);
        const postsToInspect = responseData.data.slice(0, 3); // Inspect first 3 posts, or fewer if less than 3
        
        if (postsToInspect.length === 0 && responseData.data.length > 0) {
            console.log("   (No posts to inspect based on slice, but posts were found)");
        } else if (postsToInspect.length === 0 && responseData.data.length === 0) {
            console.log("   (No posts found in the response data array)");
        }

        postsToInspect.forEach((post, index) => {
          console.log(`\n  Post ${index + 1} (ID: ${post.id}):`);
          console.log(`    Title: ${post.attributes?.post_title}`);
          console.log(`    Published At: ${post.attributes?.publishedAt} (null means draft)`);
          
          // DEBUG: Let's see what attributes are actually available
          console.log(`    Available attributes: ${Object.keys(post.attributes || {}).join(', ')}`);
          console.log(`    Raw post structure (first 500 chars): ${JSON.stringify(post, null, 2).substring(0, 500)}...`);
          
          if (post.attributes?.rich_content) {
            if (Array.isArray(post.attributes.rich_content)) {
              console.log(`    rich_content: Array with ${post.attributes.rich_content.length} components`);
              post.attributes.rich_content.forEach((component, cIndex) => {
                console.log(`      Component ${cIndex + 1}: ${component.__component}`);
                // You can log more component details if needed:
                // console.log(\`        Details: ${JSON.stringify(component, null, 2)}\`);
              });
            } else {
              console.log(`    rich_content: Exists, but not an array (Type: ${typeof post.attributes.rich_content})`);
              console.log(`      Value: ${JSON.stringify(post.attributes.rich_content)}`);
            }
          } else {
            console.log(`    rich_content: Not found, null, or empty in attributes.`);
          }
        });
      } else { // Handle single entry response (e.g., /api/posts/1)
        const post = responseData.data;
        console.log(`Found single post (ID: ${post.id}):`);
        console.log(`  Title: ${post.attributes?.post_title}`);
        console.log(`  Published At: ${post.attributes?.publishedAt} (null means draft)`);
        if (post.attributes?.rich_content) {
          if (Array.isArray(post.attributes.rich_content)) {
            console.log(`  rich_content: Array with ${post.attributes.rich_content.length} components`);
            post.attributes.rich_content.forEach((component, cIndex) => {
              console.log(`    Component ${cIndex + 1}: ${component.__component}`);
            });
          } else {
            console.log(`  rich_content: Exists, but not an array (Type: ${typeof post.attributes.rich_content})`);
            console.log(`    Value: ${JSON.stringify(post.attributes.rich_content)}`);
          }
        } else {
          console.log(`  rich_content: Not found, null, or empty in attributes.`);
        }
      }
    } else {
      console.log("Response data.data is missing or not in the expected format.");
      console.log("Full response structure:", JSON.stringify(responseData, null, 2));
    }
    return true; // Indicate success for this base URL
  } catch (error) {
    console.error(`Error during fetch for ${url}:`, error.message);
    if (error.cause) console.error("Cause:", error.cause);
    return false; // Indicate failure for this base URL
  }
}

async function main() {
  console.log("Starting Strapi fetch debugger script...");
  console.log("IMPORTANT: If your Strapi API requires an authentication token for the public role,");
  console.log("please edit this script and set the 'API_TOKEN' variable.");
  console.log("---------------------------------------------------\n");

  let strapiAvailableLocalhost = false;
  let strapiAvailable127 = false;

  // Quick check if Strapi is available at either URL
  try {
    await fetch(STRAPI_BASE_URL_LOCALHOST + '/api/posts?pagination[limit]=1', { headers, timeout: 3000 });
    strapiAvailableLocalhost = true;
    console.log(`Strapi seems available at ${STRAPI_BASE_URL_LOCALHOST}`);
  } catch (e) {
    console.log(`Strapi does not seem available at ${STRAPI_BASE_URL_LOCALHOST}. Trying ${STRAPI_BASE_URL_127}...`);
    try {
        await fetch(STRAPI_BASE_URL_127 + '/api/posts?pagination[limit]=1', { headers, timeout: 3000 });
        strapiAvailable127 = true;
        console.log(`Strapi seems available at ${STRAPI_BASE_URL_127}`);
    } catch (e2) {
        console.log(`Strapi does not seem available at ${STRAPI_BASE_URL_127} either.`);
        console.log("Please ensure your Strapi server is running and accessible.");
        return;
    }
  }

  const baseUrlToUse = strapiAvailableLocalhost ? STRAPI_BASE_URL_LOCALHOST : STRAPI_BASE_URL_127;

  for (const testCase of testCases) {
    await runTest(baseUrlToUse, testCase);
  }

  console.log("\n--- Debugging Script Finished ---");
  console.log("Review the output above. Key things to look for:");
  console.log("1. HTTP Status Codes: Should generally be 200 OK. Errors (401/403 Forbidden, 404 Not Found, 500 Server Error) indicate problems.");
  console.log("2. 'Found X posts': Does the number of posts match your expectations for each query?");
  console.log("3. 'Published At': If 'null' for a post you expect to see, it's a draft. Queries with 'publicationState=preview' should fetch these.");
  console.log("4. 'rich_content' details:");
  console.log("   - 'Not found, null, or empty...': The field isn't being returned or is empty.");
  console.log("   - 'Array with X components': This is ideal. Check if X > 0 for relevant posts.");
  console.log("   - 'Component Y: shared.component-name': Confirms components within the dynamic zone are being populated by type.");
  console.log("\nIf 'rich_content' is consistently missing or empty for PUBLISHED posts where you expect data, and you've confirmed:");
  console.log("  - The Public role has full read permissions for 'Post' content type, the 'rich_content' field, AND all 'shared.*' components in Strapi Admin.");
  console.log("  - The specific post entries in Strapi Admin *definitely* have components added to their 'rich_content' field and are *published*.");
  console.log("Then the issue might be more subtle (e.g., a Strapi-specific configuration or a very specific data-related edge case).");
  console.log("Consider also checking your Strapi server logs for any errors when these API calls are made.");
}

main();