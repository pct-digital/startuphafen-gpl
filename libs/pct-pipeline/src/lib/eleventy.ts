import Eleventy from '@11ty/eleventy';

import tailwind from 'tailwindcss';
import postcss from 'postcss';

import { promises as fs } from 'fs';

import path from 'path';
import { sleep } from '@startuphafen/utility';

export interface SiteGenerationRequest {
  inputDirectory: string;
  outputDirectory: string;
  inputDataMap: Record<string, unknown>;
  passthrough?: {
    srcBaseDir: string;
    inputs: string[];
  };
  // If you need to configure more options in eleventy or tailwind extend this request object with further optional properties
  // Remember to extend the tests for the actor if you do
}

async function generateEleventyPage(req: SiteGenerationRequest) {
  const eleven = new Eleventy(req.inputDirectory, req.outputDirectory, {
    config: function (elevenConfig: any) {
      elevenConfig.setQuietMode(true);
      for (const dataKey of Object.keys(req.inputDataMap)) {
        const dataValue = req.inputDataMap[dataKey];
        elevenConfig.addGlobalData(dataKey, dataValue);
      }
      elevenConfig.addFilter('i18n', function () {
        const args = [...arguments];
        const key = args[0];
        const tx = args[args.length - 1].data.root.translation;
        let result = tx[key] || key;
        const replacements = args.slice(1, args.length - 1);
        for (let i = 0; i < replacements.length; i++) {
          result = result.replace('%' + (i + 1), replacements[i]);
        }
        return result;
      });

      elevenConfig.addFilter('first6', function (this: any, param: string) {
        return param.slice(0, 6);
      });

      elevenConfig.addFilter('UPPER', function (this: any, param: string) {
        return param.toLocaleUpperCase();
      });

      elevenConfig.addFilter('LOWER', function (this: any, param: string) {
        return param.toLocaleLowerCase();
      });

      elevenConfig.addFilter(
        'concat',
        function (this: any, ...params: string[]) {
          return params.slice(0, params.length - 1).join('');
        }
      );

      elevenConfig.addFilter(
        'cutout',
        function (this: any, src: string, ...params: string[]) {
          let result = src;
          for (let i = 0; i < params.length - 1; i++) {
            result = result.replaceAll(params[i], '');
          }
          return result;
        }
      );

      elevenConfig.addFilter(
        'isLengthInRange',
        function (this: any, ar: { length: number }, min: number, max: number) {
          return ar.length >= min && ar.length <= max;
        }
      );

      elevenConfig.addFilter(
        'attr',
        function (this: any, object: any, ...attrs: string[]) {
          let result = object;
          for (const attr of attrs.slice(0, attrs.length - 1)) {
            if (result == null) {
              break;
            }
            result = result[attr];
          }
          return result;
        }
      );

      elevenConfig.addFilter(
        'filterEmptyStrings',
        function (this: any, param: any[]) {
          return param.filter((x) => x !== '');
        }
      );

      elevenConfig.addFilter(
        'allEmpty',
        function (this: any, ...params: any[]) {
          const vals = params.slice(0, params.length - 1);
          return (
            params.length === 0 ||
            vals.find((p) => p !== '' && p !== null && p !== undefined) == null
          );
        }
      );

      elevenConfig.addFilter('http', function (this: any, link: string) {
        if (!link.startsWith('http')) {
          return '//' + link;
        }
        return link;
      });
    },
  });

  await eleven.write();

  await sleep(100);

  // for some reason programmatic access to eleventy produces output files for _includes
  // for clean outputs remove that directory
  await fs.rm(path.join(req.outputDirectory, '_includes'), {
    recursive: true,
    force: true,
    maxRetries: 5,
  });

  await sleep(100);

  function getUncommonEndOfA(a: string[], b: string[]) {
    while (a[0] === b[0] && a.length > 0 && b.length > 0) {
      a = a.slice(1);
      b = b.slice(1);
    }
    return a;
  }

  if (req.passthrough != null) {
    // could not get passthrough to work by eleventy, so just copy files myself
    for (const passthrough of req.passthrough.inputs || []) {
      const src = path.join(req.passthrough.srcBaseDir, passthrough);

      // To prevent relative passthrough targets to place anything outside of the output directory
      // figure out the part of the absolute src path decided by the passthrough
      // use that path to place the passed through files inside the output directory

      // base = a/b/c
      // passthrough = ../c
      // src = a/b/c
      // pdest = c

      // ouput = z
      // dest = z/c

      const pdest = getUncommonEndOfA(
        src.split('/'),
        path.normalize(req.passthrough.srcBaseDir).split('/')
      );

      const dest = path.join(req.outputDirectory, pdest.join('/'));

      await fs.cp(src, dest, {
        recursive: true,
        force: true,
        dereference: false,
        preserveTimestamps: true,
      });
    }
  }
}

async function generateTailwindcss(req: SiteGenerationRequest) {
  const contentPath = path.join(req.outputDirectory, '**', '*.html');
  const result = await postcss([
    // somehow the types of tailwindcss are wrong, it claims to export a default object, but seems to not actually do that?
    // need to import it in a way that shows type errors for it to work at runtime
    // thus 'as any'
    (tailwind as any)({
      content: [contentPath],
    }),
  ]).process(`@tailwind base;@tailwind components;@tailwind utilities;`, {
    from: undefined,
  });

  await fs.writeFile(path.join(req.outputDirectory, 'tw.css'), result.css);
}

export async function generatePage(req: SiteGenerationRequest) {
  const startGenerationTime = Date.now();

  await generateEleventyPage(req);

  await generateTailwindcss(req);

  console.log(
    'Static site generated in ' + (Date.now() - startGenerationTime) + ' ms'
  );
}
