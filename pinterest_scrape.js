/**
 * Etsy Image URL Scraper for Pinterest
 *
 * Usage: node pinterest_scrape.js
 *
 * Connects to your browser via CDP and scrapes the main product image
 * from each Etsy listing's public page. Saves results to listings_with_images.json.
 *
 * Prerequisites: Browser running with --remote-debugging-port (set DEBUG_PORT in .env)
 */

require('dotenv/config');
const { chromium } = require('playwright');
const fs = require('fs');

const DEBUG_PORT = parseInt(process.env.DEBUG_PORT || '9334');
const OUTPUT_FILE = 'listings_with_images.json';

async function loadListings() {
  const listings = [];

  if (fs.existsSync('listings_raw.json')) {
    const raw = JSON.parse(fs.readFileSync('listings_raw.json', 'utf8'));
    raw.forEach(l => listings.push(l));
  }

  // Also merge optimized titles/descriptions if available
  if (fs.existsSync('listings_optimized.json')) {
    const optimized = JSON.parse(fs.readFileSync('listings_optimized.json', 'utf8'));
    for (const opt of optimized) {
      const existing = listings.find(l => l.id === opt.id);
      if (existing) {
        existing.optimizedTitle = opt.title;
        existing.optimizedDescription = opt.description;
      } else {
        listings.push(opt);
      }
    }
  }

  return listings;
}

async function loadProgress() {
  if (fs.existsSync(OUTPUT_FILE)) {
    return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
  }
  return [];
}

function saveProgress(data) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
}

(async () => {
  console.log('Etsy Image Scraper for Pinterest\n');

  const listings = await loadListings();
  console.log(`Loaded ${listings.length} listings total`);

  const scraped = await loadProgress();
  const scrapedIds = new Set(scraped.map(s => s.id));
  const toScrape = listings.filter(l => !scrapedIds.has(l.id));

  if (toScrape.length === 0) {
    console.log('All listings already scraped! Delete ' + OUTPUT_FILE + ' to re-scrape.');
    return;
  }

  console.log(`Already scraped: ${scraped.length}, remaining: ${toScrape.length}\n`);

  // Connect to browser
  let browser;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);
      console.log('Connected to browser\n');
      break;
    } catch (e) {
      console.log(`Connecting... (${attempt + 1}/10)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!browser) {
    console.error('Could not connect. Make sure browser is running with --remote-debugging-port=' + DEBUG_PORT);
    process.exit(1);
  }

  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  for (let i = 0; i < toScrape.length; i++) {
    const listing = toScrape[i];
    const listingUrl = `https://www.etsy.com/listing/${listing.id}`;

    console.log(`[${scraped.length + 1}/${listings.length}] Scraping: ${listing.id} - ${(listing.title || '').substring(0, 50)}...`);

    try {
      await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);

      // Extract the main product image URL
      const imageUrl = await page.evaluate(() => {
        const selectors = [
          'ul[data-carousel] li:first-child img',
          '[data-carousel-pane] img',
          'div[data-appears-component-name="listing_page_image_carousel"] img',
          '.image-carousel-container img',
          'img[data-listing-card-image]',
        ];

        for (const sel of selectors) {
          const img = document.querySelector(sel);
          if (img && img.src && !img.src.includes('placeholder')) {
            let src = img.src;
            src = src.replace(/il_\d+x\w+/, 'il_fullxfull');
            return src;
          }
        }

        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
          let src = ogImage.content;
          src = src.replace(/il_\d+x\w+/, 'il_fullxfull');
          return src;
        }

        const allImages = document.querySelectorAll('img');
        for (const img of allImages) {
          if (img.src && img.src.includes('etsystatic.com') && img.naturalWidth > 200) {
            let src = img.src;
            src = src.replace(/il_\d+x\w+/, 'il_fullxfull');
            return src;
          }
        }

        return null;
      });

      const canonicalUrl = await page.evaluate(() => {
        const link = document.querySelector('link[rel="canonical"]');
        return link ? link.href : null;
      });

      scraped.push({
        id: listing.id,
        title: listing.optimizedTitle || listing.title,
        description: listing.optimizedDescription || listing.description,
        imageUrl: imageUrl,
        listingUrl: canonicalUrl || listingUrl,
        editUrl: listing.editUrl,
        scrapedAt: new Date().toISOString(),
      });

      if (!imageUrl) {
        console.log('  WARNING: No image found for this listing');
      } else {
        console.log('  Image: ' + imageUrl.substring(0, 80) + '...');
      }

      saveProgress(scraped);
      await page.waitForTimeout(1500);

    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      scraped.push({
        id: listing.id,
        title: listing.optimizedTitle || listing.title,
        description: listing.optimizedDescription || listing.description,
        imageUrl: null,
        listingUrl: `https://www.etsy.com/listing/${listing.id}`,
        editUrl: listing.editUrl,
        error: err.message,
        scrapedAt: new Date().toISOString(),
      });
      saveProgress(scraped);
    }
  }

  const withImages = scraped.filter(s => s.imageUrl);
  const withoutImages = scraped.filter(s => !s.imageUrl);

  console.log(`\nDone! ${withImages.length}/${scraped.length} listings have images.`);
  if (withoutImages.length > 0) {
    console.log(`Missing images for: ${withoutImages.map(s => s.id).join(', ')}`);
  }
  console.log('Saved to ' + OUTPUT_FILE);
  console.log('\nNext step: node pin.js  (or node pinterest_post.js for API method)');
})();
