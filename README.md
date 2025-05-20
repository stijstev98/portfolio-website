## About This Project

This project is a modern, production-ready website and CMS solution built with Eleventy (11ty) for static site generation and Strapi for headless content management. It is ideal for personal portfolios, blogs, or content-driven sites, and comes with a clean structure, SEO best practices, and easy customization. The stack includes Tailwind CSS, Webpack, PostCSS, and more for a fast and flexible developer experience.

---

## Getting Started

Follow these steps to set up the project on your local machine:

### 1. Clone the Repository

```sh
git clone https://github.com/stijstev98/portfolio-website.git
cd portfolio-website
```

### 2. Install Dependencies

Install all required dependencies for both the Eleventy frontend and the Strapi backend:

```sh
npm install
cd strapi-cms
npm install
cd ..
```

### 3. Start the Strapi CMS Server

The Strapi backend manages your content. To start the Strapi server:

```sh
cd strapi-cms
npm run develop
```

This will launch Strapi in development mode. The admin panel is usually available at [http://localhost:1337/admin](http://localhost:1337/admin).

### 4. Start the Eleventy Development Server

In a new terminal, from the project root:

```sh
npm run dev
```

This will start the Eleventy dev server, typically available at [http://localhost:8080](http://localhost:8080).

---

## Project Structure

```
.
├── public/             # Static files (images, favicons, etc.)
├── scripts/            # Utility and setup scripts
├── src/                # Eleventy source files
│   ├── _data/          # Eleventy data folder
│   ├── _includes/      # HTML/EJS layout and component files
│   ├── assets/         # Images, JS, and CSS (processed by Webpack)
│   └── posts/          # Blog posts
├── strapi-cms/         # Strapi CMS backend
│   ├── config/         # Strapi configuration
│   ├── src/            # Strapi source (APIs, extensions)
│   └── public/uploads/ # Media uploads (gitignored)
├── package.json        # Project metadata and scripts
└── README.md           # Project documentation
```

---

## Useful Commands

### Eleventy (11ty)
- `npm run dev` – Start Eleventy in development mode with live reload
- `npm run build` – Build the static site for production
- `npm run serve` – Preview the production build locally

### Strapi CMS
- `cd strapi-cms && npm run develop` – Start Strapi in development mode
- `cd strapi-cms && npm run build` – Build Strapi for production

---

## Notes
- Make sure Node.js and npm are installed on your system.
- The `strapi-cms/public/uploads` directory is gitignored to avoid committing media files.
- Configure your environment variables as needed in `.env` files for both Eleventy and Strapi.
