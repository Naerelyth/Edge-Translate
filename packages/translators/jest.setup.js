Object.assign(global, require('jest-chrome'))

// fetch polyfill for Node.js environment
const fetch = require('node-fetch');
global.fetch = fetch;
global.Request = fetch.Request;
global.Response = fetch.Response;
global.Headers = fetch.Headers;