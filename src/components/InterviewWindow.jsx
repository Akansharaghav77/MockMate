import React, { useState, useEffect, useRef } from 'react';
import CameraFeed from './CameraFeed';
import AudioVisualizer from './AudioVisualizer';
import { API_BASE_URL, fetchWithTimeout } from '../config';
import questionsJson from '../questions.json';

export default function InterviewWindow({ interview, voiceAssist, onComplete }) {
  const [currentQIndex, setCurrentQIndex] = useState(1);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [codeWorkspace, setCodeWorkspace] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true); // Enable camera by default
  
  // Phase can be 'GREETING', 'WAITING_FOR_READY', 'IN_PROGRESS', 'COMPLETED'
  const [interviewPhaseState, setInterviewPhaseState] = useState('GREETING');
  const interviewPhaseRef = useRef('GREETING');

  const setInterviewPhase = (phase) => {
    interviewPhaseRef.current = phase;
    setInterviewPhaseState(phase);
  };
  const interviewPhase = interviewPhaseState;

  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const shouldBeListeningRef = useRef(false);
  const prefetchQ1Ref = useRef(null);
  const apiLockRef = useRef(false); // Locking concurrent API calls
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Media Stream & Recording States
  const [mediaStream, setMediaStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const recordedChunksRef = useRef([]);

  // 1. Initialize Unified Media Stream
  const initMedia = async () => {
    setError(null);
    try {
      console.log('Requesting camera/microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 270, facingMode: 'user' },
        audio: true
      });
      mediaStreamRef.current = stream;
      setMediaStream(stream);
      setError(null);
    } catch (err) {
      console.warn('Failed to access camera/mic: ', err);
      setError('Camera or Microphone access was denied or is unavailable. Please check your browser permissions, click "Allow", and click Retry.');
    }
  };

  useEffect(() => {
    initMedia();

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
        mediaStreamRef.current = null;
      }
    };
  }, []);

  // MediaRecorder Helpers
  const startMediaRecording = () => {
    if (!mediaStream) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    try {
      recordedChunksRef.current = [];
      let recorder;
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      try {
        recorder = new MediaRecorder(mediaStream, options);
      } catch (e) {
        try {
          recorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm;codecs=vp8,opus' });
        } catch (err) {
          recorder = new MediaRecorder(mediaStream);
        }
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        try {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          console.log('Recorded video blob created successfully. Size:', blob.size);
        } catch (err) {
          console.error('Failed to create recorded blob:', err);
        }
      };

      recorder.start(1000); // chunk every 1s
      mediaRecorderRef.current = recorder;
      setMediaRecorder(recorder);
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
    }
  };

  const stopMediaRecording = () => {
    const recorder = mediaRecorderRef.current || mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (err) {
        console.error('Failed to stop MediaRecorder:', err);
      }
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setAnswer(prev => prev + finalTranscript);
        }
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('Microphone permission blocked. Please enable mic access.');
          setIsListening(false);
          shouldBeListeningRef.current = false;
          stopMediaRecording();
        } else if (event.error === 'no-speech') {
          console.log('No speech detected.');
        } else if (event.error === 'aborted') {
          console.log('Speech recognition aborted.');
        } else {
          console.warn('Speech recognition warning:', event.error);
        }
      };

      rec.onend = () => {
        setIsListening(false);
        if (shouldBeListeningRef.current) {
          setTimeout(() => {
            if (shouldBeListeningRef.current) {
              try {
                recognitionRef.current.start();
                setIsListening(true);
              } catch (err) {}
            }
          }, 400);
        }
      };

      recognitionRef.current = rec;
    } else {
      console.warn('Speech Recognition not supported in this browser.');
    }

    // Initial greeting
    setQuestion({
      id: 0,
      question: "Hello! Welcome to your mock interview. Can we start the interview?",
      category: "Greeting",
      focus_area: "Introduction"
    });

    // Prefetch Q1 technical question
    const prefetchQ1 = async () => {
      try {
        const headers = { 'Content-Type': 'application/json' };

        const response = await fetchWithTimeout(`${API_BASE_URL}/api/interviews/${interview.id}/next-question`, {
          method: 'POST',
          headers
        }, 8000);
        if (response.ok) {
          const data = await response.json();
          prefetchQ1Ref.current = data.question;
        }
      } catch (err) {
        console.warn('Prefetch failed:', err);
      }
    };
    prefetchQ1();

    return () => {
      shouldBeListeningRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Text-To-Speech: Speak question when it loads
  useEffect(() => {
    if (question && voiceAssist) {
      speakQuestion(question.question);
    }
  }, [question, voiceAssist]);

  const speakQuestion = (text) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const runSpeech = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Zira') || v.name.includes('David'))) ||
                              voices.find(v => v.lang.startsWith('en'));
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.rate = 0.95;
      
      utterance.onend = () => {
        setIsSpeaking(false);
        // Automatically start recording & listening
        if (recognitionRef.current && !isListening) {
          try {
            shouldBeListeningRef.current = true;
            recognitionRef.current.start();
            setIsListening(true);
            startMediaRecording();
          } catch (err) {
            console.error('Auto-start mic failed:', err);
          }
        }
      };
      
      utterance.onerror = (e) => {
        console.error('Speech error:', e);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        runSpeech();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      runSpeech();
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech-to-Text is not supported in this browser. Please type your answer manually.');
      return;
    }

    if (isListening) {
      shouldBeListeningRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
      stopMediaRecording();
    } else {
      setError(null);
      stopSpeaking();
      try {
        shouldBeListeningRef.current = true;
        recognitionRef.current.start();
        setIsListening(true);
        startMediaRecording();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleGreetingResponse = async (text) => {
    const lower = text.toLowerCase();
    const yesWords = ['yes', 'yeah', 'okay', 'start', "let's start", 'sure', 'yep', 'ready'];
    const noWords = ['no', 'wait', 'not now', 'hold on', 'stop', 'later'];

    const isYes = yesWords.some(w => lower.includes(w));
    const isNo = noWords.some(w => lower.includes(w));

    if (isYes) {
      setInterviewPhase('IN_PROGRESS');
      setAnswer('');
      if (prefetchQ1Ref.current) {
        setQuestion(prefetchQ1Ref.current);
        setCurrentQIndex(prefetchQ1Ref.current.id);
        const isTechnical = prefetchQ1Ref.current.category.includes('Practical') || prefetchQ1Ref.current.category.includes('Problem-solving') || prefetchQ1Ref.current.category.includes('React') || prefetchQ1Ref.current.category.includes('Java');
        setShowCode(isTechnical);
      } else {
        await fetchNextQuestion(1);
      }
    } else if (isNo) {
      setInterviewPhase('WAITING_FOR_READY');
      setAnswer('');
      setQuestion({
        id: 0,
        question: "No problem. Let me know when you are ready to continue.",
        category: "Greeting",
        focus_area: "Waiting"
      });
    } else {
      setAnswer('');
      setQuestion({
        id: 0,
        question: "I didn't quite catch that. Can we start the interview?",
        category: "Greeting",
        focus_area: "Introduction"
      });
    }
  };

  const fetchNextQuestion = async (qIndex) => {
    setIsLoading(true);
    setError(null);
    try {
      let nextQuestionObj = null;

      // Try server endpoint first
      try {
        const headers = { 'Content-Type': 'application/json' };

        const response = await fetchWithTimeout(`${API_BASE_URL}/api/interviews/${interview.id}/next-question`, {
          method: 'POST',
          headers
        }, 8000);

        if (response.ok) {
          const data = await response.json();
          nextQuestionObj = data.question;
        }
      } catch (err) {
        console.warn('Server failed to fetch next question, falling back locally:', err);
      }

      // Local fallback
      if (!nextQuestionObj) {
        const text = `${interview.techStack || ''} ${interview.jobRole || ''}`.toLowerCase();
        let domain = 'General Technical';
        if (text.includes('react')) domain = 'React';
        else if (text.includes('java ') || text.includes('java,') || text.endsWith('java') || text.includes('spring boot')) domain = 'Java';
        else if (text.includes('dbms') || text.includes('sql') || text.includes('postgres') || text.includes('mongo') || text.includes('database')) domain = 'DBMS';
        else if (text.includes('operating system') || text.includes(' os ') || text.includes('linux')) domain = 'Operating Systems';
        else if (text.includes('ai') || text.includes('ml') || text.includes('machine learning') || text.includes('deep learning') || text.includes('data science')) domain = 'AI/ML';
        else if (text.includes('html') || text.includes('css') || text.includes('javascript') || text.includes('frontend') || text.includes('web')) domain = 'Web Development';

        // Determine target difficulty level adaptively
        let targetDifficulty = 'Easy';
        let adaptationReason = 'Starting interview with foundational concepts.';
        let adaptationEval = 'Initial';

        if (interview.questions.length < 2) {
          targetDifficulty = 'Easy';
          adaptationReason = 'First few questions are kept at basic/foundational level to evaluate core concepts.';
          adaptationEval = 'Initial';
        } else if (interview.questions.length > 0 && interview.answers.length > 0) {
          const prevQuestion = interview.questions[interview.questions.length - 1];
          const prevAnswer = interview.answers[interview.answers.length - 1] || '';
          const prevKeywords = prevQuestion.ideal_keywords || [];
          const matchedCount = prevKeywords.filter(kw => prevAnswer.toLowerCase().includes(kw.toLowerCase())).length;
          const score = prevKeywords.length > 0 ? (matchedCount / prevKeywords.length) : 0.5;
          
          const prevDifficulty = prevQuestion.difficulty_level || 'Easy';
          adaptationEval = score >= 0.4 ? 'Correct/Good' : 'Needs Development';
          
          if (prevDifficulty.toLowerCase() === 'easy') {
            if (score >= 0.4) {
              targetDifficulty = 'Medium';
              adaptationReason = `Good response to basic question (matched ${matchedCount} keywords). Upgrading to intermediate level.`;
            } else {
              targetDifficulty = 'Easy';
              adaptationReason = `Basic question needs more detail. Remaining at basic level to build confidence.`;
            }
          } else if (prevDifficulty.toLowerCase() === 'medium') {
            if (score >= 0.4) {
              targetDifficulty = 'Hard';
              adaptationReason = `Solid response to intermediate question. Upgrading to advanced level.`;
            } else {
              targetDifficulty = 'Easy';
              adaptationReason = `Intermediate question was challenging. Reverting to basic level for foundational review.`;
            }
          } else {
            if (score >= 0.4) {
              targetDifficulty = 'Hard';
              adaptationReason = `Excellent performance at advanced level. Continuing advanced questions.`;
            } else {
              targetDifficulty = 'Medium';
              adaptationReason = `Advanced question was difficult. Stepping down to intermediate level.`;
            }
          }
        }

        const domainQuestions = questionsJson[domain] || questionsJson['General Technical'];
        const askedTexts = interview.questions.map(q => q.question.toLowerCase().trim());
        let availableQuestions = domainQuestions.filter(q => !askedTexts.includes(q.question.toLowerCase().trim()));
        
        if (availableQuestions.length === 0) {
          availableQuestions = domainQuestions;
        }

        // Filter by target difficulty first
        let difficultyMatchedQuestions = availableQuestions.filter(
          q => (q.difficulty_level || 'Easy').toLowerCase() === targetDifficulty.toLowerCase()
        );

        // Fallback if no questions found for selected difficulty
        if (difficultyMatchedQuestions.length === 0) {
          difficultyMatchedQuestions = availableQuestions;
        }

        const randomIndex = Math.floor(Math.random() * difficultyMatchedQuestions.length);
        const selected = difficultyMatchedQuestions[randomIndex];

        nextQuestionObj = {
          id: qIndex,
          question: selected.question,
          category: selected.category || domain,
          focus_area: selected.focus_area || 'Core Concept',
          difficulty_level: selected.difficulty_level || 'Medium',
          adaptation: {
            evaluation: adaptationEval,
            reasoning: adaptationReason
          },
          ideal_keywords: selected.ideal_keywords || []
        };

        interview.questions = interview.questions || [];
        interview.questions.push(nextQuestionObj);
      }

      setQuestion(nextQuestionObj);
      setCurrentQIndex(nextQuestionObj.id);
      setAnswer('');
      setCodeWorkspace('');
      
      const isTechnical = nextQuestionObj.category.includes('Practical') || nextQuestionObj.category.includes('Problem-solving') || nextQuestionObj.category.includes('React') || nextQuestionObj.category.includes('Java');
      setShowCode(isTechnical);

    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async (submitText) => {
    if (apiLockRef.current) {
      console.warn('API Lock in place, duplicate submit ignored.');
      return;
    }

    shouldBeListeningRef.current = false;
    const textToSubmit = typeof submitText === 'string' ? submitText : answer.trim();
    if (!textToSubmit && !codeWorkspace.trim()) {
      alert('Please speak or type an answer before submitting.');
      return;
    }

    apiLockRef.current = true;
    setIsLoading(true);
    stopSpeaking();
    stopMediaRecording();

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }

    try {
      let fullSubmission = textToSubmit;
      if (showCode && codeWorkspace.trim()) {
        fullSubmission += `\n\n[Candidate's Provided Code Snippet]:\n\`\`\`\n${codeWorkspace.trim()}\n\`\`\``;
      }

      if (interviewPhase === 'GREETING' || interviewPhase === 'WAITING_FOR_READY') {
        await handleGreetingResponse(fullSubmission);
      } else {
        // Record answer
        try {
          const response = await fetchWithTimeout(`${API_BASE_URL}/api/interviews/${interview.id}/submit-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer: fullSubmission })
          }, 8000);

          if (!response.ok) {
            throw new Error('Failed to record your answer.');
          }
        } catch (err) {
          console.warn('Server failed to record answer, saving locally:', err);
          interview.answers = interview.answers || [];
          interview.answers.push(fullSubmission);
        }

        // Fetch next question in continuous mode
        await fetchNextQuestion(currentQIndex + 1);
      }
    } catch (err) {
      setError(err.message || 'An error occurred while submitting your answer.');
    } finally {
      setIsLoading(false);
      apiLockRef.current = false;
    }
  };

  const handleStopInterview = () => {
    // 1. Immediately block any further voice recognition listener triggers
    shouldBeListeningRef.current = false;
    
    // 2. Cancel active text-to-speech / speaking processes
    stopSpeaking();
    
    // 3. Stop the media recording process instantly
    stopMediaRecording();
    
    // 4. Force stop the web speech recognition engine
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    
    // 5. Release all active camera and microphone tracks immediately
    const activeStream = mediaStreamRef.current || mediaStream;
    if (activeStream) {
      try {
        activeStream.getTracks().forEach(track => {
          track.enabled = false; // Disable it first to clear preview instantly
          track.stop(); // Release the hardware device
        });
      } catch (err) {
        console.warn('Failed to release tracks on stop interview:', err);
      }
    }
    
    // 6. Clear references and update state synchronously
    mediaStreamRef.current = null;
    setMediaStream(null);
    setIsCameraOn(false);
    setIsListening(false);
    
    evaluateInterview(); // Ends session and generates assessment dossier
  };

  const evaluateInterview = async () => {
    setInterviewPhase('COMPLETED');
    setEvalLoading(true);
    setError(null);
    try {
      const headers = { 'Content-Type': 'application/json' };

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/interviews/${interview.id}/evaluate`, {
        method: 'POST',
        headers
      }, 15000);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed during interview evaluation.');
      }

      const evaluation = await response.json();
      onComplete(evaluation);
    } catch (err) {
      console.warn('AI evaluation failed, attempting local fallback evaluation:', err);
      try {
        function generateModelAnswer(q) {
          const keywordsStr = q.ideal_keywords && q.ideal_keywords.length > 0
            ? q.ideal_keywords.map(kw => `\`${kw}\``).join(', ')
            : '';
          return `### Recommended Technical Approach

To answer this question effectively as a senior engineer, cover the following foundational sections:

1. **Core Concept & Mechanism**
   Clearly define the underlying concepts. Focus on the inner mechanics of **${q.category || 'General'}** (Focus Area: *${q.focus_area || 'Core Concept'}*).
   
2. **Key Architectural Components**
   Explain how it executes and interacts with surrounding systems. Be sure to reference: ${keywordsStr}.
   
3. **Trade-offs & Implementation Decisions**
   Analyze performance implications, memory usage, CPU execution overhead, and structural complexity. Compare alternate models to demonstrate technical depth.
   
4. **Typical Production Pitfalls**
   Highlight common mistakes, debug patterns, resource leakage concerns, or concurrency bottlenecks and how to prevent them.`;
        }

        function generateFeedback(q, score, ans) {
          if (!ans || ans.trim().length === 0 || ans.toLowerCase().includes('no answer') || ans === 'No answer recorded.') {
            return `### Critical Gaps: No Response Recorded
The candidate did not provide any substantive answer to this question. 
To prepare for this **${q.category || 'General'}** topic:
- Study the foundational mechanics of **${q.focus_area || 'Core Concept'}**.
- Learn to articulate definitions and use cases for: ${q.ideal_keywords ? q.ideal_keywords.map(k => `\`${k}\``).join(', ') : 'ideal keywords'}.
- Practice drafting brief code structures or diagrams to build confidence.`;
          }

          const matched = q.ideal_keywords ? q.ideal_keywords.filter(keyword => ans.toLowerCase().includes(keyword.toLowerCase())) : [];
          const missing = q.ideal_keywords ? q.ideal_keywords.filter(keyword => !ans.toLowerCase().includes(keyword.toLowerCase())) : [];
          
          let structure = `### Technical Assessment Notes\n\n`;
          if (score >= 8) {
            structure += `**Overall Strength:** Strong technical response. The candidate successfully covered the core concepts and referenced key terminology.
- **Demonstrated Knowledge:** Mentioned critical concepts like ${matched.map(k => `\`${k}\``).join(', ')}.
- **Communication Articulation:** Good technical phrasing and logical clarity.`;
          } else if (score >= 5) {
            structure += `**Overall Strength:** Moderate understanding. The candidate has the right intuition but misses critical depth and core specifications.
- **Identified Gaps:** Failed to mention or detail key concepts: ${missing.map(k => `\`${k}\``).join(', ')}.
- **Actionable Advice:** Restructure the response to explain *why* and *how* the mechanism operates, incorporating precise technical terminology.`;
          } else {
            structure += `**Overall Strength:** Weak response. The explanation was vague, incomplete, or technically inaccurate.
- **Critical Gaps:** Missed almost all essential domain keywords: ${missing.map(k => `\`${k}\``).join(', ')}.
- **Actionable Advice:** Re-read documentation on **${q.category || 'General'}** focusing on **${q.focus_area || 'Core Concept'}** concepts before attempting higher difficulty levels.`;
          }
          return structure;
        }

        const totalQuestions = interview.questions.length;
        let totalScoreSum = 0;
        const detailedFeedback = interview.questions.map((q, idx) => {
          const ans = interview.answers[idx] || '';
          const matched = q.ideal_keywords ? q.ideal_keywords.filter(keyword => ans.toLowerCase().includes(keyword.toLowerCase())) : [];
          const matchPercent = q.ideal_keywords && q.ideal_keywords.length > 0 ? (matched.length / q.ideal_keywords.length) : 0.5;
          let score = Math.round(5 + matchPercent * 5);
          if (ans.trim().length === 0) score = 0;
          totalScoreSum += score;
          
          return {
            question_id: q.id,
            question: q.question,
            score: score,
            feedback: generateFeedback(q, score, ans),
            model_answer: generateModelAnswer(q)
          };
        });

        const overallScore = totalQuestions > 0 ? Math.round((totalScoreSum / (totalQuestions * 10)) * 100) : 0;
        const localEvaluation = {
          overallScore,
          categoryScores: {
            technical: overallScore,
            communication: Math.min(overallScore + 5, 100),
            completeness: overallScore
          },
          summary: `MockMate strictly evaluated your responses for the ${interview.jobRole} profile. You answered ${totalQuestions} questions.`,
          strengths: [
            "Demonstrated familiarity with concepts in the " + interview.jobRole + " domain.",
            "Completed the active technical session questions."
          ],
          weakAreas: [
            "Explanations lacked critical technical details and did not cover all keywords.",
            "Failed to explain design patterns or core mechanics for: " + interview.techStack
          ],
          technicalAccuracy: `Technical precision calculated at ${overallScore}%. Some responses lacked complete accuracy.`,
          communicationClarity: `Communication is basic. Needs clearer structure and professional articulation of trade-offs.`,
          domainUnderstanding: `Domain comprehension assessed at ${overallScore}%. Demonstrates foundational knowledge of ${interview.jobRole} concepts but lacks the technical depth expected at ${interview.experienceLevel} level.`,
          finalVerdict: overallScore < 50 ? 'Beginner' : overallScore < 80 ? 'Intermediate' : 'Advanced',
          improvements: [
            "Study foundational inner mechanics for " + interview.techStack,
            "Incorporate precise technical keywords in answers rather than generic definitions.",
            "Exhaustively detail trade-offs and edge cases for architectural questions."
          ],
          detailedFeedback
        };
        onComplete(localEvaluation);
      } catch (fallbackErr) {
        setError(err.message || 'Evaluation failed. Make sure your API key is correct and try again.');
      }
    } finally {
      setEvalLoading(false);
    }
  };

  if (evalLoading) {
    return (
      <div className="glass-panel" style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center', padding: '40px' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 24px' }}>
          <div style={{ width: '100%', height: '100%', border: '4px solid var(--bg-tertiary)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '12px', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Evaluating Performance...
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Please wait. MockMate is analyzing your transcript, evaluating technical correctness, assessing communication clarity, and drafting a comprehensive feedback dossier...
        </p>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { to { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  return (
    <div className="main-container">
      {/* Device Authorization Prompt */}
      {!mediaStream && !error && (
        <div className="glass-panel" style={{ background: 'rgba(0, 245, 255, 0.05)', borderColor: 'rgba(0, 245, 255, 0.2)', padding: '16px', marginBottom: '24px', borderRadius: '10px' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--accent-cyan)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎤 Action Required: Device Authorization
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
            MockMate is initializing your camera and microphone. Please click **Allow** on the browser permission dialog to enable interactive face-tracking and speech recognition.
          </p>
        </div>
      )}

      {/* Active Header Dashboard Banner */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', padding: '16px 24px' }}>
        <div>
          <span className="badge badge-purple" style={{ marginBottom: '6px' }}>Interview Session</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{interview.jobRole} ({interview.experienceLevel})</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status: </span>
          <span className="badge badge-success">ACTIVE SIMULATION</span>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {interviewPhase === 'IN_PROGRESS' ? `Progress: Question ${currentQIndex} (Continuous Mode)` : 'Greeting Phase'}
          </p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left Side: Audio & Visual Simulated Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <CameraFeed videoStream={isCameraOn ? mediaStream : null} />
          <AudioVisualizer audioStream={isListening ? mediaStream : null} isActive={isListening} />
          
          {/* Action controller toggles */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-secondary)' }}>Interface Settings</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="flex-between">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>AI Question Reader</span>
                <button 
                  className={`btn ${voiceAssist ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                  onClick={() => {
                    if (isSpeaking) {
                      stopSpeaking();
                    } else if (question) {
                      speakQuestion(question.question);
                    }
                  }}
                >
                  {isSpeaking ? '🔊 Speaking...' : '🔊 Read Question'}
                </button>
              </div>
              
              <div className="flex-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Input Workspace</span>
                <button 
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                  onClick={() => setShowCode(!showCode)}
                >
                  {showCode ? 'Hide Code Workspace' : 'Show Code Workspace'}
                </button>
              </div>

              <div className="flex-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Camera</span>
                <label className="switch" style={{ margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={isCameraOn} 
                    onChange={(e) => setIsCameraOn(e.target.checked)} 
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="flex-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Microphone</span>
                <label className="switch" style={{ margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={isListening} 
                    onChange={toggleListening} 
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interviewer Window */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '450px' }}>
          {/* Question Banner */}
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', marginBottom: '20px' }}>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <span className="badge badge-blue">{question?.category || 'Generating...'}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Focus: {question?.focus_area || 'Loading...'}</span>
            </div>
            
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: '100%', background: 'linear-gradient(to right, var(--accent-purple), var(--accent-cyan))', animation: 'pulse 1.5s infinite' }}></div>
            </div>
          </div>

          {/* Question Text block */}
          <div style={{ flexGrow: 1, marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Interviewer:
            </h3>
            
            {isLoading && !question ? (
              <div style={{ padding: '20px 0' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Interviewer is formulating the next tailored question...</p>
                <div className="typing-loader">
                  <span></span><span></span><span></span>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative', marginBottom: isLoading ? '24px' : '0', transition: 'margin 0.3s' }}>
                <p style={{ fontSize: '1.25rem', fontWeight: '500', color: 'var(--text-primary)', lineHeight: 1.5, textShadow: '0 0 1px rgba(255,255,255,0.1)', opacity: isLoading ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                  "{question?.question}"
                </p>
                {isLoading && (
                  <div style={{ position: 'absolute', bottom: '-28px', left: '0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                    <span className="typing-loader" style={{ height: 'auto', margin: 0 }}><span></span><span></span><span></span></span> Processing & formulating next question...
                  </div>
                )}
                {isSpeaking && (
                  <span className="badge badge-blue" style={{ position: 'absolute', top: '-28px', right: 0, fontSize: '0.65rem' }}>
                    🎙️ READING ALOUD
                  </span>
                )}
              </div>
            )}
            
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '8px', color: 'var(--error)', fontSize: '0.85rem', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
                <span>⚠️ {error}</span>
                {(error.includes('denied') || error.includes('permission') || error.includes('unavailable')) && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', borderColor: 'rgba(255, 255, 255, 0.1)' }}
                    onClick={initMedia}
                  >
                    🔄 Retry Microphone & Camera Access
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Code Workspace Toggle Panel */}
          {showCode && (
            <div className="fade-in" style={{ marginBottom: '16px' }}>
              <div className="answer-title" style={{ color: 'var(--accent-cyan)' }}>👨‍💻 Interactive Code Workspace</div>
              <textarea
                className="form-control"
                style={{ fontFamily: 'monospace', height: '150px', background: '#08090d', fontSize: '0.85rem', borderColor: 'rgba(0, 245, 255, 0.2)' }}
                placeholder="// Write any code snippets, algorithms, or queries here to support your explanation..."
                value={codeWorkspace}
                onChange={(e) => setCodeWorkspace(e.target.value)}
              />
            </div>
          )}

          {/* Answer Input block */}
          <div>
            <div className="flex-between" style={{ marginBottom: '6px' }}>
              <label className="answer-title">Your Response</label>
              {isListening && (
                <span style={{ fontSize: '0.75rem', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="pulse-dot recording" style={{ width: '6px', height: '6px' }}></span> Transcribing Live...
                </span>
              )}
            </div>
            
            <textarea
              className="form-control"
              style={{ height: '110px', resize: 'none', marginBottom: '16px' }}
              placeholder={isListening ? 'Listening... Speak clearly into your microphone.' : 'Type your answer here or click the microphone to dictate your response...'}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={isLoading}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className={`btn ${isListening ? 'btn-danger' : 'btn-secondary'}`}
                onClick={toggleListening}
                disabled={isLoading}
                style={{ flexGrow: 1 }}
              >
                {isListening ? '⏹️ Stop Listening' : '🎤 Speech to Text'}
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={handleStopInterview}
                disabled={isLoading || interviewPhase !== 'IN_PROGRESS'}
                style={{ flexGrow: 1 }}
              >
                🛑 Stop Interview
              </button>
              
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSubmitAnswer()}
                disabled={isLoading || (!answer.trim() && !codeWorkspace.trim())}
                style={{ flexGrow: 2 }}
              >
                {isLoading ? (
                  <>
                    <span className="typing-loader" style={{ margin: 0, height: 'auto' }}>
                      <span></span><span></span><span></span>
                    </span>
                    Saving Response...
                  </>
                ) : (
                  'Submit Answer'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
