const Anthropic = require('@anthropic-ai/sdk');
const { createAdminClient } = require('../_lib/supabase');
const { publishToCms, markdownToHtml } = require('../_lib/cms-publish');
const { sendArticlePublishedEmail } = require('../_lib/emails');

var BATCH_LIMIT = 10; // max users per cron run

// ─── Frequency check ───
function isDue(frequency, lastAt) {
  if (!lastAt) return true;
  var now = new Date();
  var last = new Date(lastAt);
  var hoursSince = (now - last) / (1000 * 60 * 60);

  switch (frequency) {
    case 'daily':       return hoursSince >= 22;
    case '3_per_week':  return hoursSince >= 48;
    case 'weekly':      return hoursSince >= 144;
    default:            return hoursSince >= 144;
  }
}

// ─── Pick next keyword (highest volume, no article yet) ───
async function getNextKeyword(sb, siteId) {
  var { data: usedKeywords } = await sb
    .from('articles')
    .select('keyword_id')
    .eq('site_id', siteId)
    .not('keyword_id', 'is', null);

  var usedIds = (usedKeywords || []).map(function(a) { return a.keyword_id; });

  var query = sb
    .from('keywords')
    .select('*')
    .eq('site_id', siteId)
    .order('volume', { ascending: false })
    .limit(1);

  if (usedIds.length > 0) {
    query = query.not('id', 'in', '(' + usedIds.join(',') + ')');
  }

  var { data: keywords } = await query;
  return keywords && keywords.length > 0 ? keywords[0] : null;
}

// ─── Auto-generate new keywords if queue empty ───
async function autoGenerateKeywords(sb, site) {
  var { data: existing } = await sb.from('keywords').select('keyword').eq('site_id', site.id);
  var existingList = (existing || []).map(function(k) { return k.keyword.toLowerCase(); });

  var lang = site.language === 'en' ? 'English' : 'French';
  var prompt = 'Tu es un expert SEO. Pour le site "' + site.domain + '" ('
    + (site.description || site.niche || '') + '), '
    + 'génère exactement 5 nouveaux mots-clés SEO en ' + lang
    + '. Mots-clés existants à NE PAS répéter : ' + existingList.join(', ') + '. '
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
  if (!jsonMatch) return null;

  var keywords;
  try { keywords = JSON.parse(jsonMatch[0]); } catch(e) { return null; }
  if (!Array.isArray(keywords) || keywords.length === 0) return null;

  var rows = keywords.map(function(k) {
    return { site_id: site.id, keyword: k.keyword, volume: k.volume || 0, difficulty: k.difficulty || 50 };
  });
  await sb.from('keywords').insert(rows);

  // Return highest volume keyword
  rows.sort(function(a, b) { return b.volume - a.volume; });
  var { data: newKw } = await sb.from('keywords')
    .select('*')
    .eq('site_id', site.id)
    .eq('keyword', rows[0].keyword)
    .limit(1)
    .maybeSingle();
  return newKw;
}

// ─── Generate article via Claude ───
async function generateArticle(sb, site, settings, keyword, profile) {
  var lengthMap = { court: '800-1000', moyen: '1200-1500', long: '1800-2500' };
  var targetLength = lengthMap[settings.article_length || 'moyen'] || '1200-1500';
  var tone = settings.tone || 'professionnel';
  var lang = site.language === 'en' ? 'English' : 'French';

  var systemPrompt = 'Tu es un expert en rédaction de contenu SEO. Tu écris des articles optimisés pour le référencement naturel. '
    + 'Tu produis du contenu unique, informatif et engageant. Tu structures toujours tes articles avec des titres H2 et H3 pertinents. '
    + 'Tu inclus naturellement le mot-clé principal et des variantes sémantiques.';

  var userPrompt = 'Écris un article blog en ' + lang + ' sur le sujet : "' + keyword.keyword + '"\n\n'
    + 'Contexte du site : ' + (site.description || site.domain) + '\n'
    + 'Domaine : ' + site.domain + '\n'
    + 'Ton : ' + tone + '\n'
    + 'Longueur cible : ' + targetLength + ' mots\n\n'
    + 'Format de réponse OBLIGATOIRE (JSON) :\n'
    + '{\n'
    + '  "title": "Titre SEO optimisé (max 60 caractères)",\n'
    + '  "meta_description": "Meta description SEO (max 155 caractères)",\n'
    + '  "content": "Article complet en Markdown avec H2, H3, listes, etc.",\n'
    + '  "seo_score": 85\n'
    + '}\n\n'
    + 'Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.';

  var anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  var msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  var text = msg.content[0].text;
  var jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid AI response');

  var article;
  try { article = JSON.parse(jsonMatch[0]); } catch(e) { throw new Error('Invalid AI JSON response'); }
  var wordCount = (article.content || '').split(/\s+/).length;

  var { data: saved, error: saveErr } = await sb.from('articles').insert({
    site_id: site.id,
    keyword_id: keyword.id,
    title: article.title,
    content: article.content,
    meta_description: article.meta_description,
    word_count: wordCount,
    seo_score: article.seo_score || 80,
    article_type: 'blog',
    status: 'draft',
    scheduled_date: new Date().toISOString().split('T')[0]
  }).select().maybeSingle();

  if (saveErr) throw saveErr;

  // Atomically increment articles_used with optimistic concurrency
  var { data: claimed } = await sb.from('profiles')
    .update({ articles_used: profile.articles_used + 1 })
    .eq('id', profile.id)
    .eq('articles_used', profile.articles_used)
    .lt('articles_used', profile.articles_limit)
    .select('articles_used')
    .maybeSingle();
  if (!claimed) {
    console.error('Autopilot: failed to claim article slot for user ' + profile.id);
  }

  return saved;
}

// ─── Auto-publish to CMS ───
async function autoPublish(sb, site, article, profile) {
  try {
    var htmlContent = markdownToHtml(article.content);
    var pubResult = await publishToCms(site, article, htmlContent);

    var now = new Date().toISOString();
    await sb.from('articles').update({
      status: 'published',
      cms_post_id: pubResult.post_id,
      cms_post_url: pubResult.post_url,
      published_at: now,
      updated_at: now
    }).eq('id', article.id);

    // Send email notification (non-blocking)
    try {
      var userName = (profile.full_name || (profile.email || '').split('@')[0] || 'Utilisateur');
      await sendArticlePublishedEmail(profile.email, userName, article.title, pubResult.post_url, site.domain);
    } catch (emailErr) {
      console.error('Autopilot email error:', emailErr.message);
    }

    return true;
  } catch (pubErr) {
    console.error('Autopilot publish failed for article ' + article.id + ':', pubErr.message);
    return false;
  }
}

// ─── Process a single user ───
async function processUser(sb, settings, results) {
  var userId = settings.user_id;

  // Check frequency
  if (!isDue(settings.publish_frequency, settings.last_autopilot_at)) {
    results.skipped++;
    return;
  }

  // Check plan & limits
  var { data: profile } = await sb.from('profiles')
    .select('id, plan_status, articles_used, articles_limit, email, full_name')
    .eq('id', userId).maybeSingle();

  if (!profile || profile.plan_status !== 'active') { results.skipped++; return; }
  if (profile.articles_used >= profile.articles_limit) { results.skipped++; return; }

  // Get site
  var { data: site } = await sb.from('sites').select('*').eq('user_id', userId).maybeSingle();
  if (!site) { results.skipped++; return; }

  // Pick next keyword from queue
  var keyword = await getNextKeyword(sb, site.id);

  // If no keywords, auto-generate new ones
  if (!keyword) {
    keyword = await autoGenerateKeywords(sb, site);
  }
  if (!keyword) { results.skipped++; return; }

  // Generate article
  var article = await generateArticle(sb, site, settings, keyword, profile);

  // Auto-publish if CMS connected
  if (site.cms_type && site.cms_connected_at) {
    await autoPublish(sb, site, article, profile);
  }

  // Update last_autopilot_at
  await sb.from('settings').update({
    last_autopilot_at: new Date().toISOString()
  }).eq('user_id', userId);

  results.processed++;
}

// ─── Main cron handler ───
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Verify CRON_SECRET
  var authHeader = req.headers.authorization || '';
  if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  var sb = createAdminClient();
  var results = { processed: 0, skipped: 0, errors: [] };

  try {
    // Fetch all autopilot users
    var { data: autopilotUsers } = await sb
      .from('settings')
      .select('user_id, publish_frequency, last_autopilot_at, tone, article_length')
      .eq('autopilot', true);

    if (!autopilotUsers || !autopilotUsers.length) {
      return res.status(200).json({ message: 'No autopilot users', results: results });
    }

    // Process batch (max BATCH_LIMIT users per run)
    var batch = autopilotUsers.slice(0, BATCH_LIMIT);

    for (var i = 0; i < batch.length; i++) {
      try {
        await processUser(sb, batch[i], results);
      } catch (err) {
        console.error('Autopilot error for user ' + batch[i].user_id + ':', err.message);
        results.errors.push({ user_id: batch[i].user_id, error: 'processing_error' });
      }
    }

    console.log('Autopilot cron complete:', JSON.stringify(results));
    return res.status(200).json({ message: 'Autopilot complete', processed: results.processed, skipped: results.skipped, errors_count: results.errors.length });
  } catch (err) {
    console.error('Autopilot cron error:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
