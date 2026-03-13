const { Resend } = require('resend');

var resend = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

// Use custom domain if verified, otherwise fallback to Resend default
var FROM = process.env.RESEND_FROM_EMAIL || 'Seora <onboarding@resend.dev>';

// ─── Welcome email after payment ───
async function sendWelcomeEmail(email, name) {
  var r = getResend();
  return r.emails.send({
    from: FROM,
    to: email,
    subject: 'Bienvenue sur Seora ! 🚀',
    html: wrapLayout(
      '<h1 style="font-size:24px;color:#1a1a1a;margin:0 0 8px;">Bienvenue, ' + (name || 'là') + ' !</h1>'
      + '<p style="font-size:15px;color:#666;line-height:1.7;margin:0 0 24px;">Votre compte Seora est maintenant actif. Vous pouvez commencer à générer du contenu SEO pour votre site.</p>'
      + '<h2 style="font-size:16px;color:#1a1a1a;margin:0 0 12px;">Pour bien démarrer :</h2>'
      + '<ol style="font-size:14px;color:#555;line-height:2;padding-left:20px;margin:0 0 24px;">'
      + '<li>Connectez votre CMS (WordPress, Shopify ou Webflow)</li>'
      + '<li>Lancez un audit SEO de votre site</li>'
      + '<li>Générez votre premier article</li>'
      + '</ol>'
      + '<a href="https://tryseora.com/dashboard" style="display:inline-block;padding:14px 32px;background:#E8562A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Accéder au dashboard</a>'
    )
  });
}

// ─── Article published notification ───
async function sendArticlePublishedEmail(email, name, articleTitle, cmsPostUrl, siteDomain) {
  var r = getResend();
  var viewBtn = cmsPostUrl
    ? '<a href="' + cmsPostUrl + '" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin-right:10px;">Voir l\'article sur votre site</a>'
    : '';

  return r.emails.send({
    from: FROM,
    to: email,
    subject: '✅ Article publié : ' + (articleTitle || 'Nouvel article'),
    html: wrapLayout(
      '<h1 style="font-size:22px;color:#1a1a1a;margin:0 0 8px;">Article publié avec succès !</h1>'
      + '<p style="font-size:15px;color:#666;line-height:1.7;margin:0 0 20px;">' + (name || 'Bonjour') + ', votre nouvel article a été publié automatiquement sur <strong>' + (siteDomain || 'votre site') + '</strong>.</p>'
      + '<div style="background:#f9fafb;border-radius:10px;padding:18px 22px;margin:0 0 24px;border:1px solid #e8e8ec;">'
      + '<div style="font-size:12px;color:#999;margin-bottom:4px;">TITRE</div>'
      + '<div style="font-size:16px;font-weight:600;color:#1a1a1a;">' + (articleTitle || 'Sans titre') + '</div>'
      + '</div>'
      + '<div style="margin-bottom:16px;">' + viewBtn
      + '<a href="https://tryseora.com/dashboard" style="display:inline-block;padding:12px 28px;background:#E8562A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Dashboard Seora</a>'
      + '</div>'
    )
  });
}

// ─── Payment failed notification ───
async function sendPaymentFailedEmail(email, name) {
  var r = getResend();
  return r.emails.send({
    from: FROM,
    to: email,
    subject: '⚠️ Problème de paiement — Action requise',
    html: wrapLayout(
      '<h1 style="font-size:22px;color:#ef4444;margin:0 0 8px;">Problème de paiement</h1>'
      + '<p style="font-size:15px;color:#666;line-height:1.7;margin:0 0 20px;">' + (name || 'Bonjour') + ', votre dernier paiement a échoué. Veuillez mettre à jour vos informations de paiement pour continuer à utiliser Seora.</p>'
      + '<a href="https://tryseora.com/dashboard" style="display:inline-block;padding:14px 32px;background:#E8562A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Mettre à jour le paiement</a>'
      + '<p style="font-size:13px;color:#999;margin-top:20px;">Si vous pensez qu\'il s\'agit d\'une erreur, contactez-nous à support@tryseora.com</p>'
    )
  });
}

// ─── HTML layout wrapper ───
function wrapLayout(bodyContent) {
  return '<!DOCTYPE html>'
    + '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:40px 0;">'
    + '<tr><td align="center">'
    + '<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">'
    // Header
    + '<tr><td style="background:#E8562A;padding:24px 32px;">'
    + '<span style="color:#fff;font-size:20px;font-weight:700;text-decoration:none;">Seora</span>'
    + '</td></tr>'
    // Body
    + '<tr><td style="padding:36px 32px;">'
    + bodyContent
    + '</td></tr>'
    // Footer
    + '<tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e8e8ec;text-align:center;">'
    + '<p style="font-size:12px;color:#999;margin:0;">Seora — Contenu SEO propulsé par l\'IA</p>'
    + '<p style="font-size:11px;color:#bbb;margin:4px 0 0;">Vous recevez cet email car vous êtes inscrit sur <a href="https://tryseora.com" style="color:#E8562A;">tryseora.com</a></p>'
    + '</td></tr>'
    + '</table>'
    + '</td></tr></table>'
    + '</body></html>';
}

module.exports = { sendWelcomeEmail, sendArticlePublishedEmail, sendPaymentFailedEmail };
