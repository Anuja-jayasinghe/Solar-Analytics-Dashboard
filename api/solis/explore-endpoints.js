/**
 * Vercel Serverless Function: List Available SolisCloud Explorer Endpoints
 * 
 * Returns metadata about all enabled endpoints for UI rendering
 * Supports caching with ETag for performance
 */

import validator from '../lib/solisExplorerValidator.js';

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Cache headers (5 minutes)
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed. Use GET.' });
    }

    const endpoints = validator.getEndpoints();

    return res.status(200).json({
      ok: true,
      count: endpoints.length,
      endpoints,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ERROR] Failed to list endpoints:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production' ? 'An error occurred' : error.message,
    });
  }
}
