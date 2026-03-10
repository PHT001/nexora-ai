// Frontend API helper — sends authenticated requests to /api/*

async function apiCall(method, path, body) {
  var session = await _sb.auth.getSession();
  var token = session?.data?.session?.access_token || '';
  var opts = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }
  var res = await fetch('/api/' + path, opts);
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}
