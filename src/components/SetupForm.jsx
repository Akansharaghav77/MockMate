import React, { useState } from 'react';

const STANDARD_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Analyst',
  'DevOps Engineer',
  'Data Scientist',
  'Mobile Developer (iOS/Android)',
  'Custom...'
];

const POPULAR_TAGS = [
  'React', 'Node.js', 'JavaScript', 'TypeScript', 'HTML/CSS',
  'Python', 'Java', 'Spring Boot', 'SQL', 'NoSQL', 'PostgreSQL',
  'MongoDB', 'Express', 'Next.js', 'Django', 'Go', 'Docker',
  'AWS', 'Git', 'Data Structures', 'System Design'
];

export default function SetupForm({ onStart, isLoading }) {
  const [step, setStep] = useState(1);
  const [jobRole, setJobRole] = useState(STANDARD_ROLES[0]);
  const [customRole, setCustomRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const [selectedTags, setSelectedTags] = useState(['React', 'JavaScript', 'HTML/CSS']);
  const [customTag, setCustomTag] = useState('');
  const [voiceAssist, setVoiceAssist] = useState(true);

  const activeRole = jobRole === 'Custom...' ? customRole : jobRole;

  const handleTagToggle = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = (e) => {
    e.preventDefault();
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      setSelectedTags([...selectedTags, customTag.trim()]);
      setCustomTag('');
    }
  };

  const handleNext = () => {
    if (step === 1 && jobRole === 'Custom...' && !customRole.trim()) {
      alert('Please specify your custom job role.');
      return;
    }
    if (step === 2 && selectedTags.length === 0) {
      alert('Please select or add at least one technology/skill for your tech stack.');
      return;
    }
    setStep(step + 1);
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

  const handleSubmit = () => {
    const finalRole = jobRole === 'Custom...' ? customRole.trim() : jobRole;
    const finalTechStack = selectedTags.join(', ');
    onStart({
      jobRole: finalRole,
      experienceLevel,
      techStack: finalTechStack,
      voiceAssist
    });
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '650px', margin: '0 auto' }}>
      {/* Wizard Steps Header */}
      <div className="setup-wizard-header">
        <div className={`step-node ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          {step > 1 ? '✓' : '1'}
        </div>
        <div className={`step-node ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          {step > 2 ? '✓' : '2'}
        </div>
        <div className={`step-node ${step >= 3 ? 'active' : ''}`}>
          3
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-around', margin: '-30px auto 30px', maxWidth: '90%', fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)' }}>
        <span style={{ color: step >= 1 ? 'var(--accent-cyan)' : '' }}>Job Profile</span>
        <span style={{ color: step >= 2 ? 'var(--accent-cyan)' : '' }}>Skills & Stack</span>
        <span style={{ color: step >= 3 ? 'var(--accent-cyan)' : '' }}>Preferences</span>
      </div>

      {/* Step 1: Job Role & Experience */}
      {step === 1 && (
        <div className="fade-in">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'var(--text-primary)' }}>Select Job Profile</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            We'll customize your interview questions based on the role and experience level.
          </p>

          <div className="form-group">
            <label className="form-label">Job Role</label>
            <select 
              className="form-control" 
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              style={{ background: 'var(--bg-tertiary)' }}
            >
              {STANDARD_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {jobRole === 'Custom...' && (
            <div className="form-group fade-in">
              <label className="form-label">Custom Job Role</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Lead QA Engineer, Data Warehouse Analyst..."
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
              />
            </div>
          )}

          <div className="form-group" style={{ marginTop: '24px' }}>
            <label className="form-label">Experience Level</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {['Beginner', 'Intermediate', 'Advanced'].map((level) => {
                let description = '0 - 2 yrs';
                if (level === 'Intermediate') description = '3 - 5 yrs';
                if (level === 'Advanced') description = '5+ yrs';

                return (
                  <button
                    key={level}
                    type="button"
                    className={`tag-select ${experienceLevel === level ? 'active' : ''}`}
                    onClick={() => setExperienceLevel(level)}
                    style={{ padding: '16px 8px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContents: 'center', height: 'auto', gap: '4px' }}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{level}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '36px' }}>
            <button className="btn btn-primary" onClick={handleNext}>
              Next Step ➔
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Tech Stack & Keywords */}
      {step === 2 && (
        <div className="fade-in">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Configure Tech Stack</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Select the technologies, libraries, and tools you want to be grilled on.
          </p>

          <div className="form-group">
            <label className="form-label">Popular Skills (Toggle to select)</label>
            <div className="tag-container" style={{ maxHeight: '160px', overflowY: 'auto', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-select ${selectedTags.includes(tag) ? 'active' : ''}`}
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '24px' }}>
            <label className="form-label">Add Custom Technologies</label>
            <form onSubmit={handleAddCustomTag} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Kubernetes, RxJS, Flask, Rust..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                + Add Tag
              </button>
            </form>
          </div>

          {selectedTags.length > 0 && (
            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="form-label">Selected Tech Stack ({selectedTags.length})</label>
              <div className="tag-container">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="badge badge-blue"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag} <span style={{ opacity: 0.6 }}>✕</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '36px' }}>
            <button className="btn btn-secondary" onClick={handlePrev}>
              🠔 Back
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Next Step ➔
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Summary & Launch */}
      {step === 3 && (
        <div className="fade-in">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Ready to Roll!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Review your interview configurations and start the assessment.
          </p>

          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="flex-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Target Job Role</span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{activeRole}</strong>
            </div>
            
            <div className="flex-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Experience Level</span>
              <strong style={{ color: 'var(--text-primary)' }}>{experienceLevel}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tech Stack to be Tested:</span>
              <div className="tag-container">
                {selectedTags.map((tag) => (
                  <span key={tag} className="badge badge-purple" style={{ fontSize: '0.75rem' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="form-group" style={{ margin: '30px 0' }}>
            <div className="flex-between" style={{ padding: '6px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>AI Voice Assistant</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Let the AI interviewer read out questions aloud automatically.
                </span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={voiceAssist} 
                  onChange={(e) => setVoiceAssist(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '36px' }}>
            <button className="btn btn-secondary" onClick={handlePrev} disabled={isLoading}>
              🠔 Back
            </button>
            <button className="btn btn-accent" onClick={handleSubmit} disabled={isLoading} style={{ minWidth: '180px' }}>
              {isLoading ? (
                <>
                  <span className="typing-loader" style={{ margin: 0, height: 'auto' }}>
                    <span></span><span></span><span></span>
                  </span>
                  Generating...
                </>
              ) : (
                '🚀 Start Mock Interview'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
