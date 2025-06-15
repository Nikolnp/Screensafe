export interface GeminiAnalysis {
  summary: string;
  keyPoints: string[];
  suggestedActions: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'work' | 'personal' | 'health' | 'finance' | 'education' | 'other';
  confidence: number;
  extractedItems: {
    todos: GeminiTodo[];
    events: GeminiEvent[];
    reminders: GeminiReminder[];
  };
}

export interface GeminiTodo {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration: string;
  tags: string[];
  dueDate?: string;
  confidence: number;
}

export interface GeminiEvent {
  title: string;
  description: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  attendees?: string[];
  type: 'meeting' | 'appointment' | 'deadline' | 'personal';
  confidence: number;
}

export interface GeminiReminder {
  title: string;
  description: string;
  remindAt?: string;
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  priority: 'low' | 'medium' | 'high';
  confidence: number;
}

class GeminiService {
  private apiKey: string | null = null;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

  constructor() {
    // API key should be set via environment variable or user input
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || null;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async analyzeText(extractedText: string, imageContext?: string): Promise<GeminiAnalysis> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = this.buildAnalysisPrompt(extractedText, imageContext);

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error('No response from Gemini API');
      }

      return this.parseGeminiResponse(generatedText);
    } catch (error) {
      console.error('Gemini analysis failed:', error);
      // Fallback to basic analysis
      return this.createFallbackAnalysis(extractedText);
    }
  }

  private buildAnalysisPrompt(text: string, imageContext?: string): string {
    return `
Analyze the following extracted text from a screenshot and provide a comprehensive analysis in JSON format.

${imageContext ? `Image Context: ${imageContext}` : ''}

Extracted Text:
"""
${text}
"""

Please provide a JSON response with the following structure:
{
  "summary": "Brief summary of the content (2-3 sentences)",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "suggestedActions": ["Action 1", "Action 2", "Action 3"],
  "priority": "low|medium|high|urgent",
  "category": "work|personal|health|finance|education|other",
  "confidence": 0.85,
  "extractedItems": {
    "todos": [
      {
        "title": "Task title",
        "description": "Detailed description",
        "priority": "medium",
        "estimatedDuration": "30 minutes",
        "tags": ["tag1", "tag2"],
        "dueDate": "2024-01-15T10:00:00Z",
        "confidence": 0.9
      }
    ],
    "events": [
      {
        "title": "Event title",
        "description": "Event description",
        "startTime": "2024-01-15T14:00:00Z",
        "endTime": "2024-01-15T15:00:00Z",
        "location": "Location if mentioned",
        "attendees": ["person1", "person2"],
        "type": "meeting",
        "confidence": 0.8
      }
    ],
    "reminders": [
      {
        "title": "Reminder title",
        "description": "What to remember",
        "remindAt": "2024-01-15T09:00:00Z",
        "frequency": "once",
        "priority": "medium",
        "confidence": 0.7
      }
    ]
  }
}

Focus on:
1. Extracting actionable items (todos, events, reminders)
2. Identifying dates, times, and deadlines
3. Determining priority based on urgency indicators
4. Categorizing content appropriately
5. Providing practical suggested actions
6. Assigning realistic confidence scores

Return only valid JSON without any markdown formatting or additional text.
`;
  }

  private parseGeminiResponse(response: string): GeminiAnalysis {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize the response
      return {
        summary: parsed.summary || 'No summary available',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
        priority: this.validatePriority(parsed.priority),
        category: this.validateCategory(parsed.category),
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        extractedItems: {
          todos: Array.isArray(parsed.extractedItems?.todos) ? parsed.extractedItems.todos : [],
          events: Array.isArray(parsed.extractedItems?.events) ? parsed.extractedItems.events : [],
          reminders: Array.isArray(parsed.extractedItems?.reminders) ? parsed.extractedItems.reminders : []
        }
      };
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      throw new Error('Invalid response format from Gemini');
    }
  }

  private validatePriority(priority: string): 'low' | 'medium' | 'high' | 'urgent' {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    return validPriorities.includes(priority) ? priority as any : 'medium';
  }

  private validateCategory(category: string): 'work' | 'personal' | 'health' | 'finance' | 'education' | 'other' {
    const validCategories = ['work', 'personal', 'health', 'finance', 'education', 'other'];
    return validCategories.includes(category) ? category as any : 'other';
  }

  private createFallbackAnalysis(text: string): GeminiAnalysis {
    // Basic fallback analysis when Gemini is not available
    const words = text.toLowerCase().split(/\s+/);
    const hasUrgentWords = words.some(word => ['urgent', 'asap', 'immediately', 'deadline'].includes(word));
    const hasWorkWords = words.some(word => ['meeting', 'project', 'work', 'office', 'client'].includes(word));
    
    return {
      summary: `Extracted text contains ${words.length} words. ${hasUrgentWords ? 'Contains urgent indicators.' : ''} ${hasWorkWords ? 'Appears to be work-related.' : ''}`,
      keyPoints: text.split('\n').filter(line => line.trim().length > 10).slice(0, 3),
      suggestedActions: ['Review extracted content', 'Categorize items manually', 'Set appropriate reminders'],
      priority: hasUrgentWords ? 'high' : 'medium',
      category: hasWorkWords ? 'work' : 'other',
      confidence: 0.6,
      extractedItems: {
        todos: [],
        events: [],
        reminders: []
      }
    };
  }

  // Mock analysis for testing
  getMockAnalysis(): GeminiAnalysis {
    return {
      summary: "The screenshot contains a mix of work tasks and personal reminders with several time-sensitive items requiring immediate attention.",
      keyPoints: [
        "Multiple deadlines identified for this week",
        "Important meeting scheduled for tomorrow",
        "Personal health appointment needs scheduling"
      ],
      suggestedActions: [
        "Schedule the team meeting for tomorrow at 2 PM",
        "Set reminder for project deadline on Friday",
        "Book doctor appointment for next week",
        "Add grocery shopping to weekend tasks"
      ],
      priority: "high",
      category: "work",
      confidence: 0.92,
      extractedItems: {
        todos: [
          {
            title: "Complete project proposal",
            description: "Finalize the Q1 project proposal with budget estimates and timeline",
            priority: "high",
            estimatedDuration: "2 hours",
            tags: ["work", "project", "deadline"],
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            confidence: 0.95
          },
          {
            title: "Buy groceries",
            description: "Weekly grocery shopping - milk, bread, eggs, vegetables",
            priority: "medium",
            estimatedDuration: "1 hour",
            tags: ["personal", "shopping"],
            confidence: 0.88
          }
        ],
        events: [
          {
            title: "Team meeting",
            description: "Weekly team sync to discuss project progress and blockers",
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
            location: "Conference Room A",
            attendees: ["John", "Sarah", "Mike"],
            type: "meeting",
            confidence: 0.93
          }
        ],
        reminders: [
          {
            title: "Doctor appointment",
            description: "Schedule annual health checkup",
            remindAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            frequency: "once",
            priority: "medium",
            confidence: 0.85
          }
        ]
      }
    };
  }
}

export const geminiService = new GeminiService();