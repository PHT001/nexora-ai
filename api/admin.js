const { createAdminClient, getUser, cors } = require('./_lib/supabase');
const { wrapLayout } = require('./_lib/emails');
const { Resend } = require('resend');

// ── Admin auth check ──
function isAdmin(email) {
  if (!email) return false;
  var adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(function(e) { return e; });
  if (adminEmails.length === 0) return false;
  return adminEmails.indexOf(email.toLowerCase()) !== -1;
}

// ── Input sanitization helpers ──
function sanitizeSearch(s) {
  // Remove PostgREST special chars that could manipulate filters
  return String(s || '').replace(/[%_\\().,]/g, '').substring(0, 100);
}

var VALID_PLANS = ['free', 'starter', 'pro', 'business', 'all-in-one'];
var VALID_STATUSES = ['active', 'inactive', 'past_due'];

function isValidUUID(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });
  if (!isAdmin(user.email)) return res.status(403).json({ error: 'Accès refusé' });

  var sb = createAdminClient();
  var action = req.method === 'POST' ? (req.body && req.body.action) : (req.query.action || 'dashboard');

  try {

    // ════════════════════════════════════════
    // GET: dashboard — KPIs + chart data
    // ════════════════════════════════════════
    if (action === 'dashboard' && req.method === 'GET') {
      var { count: totalUsers } = await sb.from('profiles').select('id', { count: 'exact', head: true });
      var { count: activeUsers } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('plan_status', 'active');
      var { count: pastDueUsers } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('plan_status', 'past_due');
      var { count: churnedUsers } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('plan_status', 'inactive').not('stripe_customer_id', 'is', null);
      var freeUsers = (totalUsers || 0) - (activeUsers || 0) - (pastDueUsers || 0) - (churnedUsers || 0);

      var { count: totalArticles } = await sb.from('articles').select('id', { count: 'exact', head: true });
      var { count: publishedArticles } = await sb.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published');
      var weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      var { count: articlesThisWeek } = await sb.from('articles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo);
      var monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      var { count: articlesThisMonth } = await sb.from('articles').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo);

      var { count: autopilotUsers } = await sb.from('settings').select('user_id', { count: 'exact', head: true }).eq('autopilot', true);
      var { count: cmsUsers } = await sb.from('sites').select('id', { count: 'exact', head: true }).not('cms_type', 'is', null);
      var { count: totalSites } = await sb.from('sites').select('id', { count: 'exact', head: true });

      // Articles per day (last 14 days)
      var fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      var { data: recentArticles } = await sb.from('articles').select('created_at').gte('created_at', fourteenDaysAgo).order('created_at', { ascending: true });
      var dailyCounts = {};
      for (var d = 13; d >= 0; d--) {
        var date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
        var key = date.toISOString().split('T')[0];
        dailyCounts[key] = 0;
      }
      (recentArticles || []).forEach(function(a) {
        var day = a.created_at.split('T')[0];
        if (dailyCounts[day] !== undefined) dailyCounts[day]++;
      });

      // Recent signups
      var { data: recentSignups } = await sb.from('profiles').select('email, full_name, plan_status, created_at').order('created_at', { ascending: false }).limit(10);

      // Computed KPIs
      var conversionRate = Math.round(((activeUsers || 0) / (totalUsers || 1)) * 100);
      var churnRate = Math.round(((churnedUsers || 0) / ((activeUsers || 0) + (churnedUsers || 0) || 1)) * 100);
      var estimatedMRR = (activeUsers || 0) * (parseInt(process.env.PLAN_PRICE) || 29);

      return res.status(200).json({
        stats: {
          totalUsers: totalUsers || 0, activeUsers: activeUsers || 0, pastDueUsers: pastDueUsers || 0,
          churnedUsers: churnedUsers || 0, freeUsers: freeUsers > 0 ? freeUsers : 0,
          totalArticles: totalArticles || 0, publishedArticles: publishedArticles || 0,
          articlesThisWeek: articlesThisWeek || 0, articlesThisMonth: articlesThisMonth || 0,
          autopilotUsers: autopilotUsers || 0, cmsUsers: cmsUsers || 0, totalSites: totalSites || 0,
          conversionRate: conversionRate, churnRate: churnRate, estimatedMRR: estimatedMRR
        },
        dailyArticles: dailyCounts,
        recentSignups: recentSignups || []
      });
    }

    // ════════════════════════════════════════
    // GET: users — Paginated user list
    // ════════════════════════════════════════
    if (action === 'users' && req.method === 'GET') {
      var page = Math.max(1, Math.min(parseInt(req.query.page) || 1, 1000));
      var limit = 25;
      var offset = (page - 1) * limit;
      var search = sanitizeSearch(req.query.search);

      var query = sb.from('profiles').select('id, email, full_name, plan, plan_status, articles_used, articles_limit, stripe_customer_id, created_at', { count: 'exact' });
      if (search) {
        query = query.or('email.ilike.%' + search + '%,full_name.ilike.%' + search + '%');
      }
      var planFilter = (req.query.plan_status || '').trim();
      if (planFilter && planFilter !== 'all') {
        if (planFilter === 'free') { query = query.is('stripe_customer_id', null); }
        else if (VALID_STATUSES.indexOf(planFilter) !== -1) { query = query.eq('plan_status', planFilter); }
      }

      var { data: profiles, count: totalCount } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (!profiles || profiles.length === 0) {
        return res.status(200).json({ users: [], total: 0, page: page, totalPages: 0 });
      }

      var userIds = profiles.map(function(p) { return p.id; });
      var { data: sites } = await sb.from('sites').select('user_id, domain, cms_type, cms_connected_at, id').in('user_id', userIds);
      var { data: settings } = await sb.from('settings').select('user_id, autopilot, publish_frequency, last_autopilot_at').in('user_id', userIds);

      // Get last article date per site
      var siteIds = (sites || []).map(function(s) { return s.id; });
      var lastArticleMap = {};
      if (siteIds.length > 0) {
        var { data: lastArticles } = await sb.from('articles').select('site_id, created_at').in('site_id', siteIds).order('created_at', { ascending: false });
        var seenSites = {};
        (lastArticles || []).forEach(function(a) {
          if (!seenSites[a.site_id]) {
            seenSites[a.site_id] = true;
            var site = (sites || []).find(function(s) { return s.id === a.site_id; });
            if (site) lastArticleMap[site.user_id] = a.created_at;
          }
        });
      }

      var sitesMap = {};
      (sites || []).forEach(function(s) { sitesMap[s.user_id] = s; });
      var settingsMap = {};
      (settings || []).forEach(function(s) { settingsMap[s.user_id] = s; });

      var users = profiles.map(function(p) {
        var site = sitesMap[p.id] || {};
        var setting = settingsMap[p.id] || {};
        var lastArt = lastArticleMap[p.id] || null;
        var lastAuto = setting.last_autopilot_at || null;
        var lastActivity = null;
        if (lastArt && lastAuto) lastActivity = new Date(lastArt) > new Date(lastAuto) ? lastArt : lastAuto;
        else lastActivity = lastArt || lastAuto || p.created_at;

        return {
          id: p.id, email: p.email, full_name: p.full_name, plan: p.plan,
          plan_status: p.plan_status, articles_used: p.articles_used, articles_limit: p.articles_limit,
          has_stripe: !!p.stripe_customer_id, domain: site.domain || null,
          cms_type: site.cms_type || null, cms_connected: !!site.cms_connected_at,
          autopilot: setting.autopilot || false, publish_frequency: setting.publish_frequency || null,
          last_autopilot_at: setting.last_autopilot_at || null, last_activity: lastActivity,
          created_at: p.created_at
        };
      });

      return res.status(200).json({ users: users, total: totalCount || 0, page: page, totalPages: Math.ceil((totalCount || 0) / limit) });
    }

    // ════════════════════════════════════════
    // GET: user-detail — Full user profile
    // ════════════════════════════════════════
    if (action === 'user-detail' && req.method === 'GET') {
      var userId = req.query.id;
      if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'ID invalide' });

      var { data: profile } = await sb.from('profiles').select('id, email, full_name, plan, plan_status, articles_used, articles_limit, stripe_customer_id, created_at, updated_at').eq('id', userId).maybeSingle();
      if (!profile) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      // Explicit columns — exclude cms_api_key, cms_username, cms_extra (sensitive)
      var { data: site } = await sb.from('sites').select('id, user_id, domain, niche, language, description, audiences, goals, cms_type, cms_url, cms_connected_at, created_at').eq('user_id', userId).maybeSingle();
      var articles = [], keywords = [], audit = null;

      if (site) {
        var [artRes, kwRes, auditRes] = await Promise.all([
          sb.from('articles').select('id, title, word_count, seo_score, article_type, status, cms_post_url, cms_post_id, published_at, created_at').eq('site_id', site.id).order('created_at', { ascending: false }).limit(50),
          sb.from('keywords').select('keyword, volume, difficulty, position, trend').eq('site_id', site.id).order('volume', { ascending: false }).limit(30),
          sb.from('audits').select('overall_score, performance_score, seo_score, accessibility_score, best_practices_score, speed_mobile, speed_desktop, fcp, lcp, issues, created_at').eq('site_id', site.id).order('created_at', { ascending: false }).limit(1)
        ]);
        articles = artRes.data || [];
        keywords = kwRes.data || [];
        audit = (auditRes.data && auditRes.data[0]) || null;
      }

      var { data: settings } = await sb.from('settings').select('user_id, autopilot, publish_frequency, last_autopilot_at, tone, article_length, brand_name, brand_color, competitors, created_at, updated_at').eq('user_id', userId).maybeSingle();
      return res.status(200).json({ profile: profile, site: site, articles: articles, keywords: keywords, audit: audit, settings: settings });
    }

    // ════════════════════════════════════════
    // GET: user-counts — Data counts for delete preview
    // ════════════════════════════════════════
    if (action === 'user-counts' && req.method === 'GET') {
      var userId = req.query.id;
      if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'ID invalide' });

      var { data: userSites } = await sb.from('sites').select('id').eq('user_id', userId);
      var siteIds = (userSites || []).map(function(s) { return s.id; });

      var articleCount = 0, keywordCount = 0, auditCount = 0;
      if (siteIds.length > 0) {
        var [artRes, kwRes, audRes] = await Promise.all([
          sb.from('articles').select('id', { count: 'exact', head: true }).in('site_id', siteIds),
          sb.from('keywords').select('id', { count: 'exact', head: true }).in('site_id', siteIds),
          sb.from('audits').select('id', { count: 'exact', head: true }).in('site_id', siteIds)
        ]);
        articleCount = artRes.count || 0;
        keywordCount = kwRes.count || 0;
        auditCount = audRes.count || 0;
      }

      return res.status(200).json({ sites: siteIds.length, articles: articleCount, keywords: keywordCount, audits: auditCount });
    }

    // ════════════════════════════════════════
    // GET: articles — All articles (paginated)
    // ════════════════════════════════════════
    if (action === 'articles' && req.method === 'GET') {
      var page = Math.max(1, Math.min(parseInt(req.query.page) || 1, 1000));
      var limit = 25;
      var offset = (page - 1) * limit;
      var statusFilter = (req.query.status || '').trim();
      var search = sanitizeSearch(req.query.search);

      var query = sb.from('articles').select('id, title, word_count, seo_score, status, cms_post_url, published_at, created_at, site_id', { count: 'exact' });
      if (statusFilter && statusFilter !== 'all' && ['draft', 'published'].indexOf(statusFilter) !== -1) {
        query = query.eq('status', statusFilter);
      }
      if (search) { query = query.ilike('title', '%' + search + '%'); }

      var { data: articlesList, count: totalCount } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (!articlesList || articlesList.length === 0) {
        return res.status(200).json({ articles: [], total: 0, page: page, totalPages: 0 });
      }

      var siteIds = [];
      articlesList.forEach(function(a) { if (a.site_id && siteIds.indexOf(a.site_id) === -1) siteIds.push(a.site_id); });
      var sitesMap = {}, usersMap = {};
      if (siteIds.length > 0) {
        var { data: sites } = await sb.from('sites').select('id, user_id, domain').in('id', siteIds);
        (sites || []).forEach(function(s) { sitesMap[s.id] = s; });
        var userIds = [];
        (sites || []).forEach(function(s) { if (s.user_id && userIds.indexOf(s.user_id) === -1) userIds.push(s.user_id); });
        if (userIds.length > 0) {
          var { data: users } = await sb.from('profiles').select('id, email, full_name').in('id', userIds);
          (users || []).forEach(function(u) { usersMap[u.id] = u; });
        }
      }

      var enriched = articlesList.map(function(a) {
        var site = sitesMap[a.site_id] || {};
        var user = usersMap[site.user_id] || {};
        return {
          id: a.id, title: a.title, word_count: a.word_count, seo_score: a.seo_score,
          status: a.status, cms_post_url: a.cms_post_url, published_at: a.published_at, created_at: a.created_at,
          domain: site.domain || null, user_email: user.email || null, user_name: user.full_name || null
        };
      });

      return res.status(200).json({ articles: enriched, total: totalCount || 0, page: page, totalPages: Math.ceil((totalCount || 0) / limit) });
    }

    // ════════════════════════════════════════
    // GET: activity — Unified activity feed
    // ════════════════════════════════════════
    if (action === 'activity' && req.method === 'GET') {
      var feedLimit = Math.min(parseInt(req.query.limit) || 50, 100);
      var [signupsRes, articlesRes, publishedRes, cmsRes, autopilotRes] = await Promise.all([
        sb.from('profiles').select('email, full_name, created_at').order('created_at', { ascending: false }).limit(20),
        sb.from('articles').select('title, status, created_at, site_id').order('created_at', { ascending: false }).limit(20),
        sb.from('articles').select('title, published_at, cms_post_url, site_id').not('published_at', 'is', null).order('published_at', { ascending: false }).limit(20),
        sb.from('sites').select('domain, cms_type, cms_connected_at, user_id').not('cms_connected_at', 'is', null).order('cms_connected_at', { ascending: false }).limit(10),
        sb.from('settings').select('user_id, last_autopilot_at').not('last_autopilot_at', 'is', null).order('last_autopilot_at', { ascending: false }).limit(10)
      ]);

      var resolveIds = [];
      (cmsRes.data || []).forEach(function(c) { if (c.user_id && resolveIds.indexOf(c.user_id) === -1) resolveIds.push(c.user_id); });
      (autopilotRes.data || []).forEach(function(a) { if (a.user_id && resolveIds.indexOf(a.user_id) === -1) resolveIds.push(a.user_id); });
      var artSiteIds = [];
      (articlesRes.data || []).concat(publishedRes.data || []).forEach(function(a) { if (a.site_id && artSiteIds.indexOf(a.site_id) === -1) artSiteIds.push(a.site_id); });

      var userMap = {}, siteMap = {};
      if (resolveIds.length > 0) {
        var { data: resolvedUsers } = await sb.from('profiles').select('id, email, full_name').in('id', resolveIds);
        (resolvedUsers || []).forEach(function(u) { userMap[u.id] = u; });
      }
      if (artSiteIds.length > 0) {
        var { data: resolvedSites } = await sb.from('sites').select('id, domain').in('id', artSiteIds);
        (resolvedSites || []).forEach(function(s) { siteMap[s.id] = s; });
      }

      var events = [];
      (signupsRes.data || []).forEach(function(s) { events.push({ type: 'signup', user_name: s.full_name || s.email.split('@')[0], user_email: s.email, timestamp: s.created_at }); });
      (articlesRes.data || []).forEach(function(a) { var site = siteMap[a.site_id] || {}; events.push({ type: 'article_created', title: a.title, domain: site.domain || '—', timestamp: a.created_at }); });
      (publishedRes.data || []).forEach(function(a) { var site = siteMap[a.site_id] || {}; events.push({ type: 'article_published', title: a.title, domain: site.domain || '—', cms_url: a.cms_post_url, timestamp: a.published_at }); });
      (cmsRes.data || []).forEach(function(c) { var u = userMap[c.user_id] || {}; events.push({ type: 'cms_connected', domain: c.domain, cms_type: c.cms_type, user_email: u.email || '—', timestamp: c.cms_connected_at }); });
      (autopilotRes.data || []).forEach(function(a) { var u = userMap[a.user_id] || {}; events.push({ type: 'autopilot_run', user_email: u.email || '—', timestamp: a.last_autopilot_at }); });

      events.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
      return res.status(200).json({ events: events.slice(0, feedLimit) });
    }

    // ════════════════════════════════════════════════
    // POST: delete-user — Cascade delete all user data
    // ════════════════════════════════════════════════
    if (action === 'delete-user' && req.method === 'POST') {
      var userId = req.body.userId;
      if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'userId invalide' });

      // Cancel Stripe subscription before deleting
      var { data: profileToDelete } = await sb.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle();
      if (profileToDelete && profileToDelete.stripe_customer_id) {
        try {
          var stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          var subscriptions = await stripe.subscriptions.list({ customer: profileToDelete.stripe_customer_id, limit: 10 });
          for (var i = 0; i < (subscriptions.data || []).length; i++) {
            var sub = subscriptions.data[i];
            if (sub.status !== 'canceled') {
              await stripe.subscriptions.cancel(sub.id);
            }
          }
        } catch (stripeErr) { console.error('Stripe cancel error:', stripeErr.message); }
      }

      var { data: userSites } = await sb.from('sites').select('id').eq('user_id', userId);
      var siteIds = (userSites || []).map(function(s) { return s.id; });

      // Delete in dependency order
      await sb.from('settings').delete().eq('user_id', userId);
      if (siteIds.length > 0) {
        await Promise.all([
          sb.from('keywords').delete().in('site_id', siteIds),
          sb.from('articles').delete().in('site_id', siteIds),
          sb.from('audits').delete().in('site_id', siteIds)
        ]);
      }
      await sb.from('sites').delete().eq('user_id', userId);
      await sb.from('profiles').delete().eq('id', userId);

      // Delete Supabase auth user
      var { error: authError } = await sb.auth.admin.deleteUser(userId);
      if (authError) console.error('Auth delete error:', authError);

      return res.status(200).json({ success: true });
    }

    // ════════════════════════════════════════
    // POST: update-user — Edit user profile
    // ════════════════════════════════════════
    if (action === 'update-user' && req.method === 'POST') {
      var userId = req.body.userId;
      if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'userId invalide' });

      var updates = {};
      if (req.body.full_name !== undefined) {
        updates.full_name = String(req.body.full_name).substring(0, 200);
      }
      if (req.body.plan !== undefined) {
        if (VALID_PLANS.indexOf(req.body.plan) === -1) return res.status(400).json({ error: 'Plan invalide' });
        updates.plan = req.body.plan;
      }
      if (req.body.plan_status !== undefined) {
        if (VALID_STATUSES.indexOf(req.body.plan_status) === -1) return res.status(400).json({ error: 'Statut invalide' });
        updates.plan_status = req.body.plan_status;
      }
      if (req.body.articles_limit !== undefined) {
        var limit = parseInt(req.body.articles_limit);
        if (isNaN(limit) || limit < 0 || limit > 9999) return res.status(400).json({ error: 'Limite invalide (0-9999)' });
        updates.articles_limit = limit;
      }
      updates.updated_at = new Date().toISOString();

      var { data: updated, error } = await sb.from('profiles').update(updates).eq('id', userId).select().maybeSingle();
      if (error) throw error;
      return res.status(200).json({ profile: updated });
    }

    // ════════════════════════════════════════
    // POST: send-email — Send email to user
    // ════════════════════════════════════════
    if (action === 'send-email' && req.method === 'POST') {
      var userId = req.body.userId;
      var subject = (req.body.subject || '').substring(0, 200);
      var message = (req.body.message || '').substring(0, 5000);
      if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'userId invalide' });
      if (!subject || !message) return res.status(400).json({ error: 'Sujet et message requis' });

      var { data: profile } = await sb.from('profiles').select('email, full_name').eq('id', userId).maybeSingle();
      if (!profile) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      // Sanitize message for HTML
      var htmlMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
      var safeSubject = subject.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      var resendClient = new Resend(process.env.RESEND_API_KEY);
      var FROM = process.env.RESEND_FROM_EMAIL || 'Seora <onboarding@resend.dev>';

      await resendClient.emails.send({
        from: FROM,
        to: profile.email,
        subject: subject,
        html: wrapLayout(
          '<h1 style="font-size:22px;color:#1a1a1a;margin:0 0 16px;">' + safeSubject + '</h1>'
          + '<div style="font-size:15px;color:#555;line-height:1.7;">' + htmlMessage + '</div>'
        )
      });

      return res.status(200).json({ success: true, sentTo: profile.email });
    }

    // ════════════════════════════════════════
    // POST: delete-article — Delete any article
    // ════════════════════════════════════════
    if (action === 'delete-article' && req.method === 'POST') {
      var articleId = req.body.articleId;
      if (!articleId || !isValidUUID(articleId)) return res.status(400).json({ error: 'articleId invalide' });
      await sb.from('articles').delete().eq('id', articleId);
      return res.status(200).json({ success: true });
    }

    // ════════════════════════════════════════
    // POST: toggle-autopilot — Enable/disable
    // ════════════════════════════════════════
    if (action === 'toggle-autopilot' && req.method === 'POST') {
      var userId = req.body.userId;
      var enabled = req.body.enabled;
      if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'userId invalide' });
      var { error } = await sb.from('settings').update({ autopilot: !!enabled, updated_at: new Date().toISOString() }).eq('user_id', userId);
      if (error) throw error;
      return res.status(200).json({ success: true, autopilot: !!enabled });
    }

    // ════════════════════════════════════════
    // POST: disconnect-cms — Remove CMS config
    // ════════════════════════════════════════
    if (action === 'disconnect-cms' && req.method === 'POST') {
      var userId = req.body.userId;
      if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'userId invalide' });
      var { error } = await sb.from('sites').update({
        cms_type: null, cms_url: null, cms_api_key: null, cms_username: null, cms_extra: {}, cms_connected_at: null
      }).eq('user_id', userId);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Action invalide' });
  } catch (err) {
    console.error('Admin error:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
