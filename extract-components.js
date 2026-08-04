// Extract TSX component code from JSON registry file
const fs = require('fs');
const path = require('path');

const components = ['create-community', 'dialog-stack', 'uniswap-dialog'];
const outDir = path.join(__dirname, 'src', 'renderer', 'watermelon-ui');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

components.forEach(name => {
  const jsonPath = path.join(__dirname, 'src', 'renderer', 'components', `${name}.json`);
  if (fs.existsSync(jsonPath)) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    if (raw.files && raw.files[0] && raw.files[0].content) {
      const targetJsxPath = path.join(outDir, `${name}.jsx`);
      fs.writeFileSync(targetJsxPath, raw.files[0].content);
      console.log(`Generated component JSX for ${name} at ${targetJsxPath}`);
    }
  }
});
