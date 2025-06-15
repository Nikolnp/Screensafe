import React, { useState, useRef } from 'react';
import { Upload, Camera, X, FileText, Loader2, CheckCircle, AlertCircle, Brain, Download, Sparkles } from 'lucide-react';
import { ocrService, OCRResult } from '../lib/ocr';
import { geminiService, GeminiAnalysis } from '../lib/gemini';
import { exportService, ExportData } from '../lib/export';
import { supabase } from '../lib/supabase';
import { GeminiConfig } from './GeminiConfig';
import { ExportModal } from './ExportModal';

interface OCRUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export const OCRUploader: React.FC<OCRUploaderProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiAnalysis | null>(null);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'processing' | 'results'>('upload');
  const [useMockData, setUseMockData] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [showGeminiConfig, setShowGeminiConfig] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setFile(selectedFile);
    setError('');
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processImage = async () => {
    if (!file && !useMockData) return;

    setIsProcessing(true);
    setStep('processing');
    setError('');
    setProcessingStep('Initializing...');

    try {
      let ocrData: OCRResult;
      let fileUrl = '';
      
      // Step 1: Upload file to Supabase Storage
      if (file && !useMockData) {
        setProcessingStep('Uploading screenshot...');
        fileUrl = await uploadScreenshot(file);
        setUploadedFileUrl(fileUrl);
      }

      // Step 2: OCR Processing
      if (useMockData) {
        setProcessingStep('Using mock data for testing...');
        ocrData = ocrService.getMockOCRResult();
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        setProcessingStep('Extracting text with OCR...');
        ocrData = await ocrService.extractText(file!);
      }

      console.log('OCR completed:', {
        textLength: ocrData.text.length,
        confidence: ocrData.confidence,
        processingTime: ocrData.metadata.processingTime
      });
      setOcrResult(ocrData);

      // Step 3: AI Analysis with Gemini
      let aiAnalysis: GeminiAnalysis | null = null;
      if (geminiService.isConfigured()) {
        setProcessingStep('Analyzing content with AI...');
        try {
          if (useMockData) {
            aiAnalysis = geminiService.getMockAnalysis();
          } else {
            aiAnalysis = await geminiService.analyzeText(ocrData.text);
          }
          console.log('Gemini analysis completed:', {
            summary: aiAnalysis.summary.substring(0, 50) + '...',
            priority: aiAnalysis.priority,
            itemsCount: aiAnalysis.extractedItems.todos.length + aiAnalysis.extractedItems.events.length + aiAnalysis.extractedItems.reminders.length
          });
          setGeminiAnalysis(aiAnalysis);
        } catch (error) {
          console.warn('Gemini analysis failed, continuing without AI insights:', error);
        }
      }

      // Step 4: Store in database
      setProcessingStep('Storing analysis results...');
      await storeAnalysisData(ocrData, aiAnalysis, fileUrl);

      // Step 5: Store extracted items
      if (aiAnalysis) {
        setProcessingStep('Saving extracted items...');
        await storeExtractedItems(aiAnalysis);
      }

      setStep('results');
    } catch (err) {
      console.error('Processing failed:', err);
      setError(`Failed to process image: ${err.message || 'Unknown error'}`);
      setStep('upload');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const uploadScreenshot = async (file: File): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('screenshots')
        .getPublicUrl(fileName);

      // Store media metadata
      await supabase.from('media_storage').insert({
        user_id: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: fileName,
        public_url: publicUrl,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        }
      });

      return publicUrl;
    } catch (error) {
      console.error('Screenshot upload failed:', error);
      throw new Error('Failed to upload screenshot');
    }
  };

  const storeAnalysisData = async (ocrData: OCRResult, aiAnalysis: GeminiAnalysis | null, fileUrl: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('extracted_data').insert({
        user_id: user.id,
        source_file_url: fileUrl,
        extraction_type: 'ocr',
        raw_data: {
          text: ocrData.text,
          blocks: ocrData.blocks,
          metadata: ocrData.metadata
        },
        processed_data: {
          ocrResult: ocrData,
          geminiAnalysis: aiAnalysis
        },
        confidence_score: ocrData.confidence,
        status: 'completed'
      });
    } catch (error) {
      console.error('Failed to store analysis data:', error);
      // Don't throw - this is not critical for the user experience
    }
  };

  const storeExtractedItems = async (analysis: GeminiAnalysis) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Store todos
      if (analysis.extractedItems.todos.length > 0) {
        const todos = analysis.extractedItems.todos.map(todo => ({
          user_id: user.id,
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          status: 'pending' as const,
          due_date: todo.dueDate,
          tags: todo.tags
        }));

        await supabase.from('todos').insert(todos);
      }

      // Store events
      if (analysis.extractedItems.events.length > 0) {
        const events = analysis.extractedItems.events.map(event => ({
          user_id: user.id,
          title: event.title,
          description: event.description,
          start_time: event.startTime || new Date().toISOString(),
          end_time: event.endTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          location: event.location,
          event_type: event.type,
          color: '#6366F1',
          is_all_day: false
        }));

        await supabase.from('events').insert(events);
      }

      // Store reminders
      if (analysis.extractedItems.reminders.length > 0) {
        const reminders = analysis.extractedItems.reminders.map(reminder => ({
          user_id: user.id,
          title: reminder.title,
          message: reminder.description,
          remind_at: reminder.remindAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          is_recurring: reminder.frequency !== 'once',
          recurrence_pattern: reminder.frequency !== 'once' ? reminder.frequency : null,
          priority: reminder.priority
        }));

        await supabase.from('reminders').insert(reminders);
      }
    } catch (error) {
      console.error('Failed to store extracted items:', error);
      // Don't throw - the analysis was successful even if storage failed
    }
  };

  const handleSave = () => {
    if (ocrResult || geminiAnalysis) {
      onSuccess({ ocrResult, geminiAnalysis });
      onClose();
      resetState();
    }
  };

  const handleExport = () => {
    const exportData: ExportData = {
      screenshot: file ? {
        url: uploadedFileUrl,
        filename: file.name,
        uploadedAt: new Date().toISOString()
      } : undefined,
      ocrResult: ocrResult ? {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.metadata.processingTime
      } : undefined,
      geminiAnalysis: geminiAnalysis ? {
        summary: geminiAnalysis.summary,
        keyPoints: geminiAnalysis.keyPoints,
        suggestedActions: geminiAnalysis.suggestedActions,
        priority: geminiAnalysis.priority,
        category: geminiAnalysis.category,
        confidence: geminiAnalysis.confidence
      } : undefined,
      extractedItems: geminiAnalysis ? {
        todos: geminiAnalysis.extractedItems.todos,
        events: geminiAnalysis.extractedItems.events,
        reminders: geminiAnalysis.extractedItems.reminders
      } : undefined,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: 'Screenshot Analysis App',
        version: '1.0.0'
      }
    };

    setShowExportModal(true);
  };

  const resetState = () => {
    setFile(null);
    setPreview('');
    setOcrResult(null);
    setGeminiAnalysis(null);
    setError('');
    setStep('upload');
    setUseMockData(false);
    setProcessingStep('');
    setUploadedFileUrl('');
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-4xl bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center space-x-2">
                <span>AI-Powered Screenshot Analysis</span>
                {geminiService.isConfigured() && <Sparkles className="w-6 h-6 text-purple-500" />}
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {step === 'upload' && (
              <div className="space-y-6">
                {/* AI Configuration Status */}
                <div className={`p-4 rounded-xl border ${
                  geminiService.isConfigured() 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Brain className={`w-5 h-5 ${
                        geminiService.isConfigured() ? 'text-green-600' : 'text-yellow-600'
                      }`} />
                      <div>
                        <h3 className={`font-medium ${
                          geminiService.isConfigured() ? 'text-green-900' : 'text-yellow-900'
                        }`}>
                          {geminiService.isConfigured() ? 'AI Analysis Ready' : 'AI Analysis Available'}
                        </h3>
                        <p className={`text-sm ${
                          geminiService.isConfigured() ? 'text-green-700' : 'text-yellow-700'
                        }`}>
                          {geminiService.isConfigured() 
                            ? 'Your screenshots will be enhanced with intelligent insights'
                            : 'Configure Gemini AI for smart task generation and priority assignment'
                          }
                        </p>
                      </div>
                    </div>
                    {!geminiService.isConfigured() && (
                      <button
                        onClick={() => setShowGeminiConfig(true)}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                      >
                        Configure AI
                      </button>
                    )}
                  </div>
                </div>

                {/* Mock Data Toggle */}
                <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="mockData"
                    checked={useMockData}
                    onChange={(e) => setUseMockData(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="mockData" className="text-sm text-blue-800">
                    Use demo data for testing (skip file upload)
                  </label>
                </div>

                {!useMockData && (
                  <>
                    {/* Upload Area */}
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {preview ? (
                        <div className="space-y-4">
                          <img
                            src={preview}
                            alt="Preview"
                            className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
                          />
                          <p className="text-sm text-gray-600">{file?.name}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <FileText className="w-12 h-12 text-gray-400 mx-auto" />
                          <div>
                            <p className="text-lg font-medium text-gray-900">
                              Drop your screenshot here
                            </p>
                            <p className="text-gray-600">
                              or click to browse files
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center space-x-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <Upload className="w-5 h-5" />
                        <span>Choose File</span>
                      </button>
                      
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center space-x-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <Camera className="w-5 h-5" />
                        <span>Take Photo</span>
                      </button>
                    </div>
                  </>
                )}

                {error && (
                  <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Process Button */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={processImage}
                    disabled={!file && !useMockData}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {geminiService.isConfigured() ? 'Analyze with AI' : 'Extract Text'}
                  </button>
                </div>

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
              </div>
            )}

            {step === 'processing' && (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Processing Screenshot...
                </h3>
                <p className="text-gray-600 mb-2">
                  {processingStep || 'Analyzing your screenshot with AI'}
                </p>
                <div className="text-sm text-gray-500">
                  This may take a few moments
                </div>
              </div>
            )}

            {step === 'results' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Analysis Complete!</span>
                  </div>
                  <button
                    onClick={handleExport}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Results</span>
                  </button>
                </div>

                {/* AI Analysis Results */}
                {geminiAnalysis && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                    <div className="flex items-center space-x-2 mb-4">
                      <Brain className="w-6 h-6 text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-900">AI Analysis</h3>
                      <span className="px-2 py-1 bg-purple-200 text-purple-800 rounded-full text-xs font-medium">
                        {(geminiAnalysis.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-purple-900 mb-2">Summary</h4>
                        <p className="text-purple-800">{geminiAnalysis.summary}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-purple-900 mb-2">Priority & Category</h4>
                          <div className="flex space-x-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              geminiAnalysis.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              geminiAnalysis.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              geminiAnalysis.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {geminiAnalysis.priority.toUpperCase()}
                            </span>
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {geminiAnalysis.category.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-purple-900 mb-2">Items Extracted</h4>
                          <div className="flex space-x-4 text-sm">
                            <span className="text-blue-600">{geminiAnalysis.extractedItems.todos.length} todos</span>
                            <span className="text-green-600">{geminiAnalysis.extractedItems.events.length} events</span>
                            <span className="text-orange-600">{geminiAnalysis.extractedItems.reminders.length} reminders</span>
                          </div>
                        </div>
                      </div>

                      {geminiAnalysis.keyPoints.length > 0 && (
                        <div>
                          <h4 className="font-medium text-purple-900 mb-2">Key Points</h4>
                          <ul className="list-disc list-inside space-y-1 text-purple-800">
                            {geminiAnalysis.keyPoints.map((point, index) => (
                              <li key={index} className="text-sm">{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {geminiAnalysis.suggestedActions.length > 0 && (
                        <div>
                          <h4 className="font-medium text-purple-900 mb-2">Suggested Actions</h4>
                          <ul className="list-disc list-inside space-y-1 text-purple-800">
                            {geminiAnalysis.suggestedActions.map((action, index) => (
                              <li key={index} className="text-sm">{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Extracted Items */}
                {geminiAnalysis && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Todos */}
                    {geminiAnalysis.extractedItems.todos.length > 0 && (
                      <div className="bg-blue-50 rounded-xl p-4">
                        <h4 className="font-semibold text-blue-900 mb-3">
                          Todos ({geminiAnalysis.extractedItems.todos.length})
                        </h4>
                        <div className="space-y-2">
                          {geminiAnalysis.extractedItems.todos.slice(0, 3).map((todo, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-medium text-blue-800">{todo.title}</div>
                              <div className="text-blue-600 text-xs">
                                {todo.priority} priority • {todo.estimatedDuration}
                              </div>
                            </div>
                          ))}
                          {geminiAnalysis.extractedItems.todos.length > 3 && (
                            <div className="text-sm text-blue-600">
                              +{geminiAnalysis.extractedItems.todos.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Events */}
                    {geminiAnalysis.extractedItems.events.length > 0 && (
                      <div className="bg-green-50 rounded-xl p-4">
                        <h4 className="font-semibold text-green-900 mb-3">
                          Events ({geminiAnalysis.extractedItems.events.length})
                        </h4>
                        <div className="space-y-2">
                          {geminiAnalysis.extractedItems.events.slice(0, 3).map((event, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-medium text-green-800">{event.title}</div>
                              <div className="text-green-600 text-xs">
                                {event.type} • {event.startTime ? new Date(event.startTime).toLocaleDateString() : 'No date'}
                              </div>
                            </div>
                          ))}
                          {geminiAnalysis.extractedItems.events.length > 3 && (
                            <div className="text-sm text-green-600">
                              +{geminiAnalysis.extractedItems.events.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Reminders */}
                    {geminiAnalysis.extractedItems.reminders.length > 0 && (
                      <div className="bg-orange-50 rounded-xl p-4">
                        <h4 className="font-semibold text-orange-900 mb-3">
                          Reminders ({geminiAnalysis.extractedItems.reminders.length})
                        </h4>
                        <div className="space-y-2">
                          {geminiAnalysis.extractedItems.reminders.slice(0, 3).map((reminder, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-medium text-orange-800">{reminder.title}</div>
                              <div className="text-orange-600 text-xs">
                                {reminder.priority} priority • {reminder.frequency}
                              </div>
                            </div>
                          ))}
                          {geminiAnalysis.extractedItems.reminders.length > 3 && (
                            <div className="text-sm text-orange-600">
                              +{geminiAnalysis.extractedItems.reminders.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* OCR Results Summary */}
                {ocrResult && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">OCR Extraction Summary</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-600">Confidence:</span>
                        <span className="ml-2 font-medium">{ocrResult.confidence.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Processing Time:</span>
                        <span className="ml-2 font-medium">{ocrResult.metadata.processingTime}ms</span>
                      </div>
                    </div>
                    
                    <details className="cursor-pointer">
                      <summary className="font-medium text-gray-700 hover:text-gray-900">
                        View Extracted Text ({ocrResult.text.length} characters)
                      </summary>
                      <div className="mt-2 p-3 bg-white rounded border text-sm text-gray-700 max-h-32 overflow-y-auto">
                        {ocrResult.text}
                      </div>
                    </details>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => setStep('upload')}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Analyze Another
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105 font-medium"
                  >
                    Save Results
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <GeminiConfig
        isOpen={showGeminiConfig}
        onClose={() => setShowGeminiConfig(false)}
        onConfigured={() => setShowGeminiConfig(false)}
      />

      {showExportModal && ocrResult && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          data={{
            screenshot: file ? {
              url: uploadedFileUrl,
              filename: file.name,
              uploadedAt: new Date().toISOString()
            } : undefined,
            ocrResult: {
              text: ocrResult.text,
              confidence: ocrResult.confidence,
              processingTime: ocrResult.metadata.processingTime
            },
            geminiAnalysis: geminiAnalysis ? {
              summary: geminiAnalysis.summary,
              keyPoints: geminiAnalysis.keyPoints,
              suggestedActions: geminiAnalysis.suggestedActions,
              priority: geminiAnalysis.priority,
              category: geminiAnalysis.category,
              confidence: geminiAnalysis.confidence
            } : undefined,
            extractedItems: geminiAnalysis ? {
              todos: geminiAnalysis.extractedItems.todos,
              events: geminiAnalysis.extractedItems.events,
              reminders: geminiAnalysis.extractedItems.reminders
            } : undefined,
            metadata: {
              exportedAt: new Date().toISOString(),
              exportedBy: 'Screenshot Analysis App',
              version: '1.0.0'
            }
          }}
        />
      )}
    </>
  );
};