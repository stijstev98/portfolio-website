import { mergeConfig } from "vite";
// import prismjs from "vite-plugin-prismjs"; // Temporarily commented out

export default (config) =>
  mergeConfig(config, {
    plugins: [
      // prismjs({
      //   languages: ["javascript", "typescript", "jsx", "tsx", "css", "html", "json", "markdown"], // More specific language list
      // }),
    ],
    define: {
      global: "globalThis",
    },
    // optimizeDeps: {
    //   include: ["prismjs"],
    // },
    // build: {
    //   commonjsOptions: {
    //     include: [/prismjs/],
    //   },
    // },
  });