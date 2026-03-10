const { createClient } = require('@supabase/supabase-js');

function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function createUserClient(req) {
  var token = (req.headers.authorization || '').replace('Bearer ', '');
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: 'Bearer ' + token } } }
  );
}

async function getUser(req) {
  var token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  var sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  var { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

module.exports = { createAdminClient, createUserClient, getUser, cors };
