const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  var sb = createAdminClient();

  try {
    // GET — load settings + site + profile
    if (req.method === 'GET') {
      var { data: settings } = await sb.from('settings').select('*').eq('user_id', user.id).single();
      var { data: site } = await sb.from('sites').select('*').eq('user_id', user.id).single();
      var { data: profile } = await sb.from('profiles').select('full_name, email, avatar_url').eq('id', user.id).single();

      return res.status(200).json({
        settings: settings,
        site: site,
        profile: profile
      });
    }

    // POST — save settings
    if (req.method === 'POST') {
      var body = req.body;

      // Update settings table
      if (body.settings) {
        await sb.from('settings').upsert({
          user_id: user.id,
          tone: body.settings.tone,
          article_length: body.settings.article_length,
          publish_frequency: body.settings.publish_frequency,
          competitors: body.settings.competitors || [],
          brand_name: body.settings.brand_name,
          brand_color: body.settings.brand_color,
          auto_publish: body.settings.auto_publish || false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      }

      // Update site
      if (body.site) {
        await sb.from('sites').update({
          url: body.site.url,
          description: body.site.description,
          language: body.site.language,
          audiences: body.site.audiences || [],
          goals: body.site.goals || [],
          niche: body.site.niche,
          updated_at: new Date().toISOString()
        }).eq('user_id', user.id);
      }

      // Update profile name
      if (body.profile) {
        await sb.from('profiles').update({
          full_name: body.profile.full_name,
          updated_at: new Date().toISOString()
        }).eq('id', user.id);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Settings error:', err);
    return res.status(500).json({ error: err.message });
  }
};
