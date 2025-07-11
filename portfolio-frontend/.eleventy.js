const htmlmin = require('html-minifier');
const dateFns = require('date-fns');
const lazyImagesPlugin = require('eleventy-plugin-lazyimages');
const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');
const renderRichText = require('./src/_data/utils/renderRichText');
const { CACHE_DIR } = require('./src/_data/utils/pdfProcessor');

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  // Copy assets
  eleventyConfig.addPassthroughCopy('src/assets/images');
  eleventyConfig.addPassthroughCopy('src/assets/js');
  eleventyConfig.addPassthroughCopy('src/assets/styles');

  // Copy uploads from Strapi to serve media files locally
  eleventyConfig.addPassthroughCopy({ 'public/uploads': 'uploads' });

  // Serve PDF cache directory
  eleventyConfig.addPassthroughCopy({
    [CACHE_DIR]: "pdf-cache"
  });

  // Add helper filter for rendering Strapi Rich Text content (can be kept for other template languages)
  eleventyConfig.addFilter('renderRichText', renderRichText);

  // Add JavaScript function to be available in templates
  eleventyConfig.addJavaScriptFunction('renderRichText', renderRichText);

  eleventyConfig.addPlugin(lazyImagesPlugin, {
    transformImgPath: (imgPath) => {
      if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        // Handle remote file
        return imgPath;
      } else {
        return `./src/${imgPath}`;
      }
    },
  });

  eleventyConfig.setEjsOptions({
    rmWhitespace: true,
    context: {
      dateFns,
      renderRichText,
    },
  });

  eleventyConfig.setBrowserSyncConfig({
    files: './_site/assets/styles/main.css',
  });

  eleventyConfig.addTransform('htmlmin', (content, outputPath) => {
    if (outputPath.endsWith('.html')) {
      const minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyJS: true,
      });
      return minified;
    }

    return content;
  });

  return {
    dir: { input: 'src', output: '_site', data: '_data' },
  };
};
