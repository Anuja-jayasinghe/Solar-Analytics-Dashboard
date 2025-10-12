import { solisFetch } from './solisAuth.js';

export async function testSolisConnection() {
  try {
    const response = await solisFetch('/v1/api/inverterList', {
      pageNo: 1,
      pageSize: 5
    });

    if (response.success && response.code === '0') {
      console.log('✅ SolisCloud API connection successful!');
      console.log('Inverters found:', response.data?.page?.records?.length || 0);
      console.log('Sample inverter data:', response.data?.page?.records?.[0]);
    } else {
      console.error('❌ API returned error:', response);
    }
  } catch (error) {
    console.error('❌ SolisCloud API request failed:', error.message);
  }
}
