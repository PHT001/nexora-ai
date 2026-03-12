/**
 * Seora — Shared CMS Publishing Module
 * WordPress, Shopify, Webflow publishers + helpers
 */

// ---- Markdown → HTML converter ----
function markdownToHtml(md) {
  if (!md) return '';
  var html = md
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Line breaks → paragraphs
    .replace(/\n\n+/g, '\n</p>\n<p>\n')
    .replace(/^(?!<[hulo])(.+)$/gm, '$1');

  // Wrap list items in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // Wrap in paragraphs
  html = '<p>' + html + '</p>';
  // Clean empty paragraphs
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

// ---- WordPress Publisher ----
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
  return {
    post_id: String(wpPost.id),
    post_url: wpPost.link || ''
  };
}

// ---- Shopify Publisher ----
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

// ---- Webflow Publisher ----
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
  return {
    post_id: wfResult.id || '',
    post_url: ''
  };
}

// ---- Main dispatcher ----
async function publishToCms(site, article, htmlContent) {
  if (site.cms_type === 'wordpress') {
    return await publishToWordPress(site, article, htmlContent);
  } else if (site.cms_type === 'shopify') {
    return await publishToShopify(site, article, htmlContent);
  } else if (site.cms_type === 'webflow') {
    return await publishToWebflow(site, article, htmlContent);
  }
  throw new Error('Type CMS non supporté: ' + site.cms_type);
}

module.exports = { publishToCms, markdownToHtml, slugify };
