/**
 * Diagnostic endpoint to check if environment variables are set on Vercel
 * GET /api/diagnostic/env-check
 */

export default function handler(req, res) {
  // Only allow in development or from same origin
  const isLocal = req.headers.host?.includes('localhost');
  const isVercel = req.headers.host?.includes('vercel.app');
  
  if (!isLocal && !isVercel) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const envVars = {
    // Client-side (Vite) variables
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? '✅ SET' : '❌ MISSING',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING',
    VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY ? '✅ SET' : '❌ MISSING',
    VITE_USE_CLERK_AUTH: process.env.VITE_USE_CLERK_AUTH ? '✅ SET' : '❌ MISSING',
    
    // Server-side variables
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? '✅ SET' : '❌ MISSING',
    SUPABASE_URL: process.env.SUPABASE_URL ? '✅ SET' : '❌ MISSING',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? '✅ SET' : '❌ MISSING',
    SOLIS_API_ID: process.env.SOLIS_API_ID ? '✅ SET' : '❌ MISSING',
  };

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    deployment: process.env.VERCEL ? 'Vercel' : 'Local',
    envVars,
    nodeVersion: process.version
  });
}
