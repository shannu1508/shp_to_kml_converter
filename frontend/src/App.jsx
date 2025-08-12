import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon, FileZipIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon, DownloadIcon } from './components/Icons';

// --- ZIP Validation Function ---
const validateZipContents = async (file) => {
  try {
    // Dynamic import of JSZip
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const files = Object.keys(zip.files).map(f => f.toLowerCase());
    
    // Find all .shp files in the ZIP
    const shpFiles = files.filter(f => f.endsWith('.shp'));
    
    if (shpFiles.length === 0) {
      return {
        isValid: false,
        error: 'No shapefile (.shp) found in the ZIP file. Please ensure your ZIP contains at least one shapefile.'
      };
    }
    
    // Check each .shp file for required components
    const missingComponents = [];
    
    for (const shpFile of shpFiles) {
      const baseName = shpFile.replace('.shp', '');
      const requiredFiles = [
        `${baseName}.shp`,
        `${baseName}.shx`, 
        `${baseName}.dbf`
      ];
      
      const missing = requiredFiles.filter(reqFile => 
        !files.some(f => f === reqFile.toLowerCase())
      );
      
      if (missing.length > 0) {
        missingComponents.push({
          shapefile: baseName + '.shp',
          missing: missing,
          found: requiredFiles.filter(reqFile => 
            files.some(f => f === reqFile.toLowerCase())
          )
        });
      }
    }
    
    if (missingComponents.length > 0) {
      let errorMessage = 'Shapefile validation failed:\n\n';
      missingComponents.forEach(comp => {
        errorMessage += `• ${comp.shapefile} is missing:\n`;
        errorMessage += `  Missing: ${comp.missing.join(', ')}\n`;
        errorMessage += `  Found: ${comp.found.length > 0 ? comp.found.join(', ') : 'None'}\n\n`;
      });
      errorMessage += 'A complete shapefile requires: .shp, .shx, and .dbf files with the same base name.';
      
      return {
        isValid: false,
        error: errorMessage
      };
    }
    
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Error reading ZIP file: ${error.message}. Please ensure the file is a valid ZIP archive.`
    };
  }
};

// --- Helper Components defined outside App to prevent re-creation on re-renders ---

const FileDropzone = ({ onFileSelect, status }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (e.dataTransfer.files[0].type === 'application/zip' || e.dataTransfer.files[0].name.endsWith('.zip')) {
        onFileSelect(e.dataTransfer.files[0]);
      } else {
        alert("Please upload a .zip file.");
      }
    }
  };
  
  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
       onFileSelect(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div 
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`w-full max-w-3xl p-6 md:p-8 border-2 border-dashed rounded-2xl text-center transition-all duration-300 cursor-pointer backdrop-blur-sm ${
        dragActive 
          ? 'border-gray-400 bg-gray-500/10 shadow-xl shadow-gray-500/25 scale-105' 
          : 'border-gray-400 hover:border-gray-500 hover:bg-gray-100/30 hover:shadow-lg hover:shadow-gray-500/10'
        }`}
    >
      <input 
        ref={inputRef}
        type="file" 
        className="hidden" 
        accept=".zip,application/zip"
        onChange={handleChange} 
        disabled={status === 'PROCESSING'}
      />
      <div className="flex flex-col items-center justify-center space-y-4 text-gray-700">
        <div className={`transition-all duration-300 ${dragActive ? 'scale-110' : ''}`}>
          <UploadIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-600" />
        </div>
        <div className="space-y-2">
          <p className="text-lg md:text-xl font-semibold text-gray-700">
            Drag & Drop your .zip file here
          </p>
          <p className="text-sm text-gray-500">or</p>
          <button 
            type="button" 
            className="px-6 py-3 text-sm font-medium text-white bg-gray-700 rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
          >
            Browse Files
          </button>
        </div>
        <div className="mt-4 p-3 bg-gray-100/50 rounded-xl max-w-sm">
          <p className="text-xs text-gray-600">
            <span className="font-medium text-gray-700">Supported:</span> ZIP files should contain ESRI Shapefiles (.shp, .shx, .dbf)
          </p>
        </div>
      </div>
    </div>
  );
};

const StatusDisplay = ({ status, fileName, error }) => {
    if (status === 'IDLE') return null;
    
    let icon;
    let message;
    let colorClass;
    let bgClass;

    switch (status) {
        case 'PROCESSING':
            icon = <SpinnerIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-600 animate-spin" />;
            message = `Processing ${fileName}...`;
            colorClass = 'text-gray-700';
            bgClass = 'bg-gradient-to-r from-gray-500/10 to-gray-600/10 border-gray-500/20';
            break;
        case 'SUCCESS':
            icon = <CheckCircleIcon className="w-12 h-12 md:w-16 md:h-16 text-green-500" />;
            message = `Successfully converted ${fileName}!`;
            colorClass = 'text-green-700';
            bgClass = 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20';
            break;
        case 'ERROR':
            icon = <XCircleIcon className="w-12 h-12 md:w-16 md:h-16 text-red-500" />;
            message = error || 'An unknown error occurred.';
            colorClass = 'text-red-700';
            bgClass = 'bg-gradient-to-r from-red-500/10 to-pink-500/10 border-red-500/20';
            break;
        default:
            return null;
    }

    return (
        <div className={`flex flex-col items-center justify-center space-y-4 p-6 md:p-8 w-full max-w-3xl rounded-2xl border backdrop-blur-sm ${bgClass} ${colorClass}`}>
            <div className="animate-pulse">
                {icon}
            </div>
            <p className="text-lg md:text-xl font-medium text-center">{message}</p>
            {status === 'PROCESSING' && (
                <div className="w-48 bg-gray-300 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gray-500 to-gray-600 rounded-full animate-pulse"></div>
                </div>
            )}
        </div>
    );
};

const ValidationModal = ({ isOpen, message, onClose }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 rounded-2xl p-6 max-w-xl w-full max-h-[80vh] overflow-y-auto border border-gray-300 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                            <XCircleIcon className="w-5 h-5 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-red-600">Validation Error</h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        ×
                    </button>
                </div>
                <div className="text-gray-700 whitespace-pre-line mb-6 p-3 bg-gray-100/50 rounded-xl border border-gray-300 text-sm">
                    {message}
                </div>
                <div className="flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 font-medium text-white bg-gray-700 rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-all duration-300 transform hover:scale-105"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

const ResultPanel = ({ result, onReset }) => {
    const handleCombinedDownload = () => {
        // Download all files as a ZIP
        fetch(`/api/download-all/${result.conversionId}`)
            .then(response => response.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${result.fileName.replace('.kml', '')}_all_files.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            })
            .catch(error => {
                console.error('Download failed:', error);
                alert('Download failed');
            });
    };

    return (
        <div className="w-full max-w-3xl p-6 bg-gradient-to-br from-white/80 to-gray-100/80 rounded-2xl border border-gray-300 backdrop-blur-sm shadow-xl">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Conversion Complete</h3>
                </div>
                <button
                    onClick={onReset}
                    title="Reset and start a new conversion"
                    className="group inline-flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                >
                    
                    <span>Start Over</span>
                </button>
            </div>
            
            <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-100/50 to-white/50 rounded-xl border border-gray-300">
                <div className="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileZipIcon className="w-6 h-6 text-gray-600" />
                </div>
                <div className="flex-grow min-w-0">
                    <p className="font-mono text-sm text-green-600 font-medium truncate">{result.fileName}</p>
                    <p className="text-xs text-gray-600 mt-1">
                        {result.processedFiles && result.processedFiles.length > 1 
                            ? `${result.processedFiles.length} shapefiles combined` 
                            : 'KML file ready for download'}
                    </p>
                    {result.processedFiles && result.processedFiles.length > 1 && (
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                            Processed: {result.processedFiles.join(', ')}
                        </p>
                    )}
                </div>
            </div>

            {/* Primary CTA placed at the bottom */}
            <div className="mt-6">
                <button
                    onClick={handleCombinedDownload}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold text-white rounded-xl bg-gradient-to-r from-gray-700 via-gray-800 to-black hover:from-gray-800 hover:via-gray-900 hover:to-black shadow-lg shadow-gray-600/30 hover:shadow-gray-700/50 ring-1 ring-gray-500/30 hover:ring-gray-400/50 transition-all duration-300"
                >
                    <DownloadIcon className="w-5 h-5" />
                    <span>Download</span>
                </button>
                <p className="text-xs text-gray-600 mt-2 text-center">Get a single ZIP containing all kml files.</p>
            </div>
        </div>
    );
}

// --- Main App Component ---

function App() {
  const [status, setStatus] = useState('IDLE');
  const [kmlResult, setKmlResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [conversionId, setConversionId] = useState(null);
  const [validationModal, setValidationModal] = useState({ isOpen: false, message: '' });
  
  const handleReset = () => {
      setStatus('IDLE');
      setKmlResult(null);
      setError(null);
      setSelectedFile(null);
      setConversionId(null);
      setValidationModal({ isOpen: false, message: '' });
  }

  // Real backend API call
  const processFile = useCallback(async (file) => {
    setStatus('PROCESSING');
    setError(null);

    try {
      // Upload file to backend
      const formData = new FormData();
      formData.append('shapefile', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      const result = await response.json();
      setConversionId(result.id);
      
      // Poll for status
      const pollStatus = async () => {
        try {
          const statusResponse = await fetch(`/api/status/${result.id}`);
          if (!statusResponse.ok) {
            throw new Error('Status check failed');
          }
          
          const statusData = await statusResponse.json();
          
          if (statusData.status === 'completed') {
            // Download the KML file
            const downloadResponse = await fetch(`/api/download/${result.id}`);
            if (!downloadResponse.ok) {
              throw new Error('Download failed');
            }
            
            const kmlContent = await downloadResponse.text();
            const kmlFileName = statusData.kmlFileName || file.name.replace(/\.zip$/, '.kml');
            
            setKmlResult({ 
                fileName: kmlFileName, 
                content: kmlContent,
                processedFiles: statusData.processedFiles || [],
                conversionId: result.id
            });
            setStatus('SUCCESS');
          } else if (statusData.status === 'failed') {
            setError(statusData.error || 'Conversion failed');
            setStatus('ERROR');
          } else {
            // Still processing, poll again in 2 seconds
            setTimeout(pollStatus, 2000);
          }
        } catch (err) {
          setError(err.message);
          setStatus('ERROR');
        }
      };
      
      // Start polling
      setTimeout(pollStatus, 1000);
      
    } catch (err) {
      setError(err.message);
      setStatus('ERROR');
    }
  }, []);

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    
    // Validate ZIP contents before processing
    const validation = await validateZipContents(file);
    
    if (!validation.isValid) {
      setValidationModal({
        isOpen: true,
        message: validation.error
      });
      return;
    }
    
    // If validation passes, process the file
    processFile(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}></div>
        </div>

        {/* Company Logo and Name - Top Left */}
        <div className="absolute top-4 sm:top-6 left-4 sm:left-6 flex items-center space-x-2 sm:space-x-3 z-10">
            <a 
                href="https://www.jooradrones.com/" 
                target="_self" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 sm:space-x-3 hover:opacity-80 transition-all duration-300 cursor-pointer group"
                title="Visit JOORA DRONES Website"
            >
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-all duration-300 hover:scale-105 shadow-lg border border-white/20">
                    <img 
                        src="https://www.jooradrones.com/assets/logo-bec58e99.webp" 
                        alt="JOORA DRONES Logo" 
                        className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                        onError={(e) => {
                            // Fallback to "J" if image fails to load
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                        }}
                    />
                    <span className="text-gray-700 font-bold text-lg sm:text-xl hidden">J</span>
                </div>
                <div className="hidden sm:block">
                    <span className="text-gray-800 font-bold text-xl sm:text-lg block"><b>Joora Drones</b></span>
                </div>
            </a>
        </div>
        
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center space-y-6 relative z-10">
            <div className="text-center space-y-3 animate-fade-in-up">
                <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                        <span className="text-gray-800">shp to kml file converter for DJI Drones </span>
            
                    </h1>
                    <div className="w-16 h-0.5 bg-orange-400 mx-auto rounded-full"></div>
                </div>
                
            </div>
            
            {status === 'IDLE' && (
                <FileDropzone onFileSelect={handleFileSelect} status={status} />
            )}

            {status !== 'IDLE' && status !== 'SUCCESS' && (
                <StatusDisplay status={status} fileName={selectedFile?.name || ''} error={error}/>
            )}

            {status === 'SUCCESS' && kmlResult && (
                <ResultPanel result={kmlResult} onReset={handleReset} />
            )}
            
            {(status === 'ERROR') && (
                <div className="flex flex-col items-center space-y-4">
                    <button 
                        onClick={handleReset} 
                        className="px-6 py-3 text-sm font-medium text-white bg-gray-700 rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                        Try Again
                    </button>
                    <p className="text-gray-600 text-center max-w-sm text-sm">
                        Something went wrong. Please check your file and try again, or contact support if the issue persists.
                    </p>
                </div>
            )}

            {/* Validation Modal */}
            <ValidationModal 
                isOpen={validationModal.isOpen}
                message={validationModal.message}
                onClose={() => setValidationModal({ isOpen: false, message: '' })}
            />
            
            {/* Footer */}
            <div className="mt-8 text-center space-y-2 animate-fade-in-up">
                <p className="text-xs text-gray-500">
                    © 2025 Joora Drones. Elevated Perspective Endless Possibilities.
                </p>
            </div>
        </div>
    </div>
  );
}

export default App; 