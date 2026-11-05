import nextConfig from '../next.config.mjs';
import {isPrivatePage} from '../lib/pagePrivacy.mjs';
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

test('sensitive pages exclude marketing scripts and apply a restrictive policy',async()=>{
 for(const path of ['/admin','/admin/','/admin/sign-in/','/book/change/'])assert.equal(isPrivatePage(path),true);
 for(const path of ['/','/book/','/service-area/','/gutter-cleaning/austin/'])assert.equal(isPrivatePage(path),false);
 const rules=await nextConfig.headers();
 for(const source of ['/admin/:path*','/book/change/:path*']){
  const headers=rules.find(rule=>rule.source===source).headers;
  const csp=headers.find(h=>h.key==='Content-Security-Policy').value;
  assert.ok(csp.includes("connect-src 'self'"));assert.ok(csp.includes("frame-ancestors 'none'"));assert.ok(csp.includes("object-src 'none'"));
  assert.ok(!csp.includes('analytics.ahrefs.com'));assert.ok(!csp.includes('cdn.cookie-script.com'));
 }
});
