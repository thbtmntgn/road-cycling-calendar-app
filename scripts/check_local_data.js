const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'src', 'generated', 'pcsData.ts');

if (!fs.existsSync(dataPath)) {
  console.error('\n❌ Local PCS data not found.\n   Run: npm run fetch-races\n');
  process.exit(1);
}
