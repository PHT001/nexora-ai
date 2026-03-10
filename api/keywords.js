const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    var sb = createAdminClient();
    var { data: site } = await sb.from('sites').select('id').eq('user_id', user.id).single();
    if (!site) return res.status(400).json({ error: 'Aucun site configuré.' });

    var { data: keywords } = await sb
      .from('keywords')
      .select('*')
      .eq('site_id', site.id)
      .order('volume', { ascending: false });

    return res.status(200).json({ keywords: keywords || [] });
  } catch (err) {
    console.error('Keywords error:', err);
    return res.status(500).json({ error: err.message });
  }
};
