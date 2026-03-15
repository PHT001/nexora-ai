const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    var sb = createAdminClient();

    // Get profile (exclude stripe_customer_id from response)
    var { data: profile } = await sb
      .from('profiles')
      .select('id, email, full_name, avatar_url, plan, plan_status, articles_used, articles_limit, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    // Get site (exclude sensitive CMS credentials)
    var { data: site } = await sb
      .from('sites')
      .select('id, user_id, url, domain, language, description, audiences, goals, niche, cms_type, cms_url, cms_connected_at, cms_extra, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get settings
    var { data: settings } = await sb
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get article count
    var articleCount = 0;
    var lastArticle = null;
    if (site) {
      var { count } = await sb
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', site.id)
        .eq('status', 'published');
      articleCount = count || 0;

      var { data: lastArt } = await sb
        .from('articles')
        .select('title, seo_score, word_count, article_type, created_at')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      lastArticle = lastArt;
    }

    // Get latest audit score
    var auditScore = null;
    if (site) {
      var { data: audit } = await sb
        .from('audits')
        .select('id, site_id, overall_score, performance_score, seo_score, accessibility_score, best_practices_score, speed_mobile, speed_desktop, fcp, lcp, issues, created_at')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      auditScore = audit;
    }

    return res.status(200).json({
      profile: profile,
      site: site,
      settings: settings,
      stats: {
        articles_published: articleCount,
        last_article: lastArticle,
        audit_score: auditScore
      }
    });
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
