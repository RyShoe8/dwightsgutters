import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appUrl } from '../lib/email.mjs';

test('APP_URL validates production origins without leaking the supplied value', () => {
  const previous = { APP_URL: process.env.APP_URL, NODE_ENV: process.env.NODE_ENV };
  try {
    process.env.NODE_ENV = 'production';
    for (const value of ['', 'dwightsgutters.com', 'http://dwightsgutters.com', 'https://user:secret@example.com', 'https://example.com/admin', 'https://example.com/?test=1', 'https://example.com/#test']) {
      process.env.APP_URL = value;
      assert.throws(appUrl, error => error.status === 503 && !error.message.includes('secret'));
    }
    process.env.APP_URL = ' https://dwightsgutters.com/ ';
    assert.equal(appUrl(), 'https://dwightsgutters.com');
    delete process.env.APP_URL;
    process.env.NODE_ENV = 'development';
    assert.equal(appUrl(), 'http://127.0.0.1:3000');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
