export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  // Validate URL
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // Basic validation that it's a Mountain Project tick export URL
  if (!url.includes('mountainproject.com') || !url.includes('tick-export')) {
    return res.status(400).json({ error: 'Invalid Mountain Project URL' });
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const csvData = await response.text();

    // Set appropriate headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    return res.status(200).send(csvData);

  } catch (error) {
    console.error('Error fetching CSV:', error);
    return res.status(500).json({
      error: 'Failed to fetch CSV data',
      details: error.message
    });
  }
}
