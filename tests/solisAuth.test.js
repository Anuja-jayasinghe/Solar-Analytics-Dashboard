// tests/solisAuth.test.js
//
// SolisCloud's gateway rejects a request whose signature does not match, and the scheduled
// collectors depend on it every five minutes. The expected values below were produced by the
// `crypto-js` implementation this replaced (MD5 + HMAC-SHA1, both base64), so they prove the
// move to node:crypto is byte-for-byte identical — including for non-ASCII bodies.

import { describe, it, expect } from 'vitest';
import { signSolisRequest } from '../api/_lib/solisAuth.js';

const date = 'Thu, 24 Sep 2026 06:00:00 GMT';
const apiId = '1300386381676000000';
const apiSecret = 's3cr3t-Ünï©ode/+=';

const cases = [
  {
    name: 'a JSON body',
    input: { method: 'POST', path: '/v1/api/inverterList', bodyString: JSON.stringify({ pageNo: '1', pageSize: '20' }) },
    md5: 'Jatjf9oy2V7XLNcuz8EeNw==',
    signature: 'ORCJB1FT5ltIus4dW6z0LCzxzIU='
  },
  {
    name: 'another JSON body',
    input: { method: 'POST', path: '/v1/api/inverterDetail', bodyString: JSON.stringify({ sn: '1811040244070066' }) },
    md5: 'VVCFK5LPxCo/Zt9xscsNBw==',
    signature: 'sG9m1+9JthEJ8Da+r+5J93cgDpE='
  },
  {
    name: 'an empty JSON object (no Content-MD5)',
    input: { method: 'POST', path: '/v1/api/userStationList', bodyString: '{}' },
    md5: '',
    signature: 'uTG1xjylPhBqqNFQL4Cu0l/hwEs='
  },
  {
    name: 'a lower-case method with no body',
    input: { method: 'get', path: '/v1/api/x', bodyString: '' },
    md5: '',
    signature: 'kNakuz6aF9lxH3A9dkgU5J1naoU='
  },
  {
    name: 'a non-ASCII body',
    input: {
      method: 'POST',
      path: '/v1/api/unicode',
      bodyString: JSON.stringify({ note: 'Sri Lanka – café ☀ 太陽' })
    },
    md5: 'icy3qIzg4GAIvpZ/e2S/lA==',
    signature: 'JisKBRo0iPTHDMu3GjALXDsHBDU='
  }
];

describe('signSolisRequest', () => {
  it.each(cases)('signs $name exactly as the previous crypto-js implementation did', ({ input, md5, signature }) => {
    const result = signSolisRequest({ apiId, apiSecret, date, ...input });
    expect(result.headers['Content-MD5']).toBe(md5);
    expect(result.signature).toBe(signature);
  });

  it('builds the Authorization header and canonical string the gateway expects', () => {
    const { headers, canonical } = signSolisRequest({
      apiId,
      apiSecret,
      date,
      method: 'post',
      path: '/v1/api/inverterList',
      bodyString: JSON.stringify({ pageNo: '1', pageSize: '20' })
    });

    expect(canonical).toBe(
      ['POST', 'Jatjf9oy2V7XLNcuz8EeNw==', 'application/json', date, '/v1/api/inverterList'].join('\n')
    );
    expect(headers.Authorization).toBe(`API ${apiId}:ORCJB1FT5ltIus4dW6z0LCzxzIU=`);
    expect(headers.Date).toBe(date);
    expect(headers['Content-Type']).toBe('application/json');
  });
});
