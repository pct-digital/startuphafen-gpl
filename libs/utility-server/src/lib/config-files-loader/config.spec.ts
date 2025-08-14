import { ZodError, z } from 'zod';
import { FileAccess } from '../file-access';
import { ConfigLoader } from './config';

function makeReadMock(content: Record<string, string>) {
  return jest.fn(async (path) => {
    if (!(path in content)) {
      const e404: any = new Error();
      e404.code = 'ENOENT';
      throw e404;
    }
    return content[path];
  });
}

function makeDirMock(content: Record<string, string[]>) {
  return jest.fn(async (path) => {
    if (!(path in content)) {
      const e404: any = new Error();
      e404.code = 'ENOENT';
      throw e404;
    }
    return content[path];
  });
}

const emptyDirMock = makeDirMock({});

const ExampleSchema = z.object({
  a: z.number(),
  b: z.number().optional(),
  c: z.number().optional(),
});

describe('the config loader function', () => {
  it('loads a a configuration', async () => {
    const faccess = new FileAccess();
    faccess.readTextFile = makeReadMock({
      'path/to/config': '{"a": 42}',
    });
    faccess.readdir = emptyDirMock;
    const loader = new ConfigLoader(['path/to/config'], ExampleSchema, faccess);

    const config = await loader.loadConfig();

    expect(config).toEqual({
      a: 42,
    });
  });

  it('can build a config from multiple files', async () => {
    const faccess = new FileAccess();
    faccess.readTextFile = makeReadMock({
      'f/1': '{"a": 42}',
      'f/2': '{"a": 21, "b": 7}',
    });
    faccess.readdir = emptyDirMock;
    const loader = new ConfigLoader(['f/1', 'f/2'], ExampleSchema, faccess);

    const config = await loader.loadConfig();

    expect(config).toEqual({
      a: 21,
      b: 7,
    });
  });

  it('does not merge arrays by index', async () => {
    const faccess = new FileAccess();
    faccess.readTextFile = makeReadMock({
      'f/1': '{"a":[{"x": 42, "y": 21}, {"z": 7}]}',
      'f/2': '{"a":[{"a": 42, "b": 21}]}',
    });
    faccess.readdir = emptyDirMock;

    const loader = new ConfigLoader(['f/1', 'f/2'], z.any(), faccess);

    const config = await loader.loadConfig();
    console.log('C', JSON.stringify(config));
    expect(config).toEqual({
      a: [
        {
          a: 42,
          b: 21,
        },
      ],
    });
  });

  it('will explode on a config that does not match the provided schema', async () => {
    const faccess = new FileAccess();
    faccess.readTextFile = makeReadMock({
      'f/1': '{"z": 42}',
    });
    faccess.readdir = emptyDirMock;
    const loader = new ConfigLoader(['f/1'], ExampleSchema, faccess);

    let ok = true;
    try {
      await loader.loadConfig();
      ok = false;
    } catch (e) {
      expect(e).toBeInstanceOf(ZodError);
    }

    expect(ok).toBeTruthy();
  });

  it('applies any docker secrets that end in .json on top of the config', async () => {
    const faccess = new FileAccess();
    faccess.readTextFile = makeReadMock({
      'f/1': '{"a": 42}',
      '/run/secrets/cfg.json': '{"c": 18}',
    });
    faccess.readdir = makeDirMock({
      '/run/secrets': ['cfg.json', 'foobar.txt'],
    });
    const loader = new ConfigLoader(['f/1'], ExampleSchema, faccess);

    const config = await loader.loadConfig();

    expect(config).toEqual({
      a: 42,
      c: 18,
    });
  });
});
