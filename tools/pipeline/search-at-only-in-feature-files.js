const fs = require('fs');
const path = require('path');
const { readFile } = require('fs/promises');

const E2E_PATH = path.join(__dirname, '../../apps/startuphafen-frontend-e2e/');
const EXTENSION = '.feature';

const isExpectedExtension = (file, extension, extensionLength) => {
  const substrFromLast = file.substr(-1 * extensionLength);
  return substrFromLast === extension;
};

const getByExtension = (basePath, extension, extensionLength, result) => {
  filesInCurrentDir = fs.readdirSync(basePath);
  filesInCurrentDir.forEach((file) => {
    const updatedBasePath = path.join(basePath, file);
    if (!fs.statSync(updatedBasePath).isDirectory()) {
      if (isExpectedExtension(file, extension, extensionLength)) {
        result.push(updatedBasePath);
      }
      return;
    }
    result = getByExtension(
      updatedBasePath,
      extension,
      extensionLength,
      result
    );
  });
  return result;
};

const fileContainsAText = async (filesWithFullPath, texToMatch) => {
  const textInLowerCase = texToMatch.toLowerCase();
  for (const file of filesWithFullPath) {
    const data = await readFile(file, 'utf-8');
    if (data.toLocaleLowerCase().includes(textInLowerCase)) {
      return file;
    }
  }
  return '';
};

const main = async () => {
  const allFeatureFiles = getByExtension(
    E2E_PATH,
    EXTENSION,
    EXTENSION.length,
    []
  );
  const file = await fileContainsAText(allFeatureFiles, '@only');
  if (file.length > 1) {
    throw new Error(file + ' contains "@only" tag.');
  }
};
main();
