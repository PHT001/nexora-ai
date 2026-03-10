const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  var sb = createAdminClient();

  // Get user's site
  var { data: site } = await sb.from('sites').select('id').eq('user_id', user.id).single();
  if (!site) return res.status(400).json({ error: 'Aucun site configuré.' });

  try {
    // GET — list articles
    if (req.method === 'GET') {
      var { data: articles } = await sb
        .from('articles')
        .select('*')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false });

      return res.status(200).json({ articles: articles || [] });
    }

    // PATCH — update article (status, scheduled_date, content)
    if (req.method === 'PATCH') {
      var { id, status, scheduled_date, title, content } = req.body;
      if (!id) return res.status(400).json({ error: 'ID requis' });

      var updates = { updated_at: new Date().toISOString() };
      if (status) updates.status = status;
      if (scheduled_date) updates.scheduled_date = scheduled_date;
      if (title) updates.title = title;
      if (content) {
        updates.content = content;
        updates.word_count = content.split(/\s+/).length;
      }

      var { data: updated, error } = await sb
        .from('articles')
        .update(updates)
        .eq('id', id)
        .eq('site_id', site.id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ article: updated });
    }

    // DELETE — delete article
    if (req.method === 'DELETE') {
      var { id: deleteId } = req.body;
      if (!deleteId) return res.status(400).json({ error: 'ID requis' });

      await sb.from('articles').delete().eq('id', deleteId).eq('site_id', site.id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Articles error:', err);
    return res.status(500).json({ error: err.message });
  }
};
