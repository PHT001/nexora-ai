const { createAdminClient, getUser, cors } = require('./_lib/supabase');
const { publishToCms, markdownToHtml } = require('./_lib/cms-publish');

// ---- Test CMS connection before saving ----
async function testCmsConnection(cmsType, cmsUrl, apiKey, username, extra) {
  if (cmsType === 'wordpress') {
    var credentials = Buffer.from((username || '') + ':' + apiKey).toString('base64');
    var testUrl = cmsUrl.replace(/\/+$/, '') + '/wp-json/wp/v2/users/me';
    var resp = await fetch(testUrl, {
      headers: { 'Authorization': 'Basic ' + credentials }
    });
    if (!resp.ok) {
      throw new Error('Connexion WordPress échouée (' + resp.status + '). Vérifiez l\'URL et le mot de passe d\'application.');
    }
  }
  else if (cmsType === 'shopify') {
    var shopDomain = cmsUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    var testUrl = 'https://' + shopDomain + '/admin/api/2024-01/blogs.json';
    var resp = await fetch(testUrl, {
      headers: { 'X-Shopify-Access-Token': apiKey }
    });
    if (!resp.ok) {
      throw new Error('Connexion Shopify échouée (' + resp.status + '). Vérifiez l\'URL et le token API admin.');
    }
  }
  else if (cmsType === 'webflow') {
    var collectionId = (extra && extra.collection_id) || '';
    if (!collectionId) throw new Error('Collection ID requis pour Webflow.');
    var resp = await fetch('https://api.webflow.com/v2/collections/' + collectionId, {
      headers: { 'Authorization': 'Bearer ' + apiKey }
    });
    if (!resp.ok) {
      throw new Error('Connexion Webflow échouée (' + resp.status + '). Vérifiez le token API et le Collection ID.');
    }
  }
  else {
    throw new Error('Type CMS non supporté: ' + cmsType);
  }
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  var sb = createAdminClient();
  var action = (req.body && req.body.action) || '';

  try {
    // ---- ACTION: connect ----
    if (req.method === 'POST' && action === 'connect') {
      var { cms_type, cms_url, cms_api_key, cms_username, cms_extra } = req.body;

      if (!cms_type || !cms_url || !cms_api_key) {
        return res.status(400).json({ error: 'Champs requis manquants (type, url, clé API).' });
      }

      // Test connection first
      await testCmsConnection(cms_type, cms_url, cms_api_key, cms_username, cms_extra);

      // Save to sites table
      var { error: updateErr } = await sb.from('sites').update({
        cms_type: cms_type,
        cms_url: cms_url,
        cms_api_key: cms_api_key,
        cms_username: cms_username || null,
        cms_extra: cms_extra || {},
        cms_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id);

      if (updateErr) throw updateErr;

      return res.status(200).json({ success: true, cms_type: cms_type });
    }

    // ---- ACTION: disconnect ----
    if (req.method === 'POST' && action === 'disconnect') {
      var { error: updateErr } = await sb.from('sites').update({
        cms_type: null,
        cms_url: null,
        cms_api_key: null,
        cms_username: null,
        cms_extra: {},
        cms_connected_at: null,
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id);

      if (updateErr) throw updateErr;

      return res.status(200).json({ success: true });
    }

    // ---- ACTION: publish ----
    if (req.method === 'POST' && action === 'publish') {
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

      // Convert markdown to HTML
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
    }

    return res.status(400).json({ error: 'Action requise: connect, disconnect, ou publish' });
  } catch (err) {
    console.error('CMS error:', err);
    return res.status(500).json({ error: err.message });
  }
};
