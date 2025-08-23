// api/courses.js
// A Vercel serverless function that fetches your Webflow courses page
// and returns just the #all-courses-content section.

const TEACHABLE_ORIGIN = 'https://master-the-score.teachable.com';
const SOURCE_URL = 'https://www.masterthescore.com/courses';

function extractSection(html) {
    // Simple regex to grab the element with id="all-courses-content"
    const re = /<([a-zA-Z0-9:-]+)[^>]*\sid=["']all-courses-content["'][^>]*>([\s\S]*?)<\/\1>/i;
    const match = html.match(re);
    return match ? match[0] : '';
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).end();
        return;
    }

    try {
        const response = await fetch(SOURCE_URL, {
            headers: { 'User-Agent': 'MTS-Teachable-Proxy' },
        });
        const html = await response.text();
        const section = extractSection(html);

        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300'); // cache for 5 min
        res.status(section ? 200 : 204).send(section);
    } catch (err) {
        console.error('Proxy error:', err);
        res.setHeader('Access-Control-Allow-Origin', TEACHABLE_ORIGIN);
        res.status(502).send('');
    }
}