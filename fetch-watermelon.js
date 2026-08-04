const fs = require('fs');
const https = require('https');
const path = require('path');

const registries = [
  { name: 'create-community', url: 'https://registry.watermelon.sh/r/create-community.json' },
  { name: 'dialog-stack', url: 'https://registry.watermelon.sh/r/dialog-stack.json' },
  { name: 'uniswap-dialog', url: 'https://registry.watermelon.sh/r/uniswap-dialog.json' },
  { name: 'save-toggle-base', url: 'https://registry.watermelon.sh/r/save-toggle-base.json' }
];

const targetDir = path.join(__dirname, 'src', 'renderer', 'components');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

registries.forEach(reg => {
  https.get(reg.url, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const data = JSON.parse(raw);
        const filePath = path.join(targetDir, `${reg.name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Successfully fetched and saved component ${reg.name}`);
      } catch (e) {
        console.error(`Error parsing ${reg.name}:`, e);
      }
    });
  }).on('error', err => console.error(`Failed downloading ${reg.name}:`, err));
});
