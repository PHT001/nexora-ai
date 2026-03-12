const { createAdminClient, getUser, cors } = require('./_lib/supabase');
const { publishToCms, markdownToHtml } = require('./_lib/cms-publish');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    var sb = createAdminClient();
    var { article_id } = req.body;
    if (!article_id) return res.status(400).json({ error: 'article_id requis' });

    // Get site with CMS credentials
    var { data: site } = await sb.from('sites').select('*').eq('user_id', user.id).single();
    if (!site) return res.status(400).json({ error: 'Aucun site configuré.' });
    if (!site.cms_type || !site.cms_connected_at) {
      return res.status(400).json({ error: 'Aucun CMS connecté. Configurez votre intégration dans Paramètres > Intégrations.' });
    }

    // Get article
    var { data: article } = await sb.from('articles').select('*').eq('id', article_id).eq('site_id', site.id).single();
    if (!article) return res.status(404).json({ error: 'Article non trouvé.' });
    if (article.cms_post_id) {
      return res.status(400).json({ error: 'Cet article a déjà été publié sur votre CMS.' });
    }

    // Convert markdown → HTML
    var htmlContent = markdownToHtml(article.content);

    // Publish to CMS
    var result = await publishToCms(site, article, htmlContent);

    // Update article in database
    var now = new Date().toISOString();
    var { data: updated } = await sb.from('articles').update({
      status: 'published',
      cms_post_id: result.post_id,
      cms_post_url: result.post_url,
      published_at: now,
      updated_at: now
    }).eq('id', article_id).select().single();

    return res.status(200).json({
      success: true,
      article: updated,
      cms_post_id: result.post_id,
      cms_post_url: result.post_url
    });
  } catch (err) {
    console.error('Publish CMS error:', err);
    return res.status(500).json({ error: 'Erreur de publication: ' + err.message });
  }
};
