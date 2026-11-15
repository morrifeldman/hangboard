// Proxy for Mountain Project's user search, which the browser can't call
// directly (no CORS). The response is passed through untouched; the app parses
// it in src/lib/mpAccount.ts.
//
// Keep the behaviour here in sync with the dev endpoint in vite.config.ts.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q || q.length > 100) {
    return res.status(400).json({ error: 'q must be 1 to 100 characters' });
  }
  const offset = Number.parseInt(req.query.offset, 10);
  const o = Number.isInteger(offset) && offset > 0 && offset <= 1000 ? offset : 0;

  const upstream =
    'https://www.mountainproject.com/ajax/public/search/results/category' +
    `?q=${encodeURIComponent(q)}&c=Users&o=${o}&s=Default`;

  try {
    const response = await fetch(upstream);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const body = await response.json();
    return res.status(200).json(body);
  } catch (error) {
    console.error('Error searching Mountain Project users:', error);
    return res.status(502).json({
      error: 'Failed to search Mountain Project',
      details: error.message,
    });
  }
}
