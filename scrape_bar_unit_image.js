import https from 'https';

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  try {
    console.log('Fetching BAR unit page...');
    const html = await fetchHtml('https://www.beyondallreason.info/unit/armpw');
    console.log('Page fetched. Searching for image URLs...');
    
    // Look for links ending in .png or .jpg or .webp
    const regex = /https?:\/\/[^\s"'()<>]+?\.(?:png|jpg|jpeg|gif|webp|svg)/gi;
    const matches = html.match(regex) || [];
    console.log(`Found ${matches.length} image URLs:`);
    const unique = [...new Set(matches)];
    unique.forEach(url => {
      console.log(`  ${url}`);
    });
  } catch (err) {
    console.error('Scrape failed:', err);
  }
}

run();
