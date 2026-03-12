const { createAdminClient, getUser, cors } = require('./_lib/supabase');

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

  try {
    // POST — connect CMS
    if (req.method === 'POST') {
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

    // DELETE — disconnect CMS
    if (req.method === 'DELETE') {
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

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('CMS connect error:', err);
    return res.status(500).json({ error: err.message });
  }
};
