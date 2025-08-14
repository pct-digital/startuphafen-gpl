// used to output the version in the given dist directory

const fs = require('fs');

const appName = process.argv[2];

const vfile = JSON.parse(
  fs.readFileSync('dist/apps/' + appName + '-version/version.json').toString()
);

console.log(vfile.time + '_' + appName);
