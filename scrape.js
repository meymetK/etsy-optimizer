require('dotenv/config');
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync, exec } = require('child_process');

(async () => {
  console.log('\nEtsy Listing Scraper\n');

  const BROWSER_EXE = process.env.BROWSER_EXE;
  const USER_DATA = process.env.BROWSER_USER_DATA;
  const DEBUG_PORT = parseInt(process.env.DEBUG_PORT || '9333');

  if (!BROWSER_EXE || !USER_DATA) {
    console.error('Set BROWSER_EXE and BROWSER_USER_DATA in .env');
    process.exit(1);
  }

  // Kill existing browser process and restart in debug mode
  console.log('Restarting browser in debug mode...');
  try {
    execSync('taskkill /F /IM opera.exe /T', { stdio: 'ignore' });
  } catch (e) {}
  await new Promise(r => setTimeout(r, 2000));

  exec(`"${BROWSER_EXE}" --remote-debugging-port=${DEBUG_PORT} --user-data-dir="${USER_DATA}" --no-first-run --start-maximized`);

  console.log('Waiting for browser...');
  await new Promise(r => setTimeout(r, 4000));

  // Connect via CDP
  let browser;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);
      console.log('Connected to browser!\n');
      break;
    } catch (e) {
      console.log(`Connecting... (${attempt + 1}/10)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!browser) {
    console.log('Could not connect to browser. Try again.');
    process.exit(1);
  }

  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  // Navigate to Etsy listings page
  console.log('Navigating to Etsy listings...');
  await page.goto('https://www.etsy.com/your/shops/me/tools/listings', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(3000);

  // Wait for login if needed
  let url = page.url();
  if (url.includes('signin') || url.includes('login')) {
    console.log('\n=== Please log in to Etsy in the browser window ===\n');

    for (let t = 0; t < 120; t++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        url = page.url();
        if (!url.includes('signin') && !url.includes('login')) {
          console.log('Login successful!\n');
          break;
        }
      } catch (e) { break; }
    }
  } else {
    console.log('Already logged in to Etsy!\n');
  }

  await page.waitForTimeout(2000);

  // Collect all listing URLs
  console.log('Scanning listings...');
  let allListingUrls = [];
  let pageNum = 1;

  while (true) {
    try {
      const pageUrl = `https://www.etsy.com/your/shops/me/tools/listings?page=${pageNum}&sort_order=asc`;
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      const urls = await page.evaluate(() => {
        const links = new Set();
        document.querySelectorAll('a[href]').forEach(a => {
          if (/\/your\/shops\/[^/]+\/tools\/listings\/\d+/.test(a.href)) {
            links.add(a.href.split('?')[0]);
          }
        });
        const scripts = document.querySelectorAll('script');
        scripts.forEach(s => {
          const matches = (s.textContent || '').matchAll(/"listing_id"\s*:\s*(\d+)/g);
          for (const m of matches) {
            links.add(`https://www.etsy.com/your/shops/me/tools/listings/${m[1]}`);
          }
        });
        return [...links];
      });

      const newUrls = urls.filter(u => !allListingUrls.includes(u));
      if (newUrls.length === 0) break;

      allListingUrls.push(...newUrls);
      console.log(`  Page ${pageNum}: ${newUrls.length} listings found`);
      pageNum++;
    } catch (e) {
      console.log(`  Page ${pageNum} error: ${e.message}`);
      break;
    }
  }

  console.log(`\nTotal ${allListingUrls.length} listings found!\n`);

  if (allListingUrls.length === 0) {
    console.log('No listings found. Are you logged in to Etsy?');
    process.exit(1);
  }

  const listings = [];

  for (let i = 0; i < allListingUrls.length; i++) {
    const url = allListingUrls[i];
    const listingId = url.match(/(\d+)\/?$/)?.[1];

    console.log(`[${i + 1}/${allListingUrls.length}] Scraping ID: ${listingId}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2500);

      const data = await page.evaluate(() => {
        // TITLE
        let title = '';
        for (const sel of ['input[name="title"]', 'input[id*="title"]', 'textarea[name="title"]']) {
          const el = document.querySelector(sel);
          if (el?.value) { title = el.value; break; }
        }

        // DESCRIPTION
        let description = '';
        for (const sel of ['textarea[name="description"]', 'textarea[id*="description"]', 'div[contenteditable="true"]']) {
          const el = document.querySelector(sel);
          if (el) { description = el.value || el.innerText || ''; if (description) break; }
        }

        // PRICE
        const priceEl = document.querySelector('input[name="price"],input[id*="price"]');
        const price = priceEl?.value || '';

        // TAGS
        const tags = [];
        document.querySelectorAll('[class*="tag"],[class*="Tag"]').forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 1 && text.length < 45 && !/\n/.test(text)) {
            if (!el.querySelector('[class*="tag"],[class*="Tag"]')) {
              if (!text.toLowerCase().includes('add') && !text.toLowerCase().startsWith('tag')) {
                tags.push(text);
              }
            }
          }
        });

        const html = document.documentElement.innerHTML;
        const tagMatch = html.match(/"tags"\s*:\s*(\[[^\]]+\])/);
        let jsonTags = [];
        if (tagMatch) {
          try { jsonTags = JSON.parse(tagMatch[1]); } catch (e) {}
        }

        const allTags = [...new Set([...tags, ...jsonTags].filter(t => t && t.length > 1 && t.length < 45))];

        const titleMatch = html.match(/"title"\s*:\s*"([^"]{5,})"/);
        if (!title && titleMatch) title = titleMatch[1];

        const descMatch = html.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (!description && descMatch) {
          description = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }

        return { title, description: description.trim(), price, tags: allTags };
      });

      data.id = listingId;
      data.editUrl = url;
      listings.push(data);

      console.log(`  Title: ${data.title?.substring(0, 65) || 'N/A'}`);
      console.log(`  Tags : ${data.tags?.length || 0}${data.tags?.length ? ' -> ' + data.tags.slice(0, 3).join(', ') : ''}`);
      console.log(`  Price: $${data.price || '?'}`);

    } catch (err) {
      console.log(`  Error: ${err.message}`);
      listings.push({ id: listingId, editUrl: url, error: err.message });
    }
  }

  // Save
  const outputPath = './listings_raw.json';
  fs.writeFileSync(outputPath, JSON.stringify(listings, null, 2), 'utf8');

  console.log('\n=========================================');
  console.log('ALL LISTINGS SCRAPED!');
  console.log(`Saved to ${outputPath}`);
  console.log('=========================================');
  listings.forEach((l, i) => {
    const s = l.error ? 'ERR' : 'OK ';
    console.log(`  ${s} ${i + 1}. ${l.title?.substring(0, 70) || 'ERROR: ' + l.error}`);
  });

  await browser.close();
  console.log('\nDone! Next step: node optimize.js\n');
})();
