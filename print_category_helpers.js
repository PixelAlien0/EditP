import https from 'https';
import fs from 'fs';

function fetchUrl(url) {
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
    console.log('Fetching JS bundle...');
    const content = await fetchUrl('https://beyondmodforge.vercel.app/assets/index-Dg9AnKoX.js');
    console.log('JS bundle fetched. Printing category section...');
    
    const pos = content.indexOf('`bots`,`vehicles`,`aircraft`');
    if (pos !== -1) {
      const slice = content.slice(pos, pos + 20000);
      fs.writeFileSync('category_code.txt', slice, 'utf8');
      console.log('Saved 20KB category code to category_code.txt');
    } else {
      console.log('Category array definition not found');
    }
  } catch (err) {
    console.error('Failed:', err);
  }
}

run();
