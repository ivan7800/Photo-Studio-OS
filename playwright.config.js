// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:8080',
  },
  webServer: {
    command: 'python -m http.server 8080',
    port: 8080,
    reuseExistingServer: true,
  },
});
