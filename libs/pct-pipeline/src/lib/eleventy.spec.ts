import { promises as fs } from 'fs';
import { generateUUID } from '@startuphafen/utility';
import { generatePage } from './eleventy';

describe('The eleventy actor', () => {
  it('should allow to configure passthrough file or directory copies', async () => {
    const tmpDir = '/tmp/' + generateUUID();

    await fs.mkdir(tmpDir);

    try {
      await generatePage({
        inputDirectory: __dirname + '/../fixtures/site0/src',
        outputDirectory: tmpDir,
        inputDataMap: {},
        passthrough: {
          srcBaseDir: __dirname + '/../fixtures/site0',
          inputs: ['static', 'global.css'],
        },
      });

      const cssFile = (await fs.readFile(tmpDir + '/global.css')).toString();
      expect(cssFile).toContain('wtf');

      const testFile = (
        await fs.readFile(tmpDir + '/static/test.txt')
      ).toString();
      expect(testFile).toContain('123');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should not copy any passthrough files outside of the output directory', async () => {
    const tmpDir = '/tmp/' + generateUUID();

    await fs.mkdir(tmpDir);

    try {
      await generatePage({
        inputDirectory: __dirname + '/../fixtures/site4/src',
        outputDirectory: tmpDir,
        inputDataMap: {},
        passthrough: {
          srcBaseDir: __dirname + '/../fixtures/site0',
          inputs: ['../static'],
        },
      });

      console.log(await fs.readdir(tmpDir));

      const testFile = (
        await fs.readFile(tmpDir + '/static/test.txt')
      ).toString();
      expect(testFile).toContain('123');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should generate a static site with tailwindcss', async () => {
    const tmpDir = '/tmp/' + generateUUID();

    await fs.mkdir(tmpDir);

    try {
      await generatePage({
        inputDirectory: __dirname + '/../fixtures/site1/',
        outputDirectory: tmpDir,
        inputDataMap: {},
      });

      const indexHTML = (await fs.readFile(tmpDir + '/index.html')).toString();
      expect(indexHTML).toContain('head');
      expect(indexHTML).toContain('Hello world!');

      const styleCSS = (await fs.readFile(tmpDir + '/tw.css')).toString();
      expect(styleCSS).toContain('text-green-800');
      expect(styleCSS).toContain('font-bold');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should generate a static site with programmatically provided data', async () => {
    const tmpDir = '/tmp/' + generateUUID();

    await fs.mkdir(tmpDir);

    try {
      await generatePage({
        inputDirectory: __dirname + '/../fixtures/site2/',
        outputDirectory: tmpDir,
        inputDataMap: {
          experts: [
            {
              id: 1,
              forename: 'Pierre',
              surname: 'Nguyen',
            },
            {
              id: 2,
              forename: 'Colin',
              surname: 'Clausen',
            },
            {
              id: 3,
              forename: 'Thomas',
              surname: 'Tucker',
            },
            {
              id: 4,
              forename: 'Isabel',
              surname: 'Blomberg',
            },
          ],
        },
      });

      const indexHTML = (await fs.readFile(tmpDir + '/index.html')).toString();
      expect(indexHTML).toContain('head');
      expect(indexHTML).toContain('Hello world!');
      expect(indexHTML).toContain('Colin');
      expect(indexHTML).toContain('Pierre');
      expect(indexHTML).toContain('Thomas');
      expect(indexHTML).toContain('Blomberg');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
