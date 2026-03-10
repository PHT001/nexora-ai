const Anthropic = require('@anthropic-ai/sdk');
const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    var sb = createAdminClient();
    var { data: site } = await sb.from('sites').select('*').eq('user_id', user.id).single();
    if (!site) return res.status(400).json({ error: 'Aucun site configuré.' });

    // Get existing keywords to avoid duplicates
    var { data: existing } = await sb.from('keywords').select('keyword').eq('site_id', site.id);
    var existingList = (existing || []).map(function(k) { return k.keyword.toLowerCase(); });

    var { topic, count } = req.body;
    var lang = site.language === 'en' ? 'English' : 'French';

    var prompt = 'Tu es un expert SEO. Pour le site "' + site.domain + '" (' + (site.description || site.niche || '') + '), '
      + 'génère exactement ' + (count || 5) + ' nouveaux mots-clés SEO en ' + lang;

    if (topic) {
      prompt += ' autour du thème "' + topic + '"';
    }

    prompt += '. Mots-clés existants à NE PAS répéter : ' + existingList.join(', ') + '. '
      + 'Pour chaque mot-clé, estime le volume de recherche mensuel (100-10000) et la difficulté SEO (10-90). '
      + 'Réponds UNIQUEMENT en JSON : [{"keyword":"...","volume":...,"difficulty":...}]';

    var anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    var msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    var text = msg.content[0].text;
    var jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Réponse IA invalide' });
    }

    var keywords = JSON.parse(jsonMatch[0]);

    // Insert new keywords
    var rows = keywords.map(function(k) {
      return { site_id: site.id, keyword: k.keyword, volume: k.volume || 0, difficulty: k.difficulty || 50 };
    });
    var { data: saved } = await sb.from('keywords').insert(rows).select();

    return res.status(200).json({ keywords: saved || rows });
  } catch (err) {
    console.error('Generate keywords error:', err);
    return res.status(500).json({ error: err.message });
  }
};
