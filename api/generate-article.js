const Anthropic = require('@anthropic-ai/sdk');
const { createAdminClient, getUser, cors } = require('./_lib/supabase');
const { publishToCms, markdownToHtml } = require('./_lib/cms-publish');
const { sendArticlePublishedEmail } = require('./_lib/emails');

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    var sb = createAdminClient();

    // Check plan & limits with optimistic concurrency lock
    var { data: profile } = await sb.from('profiles').select('plan_status, articles_used, articles_limit').eq('id', user.id).maybeSingle();
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });
    if (profile.plan_status !== 'active') {
      return res.status(403).json({ error: 'Abonnement inactif. Veuillez activer votre plan.' });
    }
    if (profile.articles_used >= profile.articles_limit) {
      return res.status(403).json({ error: 'Limite d\'articles atteinte ce mois-ci (' + profile.articles_limit + ').' });
    }

    // Atomically claim a slot using optimistic concurrency
    var { data: claimed } = await sb.from('profiles')
      .update({ articles_used: profile.articles_used + 1 })
      .eq('id', user.id)
      .eq('articles_used', profile.articles_used)
      .lt('articles_used', profile.articles_limit)
      .select('articles_used')
      .maybeSingle();
    if (!claimed) {
      return res.status(409).json({ error: 'Limite atteinte ou requête concurrente. Réessayez.' });
    }

    // Get site info
    var { data: site } = await sb.from('sites').select('*').eq('user_id', user.id).maybeSingle();
    if (!site) return res.status(400).json({ error: 'Aucun site configuré.' });

    // Get settings
    var { data: settings } = await sb.from('settings').select('tone, article_length, auto_publish').eq('user_id', user.id).maybeSingle();

    var { keyword, article_type, keyword_id } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Mot-clé requis' });
    var safeKeyword = String(keyword).substring(0, 200);
    var VALID_TYPES = ['blog', 'guide', 'listicle', 'how-to', 'review', 'comparison', 'pillar'];
    var safeType = VALID_TYPES.indexOf(article_type) !== -1 ? article_type : 'blog';

    var lengthMap = { court: '800-1000', moyen: '1200-1500', long: '1800-2500' };
    var targetLength = lengthMap[(settings && settings.article_length) || 'moyen'] || '1200-1500';
    var tone = (settings && settings.tone) || 'professionnel';
    var lang = site.language === 'en' ? 'English' : 'French';

    var systemPrompt = 'Tu es un expert en rédaction de contenu SEO. Tu écris des articles optimisés pour le référencement naturel. '
      + 'Tu produis du contenu unique, informatif et engageant. Tu structures toujours tes articles avec des titres H2 et H3 pertinents. '
      + 'Tu inclus naturellement le mot-clé principal et des variantes sémantiques.';

    var userPrompt = 'Écris un article ' + safeType + ' en ' + lang + ' sur le sujet : "' + safeKeyword + '"\n\n'
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
    var msg;
    try {
      msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });
    } catch (aiErr) {
      // Rollback the claimed slot on AI failure
      await sb.rpc('decrement_articles_used', { uid: user.id }).catch(function() {
        // Fallback if RPC not available: use optimistic rollback
        sb.from('profiles').update({ articles_used: profile.articles_used }).eq('id', user.id).eq('articles_used', profile.articles_used + 1);
      });
      console.error('AI generation error:', aiErr);
      return res.status(500).json({ error: 'Erreur de génération IA' });
    }

    var text = msg.content[0].text;
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Rollback the claimed slot on invalid response
      await sb.rpc('decrement_articles_used', { uid: user.id }).catch(function() {
        // Fallback if RPC not available: use optimistic rollback
        sb.from('profiles').update({ articles_used: profile.articles_used }).eq('id', user.id).eq('articles_used', profile.articles_used + 1);
      });
      return res.status(500).json({ error: 'Réponse IA invalide' });
    }

    var article;
    try {
      article = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      // Rollback the claimed slot on parse failure
      await sb.rpc('decrement_articles_used', { uid: user.id }).catch(function() {
        // Fallback if RPC not available: use optimistic rollback
        sb.from('profiles').update({ articles_used: profile.articles_used }).eq('id', user.id).eq('articles_used', profile.articles_used + 1);
      });
      return res.status(500).json({ error: 'Réponse IA invalide' });
    }
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
      article_type: safeType,
      status: 'draft',
      scheduled_date: new Date().toISOString().split('T')[0]
    }).select().maybeSingle();

    if (saveErr) {
      // Rollback the claimed slot on save failure
      await sb.rpc('decrement_articles_used', { uid: user.id }).catch(function() {
        // Fallback if RPC not available: use optimistic rollback
        sb.from('profiles').update({ articles_used: profile.articles_used }).eq('id', user.id).eq('articles_used', profile.articles_used + 1);
      });
      throw saveErr;
    }

    // --- AUTO-PUBLISH: if enabled and CMS connected ---
    var autoPublished = false;
    var publishError = null;

    if (settings && settings.auto_publish && site.cms_type && site.cms_connected_at) {
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

        // Send email notification (non-blocking)
        try {
          var userEmail = user.email;
          var userName = user.user_metadata?.full_name || userEmail.split('@')[0];
          await sendArticlePublishedEmail(userEmail, userName, saved.title, pubResult.post_url, site.domain);
        } catch (emailErr) { console.error('Article published email error:', emailErr.message); }
      } catch (pubErr) {
        // Non-blocking: article stays as draft
        console.error('Auto-publish failed:', pubErr.message);
        publishError = 'Échec de la publication automatique';
      }
    }

    return res.status(200).json({
      article: saved,
      remaining: profile.articles_limit - (profile.articles_used + 1),
      auto_published: autoPublished,
      publish_error: publishError
    });
  } catch (err) {
    console.error('Generate article error:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
