const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    var sb = createAdminClient();

    // Get profile
    var { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Get site
    var { data: site } = await sb
      .from('sites')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get settings
    var { data: settings } = await sb
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

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
        .select('title, created_at')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      lastArticle = lastArt;
    }

    // Get latest audit score
    var auditScore = null;
    if (site) {
      var { data: audit } = await sb
        .from('audits')
        .select('overall_score, created_at')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
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
    return res.status(500).json({ error: err.message });
  }
};
