const { join } = require('path');

/**
 * Install/look up the bundled Chromium inside the project directory instead of
 * the default ~/.cache/puppeteer. On Render the home cache (/opt/render/.cache)
 * isn't present at runtime, so launching failed with "Could not find Chrome".
 * Keeping the browser under the project dir means it's there both at build time
 * (when `puppeteer browsers install chrome` downloads it) and at runtime.
 */
module.exports = {
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
