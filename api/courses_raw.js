// /api/courses_raw.js — dumps Webflow response so we can see the real error/status.
module.exports = async (req, res) => {
    try {
        const token = process.env.50000c1b5f0ed810c790cec1c6c4487f93dcb98ecd01ddd2253bad509f071a5e;
        const cid = process.env.65c375ede1d584c57eab1c18;
        if (!token || !cid) {
            return res.status(500).json({ error: 'Missing WEBFLOW_TOKEN or COLLECTION_ID' });
        }
        const url = `https://api.webflow.com/v2/collections/${cid}/items?limit=5`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const text = await r.text();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        // Return both status and body to see what's going on
        res.status(200).send(JSON.stringify({ status: r.status, body: text.slice(0, 2000) }, null, 2));
    } catch (e) {
        res.status(200).json({ caught: String(e) });
    }
};
