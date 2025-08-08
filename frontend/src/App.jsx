import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon, FileZipIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon, DownloadIcon, EyeIcon } from './components/Icons';

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
        className={`w-full max-w-2xl p-8 border-2 border-dashed rounded-2xl text-center transition-all duration-300 cursor-pointer ${
        dragActive ? 'border-indigo-400 bg-gray-700/50' : 'border-gray-600 hover:border-indigo-500 hover:bg-gray-800/50'
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
      <div className="flex flex-col items-center justify-center space-y-4 text-gray-400">
        <UploadIcon className="w-16 h-16" />
        <p className="text-xl font-semibold">Drag & Drop your .zip file here</p>
        <p>or</p>
        <button type="button" className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500">
          Browse Files
        </button>
      </div>
    </div>
  );
};

const StatusDisplay = ({ status, fileName, error }) => {
    if (status === 'IDLE') return null;
    
    let icon;
    let message;
    let colorClass;

    switch (status) {
        case 'PROCESSING':
            icon = <SpinnerIcon className="w-12 h-12 text-indigo-400" />;
            message = `Processing ${fileName}...`;
            colorClass = 'text-indigo-300';
            break;
        case 'SUCCESS':
            icon = <CheckCircleIcon className="w-12 h-12 text-green-400" />;
            message = `Successfully converted ${fileName}!`;
            colorClass = 'text-green-300';
            break;
        case 'ERROR':
            icon = <XCircleIcon className="w-12 h-12 text-red-400" />;
            message = error || 'An unknown error occurred.';
            colorClass = 'text-red-300';
            break;
        default:
            return null;
    }

    return (
        <div className={`flex flex-col items-center justify-center space-y-4 p-8 w-full max-w-2xl bg-gray-800 rounded-2xl ${colorClass}`}>
            {icon}
            <p className="text-xl font-medium">{message}</p>
        </div>
    );
};

const ValidationModal = ({ isOpen, message, onClose }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-red-400">Validation Error</h3>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>
                <div className="text-gray-300 whitespace-pre-line mb-6">
                    {message}
                </div>
                <div className="flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

const ResultPanel = ({ result, onReset }) => {
    const [individualPreviews, setIndividualPreviews] = useState({});

    const handleIndividualDownload = (fileName) => {
        // Download individual file
        fetch(`/api/download/${result.conversionId}/${fileName}`)
            .then(response => response.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
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

    const handleIndividualPreview = async (fileName) => {
        try {
            const response = await fetch(`/api/download/${result.conversionId}/${fileName}`);
            if (!response.ok) {
                throw new Error('Preview failed');
            }
            const content = await response.text();
            setIndividualPreviews(prev => ({
                ...prev,
                [fileName]: content
            }));
        } catch (error) {
            console.error('Preview failed:', error);
            alert('Preview failed');
        }
    };

    return (
        <div className="w-full max-w-2xl p-6 bg-gray-800 rounded-2xl flex flex-col space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Conversion Complete</h3>
                <button onClick={onReset} className="text-sm text-gray-400 hover:text-white">&times; Start Over</button>
            </div>
            
            <div className="flex items-center space-x-4 p-4 bg-gray-900/50 rounded-lg">
                <FileZipIcon className="w-10 h-10 text-indigo-400 flex-shrink-0" />
                <div className="flex-grow">
                    <p className="font-mono text-green-400">{result.fileName}</p>
                    <p className="text-xs text-gray-400">
                        {result.processedFiles && result.processedFiles.length > 1 
                            ? `${result.processedFiles.length} shapefiles combined` 
                            : 'KML file ready'}
                    </p>
                    {result.processedFiles && result.processedFiles.length > 1 && (
                        <p className="text-xs text-blue-400 mt-1">
                            Processed: {result.processedFiles.join(', ')}
                        </p>
                    )}
                </div>
                <div className="flex space-x-2">
                    {/* Combined preview button removed */}
                </div>
            </div>

            {/* Individual file downloads */}
            {result.processedFiles && result.processedFiles.length > 1 && (
                <div className="p-4 bg-gray-900/30 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Individual Files:</h4>
                    <div className="flex flex-wrap gap-2">
                        {result.processedFiles.map((fileName, index) => (
                            <div key={index} className="flex items-center space-x-1">
                                <button
                                    onClick={() => handleIndividualDownload(fileName)}
                                    className="flex items-center space-x-2 px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                                >
                                    <DownloadIcon className="w-3 h-3" />
                                    <span>{fileName}</span>
                                </button>
                                                                 <button
                                     onClick={() => {
                                         if (individualPreviews[fileName]) {
                                             // Hide preview
                                             setIndividualPreviews(prev => {
                                                 const newPreviews = { ...prev };
                                                 delete newPreviews[fileName];
                                                 return newPreviews;
                                             });
                                         } else {
                                             // Show preview
                                             handleIndividualPreview(fileName);
                                         }
                                     }}
                                     className={`flex items-center space-x-2 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                                         individualPreviews[fileName] 
                                             ? 'bg-gray-600 hover:bg-gray-500' 
                                             : 'bg-blue-600 hover:bg-blue-700'
                                     }`}
                                 >
                                     <EyeIcon className="w-3 h-3" />
                                     <span>{individualPreviews[fileName] ? 'Hide' : 'Preview'}</span>
                                 </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Combined preview removed */}

            {/* Individual file previews */}
            {Object.entries(individualPreviews).map(([fileName, content]) => (
                <div key={fileName} className="mt-4 p-4 bg-gray-900 rounded-lg max-h-64 overflow-auto">
                    <div className="flex justify-between items-center mb-2">
                        <h5 className="text-sm font-medium text-gray-300">Preview: {fileName}</h5>
                    </div>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap"><code>{content}</code></pre>
                </div>
            ))}
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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative">
        {/* Company Logo and Name - Top Left */}
        <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
            <a 
                href="https://www.jooradrones.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
                title="Visit JOORA DRONES Website"
            >
                <img 
                    src="https://www.jooradrones.com/assets/logo-bec58e99.webp" 
                    alt="JOORA DRONES Logo" 
                    className="w-8 h-8 object-contain"
                />
                <span className="text-white font-semibold text-lg"><b>Joora Drones</b></span>
            </a>
        </div>
        
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center space-y-8">
            <div className="text-center">
                <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                    Shapefile to KML
                </h1>
                <p className="mt-3 text-lg text-gray-400">
                    Upload a <code className="bg-gray-700/50 text-indigo-300 px-1.5 py-0.5 rounded">.zip</code> containing your shapefiles to convert them to KML.
                </p>
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
                <button onClick={handleReset} className="mt-4 px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500">
                    Try Again
                </button>
            )}

            {/* Validation Modal */}
            <ValidationModal 
                isOpen={validationModal.isOpen}
                message={validationModal.message}
                onClose={() => setValidationModal({ isOpen: false, message: '' })}
            />
            
        </div>
    </div>
  );
}
//testing for git push
export default App; 