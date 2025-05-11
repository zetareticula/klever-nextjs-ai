import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { OpenAI } from 'openai';
import { useSession } from 'next-auth/react';

// Configuration for OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Interfaces for data structures
interface UserProfile {
  userId: string;
  preferences: Record<string, string>;
  behaviorHistory: BehaviorEntry[];
  sentimentHistory: SentimentEntry[];
  lastSessionStart: string | null;
  queryCountInSession: number;
  suggestionsReceived: number;
  suggestionsAccepted: number;
  lifeDomains: Record<string, number>; // Track exploration of life domains
}

interface BehaviorEntry {
  timestamp: string;
  action: string;
  context: Record<string, any>;
}

interface SentimentEntry {
  timestamp: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  emotions?: string[];
}

interface ProactiveSuggestion {
  suggestion: string;
  priority: number;
  dimension: 'specificity' | 'personal' | 'life' | 'emotional' | 'tool';
  rationale: string;
  toolRecommendation?: string;
}

//
interface QueryAnalysis {
  query: string;
  scores: {
    specificity: number;
    personal: number;
    life: number;
    emotional: number;
    tool: number;
  };
  dominantDimension: string;
  shouldSuggest: boolean;
  context: {
    userSentiment: string;
    recentQueries: string[];
    sessionCount: number;
  };
}

// Enhanced Data Collection Pipeline
const collectUserData = async (userId: string, action: string, context: Record<string, any>): Promise<void> => {
  const behaviorEntry: BehaviorEntry = {
    timestamp: new Date().toISOString(),
    action,
    context,
  };

  try {
    // Store behavior data
    await fetch('/api/store-behavior', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, behaviorEntry }),
    });
  } catch (error) {
    console.error('Failed to store behavior data:', error);
    // Implement fallback or retry logic
  }
};

// Advanced Sentiment Analysis using OpenAI
const analyzeSentiment = async (text: string): Promise<SentimentEntry> => {
  const prompt = `
    Analyze the sentiment and emotions in this text: "${text}"
    Return a JSON object with:
    - sentiment: either "positive", "neutral", or "negative"
    - confidence: a number between 0 and 1
    - emotions: an array of up to 3 specific emotions detected (e.g., "joy", "frustration", "curiosity")
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0]?.message.content || '{"sentiment":"neutral","confidence":0.5,"emotions":[]}');
    
    return {
      timestamp: new Date().toISOString(),
      sentiment: result.sentiment,
      confidence: result.confidence,
      emotions: result.emotions,
    };
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    return {
      timestamp: new Date().toISOString(),
      sentiment: 'neutral',
      confidence: 0.5,
    };
  }
};

// Enhanced Query Analysis Module with Dynamic Scoring
const analyzeQuery = async (
  query: string, 
  userProfile: UserProfile, 
  recentQueries: string[]
): Promise<QueryAnalysis> => {
  // Extract user context for more nuanced analysis
  const userSentiment = userProfile.sentimentHistory.length > 0 
    ? userProfile.sentimentHistory[userProfile.sentimentHistory.length - 1].sentiment 
    : 'neutral';
  
  const recentEmotions = userProfile.sentimentHistory
    .slice(-3)
    .flatMap(entry => entry.emotions || []);
  
  const unexploredLifeDomains = Object.entries(userProfile.lifeDomains)
    .filter(([_, value]) => value < 2)
    .map(([domain]) => domain);

  const prompt = `
    Analyze the following query in the context of a user assistance system: "${query}".
    
    Recent user queries: ${JSON.stringify(recentQueries)}
    User sentiment: ${userSentiment}
    Recent emotions: ${JSON.stringify(recentEmotions)}
    Unexplored life domains: ${JSON.stringify(unexploredLifeDomains)}
    
    Evaluate the query across five dimensions:
    1. Specificity: Is the query vague or lacking detail? (Score 0-1, higher if vague)
    2. Personal Sharing: Does the query seem transactional or emotionally flat, suggesting an opportunity for deeper connection? (Score 0-1, higher if flat)
    3. Life Exploration: Does the query miss opportunities to explore unaddressed life domains (e.g., health, hobbies, relationships, career)? (Score 0-1, higher if unexplored)
    4. Emotional Support: Does the query indicate negative emotion, uncertainty, or distress? (Score 0-1, higher if emotional need)
    5. Tool Promotion: Can the query be mapped to specialized tools like planners, trackers, or analytics? (Score 0-1, higher if relevant)
    
    Return JSON: { 
      "scores": { 
        "specificity": number, 
        "personal": number, 
        "life": number, 
        "emotional": number, 
        "tool": number 
      },
      "dominantDimension": string  // The dimension with the highest score
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0]?.message.content || '{}');
    const scores = result.scores || { specificity: 0, personal: 0, life: 0, emotional: 0, tool: 0 };
    const dominantDimension = result.dominantDimension || 'none';

    // Dynamic suggestion logic based on business requirements
    const isFirstQuery = userProfile.queryCountInSession === 0;
    const suggestionThreshold = 0.7; // High score triggers suggestion
    const suggestionFrequencyCap = 0.3; // Limit suggestions to ~30% of eligible queries
    const hasDominantDimension = Object.values(scores).some((score: number) => score >= suggestionThreshold);
    
    // Additional constraints from business requirements
    const tooManySuggestions = userProfile.suggestionsReceived / Math.max(1, userProfile.queryCountInSession) > 0.25;
    const recentlyGotSuggestion = recentQueries.length > 0 && recentQueries.length <= 3;
    
    const shouldSuggest =
      !isFirstQuery && 
      hasDominantDimension && 
      !tooManySuggestions &&
      !recentlyGotSuggestion &&
      Math.random() < suggestionFrequencyCap;

    return {
      query,
      scores,
      dominantDimension,
      shouldSuggest,
      context: {
        userSentiment,
        recentQueries,
        sessionCount: userProfile.queryCountInSession,
      }
    };
  } catch (error) {
    console.error('Query analysis failed:', error);
    return {
      query,
      scores: { specificity: 0, personal: 0, life: 0, emotional: 0, tool: 0 },
      dominantDimension: 'none',
      shouldSuggest: false,
      context: {
        userSentiment,
        recentQueries,
        sessionCount: userProfile.queryCountInSession,
      }
    };
  }
};

// Enhanced Proactive Suggestion Generator
const generateSuggestions = async (
  userProfile: UserProfile,
  queryAnalysis: QueryAnalysis
): Promise<ProactiveSuggestion[]> => {
  const availableTools = {
    "health": "Health & Wellness Tracker",
    "finance": "Financial Planning Assistant",
    "productivity": "Task Management System",
    "learning": "Knowledge Base & Learning Tools",
    "social": "Relationship Manager"
  };

  // Get dominant dimension with highest score
  const scores = queryAnalysis.scores;
  const dominantDimension = queryAnalysis.dominantDimension;
  
  const prompt = `
    You are a personalized assistant generating proactive suggestions for a user.
    
    User query: "${queryAnalysis.query}"
    User sentiment: ${queryAnalysis.context.userSentiment}
    Query analysis scores: ${JSON.stringify(scores)}
    Dominant dimension: ${dominantDimension}
    
    Generate ONE proactive suggestion that feels natural, helpful, and non-intrusive.
    Focus on the dominant dimension (${dominantDimension}) while considering the user's current context.
    
    The suggestion should:
    - Feel personalized and relevant to the query
    - Enhance the user's experience without disrupting conversation flow
    - Be concise and actionable (under 30 words)
    - Not feel like a generic template
    
    Available tools: ${JSON.stringify(availableTools)}
    
    Return a JSON object:
    {
      "suggestion": string,  // The actual suggestion to show the user
      "priority": number,    // 1-5, with 5 being highest priority
      "dimension": string,   // The dimension this addresses (specificity, personal, life, emotional, tool)
      "rationale": string,   // Brief explanation of why this suggestion was chosen
      "toolRecommendation": string  // Optional: name of relevant tool if applicable
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const suggestion = JSON.parse(response.choices[0]?.message.content || '{}');
    return [suggestion]; // Return a single high-quality suggestion
  } catch (error) {
    console.error('Failed to generate suggestion:', error);
    return [];
  }
};

// Enhanced Feedback Analysis System
const analyzeFeedback = async (
  userId: string,
  suggestion: ProactiveSuggestion,
  feedback: string
): Promise<{score: number, insights: string}> => {
  const prompt = `
    Analyze this user feedback regarding a proactive suggestion:
    
    Suggestion: "${suggestion.suggestion}"
    Suggestion dimension: ${suggestion.dimension}
    User feedback: "${feedback}"
    
    Provide:
    1. A numerical score from -5 to 5 where:
       - Positive scores indicate the suggestion was helpful
       - Negative scores indicate the suggestion was unhelpful or intrusive
    2. Brief insights about what worked or didn't work
    
    Return as JSON: { "score": number, "insights": string }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0]?.message.content || '{"score": 0, "insights": "No insights available"}');
  } catch (error) {
    console.error('Feedback analysis failed:', error);
    return { score: 0, insights: "Error processing feedback" };
  }
};

// Enhanced Next.js Page Component
const ProactiveAgent: NextPage = () => {
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [queryAnalysis, setQueryAnalysis] = useState<QueryAnalysis | null>(null);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);

  // Initialize or fetch user profile
  useEffect(() => {
    if (session?.user?.id) {
      const initializeProfile = async () => {
        try {
          const response = await fetch(`/api/user-profile?userId=${session.user.id}`);
          if (!response.ok) throw new Error('Failed to fetch profile');
          
          let profile: UserProfile = await response.json();
          
          // Initialize life domains if not present
          if (!profile.lifeDomains) {
            profile.lifeDomains = {
              health: 0,
              finance: 0,
              career: 0,
              relationships: 0,
              leisure: 0,
              personal_growth: 0,
              community: 0
            };
          }
          
          // Check if new session (24-hour period)
          const now = new Date();
          const lastSession = profile.lastSessionStart ? new Date(profile.lastSessionStart) : null;
          if (!lastSession || now.getTime() - lastSession.getTime() > 24 * 60 * 60 * 1000) {
            profile = { 
              ...profile, 
              lastSessionStart: now.toISOString(), 
              queryCountInSession: 0,
              suggestionsReceived: 0
            };
          }
          
          setUserProfile(profile);
          
          // Get conversation history
          const historyResponse = await fetch(`/api/conversation-history?userId=${session.user.id}&limit=5`);
          if (historyResponse.ok) {
            const history = await historyResponse.json();
            setConversationHistory(history.queries || []);
          }
        } catch (error) {
          console.error('Error initializing user profile:', error);
        }
      };
      
      initializeProfile();
    }
  }, [session]);

  // Enhanced user query handling
  const handleUserQuery = async () => {
    if (!userInput.trim() || !userProfile || isProcessing) return;
    
    setIsProcessing(true);
    try {
      // 1. Log the user query
      await collectUserData(userProfile.userId, 'query', { 
        content: userInput,
        timestamp: new Date().toISOString()
      });
      
      // 2. Analyze sentiment
      const sentiment = await analyzeSentiment(userInput);
      
      // 3. Update conversation history
      const updatedHistory = [...conversationHistory, userInput];
      setConversationHistory(updatedHistory.slice(-5)); // Keep last 5 queries
      
      // 4. Update user profile with new data
      const updatedProfile = {
        ...userProfile,
        behaviorHistory: [
          ...userProfile.behaviorHistory, 
          { 
            timestamp: new Date().toISOString(), 
            action: 'query', 
            context: { content: userInput } 
          }
        ],
        sentimentHistory: [...userProfile.sentimentHistory, sentiment],
        queryCountInSession: userProfile.queryCountInSession + 1,
      };
      setUserProfile(updatedProfile);
      
      // 5. Analyze query for proactive suggestions
      const analysis = await analyzeQuery(userInput, updatedProfile, updatedHistory);
      setQueryAnalysis(analysis);
      
      // 6. Generate suggestion if appropriate
      if (analysis.shouldSuggest) {
        const newSuggestions = await generateSuggestions(updatedProfile, analysis);
        
        if (newSuggestions.length > 0) {
          setSuggestions(newSuggestions);
          setShowSuggestion(true);
          
          // Update suggestion count in profile
          setUserProfile(prev => prev ? {
            ...prev,
            suggestionsReceived: prev.suggestionsReceived + 1
          } : null);
          
          // Randomly prompt for feedback (~20% chance)
          setShowFeedbackPrompt(Math.random() < 0.2);
        }
      } else {
        setSuggestions([]);
        setShowSuggestion(false);
        setShowFeedbackPrompt(false);
      }
      
      // Clear input field
      setUserInput('');
    } catch (error) {
      console.error('Error processing query:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Enhanced feedback handling
  const handleFeedback = async () => {
    if (!feedback.trim() || !userProfile || suggestions.length === 0) return;
    
    try {
      const suggestion = suggestions[0];
      const feedbackAnalysis = await analyzeFeedback(
        userProfile.userId, 
        suggestion,
        feedback
      );
      
      // Update user profile based on feedback
      const updatedProfile = {
        ...userProfile,
        suggestionsAccepted: userProfile.suggestionsAccepted + (feedbackAnalysis.score > 0 ? 1 : 0)
      };
      setUserProfile(updatedProfile);
      
      // Log feedback for retraining
      await fetch('/api/store-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: userProfile.userId, 
          feedback, 
          suggestion,
          analysis: feedbackAnalysis,
          timestamp: new Date().toISOString()
        }),
      });
      
      // Reset feedback UI
      setFeedback('');
      setShowFeedbackPrompt(false);
      
      // After short delay, hide suggestion
      setTimeout(() => {
        setShowSuggestion(false);
      }, 500);
    } catch (error) {
      console.error('Error processing feedback:', error);
    }
  };

  // Enhanced UI with better user experience
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Klever Assistant</h1>
      
      {/* Query Input */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleUserQuery()}
            placeholder="How can I help you today?"
            className="border p-3 rounded-lg flex-grow text-lg"
            disabled={isProcessing}
          />
          <button
            onClick={handleUserQuery}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        </div>
      </div>
      
      {/* Proactive Suggestions */}
      {showSuggestion && suggestions.length > 0 && (
        <div className="mt-6 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-800">Suggestion</h2>
          <p className="mt-2 text-gray-800">{suggestions[0].suggestion}</p>
          
          {/* Tool recommendation if applicable */}
          {suggestions[0].toolRecommendation && (
            <div className="mt-2 flex items-center">
              <span className="text-sm text-blue-600 font-medium">
                Tool: {suggestions[0].toolRecommendation}
              </span>
              <button className="ml-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md">
                Try it
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Feedback Input (conditionally displayed) */}
      {showFeedbackPrompt && showSuggestion && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Was this suggestion helpful?</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Your feedback helps us improve"
              className="border p-2 rounded flex-grow"
            />
            <button
              onClick={handleFeedback}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Send
            </button>
          </div>
        </div>
      )}
      
      {/* Debug Panel (can be toggled for development) */}
      {process.env.NODE_ENV === 'development' && userProfile && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs font-mono">
          <h3 className="font-bold mb-2">Debug Info</h3>
          <div>Queries in session: {userProfile.queryCountInSession}</div>
          <div>Suggestions received: {userProfile.suggestionsReceived}</div>
          <div>Suggestions accepted: {userProfile.suggestionsAccepted}</div>
          {queryAnalysis && (
            <div className="mt-2">
              <div>Analysis scores: {JSON.stringify(queryAnalysis.scores)}</div>
              <div>Dominant dimension: {queryAnalysis.dominantDimension}</div>
              <div>Should suggest: {queryAnalysis.shouldSuggest ? 'Yes' : 'No'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProactiveAgent;