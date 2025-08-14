import { ExecutorContext } from '@nx/devkit';
import { promises as fs } from 'fs';
import { prepareAllEntitiesOutputs } from './entity-engine-server';
import { EntitiesBuilderExecutorSchema } from './schema';

export default async function runExecutor(
  options: EntitiesBuilderExecutorSchema,
  _context: ExecutorContext
) {
  console.log('Executor ran for EntitiesBuilder', options);

  const filesRecord = await prepareAllEntitiesOutputs(
    options.app,
    options.migrationMode
  );

  for (const [fpath, fcontent] of Object.entries(filesRecord)) {
    await fs.writeFile(fpath, fcontent);
  }

  return {
    success: true,
  };
}
