import React, { useState, useEffect } from 'react';
import { API_BASE_URL, fetchWithTimeout } from '../config';

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Sign In inputs
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  // Sign Up inputs
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirm, setSignUpConfirm] = useState('');
  const [targetRole, setTargetRole] = useState('Frontend Developer');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setSignInPassword('');
    setSignUpPassword('');
    setSignUpConfirm('');
  }, []);

  // Auto-fill from signup if they register
  const handleToggle = (toLogin) => {
    setIsLogin(toLogin);
    setError('');
    setSuccessMsg('');
    setSignInPassword('');
    setSignUpPassword('');
    setSignUpConfirm('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!signInEmail.trim() || !signInPassword.trim()) {
      setError('Please fill in all credentials.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signInEmail, password: signInPassword })
      }, 8000);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Invalid credentials.');
      }

      const data = await response.json();
      onLoginSuccess(data.user, rememberMe);
    } catch (err) {
      console.warn('API login failed, attempting local storage fallback:', err);
      // LocalStorage Fallback logic
      try {
        const registeredUsers = JSON.parse(localStorage.getItem('mockmate_users') || '[]');
        const matchedUser = registeredUsers.find(
          u => u.email.toLowerCase() === signInEmail.toLowerCase() && u.password === signInPassword
        );
        const isDemoUser = signInEmail.toLowerCase() === 'demo@mockmate.com' && signInPassword === 'password123';

        if (matchedUser) {
          onLoginSuccess({
            name: matchedUser.name,
            email: matchedUser.email,
            targetRole: matchedUser.targetRole
          }, rememberMe);
        } else if (isDemoUser) {
          onLoginSuccess({
            name: 'Demo Candidate',
            email: 'demo@mockmate.com',
            targetRole: 'Full Stack Developer'
          }, rememberMe);
        } else {
          setError(err.message || 'Invalid email or password. Try demo@mockmate.com / password123 or sign up!');
        }
      } catch (fallbackErr) {
        console.error('Local fallback login error:', fallbackErr);
        setError('Login failed. Please clear storage and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPassword.trim() || !signUpConfirm.trim()) {
      setError('Please complete all form fields.');
      return;
    }
    if (signUpPassword !== signUpConfirm) {
      setError('Passwords do not match.');
      return;
    }
    if (signUpPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms of Service.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpName.trim(),
          email: signUpEmail.trim(),
          password: signUpPassword,
          targetRole
        })
      }, 8000);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Registration failed.');
      }

      setSuccessMsg('Account registered successfully! Redirecting to Sign In...');

      // Clear sign up fields and do NOT pre-fill password for login redirect
      setSignUpName('');
      setSignUpEmail('');
      setSignUpPassword('');
      setSignUpConfirm('');

      // Automatically slide back to Login after 1.5 seconds
      setTimeout(() => {
        setSignInEmail(signUpEmail);
        setSignInPassword('');
        setIsLogin(true);
        setSuccessMsg('');
      }, 1500);
    } catch (err) {
      console.warn('API signup failed, attempting local storage fallback:', err);
      // LocalStorage Fallback logic
      try {
        const registeredUsers = JSON.parse(localStorage.getItem('mockmate_users') || '[]');
        const userExists = registeredUsers.some(u => u.email.toLowerCase() === signUpEmail.toLowerCase());

        if (userExists) {
          setError('An account with this email already exists.');
          return;
        }

        // Add to mock local DB
        const newUser = {
          name: signUpName.trim(),
          email: signUpEmail.trim(),
          password: signUpPassword,
          targetRole
        };
        registeredUsers.push(newUser);
        localStorage.setItem('mockmate_users', JSON.stringify(registeredUsers));

        setSuccessMsg('Account registered successfully! Redirecting to Sign In...');

        // Clear sign up fields and do NOT pre-fill password for login redirect
        setSignUpName('');
        setSignUpEmail('');
        setSignUpPassword('');
        setSignUpConfirm('');

        setTimeout(() => {
          setSignInEmail(signUpEmail);
          setSignInPassword('');
          setIsLogin(true);
          setSuccessMsg('');
        }, 1500);
      } catch (fallbackErr) {
        console.error('Local fallback signup error:', fallbackErr);
        setError('Signup failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Decorative Blur Spheres */}
      <div className="blur-sphere sphere-purple"></div>
      <div className="blur-sphere sphere-cyan"></div>

      <div className="auth-card glass-panel fade-in">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="logo" style={{ justifyContent: 'center', fontSize: '1.8rem', marginBottom: '8px' }}>
            <div className="logo-icon">M</div>
            MockMate
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            AI-Powered Immersive Interview Simulator
          </p>
        </div>

        {/* Sliding Segmented Controller */}
        <div className="auth-tabs-toggle">
          <div className={`auth-toggle-pill ${isLogin ? 'left' : 'right'}`}></div>
          <button 
            type="button" 
            className={`auth-toggle-btn ${isLogin ? 'active' : ''}`}
            onClick={() => handleToggle(true)}
          >
            Sign In
          </button>
          <button 
            type="button" 
            className={`auth-toggle-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => handleToggle(false)}
          >
            Sign Up
          </button>
        </div>

        {/* Error/Success Feedbacks */}
        {error && (
          <div className="auth-alert error fade-in">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="auth-alert success fade-in">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Cinematic Sliding Container Viewport */}
        <div className="auth-form-viewport">
          <div className="auth-form-slider" style={{ transform: isLogin ? 'translateX(0)' : 'translateX(-50%)' }}>
            
            {/* Form Column 1: Sign In */}
            <form onSubmit={handleSignIn} className="auth-form-block">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="name@company.com"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="form-group">
                <div className="flex-between">
                  <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                  <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Demo password is: password123'); }} style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                    Forgot?
                  </a>
                </div>
                <input
                  type="password"
                  className="form-control"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                  style={{ marginTop: '8px' }}
                />
              </div>

              <div className="flex-between" style={{ margin: '20px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: 'var(--accent-purple)' }}
                  />
                  Remember me
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={isLoading}>
                {isLoading ? (
                  <span className="typing-loader" style={{ margin: 0, height: 'auto' }}>
                    <span></span><span></span><span></span>
                  </span>
                ) : (
                  'Sign In to Account'
                )}
              </button>
            </form>

            {/* Form Column 2: Sign Up */}
            <form onSubmit={handleSignUp} className="auth-form-block">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Jane Doe"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="jane@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="new-password"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={signUpConfirm}
                    onChange={(e) => setSignUpConfirm(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Target Career Track</label>
                <select 
                  className="form-control"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Developer">Backend Developer</option>
                  <option value="Full Stack Developer">Full Stack Developer</option>
                  <option value="Data Analyst">Data Analyst</option>
                  <option value="DevOps Engineer">DevOps Engineer</option>
                </select>
              </div>

              <div style={{ margin: '16px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{ accentColor: 'var(--accent-purple)', marginTop: '3px' }}
                    required
                  />
                  <span>
                    I agree to the <a href="#terms" onClick={(e) => { e.preventDefault(); alert('Standard terms apply: Use this sandbox to mock and prepare for success!'); }} style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>Terms of Service</a> and Privacy Policy.
                  </span>
                </label>
              </div>

              <button type="submit" className="btn btn-accent" style={{ width: '100%', padding: '12px' }} disabled={isLoading}>
                {isLoading ? (
                  <span className="typing-loader" style={{ margin: 0, height: 'auto' }}>
                    <span></span><span></span><span></span>
                  </span>
                ) : (
                  'Create Free Account'
                )}
              </button>
            </form>

          </div>
        </div>

        {/* Divider separator */}
        <div className="auth-divider">
          <span>Or Continue With</span>
        </div>

        {/* Social logins panel */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            type="button" 
            className="btn btn-secondary auth-social-btn"
            onClick={() => {
              onLoginSuccess({
                name: 'Google Candidate',
                email: 'google@mockmate.com',
                targetRole: 'Frontend Developer'
              });
            }}
            disabled={isLoading}
          >
            <span style={{ fontSize: '1rem' }}>🌐</span> Google
          </button>
          
          <button 
            type="button" 
            className="btn btn-secondary auth-social-btn"
            onClick={() => {
              onLoginSuccess({
                name: 'GitHub Dev',
                email: 'github@mockmate.com',
                targetRole: 'Backend Developer'
              });
            }}
            disabled={isLoading}
          >
            <span style={{ fontSize: '1rem' }}>🐙</span> GitHub
          </button>
        </div>

        {/* Footer info box */}
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          💡 Try Logging in with <strong>demo@mockmate.com</strong> / <strong>password123</strong> to experience the system instantly!
        </div>
      </div>
    </div>
  );
}
