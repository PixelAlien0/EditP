import https from 'https';
import fs from 'fs';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function fetchRawText(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Status: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

function parseLua(luaStr) {
  // Remove comments
  let clean = luaStr.replace(/--.*$/gm, '');
  clean = clean.trim();
  if (clean.startsWith('return')) {
    clean = clean.slice(6).trim();
  }
  // Convert key = value to key: value
  clean = clean.replace(/([a-zA-Z0-9_]+)\s*=\s*/g, '"$1": ');
  // Convert [key] = value to key: value
  clean = clean.replace(/\[\s*([a-zA-Z0-9_"'-]+)\s*\]\s*=\s*/g, '"$1": ');
  // Evaluate
  const fn = new Function(`return ${clean}`);
  return fn();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  try {
    let unwrappedUnits;
    try {
      console.log('1. Downloading latest language/en/units.json (Names/Descriptions)...');
      const langUnits = await fetchJson('https://cdn.jsdelivr.net/gh/beyond-all-reason/Beyond-All-Reason@master/language/en/units.json');
      unwrappedUnits = langUnits.units || langUnits;
      console.log(`Downloaded name/desc database. Names keys: ${Object.keys(unwrappedUnits.names || {}).length}`);
      
      // Save to units.json
      fs.writeFileSync('src/data/units.json', JSON.stringify(unwrappedUnits, null, 2), 'utf8');
      console.log('Saved src/data/units.json');
    } catch (e) {
      console.warn('Failed to download language/en/units.json, falling back to local src/data/units.json:', e.message);
      unwrappedUnits = JSON.parse(fs.readFileSync('src/data/units.json', 'utf8'));
    }

    console.log('2. Fetching repository file tree...');
    const treeData = await fetchJson('https://api.github.com/repos/beyond-all-reason/Beyond-All-Reason/git/trees/master?recursive=1');
    if (!treeData.tree) {
      console.error('Failed to fetch repository tree.');
      return;
    }

    // Filter for unit lua files
    const unitFiles = treeData.tree.filter(f => 
      f.path.startsWith('units/') && 
      f.path.endsWith('.lua')
    );
    console.log(`Found ${unitFiles.length} unit definition paths in repository.`);

    const defaultsDb = {};
    const categoriesDb = {};
    const rostersDb = {};

    const batchSize = 35;
    console.log(`3. Downloading and parsing unit files in batches of ${batchSize}...`);

    for (let i = 0; i < unitFiles.length; i += batchSize) {
      const batch = unitFiles.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(unitFiles.length/batchSize)}...`);
      
      const promises = batch.map(file => {
        const url = `https://cdn.jsdelivr.net/gh/beyond-all-reason/Beyond-All-Reason@master/${file.path}`;
        return fetchRawText(url).then(text => {
          try {
            const parsedObj = parseLua(text);
            const unitKey = Object.keys(parsedObj)[0];
            const unit = parsedObj[unitKey];
            return { id: unitKey.toLowerCase(), unit, path: file.path };
          } catch (e) {
            console.warn(`Parse failed for ${file.path}: ${e.message}`);
            return null;
          }
        }).catch((err) => {
          console.error(`Fetch failed for ${file.path}: ${err.message}`);
          return null;
        });
      });

      const results = await Promise.all(promises);

      results.forEach(res => {
        if (!res || !res.unit) return;
        const { id, unit, path: filePath } = res;

        // --- A. Extract default parameters ---
        const defaults = {};
        
        // Numeric parameters
        const numericKeys = [
          'metalcost', 'energycost', 'buildtime', 'health', 'sightdistance',
          'radardistance', 'sonardistance', 'workertime', 'metalmake',
          'extractsmetal', 'energymake', 'metalstorage', 'energystorage',
          'cloakcost', 'cloakcostmoving', 'builddistance', 'autoheal',
          'maxslope', 'maxwaterdepth', 'minwaterdepth', 'transportcapacity'
        ];
        
        numericKeys.forEach(k => {
          if (unit[k] !== undefined) {
            defaults[k] = parseFloat(unit[k]);
          }
        });

        // Movement / Physics
        if (unit.acceleration !== undefined) defaults.acceleration = parseFloat(unit.acceleration);
        if (unit.brakerate !== undefined) defaults.brakerate = parseFloat(unit.brakerate);
        else if (unit.brakeRate !== undefined) defaults.brakerate = parseFloat(unit.brakeRate);

        if (unit.turnrate !== undefined) defaults.turnrate = parseFloat(unit.turnrate);
        else if (unit.turnRate !== undefined) defaults.turnrate = parseFloat(unit.turnRate);

        if (unit.mass !== undefined) defaults.mass = parseFloat(unit.mass);

        // Max speed (maxvelocity)
        if (unit.speed !== undefined) {
          defaults.maxvelocity = parseFloat(unit.speed);
        }

        // Customparams (techlevel, energy conv keys)
        if (unit.customparams) {
          const cp = unit.customparams;
          if (cp.techlevel !== undefined) {
            defaults['customparams.techlevel'] = parseInt(cp.techlevel, 10);
          }
          if (cp.energyconv_capacity !== undefined) {
            defaults['customparams.energyconv_capacity'] = parseFloat(cp.energyconv_capacity);
          }
          if (cp.energyconv_efficiency !== undefined) {
            defaults['customparams.energyconv_efficiency'] = parseFloat(cp.energyconv_efficiency);
          }
        }

        // Boolean parameters
        if (unit.cantbetransported !== undefined) {
          defaults.cantbetransported = unit.cantbetransported === true || unit.cantbetransported === 'true';
        }
        if (unit.stealth !== undefined) {
          defaults.stealth = unit.stealth === true || unit.stealth === 'true';
        }
        if (unit.sonarstealth !== undefined) {
          defaults.sonarstealth = unit.sonarstealth === true || unit.sonarstealth === 'true';
        } else if (unit.sonarStealth !== undefined) {
          defaults.sonarstealth = unit.sonarStealth === true || unit.sonarStealth === 'true';
        }

        // Weapon defaults
        if (unit.weapons) {
          const slots = [];
          Object.entries(unit.weapons).forEach(([slotStr, w]) => {
            const slotNum = parseInt(slotStr, 10);
            if (isNaN(slotNum)) return;
            const defName = w.def;
            if (defName && unit.weapondefs) {
              const defKey = Object.keys(unit.weapondefs).find(k => k.toLowerCase() === defName.toLowerCase());
              if (defKey && unit.weapondefs[defKey]) {
                const wDef = unit.weapondefs[defKey];
                const wSlot = {
                  slot: slotNum,
                  defKey: defKey.toLowerCase(),
                  range: wDef.range !== undefined ? parseFloat(wDef.range) : 0,
                  reload: wDef.reloadtime !== undefined ? parseFloat(wDef.reloadtime) : 0,
                  velocity: wDef.weaponvelocity !== undefined ? parseFloat(wDef.weaponvelocity) : (wDef.velocity !== undefined ? parseFloat(wDef.velocity) : 0),
                  flighttime: wDef.flighttime !== undefined ? parseFloat(wDef.flighttime) : 0,
                  aoe: wDef.areaofeffect !== undefined ? parseFloat(wDef.areaofeffect) : (wDef.areaOfEffect !== undefined ? parseFloat(wDef.areaOfEffect) : 0),
                  accuracy: wDef.accuracy !== undefined ? parseFloat(wDef.accuracy) : 0,
                  sprayangle: wDef.sprayangle !== undefined ? parseFloat(wDef.sprayangle) : (wDef.sprayAngle !== undefined ? parseFloat(wDef.sprayAngle) : 0),
                  projectiles: wDef.projectiles !== undefined ? parseInt(wDef.projectiles, 10) : 1,
                  burst: wDef.burst !== undefined ? parseInt(wDef.burst, 10) : 1,
                  burstrate: wDef.burstrate !== undefined ? parseFloat(wDef.burstrate) : (wDef.burstRate !== undefined ? parseFloat(wDef.burstRate) : 0)
                };

                // Preserve additional engine-backed WeaponDef values for the advanced slot editor.
                // Undefined values intentionally remain inherited rather than being replaced with guessed defaults.
                const numberFields = [
                  'edgeeffectiveness', 'impulsefactor', 'impulseboost', 'energypershot', 'metalpershot',
                  'paralyzetime', 'mygravity', 'heightboostfactor', 'startvelocity', 'weaponacceleration',
                  'turnrate', 'trajectoryheight', 'wobble', 'dance', 'movingaccuracy', 'targetmoveerror',
                  'predictboost', 'leadlimit', 'leadbonus', 'targetborder', 'cylindertargeting', 'tolerance',
                  'firetolerance', 'proximitypriority', 'collisionsize', 'numbounce', 'bounceslip',
                  'bouncerebound', 'beamtime', 'minintensity', 'duration', 'falloffrate', 'thickness',
                  'corethickness', 'laserflaresize', 'intensity', 'interceptedbyshieldtype'
                ];
                numberFields.forEach(field => {
                  if (wDef[field] !== undefined && Number.isFinite(Number(wDef[field]))) {
                    wSlot[field === 'collisionsize' ? 'collisionSize' : field] = Number(wDef[field]);
                  }
                });

                const booleanFields = [
                  'impactonly', 'noexplode', 'burnblow', 'noselfdamage', 'paralyzer', 'waterweapon',
                  'firesubmersed', 'collidefeature', 'collideneutral', 'collideground', 'tracks',
                  'fixedlauncher', 'smoketrail', 'groundbounce', 'waterbounce', 'beamburst', 'sweepfire',
                  'hardstop', 'explosionscar', 'alwaysvisible', 'toairweapon'
                ];
                booleanFields.forEach(field => {
                  if (wDef[field] !== undefined) {
                    wSlot[field] = wDef[field] === true || wDef[field] === 'true' || wDef[field] === 1;
                  }
                });

                ['rgbcolor', 'rgbcolor2', 'soundstart', 'soundhit', 'soundhitwet'].forEach(field => {
                  if (wDef[field] !== undefined) wSlot[field] = String(wDef[field]);
                });

                if (w.onlytargetcategory !== undefined) wSlot.onlytargetcategory = String(w.onlytargetcategory);
                if (w.badtargetcategory !== undefined) wSlot.badtargetcategory = String(w.badtargetcategory);
                if (wDef.damage) {
                  wSlot.damage = parseFloat(wDef.damage.default || 0);
                } else {
                  wSlot.damage = 0;
                }
                slots.push(wSlot);
              }
            }
          });
          if (slots.length > 0) {
            slots.sort((a, b) => a.slot - b.slot);
            defaults.weaponSlots = slots;

            // Legacy weapon1 compatibility for the first slot
            const firstSlot = slots[0];
            defaults.weapon1def = firstSlot.defKey;
            defaults.weapon1Damage = firstSlot.damage;
            defaults.weapon1Reload = firstSlot.reload;
            defaults.weapon1Range = firstSlot.range;
            defaults.weapon1Velocity = firstSlot.velocity;
            defaults.weapon1Flighttime = firstSlot.flighttime;
            defaults.weapon1Aoe = firstSlot.aoe;
            defaults.weapon1Accuracy = firstSlot.accuracy;
            defaults.weapon1Sprayangle = firstSlot.sprayangle;
            defaults.weapon1Projectiles = firstSlot.projectiles;
            defaults.weapon1Burst = firstSlot.burst;
            defaults.weapon1Burstrate = firstSlot.burstrate;
          }
        }

        defaultsDb[id] = defaults;

        // --- B. Extract categories/tags ---
        const tags = [];
        const pathLower = filePath.toLowerCase();
        
        if (pathLower.includes('aircraft') || pathLower.includes('seaplane')) tags.push('aircraft');
        else if (pathLower.includes('bot') || pathLower.includes('raptor')) tags.push('bots');
        else if (pathLower.includes('vehicle')) tags.push('vehicles');
        else if (pathLower.includes('hover')) tags.push('hovercraft');
        else if (pathLower.includes('ship') || pathLower.includes('sub')) tags.push('ships');

        if (unit.buildoptions && Object.keys(unit.buildoptions).length > 0) {
          tags.push('factories');
        } else if (unit.speed === 0 || !unit.speed) {
          if (unit.weapons && Object.keys(unit.weapons).length > 0) {
            tags.push('defenses');
          } else {
            tags.push('buildings');
          }
        }

        const tech = unit.customparams?.techlevel || 1;
        tags.push(`t${tech}`);

        categoriesDb[id] = tags;

        // --- C. Extract factory buildoptions rosters ---
        if (unit.buildoptions) {
          const list = [];
          Object.values(unit.buildoptions).forEach(bo => {
            if (typeof bo === 'string') {
              list.push(bo.toLowerCase());
            }
          });
          if (list.length > 0) {
            rostersDb[id] = list;
          }
        }
      });

      // Small throttling delay to avoid connection resets
      await delay(100);
    }

    // --- D. Programmatically generate scavenger variants for all normal units ---
    console.log('3.5. Generating scavenger variants for all normal units...');
    let generatedScavsCount = 0;
    Object.keys(defaultsDb).forEach(baseId => {
      if (baseId.startsWith('scav_') || baseId.includes('scav') || baseId.includes('raptor') || baseId.includes('acid')) {
        return;
      }
      
      const scavId = `scav_${baseId}`;
      if (!defaultsDb[scavId]) {
        defaultsDb[scavId] = JSON.parse(JSON.stringify(defaultsDb[baseId]));
        unwrappedUnits.names[scavId] = `Scavenger ${unwrappedUnits.names[baseId] || baseId}`;
        unwrappedUnits.descriptions[scavId] = unwrappedUnits.descriptions[baseId] || '';
        
        if (categoriesDb[baseId]) {
          categoriesDb[scavId] = [...categoriesDb[baseId], 'scavenger'];
        } else {
          categoriesDb[scavId] = ['scavenger'];
        }
        generatedScavsCount++;
      }
    });
    console.log(`Generated ${generatedScavsCount} scavenger unit variants!`);

    console.log('4. Writing databases...');
    fs.writeFileSync('src/data/units.json', JSON.stringify(unwrappedUnits, null, 2), 'utf8');
    fs.writeFileSync('src/data/unit-defaults.json', JSON.stringify(defaultsDb, null, 2), 'utf8');
    fs.writeFileSync('src/data/unit-categories.json', JSON.stringify(categoriesDb, null, 2), 'utf8');
    fs.writeFileSync('src/data/factory-rosters.json', JSON.stringify(rostersDb, null, 2), 'utf8');

    console.log('Synchronization complete!');
    console.log(`  Units in Defaults: ${Object.keys(defaultsDb).length}`);
    console.log(`  Units Categorized: ${Object.keys(categoriesDb).length}`);
    console.log(`  Factory Rosters Mapped: ${Object.keys(rostersDb).length}`);
  } catch (err) {
    console.error('Fatal Error during synchronization:', err);
  }
}

run();
