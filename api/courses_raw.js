// /api/courses_raw.js — dumps Webflow response so we can see the real error/status.
module.exports = async (req, res) => {
    try {
        const token = process.env.WEBFLOW_TOKEN;
        const cid = process.env.COLLECTION_ID;
        const teacherId = process.env.TEACHERS_COLLECTION_ID;
        if (!token || !cid || !teacherId ) {
            return res.status(500).json({ error: 'Missing WEBFLOW_TOKEN or COLLECTION_ID or TEACHER_ID' });
        }
        const url = `https://api.webflow.com/v2/collections/${teacherId}/items?limit=5`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const text = await r.text();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        // Return both status and body to see what's going on
        res.status(200).send(JSON.stringify({ status: r.status, body: text.slice(0, 2000) }, null, 2));
    } catch (e) {
        res.status(200).json({ caught: String(e) });
    }
};
