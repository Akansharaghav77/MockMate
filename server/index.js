import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data', 'interviews.json');

// Helper to clean JSON from markdown code blocks
function cleanJsonString(str) {
  return str
    .replace(/```json\s?/i, '')
    .replace(/```\s?$/, '')
    .trim();
}

// Helper to get Gemini Client based on headers or server environment variables
function getGeminiClient(req) {
  const clientKey = req.headers['x-gemini-key'];
  const envKey = process.env.GEMINI_API_KEY;
  const key = clientKey || envKey;
  
  if (!key) {
    throw new Error('API_KEY_MISSING');
  }
  
  return new GoogleGenerativeAI(key);
}

// Database Helpers
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

async function ensureDbExists() {
  try {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    await fs.access(DB_FILE);
  } catch (error) {
    await fs.writeFile(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

async function readDb() {
  await ensureDbExists();
  const data = await fs.readFile(DB_FILE, 'utf-8');
  return JSON.parse(data);
}

async function writeDb(data) {
  await ensureDbExists();
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function ensureUsersDbExists() {
  try {
    await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
    await fs.access(USERS_FILE);
  } catch (error) {
    // Write demo user by default so it's always available
    const defaultUsers = [
      {
        name: 'Demo Candidate',
        email: 'demo@mockmate.com',
        password: 'password123',
        targetRole: 'Full Stack Developer'
      }
    ];
    await fs.writeFile(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf-8');
  }
}

async function readUsersDb() {
  await ensureUsersDbExists();
  const data = await fs.readFile(USERS_FILE, 'utf-8');
  return JSON.parse(data);
}

async function writeUsersDb(data) {
  await ensureUsersDbExists();
  await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 1. Get API Key Status
app.get('/api/config', (req, res) => {
  const envKeyExists = !!process.env.GEMINI_API_KEY;
  res.json({ envKeyConfigured: envKeyExists });
});

// Save API Key in server environment variables and .env file
app.post('/api/config', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required.' });
    }
    // Update process.env
    process.env.GEMINI_API_KEY = apiKey;
    // Write or update .env file
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch (e) {
      try {
        envContent = await fs.readFile(path.join(__dirname, '..', '.env.example'), 'utf-8');
      } catch (err) {
        envContent = 'PORT=5000\n';
      }
    }
    
    // Replace or append GEMINI_API_KEY
    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${apiKey}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${apiKey}`;
    }
    await fs.writeFile(envPath, envContent, 'utf-8');
    res.json({ success: true, message: 'API key configured successfully on the server.' });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save API key on the server.' });
  }
});

// Clear API Key in server environment variables and .env file
app.post('/api/config/clear', async (req, res) => {
  try {
    delete process.env.GEMINI_API_KEY;
    const envPath = path.join(__dirname, '..', '.env');
    try {
      let envContent = await fs.readFile(envPath, 'utf-8');
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, 'GEMINI_API_KEY=');
      await fs.writeFile(envPath, envContent, 'utf-8');
    } catch (e) {}
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear API key on server.' });
  }
});

// Auth: Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, targetRole } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const users = await readUsersDb();
    const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }
    const newUser = { name, email, password, targetRole: targetRole || 'Frontend Developer' };
    users.push(newUser);
    await writeUsersDb(users);
    res.status(201).json({ message: 'User registered successfully.', user: { name, email, targetRole } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

// Auth: Signin
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const users = await readUsersDb();
    const matchedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!matchedUser) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    res.json({
      user: {
        name: matchedUser.name,
        email: matchedUser.email,
        targetRole: matchedUser.targetRole
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sign in.' });
  }
});

// Auth: Verify Session
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const users = await readUsersDb();
    const matchedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!matchedUser) {
      return res.status(401).json({ error: 'Session user does not exist.' });
    }
    res.json({
      success: true,
      user: {
        name: matchedUser.name,
        email: matchedUser.email,
        targetRole: matchedUser.targetRole
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Session verification failed.' });
  }
});

// 2. Get All Interviews (History, with optional email filtering)
app.get('/api/interviews', async (req, res) => {
  try {
    const { email } = req.query;
    const db = await readDb();
    let filtered = db;
    if (email) {
      filtered = db.filter(i => !i.userEmail || i.userEmail.toLowerCase() === email.toLowerCase());
    }
    // Return sorted by date descending (newest first)
    const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve interviews history.' });
  }
});

// 3. Get A Single Interview
app.get('/api/interviews/:id', async (req, res) => {
  try {
    const db = await readDb();
    const interview = db.find(i => i.id === req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found.' });
    }
    res.json(interview);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve interview details.' });
  }
});

// 4. Start Interview (Creates entry and returns greeting)
app.post('/api/interviews/start', async (req, res) => {
  try {
    const { jobRole, experienceLevel, techStack, userEmail } = req.body;
    if (!jobRole || !experienceLevel || !techStack) {
      return res.status(400).json({ error: 'Job role, experience level, and tech stack are required.' });
    }

    const newInterview = {
      id: Date.now().toString(),
      jobRole,
      experienceLevel,
      techStack,
      status: 'active',
      createdAt: new Date().toISOString(),
      questions: [],
      answers: [],
      evaluation: null,
      userEmail: userEmail || null
    };

    const db = await readDb();
    db.push(newInterview);
    await writeDb(db);

    const greeting = `Hello! Welcome to your MockMate interview for the ${jobRole} position. I will be your AI interviewer today. Let's start with a basic question to get warmed up.`;

    res.status(201).json({
      interview: newInterview,
      greeting
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start interview.' });
  }
});

// 5. Generate Next Question Dynamically with Adaptive Difficulty and Follow-ups
app.post('/api/interviews/:id/next-question', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readDb();
    const interviewIndex = db.findIndex(i => i.id === id);

    if (interviewIndex === -1) {
      return res.status(404).json({ error: 'Interview not found.' });
    }

    const interview = db[interviewIndex];
    const nextIndex = interview.questions.length + 1;

    // Match domain based on tech stack and job role
    function matchDomain(techStack, jobRole) {
      const text = `${techStack || ''} ${jobRole || ''}`.toLowerCase();
      if (text.includes('react')) return 'React';
      if (text.includes('java ') || text.includes('java,') || text.endsWith('java') || text.includes('spring boot')) return 'Java';
      if (text.includes('dbms') || text.includes('sql') || text.includes('postgres') || text.includes('mongo') || text.includes('database')) return 'DBMS';
      if (text.includes('operating system') || text.includes(' os ') || text.includes('linux')) return 'Operating Systems';
      if (text.includes('ai') || text.includes('ml') || text.includes('machine learning') || text.includes('deep learning') || text.includes('data science')) return 'AI/ML';
      if (text.includes('html') || text.includes('css') || text.includes('javascript') || text.includes('frontend') || text.includes('web')) return 'Web Development';
      return 'General Technical';
    }

    const domain = matchDomain(interview.techStack, interview.jobRole);
    
    // Load question from local src/questions.json
    let questionsJson = {};
    try {
      const qPath = path.join(__dirname, '..', 'src', 'questions.json');
      const qData = await fs.readFile(qPath, 'utf-8');
      questionsJson = JSON.parse(qData);
    } catch (err) {
      console.warn('Failed to load questions.json from server side, using fallback questions:', err);
      // Hardcoded fallback questions
      questionsJson = {
        "React": [
          { "question": "Explain the difference between useMemo and useCallback hooks in React.", "category": "React Hooks", "focus_area": "Hooks", "ideal_keywords": ["useMemo", "useCallback"] }
        ],
        "General Technical": [
          { "question": "What is the difference between monolithic and microservices architectures?", "category": "System Design", "focus_area": "Architecture", "ideal_keywords": ["microservices", "monolith"] }
        ]
      };
    }

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

    const domainQuestions = questionsJson[domain] || questionsJson['General Technical'] || questionsJson['React'];
    
    // Filter out already asked questions to prevent repetition
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

    // Pick a random question from selected set
    const randomIndex = Math.floor(Math.random() * difficultyMatchedQuestions.length);
    const selected = difficultyMatchedQuestions[randomIndex];

    const nextQuestion = {
      id: nextIndex,
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

    interview.questions.push(nextQuestion);
    db[interviewIndex] = interview;
    await writeDb(db);

    res.json({
      complete: false,
      question: nextQuestion
    });

  } catch (error) {
    console.error('Error generating adaptive question:', error);
    res.status(500).json({ error: 'Failed to generate the next question. Please try again.' });
  }
});

// 6. Submit User Answer for the Current Question
app.post('/api/interviews/:id/submit-answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    const db = await readDb();
    const interviewIndex = db.findIndex(i => i.id === id);

    if (interviewIndex === -1) {
      return res.status(404).json({ error: 'Interview not found.' });
    }

    const interview = db[interviewIndex];
    
    // Store answer corresponding to current question index
    const currentQIndex = interview.answers.length;
    if (currentQIndex >= interview.questions.length) {
      return res.status(400).json({ error: 'No active question waiting for an answer.' });
    }

    interview.answers.push(answer || 'No answer recorded.');
    db[interviewIndex] = interview;
    await writeDb(db);

    res.json({ success: true, answersCount: interview.answers.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record answer.' });
  }
});

// 7. Send Transcript to Gemini for Evaluation
app.post('/api/interviews/:id/evaluate', async (req, res) => {
  const { id } = req.params;
  let db;
  let interviewIndex = -1;
  let timeoutId;
  try {
    db = await readDb();
    interviewIndex = db.findIndex(i => i.id === id);

    if (interviewIndex === -1) {
      return res.status(404).json({ error: 'Interview not found.' });
    }

    const interview = db[interviewIndex];

    if (interview.questions.length === 0) {
      return res.status(400).json({ error: 'Interview is not complete.' });
    }

    // Prepare transcript string
    const transcript = interview.questions.map((q, idx) => {
      const answer = interview.answers[idx] || 'No answer provided.';
      return `Question ${q.id} (${q.category}): ${q.question}\nCandidate Answer: ${answer}\n`;
    }).join('\n---\n\n');

    const evaluationPrompt = `You are a senior technical interviewer and hiring manager. Evaluate the completed mock interview for:
Candidate Profile:
- Role: ${interview.jobRole}
- Experience Level: ${interview.experienceLevel}
- Tech Stack: ${interview.techStack}

Transcript of the mock interview containing ${interview.questions.length} questions:
${transcript}

Provide an exhaustive, professional, and detailed evaluation. Give actionable feedback and construct the output as a valid JSON object matching the format below. Do not wrap in markdown code blocks.
You must return detailed feedback in the 'detailedFeedback' array for ALL ${interview.questions.length} questions in the transcript.

Your assessment must be strict, realistic, and highly critical, mimicking a real senior technical interviewer. Highlight technical mistakes, missing details, or vague explanations clearly. Do not use overly soft, generic, or polite language. Focus on identifying actual gaps in knowledge.

JSON Format:
{
  "overallScore": 85, // overall integer score 0-100 (be strict and critical)
  "categoryScores": {
    "technical": 88, // 0-100 technical knowledge score
    "communication": 82, // 0-100 articulation and clarity
    "completeness": 85 // 0-100 depth of answers and keywords
  },
  "summary": "A 3-4 sentence professional executive summary of their performance...",
  "strengths": [
    "Identify specific strong point 1",
    "Identify specific strong point 2",
    "Identify specific strong point 3"
  ],
  "weakAreas": [
    "Identify specific weak area, mistake, or missing concept 1",
    "Identify specific weak area, mistake, or missing concept 2",
    "Identify specific weak area, mistake, or missing concept 3"
  ],
  "technicalAccuracy": "A strict assessment of the technical accuracy of their responses, highlighting incorrect answers.",
  "communicationClarity": "Assessment of their communication clarity and confidence level.",
  "domainUnderstanding": "Assessment of their domain understanding quality based on responses in the context of their experience level.",
  "finalVerdict": "Beginner | Intermediate | Advanced recommendation based on performance",
  "improvements": [
    "Specific and actionable suggestion 1",
    "Specific and actionable suggestion 2",
    "Specific and actionable suggestion 3"
  ],
  "detailedFeedback": [
    // Provide an entry for each of the ${interview.questions.length} questions:
    {
      "question_id": 1, // match the question_id from the transcript
      "question": "The question text...",
      "score": 8, // out of 10
      "feedback": "Highlight exactly what was excellent and details they missed or could have articulated better.",
      "model_answer": "Provide a complete, comprehensive, professional model answer to show how a senior candidate would answer this question perfectly."
    }
  ]
}`;

    // Get Gemini instance
    let genAI;
    try {
      genAI = getGeminiClient(req);
    } catch (err) {
      if (err.message === 'API_KEY_MISSING') {
        throw new Error('API_KEY_MISSING');
      }
      throw err;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 12000);
    });

    const geminiCall = model.generateContent({
      contents: [{ role: 'user', parts: [{ text: evaluationPrompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    const result = await Promise.race([geminiCall, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    const text = result.response.text();
    const cleanText = cleanJsonString(text);
    const parsed = JSON.parse(cleanText);

    // Save final evaluation results and set status to completed
    interview.status = 'completed';
    interview.evaluation = parsed;

    db[interviewIndex] = interview;
    await writeDb(db);

    res.json(parsed);

  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    console.error('Error during AI evaluation, attempting local fallback evaluation:', error);
    try {
      if (interviewIndex === -1) {
        return res.status(500).json({ error: 'Failed to evaluate interview.' });
      }

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

      const interview = db[interviewIndex];
      const totalQuestions = interview.questions.length;
      let totalScoreSum = 0;
      const detailedFeedback = interview.questions.map((q, idx) => {
        const answer = interview.answers[idx] || '';
        // Match ideal keywords
        const matched = q.ideal_keywords ? q.ideal_keywords.filter(keyword => answer.toLowerCase().includes(keyword.toLowerCase())) : [];
        const matchPercent = q.ideal_keywords && q.ideal_keywords.length > 0 ? (matched.length / q.ideal_keywords.length) : 0.5;
        let score = Math.round(5 + matchPercent * 5); // baseline of 5, goes up to 10
        if (answer.trim().length === 0) score = 0;
        totalScoreSum += score;
        
        return {
          question_id: q.id,
          question: q.question,
          score: score,
          feedback: generateFeedback(q, score, answer),
          model_answer: generateModelAnswer(q)
        };
      });

      const overallScore = totalQuestions > 0 ? Math.round((totalScoreSum / (totalQuestions * 10)) * 100) : 0;
      const parsed = {
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

      interview.status = 'completed';
      interview.evaluation = parsed;
      db[interviewIndex] = interview;
      await writeDb(db);

      res.json(parsed);
    } catch (fallbackErr) {
      console.error('Fallback evaluation failed:', fallbackErr);
      res.status(500).json({ error: 'Failed to evaluate interview. Please try again.' });
    }
  }
});

// Delete Interview History Item
app.delete('/api/interviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readDb();
    const filtered = db.filter(i => i.id !== id);
    await writeDb(filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete interview history item.' });
  }
});

// Fallback to serve frontend in production (optional, we use Vite server for development)
app.get('/', (req, res) => {
  res.send('MockMate Server API is running.');
});

app.listen(PORT, () => {
  console.log(`MockMate API server is running on http://localhost:${PORT}`);
});
