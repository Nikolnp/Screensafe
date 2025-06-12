import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Calendar, 
  Bell, 
  Trophy, 
  Plus,
  LogOut,
  Wifi,
  WifiOff
} from 'lucide-react';
import { supabase, Todo, Event, Reminder, Achievement } from './lib/supabase';
import { hybridStorage } from './lib/storage';
import { DashboardCard } from './components/DashboardCard';
import { TodoModal } from './components/TodoModal';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { PWAInstaller } from './components/PWAInstaller';

function App() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Data states
  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Loading states
  const [todosLoading, setTodosLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [achievementsLoading, setAchievementsLoading] = useState(false);

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    }

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    if (!user) return;

    // Fetch todos
    setTodosLoading(true);
    try {
      const { data: todosData, error: todosError } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (todosError) throw todosError;
      setTodos(todosData || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
      // Fallback to local storage
      const localTodos = await hybridStorage.retrieve('todos');
      if (localTodos) setTodos(localTodos);
    } finally {
      setTodosLoading(false);
    }

    // Fetch events
    setEventsLoading(true);
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });
      
      if (eventsError) throw eventsError;
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      const localEvents = await hybridStorage.retrieve('events');
      if (localEvents) setEvents(localEvents);
    } finally {
      setEventsLoading(false);
    }

    // Fetch reminders
    setRemindersLoading(true);
    try {
      const { data: remindersData, error: remindersError } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('remind_at', { ascending: true });
      
      if (remindersError) throw remindersError;
      setReminders(remindersData || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
      const localReminders = await hybridStorage.retrieve('reminders');
      if (localReminders) setReminders(localReminders);
    } finally {
      setRemindersLoading(false);
    }

    // Fetch achievements
    setAchievementsLoading(true);
    try {
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_unlocked', true)
        .order('unlocked_at', { ascending: false });
      
      if (achievementsError) throw achievementsError;
      setAchievements(achievementsData || []);
    } catch (error) {
      console.error('Error fetching achievements:', error);
      const localAchievements = await hybridStorage.retrieve('achievements');
      if (localAchievements) setAchievements(localAchievements);
    } finally {
      setAchievementsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleTodoSave = () => {
    fetchAllData(); // Refresh all data after todo save
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Dashboard PWA
          </h1>
          <p className="text-gray-600 mb-8">
            Your beautiful, mobile-optimized productivity dashboard. Manage todos, events, reminders, and track achievements.
          </p>
          
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105 font-medium"
          >
            Get Started
          </button>
        </div>
        
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
        <PWAInstaller />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Header user={user} onMenuClick={() => {}} />
      
      {/* Connection status indicator */}
      <div className="px-4 py-2">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
          isOnline 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <main className="px-4 pb-20">
        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <DashboardCard
            title="To-dos"
            count={todos.filter(todo => todo.status !== 'completed').length}
            icon={CheckSquare}
            color="blue"
            onClick={() => setShowTodoModal(true)}
            subtitle={`${todos.filter(todo => todo.status === 'completed').length} completed`}
            isLoading={todosLoading}
          />
          
          <DashboardCard
            title="Events"
            count={events.length}
            icon={Calendar}
            color="purple"
            onClick={() => {}}
            subtitle="This week"
            isLoading={eventsLoading}
          />
          
          <DashboardCard
            title="Reminders"
            count={reminders.length}
            icon={Bell}
            color="orange"
            onClick={() => {}}
            subtitle="Active"
            isLoading={remindersLoading}
          />
          
          <DashboardCard
            title="Achievements"
            count={achievements.length}
            icon={Trophy}
            color="green"
            onClick={() => {}}
            subtitle="Unlocked"
            isLoading={achievementsLoading}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex space-x-3 overflow-x-auto pb-2">
            <button 
              onClick={() => setShowTodoModal(true)}
              className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm border border-white/20 px-4 py-3 rounded-xl hover:bg-white/90 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Todo</span>
            </button>
            
            <button className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm border border-white/20 px-4 py-3 rounded-xl hover:bg-white/90 transition-all whitespace-nowrap">
              <Calendar className="w-4 h-4" />
              <span>New Event</span>
            </button>
            
            <button className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm border border-white/20 px-4 py-3 rounded-xl hover:bg-white/90 transition-all whitespace-nowrap">
              <Bell className="w-4 h-4" />
              <span>Set Reminder</span>
            </button>
          </div>
        </div>

        {/* Recent Todos */}
        {todos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent To-dos</h2>
            <div className="space-y-3">
              {todos.slice(0, 5).map((todo) => (
                <div key={todo.id} className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className={`font-medium ${
                        todo.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
                      }`}>
                        {todo.title}
                      </h3>
                      {todo.description && (
                        <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          todo.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          todo.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          todo.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {todo.priority}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          todo.status === 'completed' ? 'bg-green-100 text-green-800' :
                          todo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {todo.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sign Out Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </main>

      <TodoModal
        isOpen={showTodoModal}
        onClose={() => setShowTodoModal(false)}
        onSave={handleTodoSave}
      />
      
      <PWAInstaller />
    </div>
  );
}

export default App;