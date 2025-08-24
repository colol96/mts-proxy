// /api/diag.js
module.exports = async (req, res) => {
    const out = {};
    try {
        const token = process.env.WEBFLOW_TOKEN;
        const cid   = process.env.COLLECTION_ID;
        const teacherID = process.env.TEACHERS_COLLECTION_ID;

        out.has_WEBFLOW_TOKEN = !!token;
        out.has_COLLECTION_ID = !!cid;
        out.has_TEACGER_ID = !!teacherID;

        if (!token) return res.status(200).json(out);

        // Probe v2
        try {
            const r2 = await fetch('https://api.webflow.com/v2/sites', {
                headers: { Authorization: `Bearer ${token}` }
            });
            out.v2_sites_status = r2.status;
            out.v2_sites_ok = r2.ok;
        } catch (e) { out.v2_error = String(e); }

        // Probe v1
        try {
            const r1 = await fetch('https://api.webflow.com/sites', {
                headers: { Authorization: `Bearer ${token}`, 'accept-version': '1.0.0' }
            });
            out.v1_sites_status = r1.status;
            out.v1_sites_ok = r1.ok;
        } catch (e) { out.v1_error = String(e); }

        res.status(200).json(out);
    } catch (e) {
        res.status(200).json({ caught: String(e) });
    }
};