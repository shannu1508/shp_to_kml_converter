// Shapefile to KML Converter - Standalone JavaScript
// Usage: Include this file and shapetokml.css in your HTML, then call initShapeToKmlConverter(containerId)

(function() {
    'use strict';

    // ZIP Validation Function
    const validateZipContents = async (file) => {
        try {
            // Dynamic import of JSZip
            const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')).default;
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

    // Icons (SVG components)
    const Icons = {
        Upload: `<svg class="w-12 h-12 md:w-16 md:h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>`,
        FileZip: `<svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>`,
        Spinner: `<svg class="w-12 h-12 md:w-16 md:h-16 text-gray-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>`,
        CheckCircle: `<svg class="w-12 h-12 md:w-16 md:h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`,
        XCircle: `<svg class="w-12 h-12 md:w-16 md:h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`,
        Download: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>`,
        XCircleSmall: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`
    };

    // Main Converter Class
    class ShapeToKmlConverter {
        constructor(containerId, options = {}) {
            this.containerId = containerId;
            this.options = {
                apiEndpoint: options.apiEndpoint || '/api',
                companyName: options.companyName || 'Your Company',
                companyLogo: options.companyLogo || '',
                companyUrl: options.companyUrl || '#',
                ...options
            };
            
            this.state = {
                status: 'IDLE',
                kmlResult: null,
                error: null,
                selectedFile: null,
                conversionId: null,
                validationModal: { isOpen: false, message: '' }
            };
            
            this.init();
        }

        init() {
            this.render();
            this.attachEventListeners();
        }

        render() {
            const container = document.getElementById(this.containerId);
            if (!container) {
                console.error(`Container with id "${this.containerId}" not found`);
                return;
            }

            container.innerHTML = `
                <div class="shp-converter min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
                    <!-- Background Pattern -->
                    <div class="absolute inset-0 opacity-10">
                        <div class="absolute inset-0" style="background-image: url('data:image/svg+xml,%3Csvg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'none\\' fill-rule=\\'evenodd\\'%3E%3Cg fill=\\'%23000000\\' fill-opacity=\\'0.1\\'%3E%3Ccircle cx=\\'30\\' cy=\\'30\\' r=\\'2\\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"></div>
                    </div>

                    <!-- Company Logo and Name - Top Left -->
                    <div class="absolute top-4 sm:top-6 left-4 sm:left-6 flex items-center space-x-2 sm:space-x-3 z-10">
                        <a href="${this.options.companyUrl}" target="_self" rel="noopener noreferrer" class="flex items-center space-x-2 sm:space-x-3 hover:opacity-80 transition-all duration-300 cursor-pointer group" title="Visit ${this.options.companyName} Website">
                            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-all duration-300 hover:scale-105 shadow-lg border border-white/20">
                                ${this.options.companyLogo ? `<img src="${this.options.companyLogo}" alt="${this.options.companyName} Logo" class="w-5 h-5 sm:w-6 sm:h-6 object-contain" onerror="this.style.display='none'; this.nextSibling.style.display='block';">` : ''}
                                <span class="text-gray-700 font-bold text-lg sm:text-xl ${this.options.companyLogo ? 'hidden' : ''}">${this.options.companyName.charAt(0)}</span>
                            </div>
                            <div class="hidden sm:block">
                                <span class="text-gray-800 font-bold text-xl sm:text-lg block"><b>${this.options.companyName}</b></span>
                            </div>
                        </a>
                    </div>
                    
                    <div class="w-full max-w-3xl mx-auto flex flex-col items-center space-y-6 relative z-10">
                        <div class="text-center space-y-3 animate-fade-in-up">
                            <div class="space-y-2">
                                <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                                    <span class="text-gray-800">shp to kml file convertor for DJ Drones</span>
                                </h1>
                                <div class="w-16 h-0.5 bg-orange-400 mx-auto rounded-full"></div>
                            </div>
                        </div>
                        
                        <div id="converter-content">
                            ${this.renderContent()}
                        </div>
                        
                        <!-- Footer -->
                        <div class="mt-8 text-center space-y-2 animate-fade-in-up">
                            <p class="text-xs text-gray-500">
                                © 2025 ${this.options.companyName}. Elevated Perspective Endless Possibilities.
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }

        renderContent() {
            switch (this.state.status) {
                case 'IDLE':
                    return this.renderFileDropzone();
                case 'PROCESSING':
                    return this.renderStatusDisplay();
                case 'SUCCESS':
                    return this.renderResultPanel();
                case 'ERROR':
                    return this.renderErrorState();
                default:
                    return this.renderFileDropzone();
            }
        }

        renderFileDropzone() {
            return `
                <div id="file-dropzone" class="w-full max-w-3xl p-6 md:p-8 border-2 border-dashed rounded-2xl text-center transition-all duration-300 cursor-pointer backdrop-blur-sm border-gray-400 hover:border-gray-500 hover:bg-gray-100/30 hover:shadow-lg hover:shadow-gray-500/10">
                    <input id="file-input" type="file" class="hidden" accept=".zip,application/zip">
                    <div class="flex flex-col items-center justify-center space-y-4 text-gray-700">
                        <div class="transition-all duration-300">
                            ${Icons.Upload}
                        </div>
                        <div class="space-y-2">
                            <p class="text-lg md:text-xl font-semibold text-gray-700">
                                Drag & Drop your .zip file here
                            </p>
                            <p class="text-sm text-gray-500">or</p>
                            <button type="button" class="px-6 py-3 text-sm font-medium text-white bg-gray-700 rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg">
                                Browse Files
                            </button>
                        </div>
                        <div class="mt-4 p-3 bg-gray-100/50 rounded-xl max-w-sm">
                            <p class="text-xs text-gray-600">
                                <span class="font-medium text-gray-700">Supported:</span> ZIP files should contain ESRI Shapefiles (.shp, .shx, .dbf)
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }

        renderStatusDisplay() {
            let icon, message, colorClass, bgClass;

            switch (this.state.status) {
                case 'PROCESSING':
                    icon = Icons.Spinner;
                    message = `Processing ${this.state.selectedFile?.name || ''}...`;
                    colorClass = 'text-gray-700';
                    bgClass = 'bg-gradient-to-r from-gray-500/10 to-gray-600/10 border-gray-500/20';
                    break;
                case 'SUCCESS':
                    icon = Icons.CheckCircle;
                    message = `Successfully converted ${this.state.selectedFile?.name || ''}!`;
                    colorClass = 'text-green-700';
                    bgClass = 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20';
                    break;
                case 'ERROR':
                    icon = Icons.XCircle;
                    message = this.state.error || 'An unknown error occurred.';
                    colorClass = 'text-red-700';
                    bgClass = 'bg-gradient-to-r from-red-500/10 to-pink-500/10 border-red-500/20';
                    break;
                default:
                    return '';
            }

            return `
                <div class="flex flex-col items-center justify-center space-y-4 p-6 md:p-8 w-full max-w-3xl rounded-2xl border backdrop-blur-sm ${bgClass} ${colorClass}">
                    <div class="animate-pulse">
                        ${icon}
                    </div>
                    <p class="text-lg md:text-xl font-medium text-center">${message}</p>
                    ${this.state.status === 'PROCESSING' ? `
                        <div class="w-48 bg-gray-300 rounded-full h-1.5 overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-gray-500 to-gray-600 rounded-full animate-pulse"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        renderResultPanel() {
            if (!this.state.kmlResult) return '';

            return `
                <div class="w-full max-w-3xl p-6 bg-gradient-to-br from-white/80 to-gray-100/80 rounded-2xl border border-gray-300 backdrop-blur-sm shadow-xl">
                    <div class="flex justify-between items-center mb-6">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                                ${Icons.CheckCircle.replace('w-12 h-12 md:w-16 md:h-16', 'w-6 h-6').replace('text-green-500', 'text-green-600')}
                            </div>
                            <h3 class="text-lg font-bold text-gray-800">Conversion Complete</h3>
                        </div>
                        <button id="start-over-btn" title="Reset and start a new conversion" class="group inline-flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                            ${Icons.XCircleSmall}
                            <span>Start Over</span>
                        </button>
                    </div>
                    
                    <div class="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-100/50 to-white/50 rounded-xl border border-gray-300">
                        <div class="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            ${Icons.FileZip}
                        </div>
                        <div class="flex-grow min-w-0">
                            <p class="font-mono text-sm text-green-600 font-medium truncate">${this.state.kmlResult.fileName}</p>
                            <p class="text-xs text-gray-600 mt-1">
                                ${this.state.kmlResult.processedFiles && this.state.kmlResult.processedFiles.length > 1 
                                    ? `${this.state.kmlResult.processedFiles.length} shapefiles combined` 
                                    : 'KML file ready for download'}
                            </p>
                            ${this.state.kmlResult.processedFiles && this.state.kmlResult.processedFiles.length > 1 ? `
                                <p class="text-xs text-gray-600 mt-1 font-medium">
                                    Processed: ${this.state.kmlResult.processedFiles.join(', ')}
                                </p>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Primary CTA placed at the bottom -->
                    <div class="mt-6">
                        <button id="download-btn" class="w-full flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold text-white rounded-xl bg-gradient-to-r from-gray-700 via-gray-800 to-black hover:from-gray-800 hover:via-gray-900 hover:to-black shadow-lg shadow-gray-600/30 hover:shadow-gray-700/50 ring-1 ring-gray-500/30 hover:ring-gray-400/50 transition-all duration-300">
                            ${Icons.Download}
                            <span>Download</span>
                        </button>
                        <p class="text-xs text-gray-600 mt-2 text-center">Get a single ZIP containing all kml files.</p>
                    </div>
                </div>
            `;
        }

        renderErrorState() {
            return `
                <div class="flex flex-col items-center space-y-4">
                    <button id="try-again-btn" class="px-6 py-3 text-sm font-medium text-white bg-gray-700 rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-all duration-300 transform hover:scale-105 shadow-lg">
                        Try Again
                    </button>
                    <p class="text-gray-600 text-center max-w-sm text-sm">
                        Something went wrong. Please check your file and try again, or contact support if the issue persists.
                    </p>
                </div>
            `;
        }

        renderValidationModal() {
            if (!this.state.validationModal.isOpen) return '';

            return `
                <div id="validation-modal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div class="bg-white/95 rounded-2xl p-6 max-w-xl w-full max-h-[80vh] overflow-y-auto border border-gray-300 shadow-xl">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                                    ${Icons.XCircle.replace('w-12 h-12 md:w-16 md:h-16', 'w-5 h-5').replace('text-red-500', 'text-red-500')}
                                </div>
                                <h3 class="text-lg font-bold text-red-600">Validation Error</h3>
                            </div>
                            <button id="close-modal-btn" class="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1 hover:bg-gray-200 rounded-lg transition-colors">×</button>
                        </div>
                        <div class="text-gray-700 whitespace-pre-line mb-6 p-3 bg-gray-100/50 rounded-xl border border-gray-300 text-sm">
                            ${this.state.validationModal.message}
                        </div>
                        <div class="flex justify-end">
                            <button id="modal-ok-btn" class="px-6 py-2 font-medium text-white bg-gray-700 rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-all duration-300 transform hover:scale-105">OK</button>
                        </div>
                    </div>
                </div>
            `;
        }

        attachEventListeners() {
            // File dropzone events
            const dropzone = document.getElementById('file-dropzone');
            const fileInput = document.getElementById('file-input');

            if (dropzone) {
                dropzone.addEventListener('click', () => fileInput?.click());
                dropzone.addEventListener('dragover', this.handleDragOver.bind(this));
                dropzone.addEventListener('dragleave', this.handleDragLeave.bind(this));
                dropzone.addEventListener('drop', this.handleDrop.bind(this));
            }

            if (fileInput) {
                fileInput.addEventListener('change', this.handleFileSelect.bind(this));
            }

            // Other button events
            document.addEventListener('click', (e) => {
                if (e.target.id === 'start-over-btn' || e.target.id === 'try-again-btn') {
                    this.handleReset();
                }
                if (e.target.id === 'download-btn') {
                    this.handleDownload();
                }
                if (e.target.id === 'close-modal-btn' || e.target.id === 'modal-ok-btn') {
                    this.closeValidationModal();
                }
            });
        }

        handleDragOver(e) {
            e.preventDefault();
            e.stopPropagation();
            const dropzone = document.getElementById('file-dropzone');
            if (dropzone) {
                dropzone.classList.add('border-gray-400', 'bg-gray-500/10', 'shadow-xl', 'shadow-gray-500/25', 'scale-105');
            }
        }

        handleDragLeave(e) {
            e.preventDefault();
            e.stopPropagation();
            const dropzone = document.getElementById('file-dropzone');
            if (dropzone) {
                dropzone.classList.remove('border-gray-400', 'bg-gray-500/10', 'shadow-xl', 'shadow-gray-500/25', 'scale-105');
            }
        }

        handleDrop(e) {
            e.preventDefault();
            e.stopPropagation();
            this.handleDragLeave(e);
            
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const file = e.dataTransfer.files[0];
                if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                    this.handleFileSelect({ target: { files: [file] } });
                } else {
                    alert("Please upload a .zip file.");
                }
            }
        }

        async handleFileSelect(e) {
            const file = e.target.files[0];
            if (!file) return;

            this.state.selectedFile = file;
            
            // Validate ZIP contents before processing
            const validation = await validateZipContents(file);
            
            if (!validation.isValid) {
                this.state.validationModal = {
                    isOpen: true,
                    message: validation.error
                };
                this.render();
                return;
            }
            
            // If validation passes, process the file
            this.processFile(file);
        }

        async processFile(file) {
            this.state.status = 'PROCESSING';
            this.state.error = null;
            this.render();

            try {
                // Upload file to backend
                const formData = new FormData();
                formData.append('shapefile', file);
                
                const response = await fetch(`${this.options.apiEndpoint}/upload`, {
                    method: 'POST',
                    body: formData,
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
                
                const result = await response.json();
                this.state.conversionId = result.id;
                
                // Poll for status
                this.pollStatus(result.id, file);
                
            } catch (err) {
                this.state.error = err.message;
                this.state.status = 'ERROR';
                this.render();
            }
        }

        async pollStatus(id, file) {
            try {
                const statusResponse = await fetch(`${this.options.apiEndpoint}/status/${id}`);
                if (!statusResponse.ok) {
                    throw new Error('Status check failed');
                }
                
                const statusData = await statusResponse.json();
                
                if (statusData.status === 'completed') {
                    // Download the KML file
                    const downloadResponse = await fetch(`${this.options.apiEndpoint}/download/${id}`);
                    if (!downloadResponse.ok) {
                        throw new Error('Download failed');
                    }
                    
                    const kmlContent = await downloadResponse.text();
                    const kmlFileName = statusData.kmlFileName || file.name.replace(/\.zip$/, '.kml');
                    
                    this.state.kmlResult = { 
                        fileName: kmlFileName, 
                        content: kmlContent,
                        processedFiles: statusData.processedFiles || [],
                        conversionId: id
                    };
                    this.state.status = 'SUCCESS';
                    this.render();
                } else if (statusData.status === 'failed') {
                    this.state.error = statusData.error || 'Conversion failed';
                    this.state.status = 'ERROR';
                    this.render();
                } else {
                    // Still processing, poll again in 2 seconds
                    setTimeout(() => this.pollStatus(id, file), 2000);
                }
            } catch (err) {
                this.state.error = err.message;
                this.state.status = 'ERROR';
                this.render();
            }
        }

        handleDownload() {
            if (!this.state.kmlResult) return;

            // Download all files as a ZIP
            fetch(`${this.options.apiEndpoint}/download-all/${this.state.kmlResult.conversionId}`)
                .then(response => response.blob())
                .then(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${this.state.kmlResult.fileName.replace('.kml', '')}_all_files.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                })
                .catch(error => {
                    console.error('Download failed:', error);
                    alert('Download failed');
                });
        }

        handleReset() {
            this.state.status = 'IDLE';
            this.state.kmlResult = null;
            this.state.error = null;
            this.state.selectedFile = null;
            this.state.conversionId = null;
            this.state.validationModal = { isOpen: false, message: '' };
            this.render();
        }

        closeValidationModal() {
            this.state.validationModal = { isOpen: false, message: '' };
            this.render();
        }
    }

    // Global function to initialize the converter
    window.initShapeToKmlConverter = function(containerId, options = {}) {
        return new ShapeToKmlConverter(containerId, options);
    };

    // Auto-initialize if container exists and no manual init
    document.addEventListener('DOMContentLoaded', function() {
        const container = document.querySelector('[data-shape-to-kml]');
        if (container && !window.shapeToKmlInstance) {
            const options = {
                companyName: container.dataset.companyName || 'Your Company',
                companyLogo: container.dataset.companyLogo || '',
                companyUrl: container.dataset.companyUrl || '#',
                apiEndpoint: container.dataset.apiEndpoint || '/api'
            };
            window.shapeToKmlInstance = new ShapeToKmlConverter(container.id, options);
        }
    });

})();
