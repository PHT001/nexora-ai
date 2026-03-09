// Supabase Auth Configuration
const SUPABASE_URL = 'https://lzqnbsgxqecnwecksfuc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cW5ic2d4cWVjbndlY2tzZnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTE4MjIsImV4cCI6MjA4ODYyNzgyMn0.STBKjwoDY8Ci1w3u8xxuL2DRwqGAbVLMvI8t3x1Wa40';

var _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Auth Functions ---

async function signInWithGoogle() {
  var { error } = await _sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/dashboard.html' }
  });
  if (error) {
    console.error('Google sign-in error:', error.message);
    showAuthError(error.message);
  }
}

async function signUpWithEmail(email, password) {
  var { data, error } = await _sb.auth.signUp({
    email: email,
    password: password,
    options: { emailRedirectTo: window.location.origin + '/dashboard.html' }
  });
  if (error) {
    console.error('Email sign-up error:', error.message);
    showAuthError(error.message);
    return false;
  }
  return data;
}

async function signInWithEmail(email, password) {
  var { data, error } = await _sb.auth.signInWithPassword({
    email: email,
    password: password
  });
  if (error) {
    console.error('Email sign-in error:', error.message);
    showAuthError(error.message);
    return false;
  }
  window.location.href = 'dashboard.html';
  return data;
}

async function signOut() {
  var { error } = await _sb.auth.signOut();
  if (error) {
    console.error('Sign-out error:', error.message);
  }
  window.location.href = 'index.html';
}

async function getUser() {
  var { data: { user } } = await _sb.auth.getUser();
  return user;
}

// --- UI Helpers ---

function showAuthError(message) {
  var el = document.getElementById('auth-error');
  if (!el) return;
  var msg = message;
  if (msg.includes('Invalid login')) msg = 'Email ou mot de passe incorrect.';
  if (msg.includes('already registered')) msg = 'Cet email est déjà utilisé.';
  if (msg.includes('Password should be')) msg = 'Le mot de passe doit faire au moins 6 caractères.';
  if (msg.includes('Unable to validate')) msg = 'Vérifiez votre email et mot de passe.';
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAuthError() {
  var el = document.getElementById('auth-error');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// --- Auth State Listener ---

_sb.auth.onAuthStateChange(function(event, session) {
  if (event === 'SIGNED_IN' && session) {
    var page = window.location.pathname;
    if (page.includes('signup.html') || page.includes('signin.html')) {
      window.location.href = 'dashboard.html';
    }
  }
});

// --- Protect Dashboard ---

async function requireAuth() {
  var user = await getUser();
  if (!user) {
    window.location.href = 'signin.html';
    return null;
  }
  return user;
}

// --- Update Navbar ---

async function updateNavAuth() {
  var user = await getUser();
  var signupBtns = document.querySelectorAll('.nav-signup-btn');
  var userMenus = document.querySelectorAll('.nav-user-menu');
  if (user) {
    signupBtns.forEach(function(b) { b.style.display = 'none'; });
    userMenus.forEach(function(m) {
      m.style.display = 'flex';
      var nameEl = m.querySelector('.nav-user-name');
      if (nameEl) nameEl.textContent = user.user_metadata.full_name || user.email.split('@')[0];
    });
  } else {
    signupBtns.forEach(function(b) { b.style.display = ''; });
    userMenus.forEach(function(m) { m.style.display = 'none'; });
  }
}
