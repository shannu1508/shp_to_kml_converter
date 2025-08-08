# Shapefile to KML Backend Server

A Node.js backend server that converts shapefiles to KML format using Python scripts and MongoDB for data persistence.

## Features

- File upload handling with Multer
- ZIP file extraction and processing
- Python script execution for shapefile conversion
- MongoDB integration for conversion tracking
- Real-time status polling
- Automatic cleanup of temporary files
- RESTful API endpoints

## Prerequisites

- Node.js (v16 or higher)
- Python (v3.7 or higher)
- MongoDB (local or cloud instance)
- Python packages: geopandas, simplekml, pandas, shapely, fiona, pyproj

## Installation

1. Install Node.js dependencies:
```bash
npm install
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Set up MongoDB:
   - Install MongoDB locally or use a cloud service like MongoDB Atlas
   - Set the `MONGODB_URI` environment variable or use the default local connection

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3001)
- `MONGODB_URI`: MongoDB connection string (default: mongodb://localhost:27017/shapefile-converter)

### Python Script Configuration

The Python script accepts the following parameters:
- `--input_path`: Directory containing shapefiles
- `--output_path`: Directory for KML output
- `--name_field`: Field name for feature names (default: 'id')
- `--description_field`: Field name for feature descriptions (default: 'JOORA')

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## API Endpoints

### POST /api/upload
Upload a ZIP file containing shapefiles.

**Request:**
- Content-Type: multipart/form-data
- Body: shapefile (ZIP file)

**Response:**
```json
{
  "id": "conversion-id",
  "message": "File uploaded successfully. Processing started.",
  "status": "processing"
}
```

### GET /api/status/:id
Get the status of a conversion.

**Response:**
```json
{
  "id": "conversion-id",
  "status": "processing|completed|failed",
  "originalFileName": "file.zip",
  "kmlFileName": "output.kml",
  "error": "error message (if failed)",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:01:00.000Z"
}
```

### GET /api/download/:id
Download the converted KML file.

**Response:**
- Content-Type: application/vnd.google-earth.kml+xml
- Body: KML file content

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## File Structure

```
backend/
├── server.js              # Main server file
├── package.json           # Node.js dependencies
├── requirements.txt       # Python dependencies
├── scripts/
│   └── shapefile_to_kml.py  # Python conversion script
├── uploads/              # Temporary upload directory
├── temp/                 # Temporary extraction directory
└── output/               # Temporary output directory
```

## Error Handling

The server handles various error scenarios:
- Invalid file types (non-ZIP files)
- Missing required fields in shapefiles
- Python script execution errors
- MongoDB connection issues
- File system errors

## Security Considerations

- File size limits (50MB default)
- File type validation
- Temporary file cleanup
- Input sanitization

## Troubleshooting

### Common Issues

1. **Python not found**: Ensure Python is installed and accessible via `python` or `python3` command
2. **Missing Python packages**: Run `pip install -r requirements.txt`
3. **MongoDB connection failed**: Check MongoDB service and connection string
4. **Shapefile conversion errors**: Verify shapefile format and required fields

### Logs

Check the console output for detailed error messages and processing status.

## License

MIT License 