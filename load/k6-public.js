import http from 'k6/http';
import { check, sleep } from 'k6';

const configuredApi = (__ENV.API_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
if (/api-preprod\.exemple\.com|votre-service-api\.onrender\.com|example\.com/i.test(configuredApi)) {
  throw new Error(`API_URL n'est pas une URL de test réelle: ${configuredApi}`);
}

const api = configuredApi;
const atelierId = __ENV.ATELIER_ID || '';
const smoke = __ENV.SMOKE === '1';

const charge = {
  scenarios: {
    public_traffic: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 5000,
      stages: [
        { target: 100, duration: '2m' },
        { target: 500, duration: '3m' },
        { target: 1000, duration: '5m' },
        { target: 0, duration: '2m' },
      ],
    },
  },
};

export const options = smoke ? {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    checks: ['rate>0.99'],
  },
} : {
  ...charge,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const responses = http.batch([
    ['GET', `${api}/sante`],
    ['GET', `${api}/public/config`],
    ['GET', `${api}/public/ateliers`],
  ]);

  for (const response of responses) {
    check(response, {
      'status is successful': (r) => r.status >= 200 && r.status < 400,
      'response is JSON': (r) => String(r.headers['Content-Type'] || '').includes('json'),
      'response contains a body': (r) => r.body !== null && r.body.length > 0,
    });
  }

  if (atelierId) {
    const response = http.post(`${api}/public/suivi`, JSON.stringify({
      atelier_id: atelierId,
      code: __ENV.HABIT_CODE || 'HAB-000000',
    }), { headers: { 'Content-Type': 'application/json' } });
    check(response, { 'tracking request is successful': (r) => r.status >= 200 && r.status < 400 });
  }

  sleep(Math.random() * 2);
}
