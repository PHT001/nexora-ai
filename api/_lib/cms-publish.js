/**
 * Seora — Shared CMS Publishing Module
 * WordPress, Shopify, Webflow, Ghost, Wix, Framer,
 * GoHighLevel, Duda, BigCommerce, API, Webhook
 */

var crypto = require('crypto');

// ---- Markdown → HTML converter ----
function markdownToHtml(md) {
  if (!md) return '';
  var html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n+/g, '\n</p>\n<p>\n')
    .replace(/^(?!<[hulo])(.+)$/gm, '$1');

  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[123]>)/g, '$1');
  html = html.replace(/(<\/h[123]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');

  return html;
}

// ---- Slugify ----
function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

// ---- Ghost JWT helper ----
function createGhostToken(apiKey) {
  var parts = apiKey.split(':');
  if (parts.length !== 2) throw new Error('Clé API Ghost invalide. Format attendu: {id}:{secret}');
  var id = parts[0];
  var secret = Buffer.from(parts[1], 'hex');

  var header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
  var now = Math.floor(Date.now() / 1000);
  var payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64url');

  var sig = crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + sig;
}

// ──────────────────────────────────────────
// ---- WordPress Publisher ----
// ──────────────────────────────────────────
async function publishToWordPress(site, article, htmlContent) {
  var credentials = Buffer.from((site.cms_username || '') + ':' + (site.cms_api_key || '')).toString('base64');
  var wpUrl = site.cms_url.replace(/\/+$/, '') + '/wp-json/wp/v2/posts';

  var response = await fetch(wpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + credentials
    },
    body: JSON.stringify({
      title: article.title,
      content: htmlContent,
      status: 'publish',
      excerpt: article.meta_description || '',
      format: 'standard'
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('WordPress (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var wpPost = await response.json();
  return { post_id: String(wpPost.id), post_url: wpPost.link || '' };
}

// ──────────────────────────────────────────
// ---- Shopify Publisher ----
// ──────────────────────────────────────────
async function publishToShopify(site, article, htmlContent) {
  var blogId = (site.cms_extra && site.cms_extra.blog_id) || '';
  if (!blogId) throw new Error('Blog ID Shopify non configuré.');

  var shopDomain = site.cms_url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  var shopifyUrl = 'https://' + shopDomain + '/admin/api/2024-01/blogs/' + blogId + '/articles.json';

  var response = await fetch(shopifyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': site.cms_api_key
    },
    body: JSON.stringify({
      article: {
        title: article.title,
        body_html: htmlContent,
        summary_html: article.meta_description || '',
        published: true
      }
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('Shopify (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var shopifyResult = await response.json();
  return {
    post_id: String(shopifyResult.article.id),
    post_url: 'https://' + shopDomain + '/blogs/' + blogId + '/' + (shopifyResult.article.handle || '')
  };
}

// ──────────────────────────────────────────
// ---- Webflow Publisher ----
// ──────────────────────────────────────────
async function publishToWebflow(site, article, htmlContent) {
  var collectionId = (site.cms_extra && site.cms_extra.collection_id) || '';
  if (!collectionId) throw new Error('Collection ID Webflow non configuré.');

  var response = await fetch('https://api.webflow.com/v2/collections/' + collectionId + '/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + site.cms_api_key
    },
    body: JSON.stringify({
      isArchived: false,
      isDraft: false,
      fieldData: {
        name: article.title,
        slug: slugify(article.title),
        'post-body': htmlContent,
        'post-summary': article.meta_description || ''
      }
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('Webflow (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var wfResult = await response.json();
  return { post_id: wfResult.id || '', post_url: '' };
}

// ──────────────────────────────────────────
// ---- Ghost Publisher ----
// ──────────────────────────────────────────
async function publishToGhost(site, article, htmlContent) {
  var token = createGhostToken(site.cms_api_key);
  var ghostUrl = site.cms_url.replace(/\/+$/, '') + '/ghost/api/admin/posts/?source=html';

  var response = await fetch(ghostUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Ghost ' + token
    },
    body: JSON.stringify({
      posts: [{
        title: article.title,
        html: htmlContent,
        custom_excerpt: article.meta_description || '',
        meta_description: article.meta_description || '',
        status: 'published',
        slug: slugify(article.title)
      }]
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('Ghost (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var ghostResult = await response.json();
  var post = ghostResult.posts && ghostResult.posts[0];
  return {
    post_id: post ? post.id : '',
    post_url: post ? post.url : ''
  };
}

// ──────────────────────────────────────────
// ---- Wix Publisher ----
// ──────────────────────────────────────────
async function publishToWix(site, article, htmlContent) {
  // Build richContent nodes from article content
  var contentText = (article.content || '').replace(/[#*_`\[\]()]/g, '');
  var paragraphs = contentText.split(/\n\n+/).filter(function(p) { return p.trim(); });
  var nodes = paragraphs.map(function(p) {
    return { type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: p.trim() } }] };
  });
  if (!nodes.length) {
    nodes = [{ type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: article.title || '' } }] }];
  }

  var response = await fetch('https://www.wixapis.com/blog/v3/draft-posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': site.cms_api_key
    },
    body: JSON.stringify({
      draftPost: {
        title: article.title,
        excerpt: article.meta_description || '',
        richContent: { nodes: nodes },
        memberId: '00000000-0000-0000-0000-000000000000'
      }
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('Wix draft (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var draftResult = await response.json();
  var draftId = draftResult.draftPost && draftResult.draftPost.id;
  if (!draftId) throw new Error('Wix: impossible de créer le brouillon');

  // Publish the draft
  var pubResponse = await fetch('https://www.wixapis.com/blog/v3/draft-posts/' + draftId + '/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': site.cms_api_key
    }
  });

  if (!pubResponse.ok) {
    var pubErr = await pubResponse.text();
    throw new Error('Wix publish (' + pubResponse.status + '): ' + pubErr.substring(0, 200));
  }

  var pubResult = await pubResponse.json();
  var postId = pubResult.post ? pubResult.post.id : draftId;
  var postUrl = pubResult.post ? pubResult.post.url : '';

  return { post_id: postId, post_url: postUrl || '' };
}

// ──────────────────────────────────────────
// ---- Framer Publisher ----
// ──────────────────────────────────────────
async function publishToFramer(site, article, htmlContent) {
  var collectionId = (site.cms_extra && site.cms_extra.collection_id) || '';
  if (!collectionId) throw new Error('Collection ID Framer non configuré.');

  var response = await fetch('https://api.framer.com/v1/collections/' + collectionId + '/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + site.cms_api_key
    },
    body: JSON.stringify({
      fieldData: {
        name: article.title,
        slug: slugify(article.title),
        body: htmlContent,
        excerpt: article.meta_description || ''
      },
      isDraft: false
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('Framer (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var framerResult = await response.json();
  return {
    post_id: framerResult.id || '',
    post_url: framerResult.url || ''
  };
}

// ──────────────────────────────────────────
// ---- GoHighLevel Publisher ----
// ──────────────────────────────────────────
async function publishToGoHighLevel(site, article, htmlContent) {
  var locationId = (site.cms_extra && site.cms_extra.location_id) || '';
  if (!locationId) throw new Error('Location ID GoHighLevel non configuré.');

  var response = await fetch('https://services.leadconnectorhq.com/blogs/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + site.cms_api_key,
      'Version': '2021-07-28'
    },
    body: JSON.stringify({
      locationId: locationId,
      title: article.title,
      body: htmlContent,
      slug: slugify(article.title),
      status: 'published',
      description: article.meta_description || ''
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('GoHighLevel (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var ghlResult = await response.json();
  return {
    post_id: ghlResult.id || ghlResult.data?.id || '',
    post_url: ghlResult.url || ''
  };
}

// ──────────────────────────────────────────
// ---- Duda Publisher ----
// ──────────────────────────────────────────
async function publishToDuda(site, article, htmlContent) {
  var siteName = (site.cms_extra && site.cms_extra.site_name) || '';
  if (!siteName) throw new Error('Nom du site Duda non configuré.');

  var credentials = Buffer.from((site.cms_username || '') + ':' + (site.cms_api_key || '')).toString('base64');

  var response = await fetch('https://api.duda.co/api/sites/multiscreen/' + siteName + '/blog/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + credentials
    },
    body: JSON.stringify({
      title: article.title,
      content: htmlContent,
      excerpt: article.meta_description || '',
      status: 'published'
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('Duda (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var dudaResult = await response.json();
  return {
    post_id: dudaResult.id || '',
    post_url: dudaResult.url || ''
  };
}

// ──────────────────────────────────────────
// ---- BigCommerce Publisher ----
// ──────────────────────────────────────────
async function publishToBigCommerce(site, article, htmlContent) {
  var storeHash = site.cms_url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  var apiUrl = 'https://api.bigcommerce.com/stores/' + storeHash + '/v2/blog/posts';

  var response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': site.cms_api_key
    },
    body: JSON.stringify({
      title: article.title,
      body: htmlContent,
      is_published: true,
      meta_description: article.meta_description || '',
      url: '/blog/' + slugify(article.title)
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('BigCommerce (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var bcResult = await response.json();
  return {
    post_id: String(bcResult.id || ''),
    post_url: bcResult.url || ''
  };
}

// ──────────────────────────────────────────
// ---- Generic API Publisher ----
// ──────────────────────────────────────────
async function publishToApi(site, article, htmlContent) {
  if (!site.cms_url) throw new Error('URL de l\'API non configurée.');

  var headers = {
    'Content-Type': 'application/json'
  };
  if (site.cms_api_key) {
    headers['Authorization'] = 'Bearer ' + site.cms_api_key;
  }

  var response = await fetch(site.cms_url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      title: article.title,
      content: htmlContent,
      content_markdown: article.content,
      meta_description: article.meta_description || '',
      slug: slugify(article.title),
      status: 'published',
      seo_score: article.seo_score || 0,
      word_count: article.word_count || 0
    })
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('API (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var apiResult = {};
  try { apiResult = await response.json(); } catch (e) {}
  return {
    post_id: String(apiResult.id || apiResult.post_id || ''),
    post_url: apiResult.url || apiResult.post_url || ''
  };
}

// ──────────────────────────────────────────
// ---- Webhook Publisher ----
// ──────────────────────────────────────────
async function publishToWebhook(site, article, htmlContent) {
  if (!site.cms_url) throw new Error('URL du webhook non configurée.');

  var payload = {
    event: 'article.published',
    timestamp: new Date().toISOString(),
    article: {
      id: article.id,
      title: article.title,
      content_html: htmlContent,
      content_markdown: article.content,
      meta_description: article.meta_description || '',
      slug: slugify(article.title),
      seo_score: article.seo_score || 0,
      word_count: article.word_count || 0
    }
  };

  var headers = { 'Content-Type': 'application/json' };
  if (site.cms_api_key) {
    headers['X-Webhook-Secret'] = site.cms_api_key;
  }

  var response = await fetch(site.cms_url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error('Webhook (' + response.status + '): ' + errBody.substring(0, 200));
  }

  var whResult = {};
  try { whResult = await response.json(); } catch (e) {}
  return {
    post_id: String(whResult.id || whResult.post_id || 'webhook-' + Date.now()),
    post_url: whResult.url || whResult.post_url || ''
  };
}

// ──────────────────────────────────────────
// ---- Main dispatcher ----
// ──────────────────────────────────────────
async function publishToCms(site, article, htmlContent) {
  switch (site.cms_type) {
    case 'wordpress':    return await publishToWordPress(site, article, htmlContent);
    case 'shopify':      return await publishToShopify(site, article, htmlContent);
    case 'webflow':      return await publishToWebflow(site, article, htmlContent);
    case 'ghost':        return await publishToGhost(site, article, htmlContent);
    case 'wix':          return await publishToWix(site, article, htmlContent);
    case 'framer':       return await publishToFramer(site, article, htmlContent);
    case 'gohighlevel':  return await publishToGoHighLevel(site, article, htmlContent);
    case 'duda':         return await publishToDuda(site, article, htmlContent);
    case 'bigcommerce':  return await publishToBigCommerce(site, article, htmlContent);
    case 'api':          return await publishToApi(site, article, htmlContent);
    case 'webhook':      return await publishToWebhook(site, article, htmlContent);
    default: throw new Error('Type CMS non supporté: ' + site.cms_type);
  }
}

module.exports = { publishToCms, markdownToHtml, slugify };
