// /api/schema.js — dump the v2 schema for your COURSES collection
module.exports = async (req, res) => {
    try {
        const token = process.env.WEBFLOW_TOKEN;
        const cid = process.env.COLLECTION_ID;
        if (!token || !cid) return res.status(500).json({ error: 'Missing env vars' });

        const r = await fetch(`https://api.webflow.com/v2/collections/${cid}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const t = await r.text();
        const data = JSON.parse(t);

        // Return a concise list of fields: key, type, and target collection (if any)
        const fields = (data.fields || []).map(f => ({
            key: f.key, type: f.type, target: f.metadata?.collectionId || null
        }));
        res.status(200).json({ id: cid, name: data.displayName || data.name, fields });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
};