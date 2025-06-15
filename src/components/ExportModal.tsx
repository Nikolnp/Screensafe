import React, { useState } from 'react';
import { Download, Share2, FileText, Database, Code, Globe, FileImage, X, CheckCircle } from 'lucide-react';
import { exportService, ExportData } from '../lib/export';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExportData;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');

  const exportOptions = [
    {
      id: 'txt',
      name: 'Text File',
      description: 'Simple text format for easy reading',
      icon: FileText,
      color: 'from-gray-500 to-gray-600'
    },
    {
      id: 'csv',
      name: 'CSV Spreadsheet',
      description: 'Import into Excel or Google Sheets',
      icon: Database,
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'json',
      name: 'JSON Data',
      description: 'Structured data for developers',
      icon: Code,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'html',
      name: 'Web Page',
      description: 'Formatted HTML report',
      icon: Globe,
      color: 'from-orange-500 to-orange-600'
    },
    {
      id: 'pdf',
      name: 'PDF Report',
      description: 'Professional document format',
      icon: FileImage,
      color: 'from-red-500 to-red-600'
    }
  ];

  const handleExport = async (format: string) => {
    setIsExporting(true);
    setExportStatus(`Exporting as ${format.toUpperCase()}...`);

    try {
      switch (format) {
        case 'txt':
          await exportService.exportToTXT(data);
          break;
        case 'csv':
          await exportService.exportToCSV(data);
          break;
        case 'json':
          await exportService.exportToJSON(data);
          break;
        case 'html':
          await exportService.exportToHTML(data);
          break;
        case 'pdf':
          await exportService.exportToPDF(data);
          break;
      }
      
      setExportStatus('Export completed successfully!');
      setTimeout(() => {
        setExportStatus('');
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('Export failed. Please try again.');
      setTimeout(() => setExportStatus(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    setIsExporting(true);
    setExportStatus('Preparing to share...');

    try {
      await exportService.shareData(data, 'txt');
      setExportStatus('Shared successfully!');
      setTimeout(() => {
        setExportStatus('');
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Share failed:', error);
      setExportStatus('Share failed. File downloaded instead.');
      setTimeout(() => setExportStatus(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Export Analysis
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {exportStatus && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center space-x-2">
                {exportStatus.includes('successfully') || exportStatus.includes('completed') ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                )}
                <span className="text-blue-800 font-medium">{exportStatus}</span>
              </div>
            </div>
          )}

          {/* Quick Share */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <button
              onClick={handleShare}
              disabled={isExporting}
              className="w-full flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 className="w-5 h-5" />
              <span className="font-medium">Share Analysis</span>
            </button>
          </div>

          {/* Export Options */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Formats</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {exportOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleExport(option.id)}
                  disabled={isExporting}
                  className="group p-4 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/90 hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${option.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <option.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                        {option.name}
                      </h4>
                      <p className="text-sm text-gray-600 group-hover:text-gray-500 transition-colors">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Data Summary */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl">
            <h4 className="font-semibold text-gray-900 mb-2">Export Contents</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Screenshot:</span> {data.screenshot ? 'Included' : 'Not available'}
              </div>
              <div>
                <span className="font-medium">OCR Text:</span> {data.ocrResult ? 'Included' : 'Not available'}
              </div>
              <div>
                <span className="font-medium">AI Analysis:</span> {data.geminiAnalysis ? 'Included' : 'Not available'}
              </div>
              <div>
                <span className="font-medium">Extracted Items:</span> {
                  data.extractedItems ? 
                  `${(data.extractedItems.todos?.length || 0) + (data.extractedItems.events?.length || 0) + (data.extractedItems.reminders?.length || 0)} items` : 
                  'None'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};