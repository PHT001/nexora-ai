const { createAdminClient, getUser, cors, isPublicUrl } = require('./_lib/supabase');
const { publishToCms, markdownToHtml } = require('./_lib/cms-publish');
var crypto = require('crypto');

// ---- Test CMS connection before saving ----
async function testCmsConnection(cmsType, cmsUrl, apiKey, username, extra) {
  // SSRF protection: validate URL points to public internet
  if (cmsUrl && !isPublicUrl(cmsUrl)) {
    throw new Error('URL invalide ou non autorisée.');
  }
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
  else if (cmsType === 'ghost') {
    // Test Ghost Admin API with JWT
    var parts = apiKey.split(':');
    if (parts.length !== 2) throw new Error('Clé API Ghost invalide. Format attendu: id:secret');
    var id = parts[0];
    var secret = Buffer.from(parts[1], 'hex');
    var header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
    var now = Math.floor(Date.now() / 1000);
    var payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
    var sig = crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
    var token = header + '.' + payload + '.' + sig;

    var ghostUrl = cmsUrl.replace(/\/+$/, '') + '/ghost/api/admin/site/';
    var resp = await fetch(ghostUrl, {
      headers: { 'Authorization': 'Ghost ' + token }
    });
    if (!resp.ok) {
      throw new Error('Connexion Ghost échouée (' + resp.status + '). Vérifiez l\'URL et la clé Admin API.');
    }
  }
  else if (cmsType === 'wix') {
    var resp = await fetch('https://www.wixapis.com/blog/v3/posts?limit=1', {
      headers: { 'Authorization': apiKey }
    });
    if (!resp.ok) {
      throw new Error('Connexion Wix échouée (' + resp.status + '). Vérifiez votre clé API.');
    }
  }
  else if (cmsType === 'framer') {
    var collectionId = (extra && extra.collection_id) || '';
    if (!collectionId) throw new Error('Collection ID requis pour Framer.');
    var resp = await fetch('https://api.framer.com/v1/collections/' + collectionId, {
      headers: { 'Authorization': 'Bearer ' + apiKey }
    });
    if (!resp.ok) {
      throw new Error('Connexion Framer échouée (' + resp.status + '). Vérifiez le token API et le Collection ID.');
    }
  }
  else if (cmsType === 'gohighlevel') {
    var locationId = (extra && extra.location_id) || '';
    if (!locationId) throw new Error('Location ID requis pour GoHighLevel.');
    var resp = await fetch('https://services.leadconnectorhq.com/locations/' + locationId, {
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Version': '2021-07-28' }
    });
    if (!resp.ok) {
      throw new Error('Connexion GoHighLevel échouée (' + resp.status + '). Vérifiez le token API et le Location ID.');
    }
  }
  else if (cmsType === 'duda') {
    var siteName = (extra && extra.site_name) || '';
    if (!siteName) throw new Error('Nom du site requis pour Duda.');
    var credentials = Buffer.from((username || '') + ':' + apiKey).toString('base64');
    var resp = await fetch('https://api.duda.co/api/sites/multiscreen/' + siteName, {
      headers: { 'Authorization': 'Basic ' + credentials }
    });
    if (!resp.ok) {
      throw new Error('Connexion Duda échouée (' + resp.status + '). Vérifiez les credentials et le nom du site.');
    }
  }
  else if (cmsType === 'bigcommerce') {
    var storeHash = cmsUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    var resp = await fetch('https://api.bigcommerce.com/stores/' + storeHash + '/v2/blog/posts?limit=1', {
      headers: { 'X-Auth-Token': apiKey }
    });
    if (!resp.ok) {
      throw new Error('Connexion BigCommerce échouée (' + resp.status + '). Vérifiez le Store Hash et le token.');
    }
  }
  else if (cmsType === 'api') {
    // For generic API, just check the URL is reachable
    if (!cmsUrl) throw new Error('URL de l\'API requise.');
    try {
      var resp = await fetch(cmsUrl, { method: 'OPTIONS' });
      // Accept any response - we just test connectivity
    } catch (e) {
      throw new Error('URL API injoignable: ' + e.message);
    }
  }
  else if (cmsType === 'webhook') {
    // For webhook, just check URL is valid
    if (!cmsUrl) throw new Error('URL du webhook requise.');
    try {
      new URL(cmsUrl);
    } catch (e) {
      throw new Error('URL du webhook invalide.');
    }
  }
  else {
    throw new Error('Type CMS non supporté: ' + cmsType);
  }
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  var sb = createAdminClient();
  var action = (req.body && req.body.action) || '';

  try {
    // ---- ACTION: connect ----
    if (req.method === 'POST' && action === 'connect') {
      var { cms_type, cms_url, cms_api_key, cms_username, cms_extra } = req.body;

      var VALID_CMS_TYPES = ['wordpress', 'shopify', 'webflow', 'ghost', 'wix', 'framer', 'gohighlevel', 'duda', 'bigcommerce', 'api', 'webhook'];
      if (!cms_type || VALID_CMS_TYPES.indexOf(cms_type) === -1) {
        return res.status(400).json({ error: 'Type de CMS invalide.' });
      }
      // Validate required fields per CMS type
      var needsUrl = ['wordpress', 'shopify', 'ghost', 'bigcommerce', 'api', 'webhook'];
      var needsKey = ['wordpress', 'shopify', 'webflow', 'ghost', 'wix', 'framer', 'gohighlevel', 'duda', 'bigcommerce'];
      if (needsUrl.indexOf(cms_type) !== -1 && !cms_url) {
        return res.status(400).json({ error: 'URL requise pour ' + cms_type + '.' });
      }
      if (needsKey.indexOf(cms_type) !== -1 && !cms_api_key) {
        return res.status(400).json({ error: 'Clé API requise pour ' + cms_type + '.' });
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
      if (!article_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(article_id)) {
        return res.status(400).json({ error: 'article_id invalide' });
      }

      // Get site with CMS credentials
      var { data: site } = await sb.from('sites').select('*').eq('user_id', user.id).maybeSingle();
      if (!site) return res.status(400).json({ error: 'Aucun site configuré.' });
      if (!site.cms_type || !site.cms_connected_at) {
        return res.status(400).json({ error: 'Aucun CMS connecté. Configurez votre intégration dans Paramètres > Intégrations.' });
      }

      // Get article
      var { data: article } = await sb.from('articles').select('*').eq('id', article_id).eq('site_id', site.id).maybeSingle();
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
      }).eq('id', article_id).select().maybeSingle();

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
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
