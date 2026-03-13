// Supabase Auth Configuration
const SUPABASE_URL = 'https://lzqnbsgxqecnwecksfuc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cW5ic2d4cWVjbndlY2tzZnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTE4MjIsImV4cCI6MjA4ODYyNzgyMn0.STBKjwoDY8Ci1w3u8xxuL2DRwqGAbVLMvI8t3x1Wa40';
const GOOGLE_CLIENT_ID = '628851300069-nvssk2rfj7g14q4nbfv7emt4c9l6viil.apps.googleusercontent.com';

var _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Auth Functions ---

// Google Identity Services callback
async function handleGoogleCredential(response) {
  try {
    var { data, error } = await _sb.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential
    });
    if (error) {
      console.error('Google sign-in error:', error.message);
      showAuthError(error.message);
      return;
    }
    // Redirect after successful sign-in
    var page = window.location.pathname;
    if (page.includes('signup')) {
      localStorage.removeItem('seora_onboarding_complete');
      localStorage.removeItem('seora_onboarding_data');
      window.location.href = 'onboarding.html';
    } else {
      var dest = localStorage.getItem('seora_onboarding_complete') === 'true' ? 'dashboard.html' : 'onboarding.html';
      window.location.href = dest;
    }
  } catch (err) {
    console.error('Google credential error:', err);
    showAuthError('Erreur de connexion Google. Réessayez.');
  }
}

// Initialize Google Sign-In buttons (called when GIS script loads)
function initGoogleSignIn() {
  if (typeof google === 'undefined' || !google.accounts) return;

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential
  });

  var containers = document.querySelectorAll('.g-signin-btn');
  containers.forEach(function(el) {
    var text = el.getAttribute('data-text') || 'signin_with';
    google.accounts.id.renderButton(el, {
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: text,
      width: Math.max(el.offsetWidth, 300),
      logo_alignment: 'left'
    });
  });
}

// Fallback if GIS not loaded
async function signInWithGoogle() {
  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    google.accounts.id.prompt();
  } else {
    var { error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/onboarding.html' }
    });
    if (error) {
      console.error('Google sign-in error:', error.message);
      showAuthError(error.message);
    }
  }
}

async function signUpWithEmail(email, password) {
  var { data, error } = await _sb.auth.signUp({
    email: email,
    password: password,
    options: { emailRedirectTo: window.location.origin + '/onboarding.html' }
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
  var dest = localStorage.getItem('seora_onboarding_complete') === 'true' ? 'dashboard.html' : 'onboarding.html';
  window.location.href = dest;
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
  if (msg.includes('rate limit')) return;
  if (msg.includes('already been registered') || msg.includes('already registered')) msg = 'Cet email est déjà utilisé. Essayez de vous connecter.';
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAuthError() {
  var el = document.getElementById('auth-error');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// --- Auth State Listener ---

var _skipAuthRedirect = false;

_sb.auth.onAuthStateChange(function(event, session) {
  if (_skipAuthRedirect || window.location.search.includes('preview')) return;
  if (event === 'SIGNED_IN' && session) {
    var page = window.location.pathname;
    if (page.includes('signup') || page.includes('signup.html')) {
      localStorage.removeItem('seora_onboarding_complete');
      localStorage.removeItem('seora_onboarding_data');
      window.location.href = 'onboarding.html';
    } else if (page.includes('signin') || page.includes('signin.html')) {
      var dest = localStorage.getItem('seora_onboarding_complete') === 'true' ? 'dashboard.html' : 'onboarding.html';
      window.location.href = dest;
    }
  }
});

// --- OTP Verification ---

async function verifyEmailOtp(email, token) {
  var { data, error } = await _sb.auth.verifyOtp({
    email: email,
    token: token,
    type: 'signup'
  });
  if (error) {
    console.error('OTP verification error:', error.message);
    showAuthError(error.message);
    return false;
  }
  return data;
}

async function resendOtp(email) {
  var { error } = await _sb.auth.resend({
    type: 'signup',
    email: email
  });
  if (error) {
    console.error('Resend OTP error:', error.message);
    showAuthError(error.message);
    return false;
  }
  return true;
}

// --- Protect Dashboard ---

async function requireAuth() {
  if (window.location.search.includes('preview')) return null;
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

// --- Auto-init Google Sign-In on page load ---
window.addEventListener('load', function() {
  if (document.querySelector('.g-signin-btn')) {
    initGoogleSignIn();
  }
});
