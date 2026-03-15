const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  var sb = createAdminClient();

  try {
    // GET — load settings + site + profile
    if (req.method === 'GET') {
      var { data: settings } = await sb.from('settings').select('*').eq('user_id', user.id).maybeSingle();
      var { data: site } = await sb.from('sites').select('id, user_id, url, domain, language, description, audiences, goals, niche, cms_type, cms_url, cms_connected_at, cms_extra, created_at, updated_at').eq('user_id', user.id).maybeSingle();
      var { data: profile } = await sb.from('profiles').select('full_name, email, avatar_url').eq('id', user.id).maybeSingle();

      return res.status(200).json({
        settings: settings,
        site: site,
        profile: profile
      });
    }

    // POST — save settings
    if (req.method === 'POST') {
      var body = req.body;
      var VALID_TONES = ['professionnel', 'décontracté', 'académique', 'conversationnel', 'persuasif'];
      var VALID_LENGTHS = ['court', 'moyen', 'long'];
      var VALID_FREQUENCIES = ['daily', '3_per_week', 'weekly'];

      // Update settings table (merge with existing to avoid overwriting unset fields)
      if (body.settings) {
        var s = body.settings;
        var { data: existingSettings } = await sb.from('settings').select('*').eq('user_id', user.id).maybeSingle();

        var settingsUpdate = { user_id: user.id, updated_at: new Date().toISOString() };

        // Only update fields that are explicitly provided in the request
        if (s.tone !== undefined) settingsUpdate.tone = VALID_TONES.indexOf(s.tone) !== -1 ? s.tone : (existingSettings && existingSettings.tone || 'professionnel');
        if (s.article_length !== undefined) settingsUpdate.article_length = VALID_LENGTHS.indexOf(s.article_length) !== -1 ? s.article_length : (existingSettings && existingSettings.article_length || 'moyen');
        if (s.publish_frequency !== undefined) settingsUpdate.publish_frequency = VALID_FREQUENCIES.indexOf(s.publish_frequency) !== -1 ? s.publish_frequency : (existingSettings && existingSettings.publish_frequency || 'weekly');
        if (s.brand_name !== undefined) settingsUpdate.brand_name = String(s.brand_name || '').substring(0, 200);
        if (s.brand_color !== undefined) settingsUpdate.brand_color = (s.brand_color && /^#[0-9a-fA-F]{3,8}$/.test(s.brand_color)) ? s.brand_color : null;
        if (s.competitors !== undefined) settingsUpdate.competitors = Array.isArray(s.competitors) ? s.competitors.slice(0, 10).map(function(c) { return String(c).substring(0, 200); }) : [];
        if (s.auto_publish !== undefined) settingsUpdate.auto_publish = !!s.auto_publish;
        if (s.autopilot !== undefined) settingsUpdate.autopilot = !!s.autopilot;

        if (existingSettings) {
          await sb.from('settings').update(settingsUpdate).eq('user_id', user.id);
        } else {
          await sb.from('settings').insert(settingsUpdate);
        }
      }

      // Update site
      if (body.site) {
        var siteUrl = String(body.site.url || '').substring(0, 500);
        var siteDesc = String(body.site.description || '').substring(0, 2000);
        var siteLang = ['fr', 'en'].indexOf(body.site.language) !== -1 ? body.site.language : 'fr';
        var audiences = Array.isArray(body.site.audiences) ? body.site.audiences.slice(0, 10).map(function(a) { return String(a).substring(0, 200); }) : [];
        var goals = Array.isArray(body.site.goals) ? body.site.goals.slice(0, 10).map(function(g) { return String(g).substring(0, 200); }) : [];
        var niche = String(body.site.niche || '').substring(0, 200);

        await sb.from('sites').update({
          url: siteUrl,
          description: siteDesc,
          language: siteLang,
          audiences: audiences,
          goals: goals,
          niche: niche,
          updated_at: new Date().toISOString()
        }).eq('user_id', user.id);
      }

      // Update profile name
      if (body.profile) {
        var fullName = String(body.profile.full_name || '').substring(0, 200);
        await sb.from('profiles').update({
          full_name: fullName,
          updated_at: new Date().toISOString()
        }).eq('id', user.id);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Settings error:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
