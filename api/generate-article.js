const Anthropic = require('@anthropic-ai/sdk');
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

    // Check plan & limits
    var { data: profile } = await sb.from('profiles').select('plan_status, articles_used, articles_limit').eq('id', user.id).single();
    if (profile.plan_status !== 'active') {
      return res.status(403).json({ error: 'Abonnement inactif. Veuillez activer votre plan.' });
    }
    if (profile.articles_used >= profile.articles_limit) {
      return res.status(403).json({ error: 'Limite d\'articles atteinte ce mois-ci (' + profile.articles_limit + ').' });
    }

    // Get site info
    var { data: site } = await sb.from('sites').select('*').eq('user_id', user.id).single();
    if (!site) return res.status(400).json({ error: 'Aucun site configuré.' });

    // Get settings
    var { data: settings } = await sb.from('settings').select('tone, article_length').eq('user_id', user.id).single();

    var { keyword, article_type, keyword_id } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Mot-clé requis' });

    var lengthMap = { court: '800-1000', moyen: '1200-1500', long: '1800-2500' };
    var targetLength = lengthMap[(settings && settings.article_length) || 'moyen'] || '1200-1500';
    var tone = (settings && settings.tone) || 'professionnel';
    var lang = site.language === 'en' ? 'English' : 'French';

    var systemPrompt = 'Tu es un expert en rédaction de contenu SEO. Tu écris des articles optimisés pour le référencement naturel. '
      + 'Tu produis du contenu unique, informatif et engageant. Tu structures toujours tes articles avec des titres H2 et H3 pertinents. '
      + 'Tu inclus naturellement le mot-clé principal et des variantes sémantiques.';

    var userPrompt = 'Écris un article ' + (article_type || 'blog') + ' en ' + lang + ' sur le sujet : "' + keyword + '"\n\n'
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
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Réponse IA invalide' });
    }

    var article = JSON.parse(jsonMatch[0]);
    var wordCount = (article.content || '').split(/\s+/).length;

    // Save to database
    var { data: saved, error: saveErr } = await sb.from('articles').insert({
      site_id: site.id,
      keyword_id: keyword_id || null,
      title: article.title,
      content: article.content,
      meta_description: article.meta_description,
      word_count: wordCount,
      seo_score: article.seo_score || 80,
      article_type: article_type || 'blog',
      status: 'draft',
      scheduled_date: new Date().toISOString().split('T')[0]
    }).select().single();

    if (saveErr) throw saveErr;

    // Increment articles_used
    await sb.from('profiles').update({
      articles_used: profile.articles_used + 1
    }).eq('id', user.id);

    // --- AUTO-PUBLISH: if enabled and CMS connected ---
    var autoPublished = false;
    var publishError = null;

    var { data: settingsData } = await sb.from('settings').select('auto_publish').eq('user_id', user.id).single();

    if (settingsData && settingsData.auto_publish && site.cms_type && site.cms_connected_at) {
      try {
        var htmlContent = markdownToHtml(saved.content);
        var pubResult = await publishToCms(site, saved, htmlContent);

        var now = new Date().toISOString();
        await sb.from('articles').update({
          status: 'published',
          cms_post_id: pubResult.post_id,
          cms_post_url: pubResult.post_url,
          published_at: now,
          updated_at: now
        }).eq('id', saved.id);

        saved.status = 'published';
        saved.cms_post_id = pubResult.post_id;
        saved.cms_post_url = pubResult.post_url;
        autoPublished = true;
      } catch (pubErr) {
        // Non-blocking: article stays as draft
        console.error('Auto-publish failed:', pubErr.message);
        publishError = pubErr.message;
      }
    }

    return res.status(200).json({
      article: saved,
      remaining: profile.articles_limit - profile.articles_used - 1,
      auto_published: autoPublished,
      publish_error: publishError
    });
  } catch (err) {
    console.error('Generate article error:', err);
    return res.status(500).json({ error: err.message });
  }
};
