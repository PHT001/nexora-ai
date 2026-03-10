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

    // Get or create Stripe customer
    var { data: profile } = await sb
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    var customerId = profile.stripe_customer_id;

    if (!customerId) {
      var customer = await stripe.customers.create({
        email: profile.email || user.email,
        metadata: { supabase_uid: user.id }
      });
      customerId = customer.id;
      await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    // Create checkout session
    var session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 3
      },
      success_url: process.env.SITE_URL + '/dashboard?payment=success',
      cancel_url: process.env.SITE_URL + '/select-plan?payment=cancelled',
      metadata: { supabase_uid: user.id }
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
};
