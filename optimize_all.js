const fs = require('fs');

const listings = JSON.parse(fs.readFileSync('./listings_raw.json', 'utf8'));

// ─────────────────────────────────────────────
// FIXED SECTIONS (same for every listing)
// Customize these for your product type
// ─────────────────────────────────────────────

const AVAILABLE_STYLES = `

AVAILABLE STYLES

T-SHIRT — Gildan 64000 Softstyle
• 4.2 oz, 100% ringspun cotton — lightweight, breathable, buttery soft
• Double-needle stitching throughout, seamless collar, heat-transfer neck label
• Semi-relaxed fit — great for tucking or wearing loose

SWEATSHIRT — Gildan 18000 Heavy Blend Crewneck
• 8.0 oz, 50% cotton / 50% polyester — warm but not bulky
• Air-jet yarn for a softer, pill-resistant finish
• Reinforced stitching at shoulders and armholes
• 1x1 rib knit collar, cuffs, and waistband with spandex for shape retention
• Tearaway label for comfort — no scratchy tags`;

const SIZING = `

SIZING
Both styles run true to size. For the oversized look shown in the listing photos, we recommend sizing up 1-2 sizes. Not sure which size to grab? Message us your height and usual size — we'll help you pick the right fit for either style.`;

const COLORS = `

COLORS
Listing photos show digital mock-ups. Slight color variations may occur between screens and the final print — but we've made sure the design pops on every colorway.`;

const HOW_TO_ORDER = `

HOW TO ORDER
Select your style (tee or sweatshirt) → Pick your color → Choose your size → Add to cart → Done.
Back print designs available for an additional charge — add that option before checkout.
Want to personalize? Message us first to confirm availability before purchasing.`;

const SHIPPING = `

SHIPPING & HANDLING
Orders ship within 1-3 business days.
Address changes must be requested before the item ships.`;

// ─────────────────────────────────────────────
// PRODUCT-SPECIFIC DESCRIPTION GENERATOR
// Add your own categories and intros here
// ─────────────────────────────────────────────

function generateDescription(title, tags) {
  const t = (title || '').toLowerCase();
  const specific = (title || '').split(',')[0].trim();

  let intro = '';

  // ── EXAMPLE: MOM / MAMA ──
  if (t.includes('mama') || (t.includes('mom') && !t.includes('common'))) {
    intro = `The mom shirt that actually looks good — ${specific}.

This isn't another generic "#momlife" tee. It's a well-designed piece that says what you're thinking with style and a little bit of humor. Throw it on with jeans and sneakers and you've got an outfit that works for school drop-off, errands, and the occasional night out.

Available as a lightweight tee or a cozy crewneck sweatshirt. Soft fabric, great fit, and a print that doesn't crack or peel.

Perfect gift for Mother's Day, birthdays, or just because she deserves it.`;
  }

  // ── EXAMPLE: TEACHER ──
  else if (t.includes('teacher') || t.includes('tiny humans')) {
    intro = `The teacher shirt that's cute enough for spirit week and comfortable enough for recess duty — ${specific}.

Whether it's Teacher Appreciation Week, back to school, or just a regular Tuesday, this piece makes getting dressed one less thing to stress about.

Available as a soft tee or a crewneck sweatshirt. The print is high-quality — no cracking, no peeling.

Makes a great end-of-year gift, new teacher present, or a treat-yourself purchase.`;
  }

  // ── EXAMPLE: FUNNY / SARCASTIC ──
  else if (t.includes('funny') || t.includes('meme') || t.includes('sarcastic')) {
    intro = `The shirt that says what everyone's thinking — ${specific}.

This design is for the people who use sarcasm as a love language and humor as a coping mechanism. It's funny, relatable, and going to get reactions everywhere you wear it.

Available as a lightweight tee or a cozy crewneck sweatshirt. The print is vibrant and durable.

Great gift for the friend who's impossible to shop for.`;
  }

  // ── GENERAL FALLBACK ──
  else {
    intro = `Your new favorite graphic tee and sweatshirt — ${specific}.

This design stands out from the generic stuff you see everywhere else. It's well-thought-out, the print quality is sharp, and it's comfortable enough to wear on repeat.

Available as a soft, breathable tee or a cozy crewneck sweatshirt. Both styles feature high-quality DTF printing — no cracking, no peeling, no fading.

The kind of piece that gets compliments and makes people ask "where'd you get that?"`;
  }

  // ── CLOSING CTA ──
  const closingOptions = [
    `Add it to your favorites so you don't lose it — and check out the rest of our shop for more designs you'll love.`,
    `Save it to your favorites and come back when you're ready. We'll be here.`,
    `Grab yours before it's gone — and don't forget to check the rest of the shop for more.`,
    `Add to cart now or save it for later — either way, your wardrobe will thank you.`,
  ];
  const closing = closingOptions[Math.abs(hashCode(title)) % closingOptions.length];

  return intro + AVAILABLE_STYLES + SIZING + COLORS + HOW_TO_ORDER + SHIPPING + '\n\n' + closing;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// ─────────────────────────────────────────────
// ALT TEXT GENERATOR
// ─────────────────────────────────────────────

function generateAltTexts(title, tags) {
  const full = (title || '').trim();
  const mainProduct = full.split(',')[0].trim();
  const tagList = (tags || []).filter(t => t && t.length > 0);

  const usedTags = new Set();
  function pickTag() {
    for (const t of tagList) {
      if (!usedTags.has(t)) { usedTags.add(t); return t; }
    }
    return '';
  }

  const alts = [
    full,
    [mainProduct, pickTag()].filter(Boolean).join(' - '),
    [pickTag(), mainProduct].filter(Boolean).join(', '),
    [mainProduct, pickTag(), pickTag()].filter(Boolean).join(', '),
    [pickTag(), pickTag()].filter(Boolean).join(', '),
    [mainProduct, pickTag()].filter(Boolean).join(', '),
    [pickTag(), mainProduct].filter(Boolean).join(' - '),
    [pickTag(), pickTag(), pickTag()].filter(Boolean).join(', '),
    [mainProduct, pickTag()].filter(Boolean).join(' - '),
    [pickTag(), pickTag()].filter(Boolean).join(', '),
  ];

  return alts.slice(0, 10).map(alt => alt.trim().substring(0, 250));
}

// ─────────────────────────────────────────────
// TAG OPTIMIZATION
// ─────────────────────────────────────────────

const TAG_POOLS = {
  mom: [
    'gift for new mom', 'mothers day present', 'mom birthday gift',
    'cool mom apparel', 'mom life shirt', 'mama bear gift tee',
    'best mom gift idea', 'mom graphic tee', 'mommy and me shirt'
  ],
  teacher: [
    'teacher appreciation gift', 'educator present idea', 'school staff gift',
    'back to school shirt', 'teacher birthday tee', 'end of year teacher',
    'classroom outfit', 'preschool teacher gift', 'kindergarten teacher tee'
  ],
  funny: [
    'humor graphic tee', 'funny gift idea', 'sarcasm shirt gift',
    'witty apparel tee', 'joke shirt present', 'novelty gift shirt',
    'office humor gift', 'gag gift tee idea', 'comedy shirt present'
  ],
  general: [
    'unisex graphic tee', 'gift for her idea', 'gift for him idea',
    'birthday gift shirt', 'casual everyday tee', 'trendy outfit gift',
    'cozy apparel gift', 'soft graphic shirt', 'unique shirt present',
    'statement tee gift', 'cool shirt apparel', 'fashion graphic tee'
  ]
};

function getTitleWords(title) {
  return (title || '')
    .toLowerCase()
    .split(/[\s,\-|\/]+/)
    .filter(w => w.length > 3);
}

function tagOverlapsTitle(tag, titleWords) {
  const tagWords = tag.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const matches = tagWords.filter(w => titleWords.includes(w));
  return matches.length >= 2;
}

function getCategory(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('mama') || (t.includes('mom') && !t.includes('common'))) return 'mom';
  if (t.includes('teacher') || t.includes('tiny humans')) return 'teacher';
  if (t.includes('funny') || t.includes('meme') || t.includes('sarcastic')) return 'funny';
  return 'general';
}

function optimizeTags(listing) {
  const title = listing.title || '';
  const titleWords = getTitleWords(title);
  const category = getCategory(title);
  const pool = [...(TAG_POOLS[category] || []), ...TAG_POOLS.general];

  const used = new Set();
  const result = (listing.tags || []).map(tag => {
    if (!tag) return tag;
    used.add(tag);
    if (!tagOverlapsTitle(tag, titleWords)) return tag;

    for (const candidate of pool) {
      const c = candidate.substring(0, 20).trim();
      if (!tagOverlapsTitle(c, titleWords) && !used.has(c)) {
        used.add(c);
        return c;
      }
    }
    return tag;
  });

  return result;
}

// ─────────────────────────────────────────────
// MAIN OPTIMIZATION
// ─────────────────────────────────────────────

let overlapFixed = 0;

const optimized = listings.map(listing => {
  const newDescription = generateDescription(listing.title, listing.tags);
  const altTexts = generateAltTexts(listing.title, listing.tags);
  const newTags = optimizeTags(listing);

  const titleWords = getTitleWords(listing.title);
  const oldOverlaps = (listing.tags || []).filter(tag => tagOverlapsTitle(tag, titleWords)).length;
  if (oldOverlaps > 0) overlapFixed++;

  return {
    id: listing.id,
    editUrl: listing.editUrl,
    title: listing.title,
    tags: newTags,
    description: newDescription,
    altTexts: altTexts
  };
});

fs.writeFileSync('./listings_optimized.json', JSON.stringify(optimized, null, 2), 'utf8');

console.log(`\n${optimized.length} listings optimized!`);
console.log(`Tag overlap fixed: ${overlapFixed} listings`);
console.log('Saved to listings_optimized.json\n');
console.log('=== PREVIEW (First 3) ===\n');
optimized.slice(0, 3).forEach((l, i) => {
  console.log(`${i + 1}. ${l.title?.substring(0, 70)}`);
  console.log(`   TAGS: ${l.tags.join(' | ')}`);
  console.log(`   DESC: "${l.description.substring(0, 150)}..."`);
  console.log(`   ALT1: ${l.altTexts[0]}`);
  console.log('');
});
