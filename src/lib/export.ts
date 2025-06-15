import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ExportData {
  screenshot?: {
    url: string;
    filename: string;
    uploadedAt: string;
  };
  ocrResult?: {
    text: string;
    confidence: number;
    processingTime: number;
  };
  geminiAnalysis?: {
    summary: string;
    keyPoints: string[];
    suggestedActions: string[];
    priority: string;
    category: string;
    confidence: number;
  };
  extractedItems?: {
    todos: any[];
    events: any[];
    reminders: any[];
  };
  metadata: {
    exportedAt: string;
    exportedBy: string;
    version: string;
  };
}

class ExportService {
  async exportToTXT(data: ExportData): Promise<void> {
    const content = this.formatAsText(data);
    this.downloadFile(content, `screenshot-analysis-${Date.now()}.txt`, 'text/plain');
  }

  async exportToCSV(data: ExportData): Promise<void> {
    const content = this.formatAsCSV(data);
    this.downloadFile(content, `screenshot-analysis-${Date.now()}.csv`, 'text/csv');
  }

  async exportToJSON(data: ExportData): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    this.downloadFile(content, `screenshot-analysis-${Date.now()}.json`, 'application/json');
  }

  async exportToHTML(data: ExportData): Promise<void> {
    const content = this.formatAsHTML(data);
    this.downloadFile(content, `screenshot-analysis-${Date.now()}.html`, 'text/html');
  }

  async exportToPDF(data: ExportData): Promise<void> {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      // Title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Screenshot Analysis Report', margin, yPosition);
      yPosition += 15;

      // Metadata
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Exported: ${data.metadata.exportedAt}`, margin, yPosition);
      yPosition += 10;

      // Summary
      if (data.geminiAnalysis?.summary) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Summary', margin, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const summaryLines = pdf.splitTextToSize(data.geminiAnalysis.summary, pageWidth - 2 * margin);
        pdf.text(summaryLines, margin, yPosition);
        yPosition += summaryLines.length * 5 + 10;
      }

      // Key Points
      if (data.geminiAnalysis?.keyPoints?.length) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Key Points', margin, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        data.geminiAnalysis.keyPoints.forEach((point, index) => {
          const pointText = `${index + 1}. ${point}`;
          const pointLines = pdf.splitTextToSize(pointText, pageWidth - 2 * margin);
          pdf.text(pointLines, margin, yPosition);
          yPosition += pointLines.length * 5 + 3;
        });
        yPosition += 10;
      }

      // Extracted Items
      if (data.extractedItems) {
        ['todos', 'events', 'reminders'].forEach(type => {
          const items = data.extractedItems![type as keyof typeof data.extractedItems];
          if (items?.length) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text(type.charAt(0).toUpperCase() + type.slice(1), margin, yPosition);
            yPosition += 10;

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            items.forEach((item: any, index: number) => {
              const itemText = `${index + 1}. ${item.title}${item.description ? ` - ${item.description}` : ''}`;
              const itemLines = pdf.splitTextToSize(itemText, pageWidth - 2 * margin);
              pdf.text(itemLines, margin, yPosition);
              yPosition += itemLines.length * 5 + 3;

              // Check if we need a new page
              if (yPosition > pdf.internal.pageSize.getHeight() - margin) {
                pdf.addPage();
                yPosition = margin;
              }
            });
            yPosition += 10;
          }
        });
      }

      // OCR Text
      if (data.ocrResult?.text) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Extracted Text', margin, yPosition);
        yPosition += 10;

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const textLines = pdf.splitTextToSize(data.ocrResult.text, pageWidth - 2 * margin);
        textLines.forEach((line: string) => {
          if (yPosition > pdf.internal.pageSize.getHeight() - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin, yPosition);
          yPosition += 4;
        });
      }

      pdf.save(`screenshot-analysis-${Date.now()}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      throw new Error('Failed to generate PDF');
    }
  }

  async shareData(data: ExportData, format: 'txt' | 'json' = 'txt'): Promise<void> {
    if (!navigator.share) {
      // Fallback to download
      if (format === 'txt') {
        await this.exportToTXT(data);
      } else {
        await this.exportToJSON(data);
      }
      return;
    }

    try {
      const content = format === 'txt' ? this.formatAsText(data) : JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: format === 'txt' ? 'text/plain' : 'application/json' });
      const file = new File([blob], `screenshot-analysis-${Date.now()}.${format}`, { 
        type: blob.type 
      });

      await navigator.share({
        title: 'Screenshot Analysis',
        text: data.geminiAnalysis?.summary || 'Screenshot analysis results',
        files: [file]
      });
    } catch (error) {
      console.error('Share failed:', error);
      // Fallback to download
      if (format === 'txt') {
        await this.exportToTXT(data);
      } else {
        await this.exportToJSON(data);
      }
    }
  }

  private formatAsText(data: ExportData): string {
    let content = 'SCREENSHOT ANALYSIS REPORT\n';
    content += '=' .repeat(50) + '\n\n';

    // Metadata
    content += `Exported: ${data.metadata.exportedAt}\n`;
    content += `Version: ${data.metadata.version}\n\n`;

    // Screenshot info
    if (data.screenshot) {
      content += 'SCREENSHOT INFORMATION\n';
      content += '-'.repeat(25) + '\n';
      content += `Filename: ${data.screenshot.filename}\n`;
      content += `Uploaded: ${data.screenshot.uploadedAt}\n\n`;
    }

    // OCR Results
    if (data.ocrResult) {
      content += 'OCR RESULTS\n';
      content += '-'.repeat(15) + '\n';
      content += `Confidence: ${data.ocrResult.confidence.toFixed(1)}%\n`;
      content += `Processing Time: ${data.ocrResult.processingTime}ms\n\n`;
      content += 'Extracted Text:\n';
      content += data.ocrResult.text + '\n\n';
    }

    // Gemini Analysis
    if (data.geminiAnalysis) {
      content += 'AI ANALYSIS\n';
      content += '-'.repeat(15) + '\n';
      content += `Summary: ${data.geminiAnalysis.summary}\n\n`;
      content += `Priority: ${data.geminiAnalysis.priority.toUpperCase()}\n`;
      content += `Category: ${data.geminiAnalysis.category}\n`;
      content += `Confidence: ${(data.geminiAnalysis.confidence * 100).toFixed(1)}%\n\n`;

      if (data.geminiAnalysis.keyPoints.length) {
        content += 'Key Points:\n';
        data.geminiAnalysis.keyPoints.forEach((point, index) => {
          content += `${index + 1}. ${point}\n`;
        });
        content += '\n';
      }

      if (data.geminiAnalysis.suggestedActions.length) {
        content += 'Suggested Actions:\n';
        data.geminiAnalysis.suggestedActions.forEach((action, index) => {
          content += `${index + 1}. ${action}\n`;
        });
        content += '\n';
      }
    }

    // Extracted Items
    if (data.extractedItems) {
      ['todos', 'events', 'reminders'].forEach(type => {
        const items = data.extractedItems![type as keyof typeof data.extractedItems];
        if (items?.length) {
          content += `${type.toUpperCase()}\n`;
          content += '-'.repeat(type.length) + '\n';
          items.forEach((item: any, index: number) => {
            content += `${index + 1}. ${item.title}\n`;
            if (item.description) content += `   Description: ${item.description}\n`;
            if (item.priority) content += `   Priority: ${item.priority}\n`;
            if (item.dueDate || item.startTime || item.remindAt) {
              const date = item.dueDate || item.startTime || item.remindAt;
              content += `   Date: ${new Date(date).toLocaleString()}\n`;
            }
            content += '\n';
          });
        }
      });
    }

    return content;
  }

  private formatAsCSV(data: ExportData): string {
    let csv = 'Type,Title,Description,Priority,Date,Category,Confidence\n';

    if (data.extractedItems) {
      ['todos', 'events', 'reminders'].forEach(type => {
        const items = data.extractedItems![type as keyof typeof data.extractedItems];
        items?.forEach((item: any) => {
          const row = [
            type,
            this.escapeCsvValue(item.title || ''),
            this.escapeCsvValue(item.description || ''),
            item.priority || '',
            item.dueDate || item.startTime || item.remindAt || '',
            data.geminiAnalysis?.category || '',
            item.confidence || ''
          ].join(',');
          csv += row + '\n';
        });
      });
    }

    return csv;
  }

  private formatAsHTML(data: ExportData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screenshot Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .item { margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
        .metadata { color: #666; font-size: 0.9em; }
        .priority-high { border-left: 4px solid #e74c3c; }
        .priority-medium { border-left: 4px solid #f39c12; }
        .priority-low { border-left: 4px solid #27ae60; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Screenshot Analysis Report</h1>
        <div class="metadata">
            Exported: ${data.metadata.exportedAt}<br>
            Version: ${data.metadata.version}
        </div>
    </div>

    ${data.geminiAnalysis ? `
    <div class="section">
        <h2>AI Analysis Summary</h2>
        <p><strong>Summary:</strong> ${data.geminiAnalysis.summary}</p>
        <p><strong>Priority:</strong> ${data.geminiAnalysis.priority}</p>
        <p><strong>Category:</strong> ${data.geminiAnalysis.category}</p>
        <p><strong>Confidence:</strong> ${(data.geminiAnalysis.confidence * 100).toFixed(1)}%</p>
        
        ${data.geminiAnalysis.keyPoints.length ? `
        <h3>Key Points</h3>
        <ul>
            ${data.geminiAnalysis.keyPoints.map(point => `<li>${point}</li>`).join('')}
        </ul>
        ` : ''}
        
        ${data.geminiAnalysis.suggestedActions.length ? `
        <h3>Suggested Actions</h3>
        <ul>
            ${data.geminiAnalysis.suggestedActions.map(action => `<li>${action}</li>`).join('')}
        </ul>
        ` : ''}
    </div>
    ` : ''}

    ${data.extractedItems ? ['todos', 'events', 'reminders'].map(type => {
      const items = data.extractedItems![type as keyof typeof data.extractedItems];
      if (!items?.length) return '';
      
      return `
      <div class="section">
          <h2>${type.charAt(0).toUpperCase() + type.slice(1)}</h2>
          ${items.map((item: any) => `
          <div class="item priority-${item.priority || 'medium'}">
              <h3>${item.title}</h3>
              ${item.description ? `<p>${item.description}</p>` : ''}
              <div class="metadata">
                  ${item.priority ? `Priority: ${item.priority} | ` : ''}
                  ${item.dueDate || item.startTime || item.remindAt ? 
                    `Date: ${new Date(item.dueDate || item.startTime || item.remindAt).toLocaleString()} | ` : ''}
                  Confidence: ${((item.confidence || 0) * 100).toFixed(1)}%
              </div>
          </div>
          `).join('')}
      </div>
      `;
    }).join('') : ''}

    ${data.ocrResult ? `
    <div class="section">
        <h2>Extracted Text</h2>
        <div class="metadata">
            Confidence: ${data.ocrResult.confidence.toFixed(1)}% | 
            Processing Time: ${data.ocrResult.processingTime}ms
        </div>
        <pre style="white-space: pre-wrap; background: #f8f8f8; padding: 15px; border-radius: 5px; margin-top: 10px;">${data.ocrResult.text}</pre>
    </div>
    ` : ''}
</body>
</html>
    `;
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();