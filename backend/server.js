import express from 'express';
import multer from 'multer';
import cors from 'cors';
import mongoose from 'mongoose';
import { PythonShell } from 'python-shell';
import AdmZip from 'adm-zip';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://finace-tracker:gmritprojects@cluster0.ppnct.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// MongoDB Schema
const conversionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  originalFileName: { type: String, required: true },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
  kmlFileName: String,
  kmlContent: String,
  processedFiles: [String], // Array of processed file names
  individualFiles: [{ // Store individual file contents
    fileName: String,
    content: String
  }],
  error: String,
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

const Conversion = mongoose.model('Conversion', conversionSchema);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    cb(null, `${uniqueId}_${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Routes
app.post('/api/upload', upload.single('shapefile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const conversionId = uuidv4();
    const originalFileName = req.file.originalname;

    // Create conversion record
    const conversion = new Conversion({
      id: conversionId,
      originalFileName: originalFileName,
      status: 'processing'
    });
    await conversion.save();

    // Process the file asynchronously
    processShapefile(req.file.path, conversionId, originalFileName);

    res.json({
      id: conversionId,
      message: 'File uploaded successfully. Processing started.',
      status: 'processing'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/status/:id', async (req, res) => {
  try {
    const conversion = await Conversion.findOne({ id: req.params.id });
    if (!conversion) {
      return res.status(404).json({ error: 'Conversion not found' });
    }

    res.json({
      id: conversion.id,
      status: conversion.status,
      originalFileName: conversion.originalFileName,
      kmlFileName: conversion.kmlFileName,
      processedFiles: conversion.processedFiles || [], // Include processed files info
      individualFiles: conversion.individualFiles || [], // Include individual files info
      error: conversion.error,
      createdAt: conversion.createdAt,
      completedAt: conversion.completedAt
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Status check failed' });
  }
});

app.get('/api/download/:id', async (req, res) => {
  try {
    const conversion = await Conversion.findOne({ id: req.params.id });
    if (!conversion) {
      return res.status(404).json({ error: 'Conversion not found' });
    }

    if (conversion.status !== 'completed') {
      return res.status(400).json({ error: 'Conversion not completed' });
    }

    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${conversion.kmlFileName}"`);
    res.send(conversion.kmlContent);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// New endpoint to download individual KML files
app.get('/api/download/:id/:filename', async (req, res) => {
  try {
    const conversion = await Conversion.findOne({ id: req.params.id });
    if (!conversion) {
      return res.status(404).json({ error: 'Conversion not found' });
    }

    if (conversion.status !== 'completed') {
      return res.status(400).json({ error: 'Conversion not completed' });
    }

    const filename = req.params.filename;
    const individualFile = conversion.individualFiles?.find(file => file.fileName === filename);
    
    if (!individualFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(individualFile.content);

  } catch (error) {
    console.error('Individual download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// New endpoint to download all files as a ZIP
app.get('/api/download-all/:id', async (req, res) => {
  try {
    const conversion = await Conversion.findOne({ id: req.params.id });
    if (!conversion) {
      return res.status(404).json({ error: 'Conversion not found' });
    }

    if (conversion.status !== 'completed') {
      return res.status(400).json({ error: 'Conversion not completed' });
    }

    // Create a new ZIP file
    const zip = new AdmZip();
    
    // Add the combined KML file if it exists
    if (conversion.kmlContent) {
      zip.addFile(conversion.kmlFileName, Buffer.from(conversion.kmlContent, 'utf8'));
    }
    
    // Add individual KML files if they exist
    if (conversion.individualFiles && conversion.individualFiles.length > 0) {
      conversion.individualFiles.forEach(file => {
        zip.addFile(file.fileName, Buffer.from(file.content, 'utf8'));
      });
    }

    // Generate ZIP buffer
    const zipBuffer = zip.toBuffer();
    
    // Set response headers
    const zipFileName = `${conversion.originalFileName.replace('.zip', '')}_all_files.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    
    // Send the ZIP file
    res.send(zipBuffer);

  } catch (error) {
    console.error('Download all files error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Function to combine multiple KML files into one
async function combineKmlFiles(outputDir, kmlFiles) {
  let combinedKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Combined Shapefiles</name>
    <description>Combined KML from multiple shapefiles</description>`;

  for (const kmlFile of kmlFiles) {
    const kmlFilePath = path.join(outputDir, kmlFile);
    const kmlContent = await fs.readFile(kmlFilePath, 'utf8');
    
    console.log(`Processing KML file: ${kmlFile}`);
    
    // Try multiple approaches to extract Placemark elements
    let placemarkElements = [];
    
    // Method 1: Direct Placemark extraction
    const directPlacemarks = kmlContent.match(/<Placemark>[\s\S]*?<\/Placemark>/g);
    if (directPlacemarks) {
      placemarkElements = directPlacemarks;
      console.log(`Found ${directPlacemarks.length} direct Placemark elements in ${kmlFile}`);
    } else {
      // Method 2: Extract from Document
      const documentMatch = kmlContent.match(/<Document>[\s\S]*?<\/Document>/);
      if (documentMatch) {
        const documentContent = documentMatch[0];
        const innerPlacemarks = documentContent.match(/<Placemark>[\s\S]*?<\/Placemark>/g);
        if (innerPlacemarks) {
          placemarkElements = innerPlacemarks;
          console.log(`Found ${innerPlacemarks.length} Placemark elements in Document of ${kmlFile}`);
        }
      }
      
      // Method 3: If still no Placemarks, try to extract the entire content between <kml> tags
      if (placemarkElements.length === 0) {
        const kmlMatch = kmlContent.match(/<kml[^>]*>([\s\S]*?)<\/kml>/);
        if (kmlMatch) {
          const kmlContent = kmlMatch[1];
          const allPlacemarks = kmlContent.match(/<Placemark>[\s\S]*?<\/Placemark>/g);
          if (allPlacemarks) {
            placemarkElements = allPlacemarks;
            console.log(`Found ${allPlacemarks.length} Placemark elements in KML content of ${kmlFile}`);
          }
        }
      }
    }
    
    // Add the Placemark elements to the combined KML
    if (placemarkElements.length > 0) {
      combinedKml += '\n    ' + placemarkElements.join('\n    ');
    } else {
      console.log(`Warning: No Placemark elements found in ${kmlFile}`);
    }
  }

  combinedKml += `
  </Document>
</kml>`;

  console.log('Combined KML structure created');
  return combinedKml;
}

// Function to process shapefile
async function processShapefile(filePath, conversionId, originalFileName) {
  try {
    // Extract ZIP file
    const extractDir = path.join(__dirname, 'temp', conversionId);
    await fs.ensureDir(extractDir);

    const zip = new AdmZip(filePath);
    zip.extractAllTo(extractDir, true);

    // Find shapefile in extracted directory
    const files = await fs.readdir(extractDir);
    const shapefileDir = extractDir;
    
    // Check if there's a subdirectory with shapefiles
    const subdirs = files.filter(file => 
      fs.statSync(path.join(extractDir, file)).isDirectory()
    );
    
    let inputPath = extractDir;
    if (subdirs.length > 0) {
      // Use the first subdirectory that contains .shp files
      for (const subdir of subdirs) {
        const subdirPath = path.join(extractDir, subdir);
        const subdirFiles = await fs.readdir(subdirPath);
        if (subdirFiles.some(file => file.endsWith('.shp'))) {
          inputPath = subdirPath;
          break;
        }
      }
    }

    // Create output directory
    const outputDir = path.join(__dirname, 'output', conversionId);
    await fs.ensureDir(outputDir);

    // Prepare Python script options
    const options = {
      mode: 'text',
      pythonPath: 'python', // or 'python3' depending on your system
      pythonOptions: ['-u'], // unbuffered output
      scriptPath: path.join(__dirname, 'scripts'),
      args: [
        '--input_path', inputPath,
        '--output_path', outputDir,
        '--name_field', 'id',
        '--description_field', 'JOORA'
      ],
      stderrHandler: (err) => {
        console.log('Python stderr:', err);
      }
    };

    // Run Python script with comprehensive error handling
    let results;
    let errorOutput = '';
    
    try {
        const pyshell = new PythonShell('shapefile_to_kml.py', options);
        
        // Collect all output
        const outputLines = [];
        
        pyshell.on('message', function (message) {
            outputLines.push(message);
        });
        
        pyshell.on('stderr', function (stderr) {
            errorOutput += stderr + '\n';
            console.log('Python stderr:', stderr);
        });
        
        pyshell.on('error', function (err) {
            console.error('Python shell error:', err);
            throw new Error('Python script execution failed');
        });
        
        results = await new Promise((resolve, reject) => {
            pyshell.end(function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(outputLines);
                }
            });
        });
        
    } catch (pythonError) {
        console.error('Python script execution error:', pythonError);
        throw new Error('Failed to execute shapefile conversion script');
    }
    
    // Combine stdout and stderr output
    const allOutput = [...results, errorOutput].join('\n');
    console.log('Complete Python script output:', allOutput);
    
    // Check for validation errors in the output
    if (allOutput.includes('Shapefile validation errors:') || allOutput.includes('No valid shapefiles found')) {
        // Extract the specific error messages
        let errorMessage = '';
        
        if (allOutput.includes('Shapefile validation errors:')) {
            // Extract validation errors
            const lines = allOutput.split('\n');
            const errorLines = [];
            let inErrorSection = false;
            
            for (const line of lines) {
                if (line.includes('Shapefile validation errors:')) {
                    inErrorSection = true;
                    continue;
                }
                if (inErrorSection && line.trim().startsWith('- ')) {
                    errorLines.push(line.trim());
                } else if (inErrorSection && line.trim() === '') {
                    break;
                }
            }
            
            if (errorLines.length > 0) {
                errorMessage = 'Shapefile validation failed:\n' + errorLines.join('\n');
            } else {
                errorMessage = allOutput;
            }
        } else if (allOutput.includes('No valid shapefiles found')) {
            // Extract file listing
            const lines = allOutput.split('\n');
            const fileLines = [];
            let inFileSection = false;
            
            for (const line of lines) {
                if (line.includes('Files found in the directory:')) {
                    inFileSection = true;
                    continue;
                }
                if (inFileSection && line.trim().startsWith('- ')) {
                    fileLines.push(line.trim());
                } else if (inFileSection && line.trim() === '') {
                    break;
                }
            }
            
            if (fileLines.length > 0) {
                errorMessage = 'No valid shapefiles found. Files in your ZIP:\n' + fileLines.join('\n') + '\n\nPlease ensure your ZIP contains complete shapefiles with .shp, .shx, and .dbf files.';
            } else {
                errorMessage = allOutput;
            }
        } else {
            errorMessage = allOutput;
        }
        
        throw new Error(errorMessage);
    }
    
    // Check for generated KML files
    const outputFiles = await fs.readdir(outputDir);
    const kmlFiles = outputFiles.filter(file => file.endsWith('.kml'));

    console.log(`Generated ${kmlFiles.length} KML files:`, kmlFiles);

    if (kmlFiles.length === 0) {
      throw new Error('No KML files generated');
    }

    // Handle multiple KML files
    let kmlContent;
    let kmlFileName;
    let individualFiles = [];
    
    if (kmlFiles.length === 1) {
      // Single KML file - read it directly
      const kmlFilePath = path.join(outputDir, kmlFiles[0]);
      kmlContent = await fs.readFile(kmlFilePath, 'utf8');
      kmlFileName = kmlFiles[0];
      individualFiles.push({ fileName: kmlFiles[0], content: kmlContent });
      console.log(`Processing single file: ${kmlFileName}`);
    } else {
      // Multiple KML files - combine them into a single KML
      console.log(`Combining ${kmlFiles.length} KML files into one`);
      
      // Store individual file contents
      for (const kmlFile of kmlFiles) {
        const kmlFilePath = path.join(outputDir, kmlFile);
        const fileContent = await fs.readFile(kmlFilePath, 'utf8');
        individualFiles.push({ fileName: kmlFile, content: fileContent });
      }
      
      const combinedKml = await combineKmlFiles(outputDir, kmlFiles);
      kmlContent = combinedKml;
      kmlFileName = `combined_${originalFileName.replace(/\.zip$/, '.kml')}`;
      console.log(`Combined file created: ${kmlFileName}`);
    }

    // Update conversion record
    await Conversion.findOneAndUpdate(
      { id: conversionId },
      {
        status: 'completed',
        kmlFileName: kmlFileName,
        kmlContent: kmlContent,
        processedFiles: kmlFiles, // Store all processed file names
        individualFiles: individualFiles, // Store individual file contents
        completedAt: new Date()
      }
    );

    // Cleanup temporary files
    await fs.remove(extractDir);
    await fs.remove(outputDir);
    await fs.remove(filePath);

  } catch (error) {
    console.error('Processing error:', error);
    
    // Update conversion record with error
    await Conversion.findOneAndUpdate(
      { id: conversionId },
      {
        status: 'failed',
        error: error.message,
        completedAt: new Date()
      }
    );

    // Cleanup on error
    try {
      const extractDir = path.join(__dirname, 'temp', conversionId);
      const outputDir = path.join(__dirname, 'output', conversionId);
      const filePath = path.join(__dirname, 'uploads', originalFileName);
      
      await fs.remove(extractDir);
      await fs.remove(outputDir);
      await fs.remove(filePath);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
}); 