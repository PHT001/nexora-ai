const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createAdminClient, getUser, cors } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    var sb = createAdminClient();
    var { data: profile } = await sb
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'Aucun abonnement trouvé' });
    }

    var session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: process.env.SITE_URL + '/dashboard'
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Billing portal error:', err);
    return res.status(500).json({ error: err.message });
  }
};
