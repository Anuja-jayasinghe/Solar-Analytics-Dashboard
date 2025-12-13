/**
 * Clerk Configuration Diagnostic Endpoint
 * Returns env configuration status (WITHOUT exposing actual keys)
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      clerkConfig: {
        hasSecretKey: Boolean(process.env.CLERK_SECRET_KEY),
        secretKeyPrefix: process.env.CLERK_SECRET_KEY?.substring(0, 7) || null,
        secretKeyLength: process.env.CLERK_SECRET_KEY?.length || 0,
        hasPublishableKey: Boolean(process.env.VITE_CLERK_PUBLISHABLE_KEY),
        publishableKeyPrefix: process.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 7) || null,
        jwtTemplateName: process.env.CLERK_JWT_TEMPLATE_NAME || null,
        useClerkAuth: process.env.VITE_USE_CLERK_AUTH || 'not set'
      }
    };

    console.log('🔍 Clerk Config Diagnostic:', config);

    return res.status(200).json(config);
  } catch (error) {
    console.error('Diagnostic Error:', error);
    return res.status(500).json({ 
      error: 'Diagnostic failed',
      message: error.message 
    });
  }
}
