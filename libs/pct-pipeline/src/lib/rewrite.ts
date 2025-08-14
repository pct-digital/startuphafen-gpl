import { promises as fs } from 'fs';

function escapeRegExp(x: string) {
  return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceAll(str: string, find: string, replace: string) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

export async function rewriteFile(file: string, replace: string, rwith: string) {
  const ff = await fs.readFile(file);
  const fileContent = ff.toString();
  const modfile = replaceAll(fileContent, replace, rwith);
  await fs.writeFile(file, modfile);
  console.log(`Replaced ${replace} with ${rwith} in file ${file}`);
}
