import { format, parse, isValid, addDays, addWeeks, addMonths } from 'date-fns';

export interface CategorizedContent {
  todos: ExtractedTodo[];
  events: ExtractedEvent[];
  reminders: ExtractedReminder[];
  achievements: ExtractedAchievement[];
  uncategorized: string[];
}

export interface ExtractedTodo {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string;
  tags: string[];
  confidence: number;
  source_text: string;
}

export interface ExtractedEvent {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  event_type: 'meeting' | 'appointment' | 'task' | 'reminder' | 'personal';
  color: string;
  is_all_day: boolean;
  confidence: number;
  source_text: string;
}

export interface ExtractedReminder {
  title: string;
  message?: string;
  remind_at: string;
  is_recurring: boolean;
  recurrence_pattern?: string;
  priority: 'low' | 'medium' | 'high';
  confidence: number;
  source_text: string;
}

export interface ExtractedAchievement {
  title: string;
  description?: string;
  icon: string;
  category: 'productivity' | 'consistency' | 'goals' | 'general';
  points: number;
  confidence: number;
  source_text: string;
}

class ContentCategorizer {
  private todoKeywords = [
    'todo', 'task', 'complete', 'finish', 'do', 'need to', 'must', 'should',
    'deadline', 'due', 'submit', 'deliver', 'work on', 'fix', 'update',
    'buy', 'get', 'pick up', 'call', 'email', 'contact', 'schedule'
  ];

  private eventKeywords = [
    'meeting', 'appointment', 'conference', 'call', 'session', 'interview',
    'lunch', 'dinner', 'party', 'event', 'gathering', 'presentation',
    'workshop', 'training', 'seminar', 'class', 'lesson'
  ];

  private reminderKeywords = [
    'reminder', 'remind', 'don\'t forget', 'remember', 'note', 'alert',
    'notify', 'ping', 'follow up', 'check', 'review'
  ];

  private achievementKeywords = [
    'achievement', 'unlocked', 'completed', 'milestone', 'goal reached',
    'success', 'accomplished', 'finished', 'badge', 'reward', 'level up',
    'streak', 'progress', 'target met'
  ];

  private priorityKeywords = {
    urgent: ['urgent', 'asap', 'immediately', 'critical', 'emergency'],
    high: ['important', 'priority', 'high', 'crucial', 'vital'],
    medium: ['medium', 'normal', 'regular'],
    low: ['low', 'minor', 'optional', 'when possible']
  };

  private timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/gi,
    /(\d{1,2})\s*(am|pm)/gi,
    /(tomorrow|today|tonight)/gi,
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
    /(next week|this week|next month|this month)/gi,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
    /(\d{1,2}-\d{1,2}-\d{2,4})/gi
  ];

  categorizeContent(text: string, confidence: number): CategorizedContent {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const result: CategorizedContent = {
      todos: [],
      events: [],
      reminders: [],
      achievements: [],
      uncategorized: []
    };

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length < 3) continue;

      const category = this.classifyLine(trimmedLine);
      const lineConfidence = this.calculateLineConfidence(trimmedLine, category, confidence);

      switch (category) {
        case 'todo':
          result.todos.push(this.extractTodo(trimmedLine, lineConfidence));
          break;
        case 'event':
          result.events.push(this.extractEvent(trimmedLine, lineConfidence));
          break;
        case 'reminder':
          result.reminders.push(this.extractReminder(trimmedLine, lineConfidence));
          break;
        case 'achievement':
          result.achievements.push(this.extractAchievement(trimmedLine, lineConfidence));
          break;
        default:
          result.uncategorized.push(trimmedLine);
      }
    }

    return result;
  }

  private classifyLine(line: string): string {
    const lowerLine = line.toLowerCase();
    
    // Check for achievements first (most specific)
    if (this.achievementKeywords.some(keyword => lowerLine.includes(keyword))) {
      return 'achievement';
    }

    // Check for reminders
    if (this.reminderKeywords.some(keyword => lowerLine.includes(keyword))) {
      return 'reminder';
    }

    // Check for events (meetings, appointments)
    if (this.eventKeywords.some(keyword => lowerLine.includes(keyword))) {
      return 'event';
    }

    // Check for todos (most general)
    if (this.todoKeywords.some(keyword => lowerLine.includes(keyword))) {
      return 'todo';
    }

    // If it has time patterns, likely an event or reminder
    if (this.timePatterns.some(pattern => pattern.test(line))) {
      return lowerLine.includes('remind') ? 'reminder' : 'event';
    }

    return 'uncategorized';
  }

  private calculateLineConfidence(line: string, category: string, baseConfidence: number): number {
    let confidence = baseConfidence * 0.8; // Start with 80% of OCR confidence

    const lowerLine = line.toLowerCase();
    let keywordMatches = 0;

    // Count keyword matches for the category
    switch (category) {
      case 'todo':
        keywordMatches = this.todoKeywords.filter(keyword => lowerLine.includes(keyword)).length;
        break;
      case 'event':
        keywordMatches = this.eventKeywords.filter(keyword => lowerLine.includes(keyword)).length;
        break;
      case 'reminder':
        keywordMatches = this.reminderKeywords.filter(keyword => lowerLine.includes(keyword)).length;
        break;
      case 'achievement':
        keywordMatches = this.achievementKeywords.filter(keyword => lowerLine.includes(keyword)).length;
        break;
    }

    // Boost confidence based on keyword matches
    confidence += keywordMatches * 5;

    // Boost if it has time/date information
    if (this.timePatterns.some(pattern => pattern.test(line))) {
      confidence += 10;
    }

    return Math.min(confidence, 95); // Cap at 95%
  }

  private extractTodo(line: string, confidence: number): ExtractedTodo {
    const priority = this.extractPriority(line);
    const dueDate = this.extractDate(line);
    const tags = this.extractTags(line);
    
    // Determine status based on keywords
    const lowerLine = line.toLowerCase();
    let status: 'pending' | 'in_progress' | 'completed' = 'pending';
    
    if (lowerLine.includes('completed') || lowerLine.includes('done') || lowerLine.includes('finished')) {
      status = 'completed';
    } else if (lowerLine.includes('working on') || lowerLine.includes('in progress')) {
      status = 'in_progress';
    }

    return {
      title: this.cleanTitle(line),
      description: line.length > 50 ? line : undefined,
      priority,
      status,
      due_date: dueDate,
      tags,
      confidence,
      source_text: line
    };
  }

  private extractEvent(line: string, confidence: number): ExtractedEvent {
    const timeInfo = this.extractTimeInfo(line);
    const location = this.extractLocation(line);
    const eventType = this.determineEventType(line);

    return {
      title: this.cleanTitle(line),
      description: line.length > 50 ? line : undefined,
      start_time: timeInfo.start,
      end_time: timeInfo.end,
      location,
      event_type: eventType,
      color: this.getEventColor(eventType),
      is_all_day: timeInfo.isAllDay,
      confidence,
      source_text: line
    };
  }

  private extractReminder(line: string, confidence: number): ExtractedReminder {
    const remindAt = this.extractDate(line) || this.getDefaultReminderTime();
    const priority = this.extractPriority(line);
    const isRecurring = this.isRecurring(line);

    return {
      title: this.cleanTitle(line),
      message: line,
      remind_at: remindAt,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? this.extractRecurrencePattern(line) : undefined,
      priority,
      confidence,
      source_text: line
    };
  }

  private extractAchievement(line: string, confidence: number): ExtractedAchievement {
    const category = this.determineAchievementCategory(line);
    const points = this.extractPoints(line);

    return {
      title: this.cleanTitle(line),
      description: line,
      icon: this.getAchievementIcon(category),
      category,
      points,
      confidence,
      source_text: line
    };
  }

  private extractPriority(line: string): 'low' | 'medium' | 'high' | 'urgent' {
    const lowerLine = line.toLowerCase();
    
    for (const [priority, keywords] of Object.entries(this.priorityKeywords)) {
      if (keywords.some(keyword => lowerLine.includes(keyword))) {
        return priority as 'low' | 'medium' | 'high' | 'urgent';
      }
    }
    
    return 'medium';
  }

  private extractDate(line: string): string | undefined {
    const now = new Date();
    const lowerLine = line.toLowerCase();

    // Handle relative dates
    if (lowerLine.includes('today')) {
      return now.toISOString();
    }
    if (lowerLine.includes('tomorrow')) {
      return addDays(now, 1).toISOString();
    }
    if (lowerLine.includes('next week')) {
      return addWeeks(now, 1).toISOString();
    }
    if (lowerLine.includes('next month')) {
      return addMonths(now, 1).toISOString();
    }

    // Try to parse specific dates
    for (const pattern of this.timePatterns) {
      const match = pattern.exec(line);
      if (match) {
        try {
          const dateStr = match[0];
          const parsed = parse(dateStr, 'M/d/yyyy', now);
          if (isValid(parsed)) {
            return parsed.toISOString();
          }
        } catch (error) {
          // Continue to next pattern
        }
      }
    }

    return undefined;
  }

  private extractTimeInfo(line: string): { start: string; end: string; isAllDay: boolean } {
    const now = new Date();
    const baseDate = this.extractDate(line) || now.toISOString();
    const baseDateTime = new Date(baseDate);

    // Look for time patterns
    const timeMatch = line.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3].toLowerCase() === 'pm';
      
      const adjustedHour = isPM && hour !== 12 ? hour + 12 : (!isPM && hour === 12 ? 0 : hour);
      
      baseDateTime.setHours(adjustedHour, minute, 0, 0);
      
      const endTime = new Date(baseDateTime);
      endTime.setHours(endTime.getHours() + 1); // Default 1 hour duration

      return {
        start: baseDateTime.toISOString(),
        end: endTime.toISOString(),
        isAllDay: false
      };
    }

    // Default to all-day event
    baseDateTime.setHours(9, 0, 0, 0); // 9 AM start
    const endTime = new Date(baseDateTime);
    endTime.setHours(17, 0, 0, 0); // 5 PM end

    return {
      start: baseDateTime.toISOString(),
      end: endTime.toISOString(),
      isAllDay: true
    };
  }

  private extractLocation(line: string): string | undefined {
    const locationPatterns = [
      /at\s+([^,\n]+)/i,
      /in\s+([^,\n]+)/i,
      /location:\s*([^,\n]+)/i
    ];

    for (const pattern of locationPatterns) {
      const match = pattern.exec(line);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private determineEventType(line: string): 'meeting' | 'appointment' | 'task' | 'reminder' | 'personal' {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('meeting') || lowerLine.includes('conference')) return 'meeting';
    if (lowerLine.includes('appointment') || lowerLine.includes('doctor')) return 'appointment';
    if (lowerLine.includes('personal') || lowerLine.includes('family')) return 'personal';
    if (lowerLine.includes('task') || lowerLine.includes('work')) return 'task';
    
    return 'meeting';
  }

  private getEventColor(eventType: string): string {
    const colors = {
      meeting: '#3B82F6',
      appointment: '#10B981',
      task: '#F59E0B',
      reminder: '#EF4444',
      personal: '#8B5CF6'
    };
    return colors[eventType as keyof typeof colors] || '#6366F1';
  }

  private isRecurring(line: string): boolean {
    const recurringKeywords = ['daily', 'weekly', 'monthly', 'every', 'recurring', 'repeat'];
    const lowerLine = line.toLowerCase();
    return recurringKeywords.some(keyword => lowerLine.includes(keyword));
  }

  private extractRecurrencePattern(line: string): string | undefined {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('daily') || lowerLine.includes('every day')) return 'daily';
    if (lowerLine.includes('weekly') || lowerLine.includes('every week')) return 'weekly';
    if (lowerLine.includes('monthly') || lowerLine.includes('every month')) return 'monthly';
    
    return undefined;
  }

  private determineAchievementCategory(line: string): 'productivity' | 'consistency' | 'goals' | 'general' {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('task') || lowerLine.includes('productive')) return 'productivity';
    if (lowerLine.includes('streak') || lowerLine.includes('consistent')) return 'consistency';
    if (lowerLine.includes('goal') || lowerLine.includes('target')) return 'goals';
    
    return 'general';
  }

  private extractPoints(line: string): number {
    const pointsMatch = line.match(/(\d+)\s*points?/i);
    if (pointsMatch) {
      return parseInt(pointsMatch[1]);
    }
    
    // Default points based on achievement type
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('milestone') || lowerLine.includes('major')) return 100;
    if (lowerLine.includes('streak') || lowerLine.includes('consistent')) return 50;
    
    return 25;
  }

  private getAchievementIcon(category: string): string {
    const icons = {
      productivity: 'zap',
      consistency: 'calendar-check',
      goals: 'target',
      general: 'trophy'
    };
    return icons[category as keyof typeof icons] || 'trophy';
  }

  private extractTags(line: string): string[] {
    const tags: string[] = [];
    const lowerLine = line.toLowerCase();
    
    // Common tag patterns
    if (lowerLine.includes('work') || lowerLine.includes('project')) tags.push('work');
    if (lowerLine.includes('personal') || lowerLine.includes('family')) tags.push('personal');
    if (lowerLine.includes('health') || lowerLine.includes('doctor')) tags.push('health');
    if (lowerLine.includes('shopping') || lowerLine.includes('buy')) tags.push('shopping');
    if (lowerLine.includes('urgent') || lowerLine.includes('asap')) tags.push('urgent');
    
    return tags;
  }

  private cleanTitle(line: string): string {
    // Remove common prefixes and clean up the title
    let title = line
      .replace(/^(todo|task|reminder|achievement|note):\s*/i, '')
      .replace(/^(complete|finish|do|need to)\s+/i, '')
      .trim();
    
    // Capitalize first letter
    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
    
    return title || 'Untitled';
  }

  private getDefaultReminderTime(): string {
    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
    return tomorrow.toISOString();
  }
}

export const contentCategorizer = new ContentCategorizer();