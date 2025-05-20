# Project Scraper for Strapi

This script scrapes projects from the stijnstevens.be website and imports them as posts in your Strapi CMS.

## Prerequisites

1. Make sure your Strapi server is running at http://127.0.0.1:1337
2. Set up your Strapi API token in the .env file:
   ```
   STRAPI_TOKEN=your_token_here
   ```

## Running the Script

1. Install the required dependencies:
   ```
   npm install node-fetch@2 form-data cheerio dotenv
   ```
   
   Note: We use node-fetch v2 because it's compatible with CommonJS imports.

2. Run the script:

   **Basic usage (import all projects):**
   ```
   node scripts/scrape-projects.js
   ```

   **Test mode (don't actually create posts):**
   ```
   node scripts/scrape-projects.js --dry-run
   ```

   **Limit the number of projects:**
   ```
   node scripts/scrape-projects.js --limit=3
   ```

   **Import a specific project only:**
   ```
   node scripts/scrape-projects.js --project=embrace
   ```
   or with a full URL:
   ```
   node scripts/scrape-projects.js --project=https://stijnstevens.be/works/baltic-archiscapes
   ```

   **Combine options:**
   ```
   node scripts/scrape-projects.js --dry-run --limit=2
   ```

## What the Script Does

1. Fetches the main page of stijnstevens.be
2. Finds all project links
3. For each project:
   - Parses the title, description, and content
   - Downloads and uploads images to Strapi
   - Creates a post with the project data in your Strapi CMS

## Features

- Handles Optimole image URLs to get original image sources
- Extracts project content including paragraphs, images, and descriptions
- Supports various ways to detect project elements on different website layouts
- Handles lazy-loaded images and background images in divs
- Prevents duplicate image uploads
- Skips social media links

## Troubleshooting

- Make sure your Strapi server is running
- Check if your Strapi token has the proper permissions
- If no projects are found, the script will try alternate methods to find them
- If image uploads fail, make sure your Strapi media library permissions are set correctly
- You may need to adjust the selectors in the script if the website structure changes
