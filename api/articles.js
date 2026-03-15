const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  var sb = createAdminClient();

  try {
    // Get user's site
    var { data: site } = await sb.from('sites').select('id').eq('user_id', user.id).maybeSingle();
    if (!site) return res.status(400).json({ error: 'Aucun site configuré.' });
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
      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return res.status(400).json({ error: 'ID invalide' });
      }

      var VALID_STATUSES = ['draft', 'published', 'scheduled', 'archived'];
      var updates = { updated_at: new Date().toISOString() };
      if (status) {
        if (VALID_STATUSES.indexOf(status) === -1) return res.status(400).json({ error: 'Statut invalide' });
        updates.status = status;
      }
      if (scheduled_date) updates.scheduled_date = String(scheduled_date).substring(0, 30);
      if (title) updates.title = String(title).substring(0, 300);
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
        .maybeSingle();

      if (error) throw error;
      if (!updated) return res.status(404).json({ error: 'Article non trouvé' });
      return res.status(200).json({ article: updated });
    }

    // DELETE — delete article
    if (req.method === 'DELETE') {
      var { id: deleteId } = req.body || {};
      if (!deleteId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deleteId)) {
        return res.status(400).json({ error: 'ID invalide' });
      }

      await sb.from('articles').delete().eq('id', deleteId).eq('site_id', site.id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Articles error:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
