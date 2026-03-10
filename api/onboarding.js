const Anthropic = require('@anthropic-ai/sdk');
const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    var { url, description, audiences, goals, language, niche } = req.body;
    var domain = '';
    try { domain = new URL(url).hostname; } catch (e) { domain = url; }

    var sb = createAdminClient();

    // Upsert site
    var { data: existingSite } = await sb
      .from('sites')
      .select('id')
      .eq('user_id', user.id)
      .single();

    var siteId;
    if (existingSite) {
      await sb.from('sites').update({
        url, domain, language: language || 'fr', description,
        audiences: audiences || [], goals: goals || [], niche,
        updated_at: new Date().toISOString()
      }).eq('id', existingSite.id);
      siteId = existingSite.id;
    } else {
      var { data: newSite } = await sb.from('sites').insert({
        user_id: user.id, url, domain, language: language || 'fr',
        description, audiences: audiences || [], goals: goals || [], niche
      }).select('id').single();
      siteId = newSite.id;
    }

    // Upsert settings
    await sb.from('settings').upsert({
      user_id: user.id,
      brand_name: domain,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    // Generate seed keywords with Claude
    var keywords = [];
    try {
      var anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      var prompt = 'Tu es un expert SEO. Pour le site "' + domain + '" (' + (description || niche || '') + '), '
        + 'génère exactement 8 mots-clés SEO pertinents en ' + (language || 'français') + '. '
        + 'Pour chaque mot-clé, estime le volume de recherche mensuel (entre 100 et 10000) et la difficulté SEO (entre 10 et 90). '
        + 'Réponds UNIQUEMENT en JSON, format: [{"keyword":"...","volume":...,"difficulty":...}]';

      var msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });

      var text = msg.content[0].text;
      var jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        keywords = JSON.parse(jsonMatch[0]);
      }
    } catch (aiErr) {
      console.error('AI keyword generation error:', aiErr.message);
      // Continue without keywords — not critical
    }

    // Insert keywords
    if (keywords.length > 0) {
      // Delete old keywords first
      await sb.from('keywords').delete().eq('site_id', siteId);
      var rows = keywords.map(function(k) {
        return { site_id: siteId, keyword: k.keyword, volume: k.volume || 0, difficulty: k.difficulty || 50 };
      });
      await sb.from('keywords').insert(rows);
    }

    return res.status(200).json({ success: true, site_id: siteId, keywords_count: keywords.length });
  } catch (err) {
    console.error('Onboarding error:', err);
    return res.status(500).json({ error: err.message });
  }
};
