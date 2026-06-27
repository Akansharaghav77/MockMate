import React, { useState } from 'react';

export default function FeedbackView({ evaluation, interview, onBackToDashboard }) {
  const [activeQuestionId, setActiveQuestionId] = useState(1);

  if (!evaluation) return null;

  const { overallScore, categoryScores, summary, strengths, improvements, detailedFeedback, weakAreas, technicalAccuracy, communicationClarity, finalVerdict, domainUnderstanding } = evaluation;

  // Calculate SVG circular path offsets
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="main-container">
      {/* Action Header Panel */}
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <button className="btn btn-secondary" onClick={onBackToDashboard} style={{ marginBottom: '10px', fontSize: '0.8rem', padding: '6px 12px' }}>
            🠔 Back to Dashboard
          </button>
          <h1 style={{ fontSize: '2rem', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Interview Evaluation Dossier
          </h1>
        </div>
        <button className="btn btn-accent" onClick={handlePrint}>
          🖨️ Export PDF / Print
        </button>
      </div>

      {/* Main Score Layout Grid */}
      <div className="grid-2" style={{ marginBottom: '30px' }}>
        {/* Core Circular Dial Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <span className="badge badge-purple" style={{ marginBottom: '20px' }}>Overall Result</span>
          
          <div className="radial-score">
            <svg>
              <circle className="radial-score-bg" cx="75" cy="75" r={radius} />
              <circle 
                className="radial-score-fill" 
                cx="75" 
                cy="75" 
                r={radius} 
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  stroke: 'url(#scoreGradient)'
                }}
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-cyan)" />
                  <stop offset="100%" stopColor="var(--accent-purple)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="radial-score-text">
              {overallScore}<span className="radial-score-pct">%</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
              {overallScore >= 85 ? 'Highly Recommended' : overallScore >= 70 ? 'Recommended' : 'Needs Development'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
              Candidate Level: {interview.experienceLevel} {interview.jobRole}
            </p>
            {finalVerdict && (
              <div style={{ marginTop: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assessor Verdict: </span>
                <span className={`badge ${finalVerdict.toLowerCase() === 'advanced' ? 'badge-success' : finalVerdict.toLowerCase() === 'intermediate' ? 'badge-blue' : 'badge-danger'}`} style={{ fontSize: '0.75rem', padding: '6px 14px', borderRadius: '4px' }}>
                  {finalVerdict.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Subcategory bars */}
          <div className="score-card-grid" style={{ width: '100%' }}>
            <div className="score-card-item">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Technical Depth</span>
              <div className="score-card-val" style={{ color: 'var(--accent-cyan)' }}>{categoryScores?.technical || 0}%</div>
            </div>
            
            <div className="score-card-item">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Articulation</span>
              <div className="score-card-val" style={{ color: 'var(--accent-purple)' }}>{categoryScores?.communication || 0}%</div>
            </div>

            <div className="score-card-item">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Completeness</span>
              <div className="score-card-val" style={{ color: 'var(--success)' }}>{categoryScores?.completeness || 0}%</div>
            </div>
          </div>
        </div>

        {/* Executive Summary & Dynamic Profile summary */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
              Executive Feedback Summary
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '24px' }}>
              {summary}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', marginTop: 'auto' }}>
            <div>
              <h4 style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✦ Strengths</h4>
              <ul className="glow-list strengths" style={{ listStyleType: 'none', paddingLeft: 0 }}>
                {strengths?.slice(0, 3).map((item, idx) => (
                  <li key={idx} style={{ color: 'var(--text-primary)', fontSize: '0.8rem', marginBottom: '6px', position: 'relative', paddingLeft: '12px' }}>
                    <span style={{ color: 'var(--success)', position: 'absolute', left: 0 }}>•</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            {weakAreas && weakAreas.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✦ Critical Gaps</h4>
                <ul className="glow-list weak-areas" style={{ listStyleType: 'none', paddingLeft: 0 }}>
                  {weakAreas.slice(0, 3).map((item, idx) => (
                    <li key={idx} style={{ color: 'var(--text-primary)', fontSize: '0.8rem', marginBottom: '6px', position: 'relative', paddingLeft: '12px' }}>
                      <span style={{ color: 'var(--error)', position: 'absolute', left: 0 }}>•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div>
              <h4 style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✦ Improvements</h4>
              <ul className="glow-list improvements" style={{ listStyleType: 'none', paddingLeft: 0 }}>
                {improvements?.slice(0, 3).map((item, idx) => (
                  <li key={idx} style={{ color: 'var(--text-primary)', fontSize: '0.8rem', marginBottom: '6px', position: 'relative', paddingLeft: '12px' }}>
                    <span style={{ color: 'var(--warning)', position: 'absolute', left: 0 }}>•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Strict Assessor Rubric Details */}
      {(technicalAccuracy || communicationClarity || domainUnderstanding) && (
        <div className="glass-panel" style={{ marginBottom: '30px', borderLeft: '4px solid var(--accent-cyan)', background: 'rgba(0, 245, 255, 0.01)' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Strict Assessment Rubric</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {technicalAccuracy && (
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <h4 style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🛠️ Technical Accuracy</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>{technicalAccuracy}</p>
              </div>
            )}
            {communicationClarity && (
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <h4 style={{ color: 'var(--accent-purple)', fontSize: '0.9rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🗣️ Communication & Confidence</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>{communicationClarity}</p>
              </div>
            )}
            {domainUnderstanding && (
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <h4 style={{ color: 'var(--success)', fontSize: '0.9rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎯 Domain Understanding</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>{domainUnderstanding}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accordion List - Question by Question analysis */}
      <div className="glass-panel">
        <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
          Question-by-Question Review
        </h3>

        {detailedFeedback?.map((q, idx) => {
          const isActive = activeQuestionId === q.question_id;
          const matchedQuestionObj = interview.questions.find(item => item.id === q.question_id);
          const userResponse = interview.answers[idx] || 'No answer recorded.';
          const focusArea = matchedQuestionObj?.focus_area || 'Core Concept';
          const difficulty = matchedQuestionObj?.difficulty_level || 'Medium';
          const adaptation = matchedQuestionObj?.adaptation;

          return (
            <div 
              key={q.question_id} 
              className={`feedback-accordion ${isActive ? 'active' : ''}`}
            >
              <div 
                className="feedback-accordion-header"
                onClick={() => setActiveQuestionId(isActive ? null : q.question_id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="step-node" style={{ width: '28px', height: '28px', fontSize: '0.85rem' }}>
                    {q.question_id}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {matchedQuestionObj?.category || 'Question'}
                  </span>
                  <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{difficulty}</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Focus: {focusArea}</span>
                  <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                    Score: {q.score}/10
                  </span>
                  <span style={{ transition: 'transform 0.2s', transform: isActive ? 'rotate(180deg)' : 'rotate(0)' }}>
                    ▼
                  </span>
                </div>
              </div>

              <div className="feedback-accordion-content fade-in">
                {/* Interviewer Question */}
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    Question Asked:
                  </h4>
                  <p style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    "{q.question}"
                  </p>
                </div>

                {/* Adaptive Insight Panel */}
                {adaptation && adaptation.evaluation && (
                  <div style={{ background: 'rgba(124, 77, 255, 0.05)', border: '1px solid rgba(124, 77, 255, 0.15)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '4px' }}>
                      <span>⚙️ INTERVIEWER ADAPTATION REPORT</span>
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <strong>Assessment:</strong> <span className={`badge ${adaptation.evaluation === 'Correct' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>{adaptation.evaluation}</span>
                      <span style={{ marginLeft: '12px' }}><strong>Reasoning:</strong> {adaptation.reasoning}</span>
                    </p>
                  </div>
                )}

                {/* Assessor Detailed Evaluation */}
                <div style={{ marginBottom: '24px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '15px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Assessor's Feedback Notes:
                  </h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {q.feedback}
                  </p>
                </div>

                {/* Compare Columns */}
                <div className="compare-block">
                  {/* Candidate Answer Box */}
                  <div>
                    <div className="answer-title">Your Submitted Answer</div>
                    <div className="answer-box user" style={{ height: '220px', overflowY: 'auto' }}>
                      {userResponse.includes('[Candidate\'s Provided Code Snippet]:') ? (
                        <div>
                          <p style={{ marginBottom: '10px', whiteSpace: 'pre-wrap' }}>
                            {userResponse.split('[Candidate\'s Provided Code Snippet]:')[0]}
                          </p>
                          <div className="answer-title" style={{ fontSize: '0.75rem', marginTop: '12px' }}>💡 CODE SUBMITTED:</div>
                          <pre style={{ background: '#08090d', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                            <code>
                              {userResponse.split('[Candidate\'s Provided Code Snippet]:')[1]?.replace(/```/g, '')}
                            </code>
                          </pre>
                        </div>
                      ) : (
                        <p style={{ whiteSpace: 'pre-wrap' }}>{userResponse}</p>
                      )}
                    </div>
                  </div>

                  {/* Ideal Model Answer Box */}
                  <div>
                    <div className="answer-title" style={{ color: 'var(--success)' }}>AI Model Perfect Answer</div>
                    <div className="answer-box ideal" style={{ height: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                      {q.model_answer}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', gap: '16px' }}>
        <button className="btn btn-secondary" onClick={onBackToDashboard}>
          🠔 Return to Dashboard
        </button>
      </div>

      {/* print specific CSS hacks */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            background-image: none !important;
          }
          .navbar, .btn, .step-node, ::-webkit-scrollbar {
            display: none !important;
          }
          .glass-panel {
            background: white !important;
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            color: black !important;
          }
          h1, h2, h3, h4, p, span, strong {
            color: black !important;
          }
          .feedback-accordion-content {
            display: block !important;
          }
          .feedback-accordion {
            page-break-inside: avoid !important;
            border-color: #999 !important;
          }
        }
      `}} />
    </div>
  );
}
