/* eslint-disable no-sync,no-process-env */

const gulp = require('gulp');
const Promise = require('bluebird');
const fs = require('fs');
const debug = require('debug')('slate-tools:deploy');
const open = Promise.promisify(require('open'));
const yaml = require('js-yaml');
const themekit = require('@shopify/themekit');

const config = require('./includes/config.js');
const messages = require('./includes/messages.js');

/**
 * simple promise factory wrapper for deploys
 * @param env - the environment to deploy to
 * @returns {Promise}
 * @private
 */
function deploy(env) {
  debug(`themekit cwd to: ${config.dist.root}`);

  return themekit.command('deploy', {env, nodelete: true}, {
    cwd: config.dist.root,
  }).catch((err) => {
    const message = messages.logTransferFailed(err);
    return Promise.reject(new Error(message));
  });
}

/**
 * Validate theme_id used for the environment
 * @param {Object} - settings of theme_id and environment
 * @returns {Promise}
 * @private
 */
function validateId(settings) {
  return new Promise((resolve, reject) => {
    // Only string allowed is "live"
    if (settings.themeId === 'live') {
      resolve();
    }

    const id = Number(settings.themeId);

    if (isNaN(id)) {
      const message = messages.invalidThemeId(settings.themeId, settings.environment);
      reject(new TypeError(message));
    } else {
      resolve();
    }
  });
}

/**
 * Validate the config.yml theme_id is an integer or "live"
 * @function validate:id
 * @memberof slate-cli.tasks.watch, slate-cli.tasks.deploy
 * @private
 */
gulp.task('validate:id', (cb) => {
  let file;

  try {
    file = fs.readFileSync(config.tkConfig, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      messages.configError();
    }

    cb(err);
    return;
  }

  const tkConfig = yaml.safeLoad(file);

  const environments = config.environment.split(/\s*,\s*|\s+/);

  Promise.each(environments, (environment) => {
    const envObj = tkConfig[environment];
    const envSettings = {
      themeId: envObj.theme_id,
      environment,
    };

    return validateId(envSettings);
  })
    .then(() => cb())
    .catch(cb);

  cb();
});

/**
 * Replace your existing theme using ThemeKit.
 *
 * @function deploy:replace
 * @memberof slate-cli.tasks.deploy
 * @static
 */
gulp.task('deploy:replace', (cb) => {
  debug(`environments ${config.environment}`);

  const environments = config.environment.split(/\s*,\s*|\s+/);

  Promise.each(environments, (environment) => deploy(environment))
    .then(() => {
      messages.allDeploysComplete();
      return cb();
    })
    .catch(cb);
});

/**
 * Opens the Store in the default browser (for manual upgrade/deployment)
 *
 * @function open:admin
 * @memberof slate-cli.tasks.deploy
 * @static
 */
gulp.task('open:admin', () => {
  const file = fs.readFileSync(config.tkConfig, 'utf8');
  const tkConfig = yaml.safeLoad(file);
  let envObj;

  const environments = config.environment.split(/\s*,\s*|\s+/);
  const promises = environments.map((environment) => {
    envObj = tkConfig[environment];
    return open(`https://${envObj.store}/admin/themes`);
  });

  return Promise.all(promises);
});

/**
 * Opens the Zip file in the file browser
 *
 * @function open:zip
 * @memberof slate-cli.tasks.deploy
 * @static
 */
gulp.task('open:zip', () => {
  return open('upload');
});
