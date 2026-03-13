const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createAdminClient } = require('./_lib/supabase');
const { sendWelcomeEmail, sendPaymentFailedEmail } = require('./_lib/emails');

// Disable body parsing — Stripe needs raw body for signature verification
module.exports.config = { api: { bodyParser: false } };

async function buffer(readable) {
  var chunks = [];
  for await (var chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  var rawBody = await buffer(req);
  var sig = req.headers['stripe-signature'];

  var event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  var sb = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        var session = event.data.object;
        var uid = session.metadata.supabase_uid;
        if (uid) {
          await sb.from('profiles').update({
            plan: 'all-in-one',
            plan_status: 'active',
            articles_limit: 30,
            stripe_customer_id: session.customer
          }).eq('id', uid);

          // Send welcome email (non-blocking)
          try {
            var email = session.customer_email || session.customer_details?.email;
            var name = session.customer_details?.name || '';
            if (email) await sendWelcomeEmail(email, name);
          } catch (emailErr) { console.error('Welcome email error:', emailErr.message); }
        }
        break;
      }

      case 'customer.subscription.updated': {
        var sub = event.data.object;
        var customerId = sub.customer;
        var status = sub.status; // active, past_due, canceled, trialing
        var planStatus = 'inactive';
        if (status === 'active' || status === 'trialing') planStatus = 'active';
        else if (status === 'past_due') planStatus = 'past_due';

        await sb.from('profiles')
          .update({ plan_status: planStatus })
          .eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.deleted': {
        var sub2 = event.data.object;
        await sb.from('profiles')
          .update({ plan: 'free', plan_status: 'inactive', articles_limit: 0 })
          .eq('stripe_customer_id', sub2.customer);
        break;
      }

      case 'invoice.payment_succeeded': {
        // Reset monthly article count on successful payment
        var invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_cycle') {
          await sb.from('profiles')
            .update({ articles_used: 0 })
            .eq('stripe_customer_id', invoice.customer);
        }
        break;
      }

      case 'invoice.payment_failed': {
        var failedInvoice = event.data.object;
        await sb.from('profiles')
          .update({ plan_status: 'past_due' })
          .eq('stripe_customer_id', failedInvoice.customer);

        // Send payment failed email (non-blocking)
        try {
          var custEmail = failedInvoice.customer_email;
          var custName = failedInvoice.customer_name || '';
          if (custEmail) await sendPaymentFailedEmail(custEmail, custName);
        } catch (emailErr) { console.error('Payment failed email error:', emailErr.message); }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.status(200).json({ received: true });
};
