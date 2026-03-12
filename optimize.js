const fs = require('fs');

const listings = JSON.parse(fs.readFileSync('./listings_raw.json', 'utf8'));

// Optimization rules:
// 1. Title: Main product first, under 70 chars, natural language
// 2. Tags: 13 slots full, no overlap with title, cover different intents

function optimizeTitle(title) {
  if (!title) return '';
  const parts = title.split(',').map(p => p.trim());
  let main = parts[0];
  if (main.length <= 70) return main;
  return main.substring(0, 67) + '...';
}

function generateTags(listing) {
  const title = listing.title || '';
  const existingTags = listing.tags || [];
  const titleLower = title.toLowerCase();

  let cleanTags = existingTags.filter(t =>
    t && t.length > 1 && t.length <= 20 &&
    t.toLowerCase() !== 'sweatshirt' &&
    t.toLowerCase() !== 'shirt' &&
    t.toLowerCase() !== 't-shirt'
  );

  // Category-based tag suggestions - customize these for your niche
  const extraTags = [];

  if (titleLower.includes('mom') || titleLower.includes('mama')) {
    extraTags.push('gift for mom', 'mothers day gift', 'new mom gift', 'mama shirt');
  }
  if (titleLower.includes('teacher')) {
    extraTags.push('teacher gift', 'teacher appreciation', 'school gift', 'educator shirt');
  }
  if (titleLower.includes('custom') || titleLower.includes('personalized')) {
    extraTags.push('personalized gift', 'custom shirt gift', 'custom apparel', 'name shirt');
  }
  if (titleLower.includes('cat') || titleLower.includes('kitten')) {
    extraTags.push('cat lover gift', 'cat mom shirt', 'funny cat tee', 'cat graphic shirt');
  }
  if (titleLower.includes('vintage') || titleLower.includes('retro')) {
    extraTags.push('retro graphic tee', 'vintage style shirt', 'nostalgic shirt', 'retro gift');
  }
  if (titleLower.includes('funny') || titleLower.includes('meme') || titleLower.includes('sarcastic')) {
    extraTags.push('funny gift idea', 'humor graphic tee', 'meme shirt gift', 'sarcastic tee');
  }

  let allTags = [...new Set([...cleanTags, ...extraTags])];
  allTags = allTags.map(t => t.substring(0, 20).trim());
  allTags = [...new Set(allTags)];

  if (allTags.length > 13) allTags = allTags.slice(0, 13);

  // Fill up to 13 tags with general ones
  const generalTags = [
    'unisex tee', 'graphic tee gift', 'gift for her', 'gift for him',
    'trendy shirt', 'casual tee', 'comfort colors tee', 'unique gift tee'
  ];
  let gi = 0;
  while (allTags.length < 13 && gi < generalTags.length) {
    if (!allTags.includes(generalTags[gi])) allTags.push(generalTags[gi]);
    gi++;
  }

  return allTags.slice(0, 13);
}

const optimized = listings.map(listing => {
  const newTitle = optimizeTitle(listing.title);
  const newTags = generateTags(listing);

  return {
    id: listing.id,
    editUrl: listing.editUrl,
    original: {
      title: listing.title,
      tags: listing.tags
    },
    optimized: {
      title: newTitle,
      tags: newTags
    }
  };
});

fs.writeFileSync('./listings_optimized.json', JSON.stringify(optimized, null, 2), 'utf8');

console.log(`\n${optimized.length} listings optimized!`);
console.log('Saved to listings_optimized.json\n');

// Preview
console.log('=== PREVIEW (First 5) ===\n');
optimized.slice(0, 5).forEach((l, i) => {
  console.log(`${i + 1}. ID: ${l.id}`);
  console.log(`   OLD: ${l.original.title?.substring(0, 80)}`);
  console.log(`   NEW: ${l.optimized.title}`);
  console.log(`   TAG: ${l.optimized.tags.join(' | ')}`);
  console.log('');
});
