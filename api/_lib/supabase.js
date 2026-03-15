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

function cors(req, res) {
  var allowed = (process.env.ALLOWED_ORIGINS || 'https://tryseora.com').split(',').map(function(s) { return s.trim(); });
  var origin = (req && req.headers && req.headers.origin) || '';
  if (allowed.indexOf(origin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function isPublicUrl(urlStr) {
  try {
    var u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    var hostname = u.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '[::1]' || hostname === '::1') return false;
    if (hostname === '169.254.169.254') return false;
    var parts = hostname.split('.');
    if (parts.length === 4 && parts.every(function(p) { return /^\d+$/.test(p); })) {
      var a = parseInt(parts[0]);
      var b = parseInt(parts[1]);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 127) return false;
      if (a === 0) return false;
      if (a === 169 && b === 254) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { createAdminClient, createUserClient, getUser, cors, isPublicUrl };
