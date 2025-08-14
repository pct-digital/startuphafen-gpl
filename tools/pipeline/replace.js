const fs = require('fs');

const file = process.argv[2];
const pattern = process.argv[3];
const replacement = process.argv[4];

console.log(`Replacing ${pattern} in file ${file}`);

const oldContent = fs.readFileSync(file).toString();
const newContent = oldContent.replaceAll(pattern, replacement);
fs.writeFileSync(file, newContent);
