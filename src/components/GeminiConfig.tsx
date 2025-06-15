import React, { useState, useEffect } from 'react';
import { Settings, Key, CheckCircle, AlertCircle, X } from 'lucide-react';
import { geminiService } from '../lib/gemini';

interface GeminiConfigProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured: () => void;
}

export const GeminiConfig: React.FC<GeminiConfigProps> = ({
  isOpen,
  onClose,
  onConfigured
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setIsConfigured(geminiService.isConfigured());
  }, [isOpen]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter a valid API key');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      geminiService.setApiKey(apiKey.trim());
      
      // Test the API key with a simple request
      await geminiService.analyzeText('Test text for API validation');
      
      setIsConfigured(true);
      onConfigured();
      
      // Store in localStorage for persistence
      localStorage.setItem('gemini_api_key', apiKey.trim());
      
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Gemini API key validation failed:', error);
      setError('Invalid API key or service unavailable. Please check your key and try again.');
      geminiService.setApiKey(''); // Clear invalid key
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  // Load saved API key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      geminiService.setApiKey(savedKey);
      setIsConfigured(true);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                AI Configuration
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {isConfigured ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Gemini AI Configured
              </h3>
              <p className="text-gray-600 mb-6">
                Your AI analysis is ready to use. Screenshots will now be enhanced with intelligent insights.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105 font-medium"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Key className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Enable AI-Powered Analysis
                </h3>
                <p className="text-gray-600 text-sm">
                  Add your Gemini API key to unlock intelligent task generation, priority assignment, and smart categorization.
                </p>
              </div>

              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="font-medium text-blue-900 mb-2">How to get your API key:</h4>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Visit <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                  <li>2. Sign in with your Google account</li>
                  <li>3. Click "Create API Key"</li>
                  <li>4. Copy and paste it below</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Enter your Gemini API key..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleSkip}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Skip for Now
                </button>
                <button
                  onClick={handleSave}
                  disabled={isLoading || !apiKey.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isLoading ? 'Validating...' : 'Save & Test'}
                </button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                Your API key is stored locally and never shared with our servers.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};