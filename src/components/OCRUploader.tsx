import React, { useState, useRef } from 'react';
import { Upload, Camera, X, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ocrService, OCRResult } from '../lib/ocr';
import { contentCategorizer, CategorizedContent } from '../lib/categorizer';
import { supabase } from '../lib/supabase';

interface OCRUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: CategorizedContent) => void;
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
  const [categorizedResult, setCategorizedResult] = useState<CategorizedContent | null>(null);
  const [error, setError] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'processing' | 'results'>('upload');
  const [useMockData, setUseMockData] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  
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
      
      if (useMockData) {
        setProcessingStep('Using mock data...');
        // Use mock data for testing
        ocrData = ocrService.getMockOCRResult();
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        setProcessingStep('Processing image with OCR...');
        // Process actual image
        ocrData = await ocrService.extractText(file!);
      }

      console.log('OCR completed, text extracted:', ocrData.text.substring(0, 100) + '...');
      setOcrResult(ocrData);

      setProcessingStep('Categorizing content...');
      // Categorize the extracted content
      const categorized = contentCategorizer.categorizeContent(ocrData.text, ocrData.confidence);
      console.log('Content categorized:', {
        todos: categorized.todos.length,
        events: categorized.events.length,
        reminders: categorized.reminders.length,
        achievements: categorized.achievements.length
      });
      setCategorizedResult(categorized);

      setProcessingStep('Storing data...');
      // Store in database
      await storeExtractedData(ocrData, categorized);

      setStep('results');
    } catch (err) {
      console.error('OCR processing failed:', err);
      setError(`Failed to process image: ${err.message || 'Unknown error'}`);
      setStep('upload');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const storeExtractedData = async (ocrData: OCRResult, categorized: CategorizedContent) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Store file in Supabase Storage if it's a real file
      let fileUrl = null;
      if (file && !useMockData) {
        const fileName = `${user.id}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('screenshots')
          .upload(fileName, file);

        if (uploadError) {
          console.warn('File upload failed, continuing without file storage:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('screenshots')
            .getPublicUrl(fileName);
          
          fileUrl = publicUrl;

          // Store media metadata
          await supabase.from('media_storage').insert({
            user_id: user.id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: fileName,
            public_url: fileUrl,
            metadata: {
              width: ocrData.metadata.imageSize.width,
              height: ocrData.metadata.imageSize.height,
              processingTime: ocrData.metadata.processingTime
            }
          });
        }
      }

      // Store extracted data
      const { error: extractedError } = await supabase
        .from('extracted_data')
        .insert({
          user_id: user.id,
          source_file_url: fileUrl,
          extraction_type: 'ocr',
          raw_data: {
            text: ocrData.text,
            blocks: ocrData.blocks,
            metadata: ocrData.metadata
          },
          processed_data: categorized,
          confidence_score: ocrData.confidence,
          status: 'completed'
        });

      if (extractedError) throw extractedError;

      // Store categorized items in their respective tables
      await storeCategorizedItems(categorized, user.id);

    } catch (error) {
      console.error('Error storing extracted data:', error);
      // Don't throw error here, as the processing was successful
      console.warn('Data storage failed, but OCR processing completed successfully');
    }
  };

  const storeCategorizedItems = async (categorized: CategorizedContent, userId: string) => {
    try {
      // Store todos
      if (categorized.todos.length > 0) {
        const todos = categorized.todos.map(todo => ({
          user_id: userId,
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          status: todo.status,
          due_date: todo.due_date,
          tags: todo.tags
        }));

        const { error: todosError } = await supabase.from('todos').insert(todos);
        if (todosError) console.error('Error storing todos:', todosError);
      }

      // Store events
      if (categorized.events.length > 0) {
        const events = categorized.events.map(event => ({
          user_id: userId,
          title: event.title,
          description: event.description,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          event_type: event.event_type,
          color: event.color,
          is_all_day: event.is_all_day
        }));

        const { error: eventsError } = await supabase.from('events').insert(events);
        if (eventsError) console.error('Error storing events:', eventsError);
      }

      // Store reminders
      if (categorized.reminders.length > 0) {
        const reminders = categorized.reminders.map(reminder => ({
          user_id: userId,
          title: reminder.title,
          message: reminder.message,
          remind_at: reminder.remind_at,
          is_recurring: reminder.is_recurring,
          recurrence_pattern: reminder.recurrence_pattern,
          priority: reminder.priority
        }));

        const { error: remindersError } = await supabase.from('reminders').insert(reminders);
        if (remindersError) console.error('Error storing reminders:', remindersError);
      }

      // Store achievements
      if (categorized.achievements.length > 0) {
        const achievements = categorized.achievements.map(achievement => ({
          user_id: userId,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          points: achievement.points
        }));

        const { error: achievementsError } = await supabase.from('achievements').insert(achievements);
        if (achievementsError) console.error('Error storing achievements:', achievementsError);
      }
    } catch (error) {
      console.error('Error storing categorized items:', error);
    }
  };

  const handleSave = () => {
    if (categorizedResult) {
      onSuccess(categorizedResult);
      onClose();
      resetState();
    }
  };

  const resetState = () => {
    setFile(null);
    setPreview('');
    setOcrResult(null);
    setCategorizedResult(null);
    setError('');
    setStep('upload');
    setUseMockData(false);
    setProcessingStep('');
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              Extract Content from Screenshot
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
                  Use mock data for testing (skip file upload)
                </label>
              </div>

              {!useMockData && (
                <>
                  {/* Upload Area */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors"
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
                  Process Image
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
                Processing Image...
              </h3>
              <p className="text-gray-600 mb-2">
                {processingStep || 'Extracting text and categorizing content'}
              </p>
              <div className="text-sm text-gray-500">
                This may take a few moments
              </div>
            </div>
          )}

          {step === 'results' && categorizedResult && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Processing Complete!</span>
              </div>

              {/* OCR Results Summary */}
              {ocrResult && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Extraction Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Confidence:</span>
                      <span className="ml-2 font-medium">{ocrResult.confidence.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Processing Time:</span>
                      <span className="ml-2 font-medium">{ocrResult.metadata.processingTime}ms</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Categorized Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Todos */}
                {categorizedResult.todos.length > 0 && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 mb-3">
                      Todos ({categorizedResult.todos.length})
                    </h4>
                    <div className="space-y-2">
                      {categorizedResult.todos.slice(0, 3).map((todo, index) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium text-blue-800">{todo.title}</div>
                          <div className="text-blue-600">
                            Priority: {todo.priority} • Confidence: {todo.confidence.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                      {categorizedResult.todos.length > 3 && (
                        <div className="text-sm text-blue-600">
                          +{categorizedResult.todos.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Events */}
                {categorizedResult.events.length > 0 && (
                  <div className="bg-purple-50 rounded-xl p-4">
                    <h4 className="font-semibold text-purple-900 mb-3">
                      Events ({categorizedResult.events.length})
                    </h4>
                    <div className="space-y-2">
                      {categorizedResult.events.slice(0, 3).map((event, index) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium text-purple-800">{event.title}</div>
                          <div className="text-purple-600">
                            {event.event_type} • Confidence: {event.confidence.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                      {categorizedResult.events.length > 3 && (
                        <div className="text-sm text-purple-600">
                          +{categorizedResult.events.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reminders */}
                {categorizedResult.reminders.length > 0 && (
                  <div className="bg-orange-50 rounded-xl p-4">
                    <h4 className="font-semibold text-orange-900 mb-3">
                      Reminders ({categorizedResult.reminders.length})
                    </h4>
                    <div className="space-y-2">
                      {categorizedResult.reminders.slice(0, 3).map((reminder, index) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium text-orange-800">{reminder.title}</div>
                          <div className="text-orange-600">
                            Priority: {reminder.priority} • Confidence: {reminder.confidence.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                      {categorizedResult.reminders.length > 3 && (
                        <div className="text-sm text-orange-600">
                          +{categorizedResult.reminders.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Achievements */}
                {categorizedResult.achievements.length > 0 && (
                  <div className="bg-green-50 rounded-xl p-4">
                    <h4 className="font-semibold text-green-900 mb-3">
                      Achievements ({categorizedResult.achievements.length})
                    </h4>
                    <div className="space-y-2">
                      {categorizedResult.achievements.slice(0, 3).map((achievement, index) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium text-green-800">{achievement.title}</div>
                          <div className="text-green-600">
                            {achievement.points} points • Confidence: {achievement.confidence.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                      {categorizedResult.achievements.length > 3 && (
                        <div className="text-sm text-green-600">
                          +{categorizedResult.achievements.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Raw Text Preview */}
              {ocrResult && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Extracted Text</h4>
                  <div className="text-sm text-gray-700 max-h-32 overflow-y-auto bg-white p-3 rounded border">
                    {ocrResult.text}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Process Another
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
  );
};