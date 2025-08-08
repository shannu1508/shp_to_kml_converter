import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon, FileZipIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon, DownloadIcon, EyeIcon, MapIcon } from './components/Icons';

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
          ? 'border-indigo-400 bg-indigo-500/10 shadow-xl shadow-indigo-500/25 scale-105' 
          : 'border-gray-600 hover:border-indigo-500 hover:bg-gray-800/30 hover:shadow-lg hover:shadow-indigo-500/10'
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
      <div className="flex flex-col items-center justify-center space-y-4 text-gray-300">
        <div className={`transition-all duration-300 ${dragActive ? 'scale-110' : ''}`}>
          <UploadIcon className="w-12 h-12 md:w-16 md:h-16 text-indigo-400" />
        </div>
        <div className="space-y-2">
          <p className="text-lg md:text-xl font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Drag & Drop your .zip file here
          </p>
          <p className="text-sm text-gray-400">or</p>
          <button 
            type="button" 
            className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
          >
            Browse Files
          </button>
        </div>
        <div className="mt-4 p-3 bg-gray-800/50 rounded-xl max-w-sm">
          <p className="text-xs text-gray-400">
            <span className="font-medium text-indigo-300">Supported:</span> ZIP files containing ESRI Shapefiles (.shp, .shx, .dbf)
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
            icon = <SpinnerIcon className="w-12 h-12 md:w-16 md:h-16 text-indigo-400 animate-spin" />;
            message = `Processing ${fileName}...`;
            colorClass = 'text-indigo-300';
            bgClass = 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20';
            break;
        case 'SUCCESS':
            icon = <CheckCircleIcon className="w-12 h-12 md:w-16 md:h-16 text-green-400" />;
            message = `Successfully converted ${fileName}!`;
            colorClass = 'text-green-300';
            bgClass = 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20';
            break;
        case 'ERROR':
            icon = <XCircleIcon className="w-12 h-12 md:w-16 md:h-16 text-red-400" />;
            message = error || 'An unknown error occurred.';
            colorClass = 'text-red-300';
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
                <div className="w-48 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse"></div>
                </div>
            )}
        </div>
    );
};

const ValidationModal = ({ isOpen, message, onClose }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800/95 rounded-2xl p-6 max-w-xl w-full max-h-[80vh] overflow-y-auto border border-gray-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                            <XCircleIcon className="w-5 h-5 text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-red-400">Validation Error</h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-2xl font-bold p-1 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        ×
                    </button>
                </div>
                <div className="text-gray-300 whitespace-pre-line mb-6 p-3 bg-gray-900/50 rounded-xl border border-gray-700 text-sm">
                    {message}
                </div>
                <div className="flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 transform hover:scale-105"
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
    const [mapPreview, setMapPreview] = useState({ isOpen: false, content: null, fileName: null });

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

    const handleMapPreview = async (fileName) => {
        try {
            const response = await fetch(`/api/download/${result.conversionId}/${fileName}`);
            if (!response.ok) {
                throw new Error('Map preview failed');
            }
            const content = await response.text();
            setMapPreview({
                isOpen: true,
                content: content,
                fileName: fileName
            });
        } catch (error) {
            console.error('Map preview failed:', error);
            alert('Map preview failed');
        }
    };

    return (
        <div className="w-full max-w-3xl p-6 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 backdrop-blur-sm shadow-xl">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="w-6 h-6 text-green-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Conversion Complete</h3>
                </div>
                <button 
                    onClick={onReset} 
                    className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-all duration-300"
                >
                    Start Over
                </button>
            </div>
            
            <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-900/50 to-gray-800/50 rounded-xl border border-gray-700 mb-6">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileZipIcon className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="flex-grow min-w-0">
                    <p className="font-mono text-sm text-green-400 font-medium truncate">{result.fileName}</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {result.processedFiles && result.processedFiles.length > 1 
                            ? `${result.processedFiles.length} shapefiles combined` 
                            : 'KML file ready for download'}
                    </p>
                    {result.processedFiles && result.processedFiles.length > 1 && (
                        <p className="text-xs text-blue-400 mt-1 font-medium">
                            Processed: {result.processedFiles.join(', ')}
                        </p>
                    )}
                </div>
                
               
            </div>

            {/* Individual file downloads */}
            {result.processedFiles && result.processedFiles.length > 1 && (
                <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-700 mb-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                        Individual Files
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {result.processedFiles.map((fileName, index) => (
                            <div key={index} className="flex flex-col space-y-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                <p className="text-xs font-mono text-gray-300 truncate">{fileName}</p>
                                <div className="flex space-x-1">
                                    <button
                                        onClick={() => handleIndividualDownload(fileName)}
                                        className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                                    >
                                        <DownloadIcon className="w-3 h-3" />
                                        <span>Download</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (individualPreviews[fileName]) {
                                                setIndividualPreviews(prev => {
                                                    const newPreviews = { ...prev };
                                                    delete newPreviews[fileName];
                                                    return newPreviews;
                                                });
                                            } else {
                                                handleIndividualPreview(fileName);
                                            }
                                        }}
                                        className={`flex items-center justify-center px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                            individualPreviews[fileName] 
                                                ? 'bg-gray-600 hover:bg-gray-500' 
                                                : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                    >
                                        <EyeIcon className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleMapPreview(fileName)}
                                        className="flex items-center justify-center px-2 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                                    >
                                        <MapIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Individual file previews */}
            {Object.entries(individualPreviews).map(([fileName, content]) => (
                <div key={fileName} className="mt-4 p-4 bg-gray-900/50 rounded-xl border border-gray-700 max-h-64 overflow-auto">
                    <div className="flex justify-between items-center mb-3">
                        <h5 className="text-sm font-medium text-gray-300">Text Preview: {fileName}</h5>
                    </div>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded-lg border border-gray-700"><code>{content}</code></pre>
                </div>
            ))}

            {/* Map Preview Modal */}
            <MapPreviewModal 
                isOpen={mapPreview.isOpen}
                kmlContent={mapPreview.content}
                fileName={mapPreview.fileName}
                onClose={() => setMapPreview({ isOpen: false, content: null, fileName: null })}
            />
        </div>
    );
}

const MapPreviewModal = ({ isOpen, kmlContent, fileName, onClose }) => {
    const mapRef = useRef(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapInstance, setMapInstance] = useState(null);
    const [selectedProvider, setSelectedProvider] = useState('osm');
    const [tileLayer, setTileLayer] = useState(null);

    // Available free tile providers
    const tileProviders = {
        osm: {
            name: 'OpenStreetMap',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        },
        cartodb: {
            name: 'CartoDB Positron',
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20
        },
        cartodb_dark: {
            name: 'CartoDB Dark',
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20
        },
        esri: {
            name: 'ESRI World Imagery',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: 'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">Esri</a>',
            maxZoom: 19
        },
        stamen: {
            name: 'Stamen Terrain',
            url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png',
            attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> — Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }
    };

    React.useEffect(() => {
        if (!isOpen || !kmlContent) return;

        // Load Leaflet CSS and JS if not already loaded
        if (!window.L) {
            // Load Leaflet CSS
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            document.head.appendChild(link);

            // Load Leaflet JS
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
            script.crossOrigin = '';
            script.onload = () => initializeMap();
            script.onerror = () => {
                console.error('Failed to load Leaflet');
                setMapLoaded(true);
            };
            document.head.appendChild(script);
        } else {
            initializeMap();
        }

        return () => {
            // Cleanup
            if (mapInstance) {
                mapInstance.remove();
                setMapInstance(null);
            }
            if (mapRef.current) {
                mapRef.current.innerHTML = '';
            }
        };
    }, [isOpen, kmlContent]);

    const changeTileProvider = (providerKey) => {
        if (!mapInstance || !tileLayer) return;
        
        const provider = tileProviders[providerKey];
        tileLayer.remove();
        
        const newTileLayer = window.L.tileLayer(provider.url, {
            attribution: provider.attribution,
            maxZoom: provider.maxZoom
        }).addTo(mapInstance);
        
        setTileLayer(newTileLayer);
        setSelectedProvider(providerKey);
    };

    const initializeMap = () => {
        if (!mapRef.current || !kmlContent || !window.L) return;

        try {
            // Create a new map using Leaflet
            const map = window.L.map(mapRef.current, {
                center: [0, 0],
                zoom: 2,
                zoomControl: true,
                attributionControl: true
            });

            // Add initial tile layer (OpenStreetMap)
            const initialProvider = tileProviders[selectedProvider];
            const initialTileLayer = window.L.tileLayer(initialProvider.url, {
                attribution: initialProvider.attribution,
                maxZoom: initialProvider.maxZoom
            }).addTo(map);

            setTileLayer(initialTileLayer);

            // Parse KML content and create markers/polygons
            const parser = new DOMParser();
            const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');
            
            const bounds = window.L.latLngBounds();
            let hasFeatures = false;

            // Parse Placemarks
            const placemarks = kmlDoc.querySelectorAll('Placemark');
            placemarks.forEach(placemark => {
                const name = placemark.querySelector('name')?.textContent || 'Unnamed Feature';
                const description = placemark.querySelector('description')?.textContent || '';
                
                // Parse Point features
                const point = placemark.querySelector('Point coordinates');
                if (point) {
                    const coords = point.textContent.trim().split(',').map(Number);
                    if (coords.length >= 2) {
                        const marker = window.L.marker([coords[1], coords[0]]).addTo(map);
                        marker.bindPopup(`<b>${name}</b><br>${description}`);
                        bounds.extend([coords[1], coords[0]]);
                        hasFeatures = true;
                    }
                }

                // Parse LineString features
                const lineString = placemark.querySelector('LineString coordinates');
                if (lineString) {
                    const coordPairs = lineString.textContent.trim().split(/\s+/);
                    const latlngs = coordPairs.map(pair => {
                        const [lng, lat] = pair.split(',').map(Number);
                        return [lat, lng];
                    }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

                    if (latlngs.length > 0) {
                        const polyline = window.L.polyline(latlngs, { color: 'red', weight: 3 }).addTo(map);
                        polyline.bindPopup(`<b>${name}</b><br>${description}`);
                        bounds.extend(latlngs);
                        hasFeatures = true;
                    }
                }

                // Parse Polygon features
                const polygon = placemark.querySelector('Polygon outerBoundaryIs LinearRing coordinates');
                if (polygon) {
                    const coordPairs = polygon.textContent.trim().split(/\s+/);
                    const latlngs = coordPairs.map(pair => {
                        const [lng, lat] = pair.split(',').map(Number);
                        return [lat, lng];
                    }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

                    if (latlngs.length > 0) {
                        const polygonLayer = window.L.polygon(latlngs, { 
                            color: 'blue', 
                            fillColor: '#3388ff', 
                            fillOpacity: 0.3,
                            weight: 2 
                        }).addTo(map);
                        polygonLayer.bindPopup(`<b>${name}</b><br>${description}`);
                        bounds.extend(latlngs);
                        hasFeatures = true;
                    }
                }

                // Parse MultiGeometry
                const multiGeometry = placemark.querySelector('MultiGeometry');
                if (multiGeometry) {
                    const geometries = multiGeometry.children;
                    for (let geom of geometries) {
                        if (geom.tagName === 'Point') {
                            const coords = geom.querySelector('coordinates')?.textContent.trim().split(',').map(Number);
                            if (coords && coords.length >= 2) {
                                const marker = window.L.marker([coords[1], coords[0]]).addTo(map);
                                marker.bindPopup(`<b>${name}</b><br>${description}`);
                                bounds.extend([coords[1], coords[0]]);
                                hasFeatures = true;
                            }
                        } else if (geom.tagName === 'LineString') {
                            const coordPairs = geom.querySelector('coordinates')?.textContent.trim().split(/\s+/);
                            if (coordPairs) {
                                const latlngs = coordPairs.map(pair => {
                                    const [lng, lat] = pair.split(',').map(Number);
                                    return [lat, lng];
                                }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

                                if (latlngs.length > 0) {
                                    const polyline = window.L.polyline(latlngs, { color: 'red', weight: 3 }).addTo(map);
                                    polyline.bindPopup(`<b>${name}</b><br>${description}`);
                                    bounds.extend(latlngs);
                                    hasFeatures = true;
                                }
                            }
                        } else if (geom.tagName === 'Polygon') {
                            const coordPairs = geom.querySelector('outerBoundaryIs LinearRing coordinates')?.textContent.trim().split(/\s+/);
                            if (coordPairs) {
                                const latlngs = coordPairs.map(pair => {
                                    const [lng, lat] = pair.split(',').map(Number);
                                    return [lat, lng];
                                }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

                                if (latlngs.length > 0) {
                                    const polygonLayer = window.L.polygon(latlngs, { 
                                        color: 'blue', 
                                        fillColor: '#3388ff', 
                                        fillOpacity: 0.3,
                                        weight: 2 
                                    }).addTo(map);
                                    polygonLayer.bindPopup(`<b>${name}</b><br>${description}`);
                                    bounds.extend(latlngs);
                                    hasFeatures = true;
                                }
                            }
                        }
                    }
                }
            });

            // Fit map to bounds if features were found
            if (hasFeatures && !bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: [20, 20] });
            }

            setMapInstance(map);
            setMapLoaded(true);

        } catch (error) {
            console.error('Error initializing map:', error);
            setMapLoaded(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800/95 rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col border border-gray-700 shadow-xl">
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                            <MapIcon className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Map Preview: {fileName}</h3>
                            <p className="text-xs text-gray-400">Interactive KML visualization</p>
                        </div>
                        <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded-full font-medium">Free Maps</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button 
                            onClick={onClose}
                            className="text-gray-400 hover:text-white text-2xl font-bold p-1 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            ×
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 p-4">
                    {/* Map Provider Selector */}

                    <div 
                        ref={mapRef} 
                        className="w-full h-full rounded-xl overflow-hidden bg-gray-900 border border-gray-700"
                        style={{ minHeight: '400px' }}
                    >
                        {!mapLoaded && (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <SpinnerIcon className="w-10 h-10 text-indigo-400 mx-auto mb-3 animate-spin" />
                                    <p className="text-gray-400 text-sm">Loading interactive map...</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="p-4 border-t border-gray-700">
                    <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-400">
                            <p className="font-medium">Viewing KML data on <span className="text-indigo-400">{tileProviders[selectedProvider].name}</span>. You can zoom, pan, and explore the geographic features.</p>
                            <p className="text-xs text-gray-500 mt-1">Powered by Leaflet - Completely free! No API keys required.</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 transform hover:scale-105"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
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
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-all duration-300 hover-lift">
                    <img 
                        src="https://www.jooradrones.com/assets/logo-bec58e99.webp" 
                        alt="JOORA DRONES Logo" 
                        className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                    />
                </div>
                <div className="hidden sm:block">
                    <span className="text-white font-bold text-sm sm:text-base block"><b>Joora Drones</b></span>
      
                </div>
            </a>
        </div>
        
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center space-y-6 relative z-10">
            <div className="text-center space-y-3 animate-fade-in-up">
                <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 leading-tight">
                        Shapefile to KML
                    </h1>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full"></div>
                </div>
                <div className="max-w-xl mx-auto space-y-2">
                    <p className="text-sm md:text-base text-gray-300 font-medium">
                        <span className="text-indigo-400 font-semibold">shapefile conversion</span> with download and preview capabilities
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-400">
                        <div className="flex items-center space-x-1.5 status-indicator status-success">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse-slow"></div>
                            <span>Processing</span>
                        </div>
                        <div className="flex items-center space-x-1.5 status-indicator status-processing">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse-slow"></div>
                            <span>Instant Preview</span>
                        </div>
                    </div>
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
                        className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                        Try Again
                    </button>
                    <p className="text-gray-400 text-center max-w-sm text-sm">
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
                
                <p className="text-xs text-gray-600">
                    © 2025 Joora Drones. Elevated Perspective Endless Possibilities.
                </p>
            </div>
        </div>
    </div>
  );
}

export default App; 