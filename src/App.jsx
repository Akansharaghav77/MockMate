import React, { useState, useEffect } from 'react';
import SetupForm from './components/SetupForm';
import InterviewWindow from './components/InterviewWindow';
import FeedbackView from './components/FeedbackView';
import AuthPage from './components/AuthPage';
import { API_BASE_URL, fetchWithTimeout } from './config';

const SCREENS = {
  DASHBOARD: 'DASHBOARD',
  SETUP: 'SETUP',
  INTERVIEW: 'INTERVIEW',
  FEEDBACK: 'FEEDBACK',
  AUTH: 'AUTH'
};

export default function App() {
  const [screen, setScreen] = useState(SCREENS.AUTH);

  // History navigation wrapper
  const navigateTo = (newScreen) => {
    window.history.pushState({ screen: newScreen }, '', `?screen=${newScreen.toLowerCase()}`);
    setScreen(newScreen);
  };

  useEffect(() => {
    const handlePopState = (event) => {
      const loggedIn = localStorage.getItem('mockmate_logged_in_user') || sessionStorage.getItem('mockmate_logged_in_user');
      if (event.state && event.state.screen) {
        const targetScreen = event.state.screen;
        if (!loggedIn && targetScreen !== SCREENS.AUTH) {
          setScreen(SCREENS.AUTH);
          window.history.replaceState({ screen: SCREENS.AUTH }, '', '?screen=auth');
        } else {
          setScreen(targetScreen);
        }
      } else {
        setScreen(loggedIn ? SCREENS.DASHBOARD : SCREENS.AUTH);
      }
    };
    
    // Always default to auth screen first on app start/launch
    window.history.replaceState({ screen: SCREENS.AUTH }, '', '?screen=auth');
    window.addEventListener('popstate', handlePopState);
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [interviews, setInterviews] = useState([]);
  const [currentInterview, setCurrentInterview] = useState(null);
  const [currentEvaluation, setCurrentEvaluation] = useState(null);
  
  // Auth state
  const [user, setUser] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Protect screens: if not authenticated, redirect to AUTH
  useEffect(() => {
    if (!isLoading) {
      if (!user && screen !== SCREENS.AUTH) {
        setScreen(SCREENS.AUTH);
        window.history.replaceState({ screen: SCREENS.AUTH }, '', '?screen=auth');
      }
    }
  }, [screen, user, isLoading]);

  // Load History & Check Session
  useEffect(() => {
    async function initApp() {
      try {
        // Enforce displaying Sign In page first on launch
        setScreen(SCREENS.AUTH);
        window.history.replaceState({ screen: SCREENS.AUTH }, '', '?screen=auth');

        // Load active user session
        let savedUser = localStorage.getItem('mockmate_logged_in_user');
        if (!savedUser) {
          savedUser = sessionStorage.getItem('mockmate_logged_in_user');
        }

        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            // Verify session authenticity on backend
            setActionLoading(true);
            const verifyRes = await fetchWithTimeout(`${API_BASE_URL}/api/auth/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: parsedUser.email })
            }, 8000);

            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              setUser(verifyData.user);
              
              // Only after verification, allow transition to dashboard
              setScreen(SCREENS.DASHBOARD);
              window.history.replaceState({ screen: SCREENS.DASHBOARD }, '', '?screen=dashboard');
              await loadHistory(verifyData.user.email);
            } else {
              throw new Error('Session invalid on server');
            }
          } catch (jsonErr) {
            console.error('Session verification failed:', jsonErr);
            localStorage.removeItem('mockmate_logged_in_user');
            sessionStorage.removeItem('mockmate_logged_in_user');
            setUser(null);
            setScreen(SCREENS.AUTH);
            window.history.replaceState({ screen: SCREENS.AUTH }, '', '?screen=auth');
          } finally {
            setActionLoading(false);
          }
        } else {
          setUser(null);
          setScreen(SCREENS.AUTH);
          window.history.replaceState({ screen: SCREENS.AUTH }, '', '?screen=auth');
        }
      } catch (err) {
        console.error('Application initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    initApp();
  }, []);

  const loadHistory = async (email) => {
    try {
      const activeEmail = email || (user ? user.email : '');
      if (!activeEmail) return;
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/interviews?email=${encodeURIComponent(activeEmail)}`, {}, 8000);
      if (response.ok) {
        const data = await response.json();
        setInterviews(data);
      }
    } catch (err) {
      console.error('Failed to load history list:', err);
    }
  };

  const handleStartInterview = async (setupData) => {
    setActionLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/interviews/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRole: setupData.jobRole,
          experienceLevel: setupData.experienceLevel,
          techStack: setupData.techStack,
          userEmail: user ? user.email : null
        })
      }, 8000);

      if (!response.ok) {
        throw new Error('Failed to initiate interview session on backend.');
      }

      const data = await response.json();
      setCurrentInterview(data.interview);
      navigateTo(SCREENS.INTERVIEW);
    } catch (err) {
      console.warn('API start failed, using frontend local fallback:', err);
      // Fallback interview object for offline mode
      const localInterview = {
        id: Date.now().toString(),
        jobRole: setupData.jobRole,
        experienceLevel: setupData.experienceLevel,
        techStack: setupData.techStack,
        status: 'active',
        createdAt: new Date().toISOString(),
        questions: [],
        answers: [],
        evaluation: null,
        userEmail: user ? user.email : null
      };
      setCurrentInterview(localInterview);
      navigateTo(SCREENS.INTERVIEW);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInterviewComplete = (evaluationData) => {
    setCurrentEvaluation(evaluationData);
    navigateTo(SCREENS.FEEDBACK);
    loadHistory(); // Refresh history list
  };

  const handleDeleteHistoryItem = async (e, id) => {
    e.stopPropagation(); // Avoid triggering open card
    if (!confirm('Are you sure you want to delete this interview history item?')) return;
    
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/interviews/${id}`, {
        method: 'DELETE'
      }, 8000);
      if (response.ok) {
        loadHistory();
      }
    } catch (err) {
      alert('Failed to delete history item.');
    }
  };

  const handleSelectHistoryItem = (interviewItem) => {
    setCurrentInterview(interviewItem);
    if (interviewItem.status === 'completed' && interviewItem.evaluation) {
      setCurrentEvaluation(interviewItem.evaluation);
      navigateTo(SCREENS.FEEDBACK);
    } else {
      // Resume incomplete interview
      navigateTo(SCREENS.INTERVIEW);
    }
  };

  // Cumulative statistics calculations
  const completedInterviews = interviews.filter(i => i.status === 'completed');
  const totalInterviewsCount = interviews.length;
  
  const avgScore = completedInterviews.length > 0
    ? Math.round(completedInterviews.reduce((acc, curr) => acc + (curr.evaluation?.overallScore || 0), 0) / completedInterviews.length)
    : 0;

  return (
    <div>
      {/* Background Animated Grid Elements */}
      <div className="bg-grid"></div>

      {/* Modern Navigation Header */}
      <header className="navbar">
        <div className="logo" onClick={() => navigateTo(SCREENS.DASHBOARD)} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">M</div>
          MockMate
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '8px', display: 'inline-flex', alignItems: 'center' }}>
              👋 Hi, <strong style={{ color: 'var(--accent-cyan)', marginLeft: '4px' }}>{user.name}</strong>
            </span>
          )}
          
          {user && screen !== SCREENS.DASHBOARD && (
            <button className="btn btn-secondary" onClick={() => navigateTo(SCREENS.DASHBOARD)}>
              Dashboard
            </button>
          )}

          {user && (
            <button 
              className="btn btn-secondary" 
              style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              onClick={() => {
                setUser(null);
                localStorage.removeItem('mockmate_logged_in_user');
                sessionStorage.removeItem('mockmate_logged_in_user');
                navigateTo(SCREENS.AUTH);
              }}
            >
              Log Out
            </button>
          )}
        </div>
      </header>

      <main className="main-container">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div className="typing-loader" style={{ height: '40px' }}>
              <span></span><span></span><span></span>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>Initializing MockMate Suite...</p>
          </div>
        ) : (
          <>
            {/* Screen 5: Authentication View (Login/Signup) */}
            {screen === SCREENS.AUTH && (
              <AuthPage 
                onLoginSuccess={(loggedInUser, rememberMe) => {
                  setUser(loggedInUser);
                  if (rememberMe) {
                    localStorage.setItem('mockmate_logged_in_user', JSON.stringify(loggedInUser));
                  } else {
                    sessionStorage.setItem('mockmate_logged_in_user', JSON.stringify(loggedInUser));
                  }
                  navigateTo(SCREENS.SETUP); // Automatically start the interview flow
                  loadHistory(loggedInUser.email);
                }} 
              />
            )}
            {/* Screen 1: Dashboard View */}
            {screen === SCREENS.DASHBOARD && (
              <div className="fade-in">

                {/* Banner Call to Action */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '40px', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '300px', height: '300px', borderRadius: '50%', background: 'var(--accent-purple-glow)', filter: 'blur(80px)', zIndex: -1 }}></div>
                  
                  <div style={{ maxWidth: '600px' }}>
                    <span className="badge badge-blue" style={{ marginBottom: '12px' }}>AI-Powered Interview Coach</span>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '16px' }}>
                      Master Your Technical Interviews with <span style={{ background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MockMate</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>
                      Get grilled by a dynamic, adaptive AI interviewer. MockMate measures technical depth, coding speed, and communication quality, adjusting the question complexity live based on your accuracy.
                    </p>
                  </div>

                  <div>
                    <button 
                      className="btn btn-accent" 
                      onClick={() => navigateTo(SCREENS.SETUP)}
                      style={{ fontSize: '1.05rem', padding: '14px 32px', borderRadius: '10px' }}
                    >
                      🚀 Generate New Interview
                    </button>
                  </div>
                </div>

                {/* Performance Stats Cards row */}
                {totalInterviewsCount > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px' }}>
                      <span style={{ fontSize: '2.5rem' }}>📊</span>
                      <div>
                        <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Interviews Conducted</h4>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>{totalInterviewsCount}</div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px' }}>
                      <span style={{ fontSize: '2.5rem' }}>🏆</span>
                      <div>
                        <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Average Score</h4>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', color: 'var(--accent-cyan)' }}>
                          {completedInterviews.length > 0 ? `${avgScore}%` : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px' }}>
                      <span style={{ fontSize: '2.5rem' }}>✅</span>
                      <div>
                        <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Sessions Finished</h4>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>
                          {completedInterviews.length}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Past History Table / Card grids */}
                <div>
                  <h3 style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', marginBottom: '20px' }}>
                    Assessment History
                  </h3>

                  {interviews.length === 0 ? (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', background: 'rgba(255, 255, 255, 0.01)' }}>
                      <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📁</span>
                      <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>No interviews generated yet</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px', marginBottom: '20px' }}>
                        Create your first custom mock profile to get started!
                      </p>
                      <button className="btn btn-secondary" onClick={() => navigateTo(SCREENS.SETUP)}>
                        Set up First Interview
                      </button>
                    </div>
                  ) : (
                    <div className="history-grid">
                      {interviews.map((item) => (
                        <div 
                          key={item.id} 
                          className="glass-panel history-card"
                          onClick={() => handleSelectHistoryItem(item)}
                        >
                          <div className="flex-between" style={{ marginBottom: '12px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className={`badge ${item.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                              {item.status}
                            </span>
                          </div>

                          <h4 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                            {item.jobRole}
                          </h4>

                          <div className="history-stat">
                            <span>⚡ Level:</span> 
                            <strong>{item.experienceLevel}</strong>
                          </div>

                          <div className="history-stat" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '12px' }}>
                            {item.techStack.split(',').map((tech) => (
                              <span key={tech} className="badge badge-blue" style={{ fontSize: '0.65rem', textTransform: 'none' }}>
                                {tech.trim()}
                              </span>
                            ))}
                          </div>

                          <div className="flex-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px', marginTop: '16px' }}>
                            {item.status === 'completed' ? (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Score: </span>
                                <strong style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>
                                  {item.evaluation?.overallScore}%
                                </strong>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)' }}>Resume Session ➔</span>
                            )}

                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                              onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Screen 2: Setup Form View */}
            {screen === SCREENS.SETUP && (
              <div className="fade-in" style={{ padding: '20px 0' }}>
                <SetupForm 
                  onStart={handleStartInterview} 
                  isLoading={actionLoading}
                />
              </div>
            )}

            {/* Screen 3: Live Interview Simulator Window */}
            {screen === SCREENS.INTERVIEW && currentInterview && (
              <InterviewWindow
                interview={currentInterview}
                voiceAssist={true}
                onComplete={handleInterviewComplete}
              />
            )}

            {/* Screen 4: Deep Assessor Report Feedback View */}
            {screen === SCREENS.FEEDBACK && currentEvaluation && currentInterview && (
              <FeedbackView
                evaluation={currentEvaluation}
                interview={currentInterview}
                onBackToDashboard={() => navigateTo(SCREENS.DASHBOARD)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
