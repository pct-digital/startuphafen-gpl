// @ts-check

/**
 * @typedef {import('../../../../../../tools/deploy3/lib/hooks/hook-types').PostUpHookContext} PostUpHookContext
 */

/**
 * This script runs after the application has started.
 * Verifies that all containers are running and stable.
 *
 * @param {PostUpHookContext} context
 */
module.exports = async function (context) {
  const { logger, helpers } = context;

  logger.info('Executing post-up hook...');

  // Wait for all compose services to be running and stable for 10 seconds
  helpers.containerStability.waitForStability();

  logger.info('Post-up hook finished.');
};
