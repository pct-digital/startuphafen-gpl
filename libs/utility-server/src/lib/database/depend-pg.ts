// without this import the production build will not include a dependency on pg and will crash on startup!
import pg from 'pg';
export function importPgForWebpack() {
  if (pg.types == null) {
    throw new Error(
      'import pg types should never be null, it is only imported so that the node builder can see we need pg in our server package.json!'
    );
  }
}
