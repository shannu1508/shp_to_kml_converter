# Shapefile to KML Converter

A full-stack web application for converting shapefiles to KML format. The application consists of a React frontend and a Node.js backend with Python script integration.

## Features

- **Drag & Drop Interface**: Easy file upload with drag and drop support
- **Real-time Processing**: Live status updates during conversion
- **KML Preview**: Preview generated KML files before download
- **MongoDB Integration**: Persistent storage of conversion history
- **Python Script Integration**: Leverages geopandas for accurate shapefile processing
- **Automatic Cleanup**: Temporary files are automatically cleaned up
- **Error Handling**: Comprehensive error handling and user feedback

## Project Structure

```
Dashboard/
├── frontend/                 # React frontend (JavaScript)
│   ├── App.jsx              # Main application component
│   ├── components/
│   │   └── Icons.jsx        # SVG icon components
│   ├── index.jsx            # Application entry point
│   ├── package.json         # Frontend dependencies
│   └── vite.config.js       # Vite configuration
├── backend/                  # Node.js backend
│   ├── server.js            # Express server
│   ├── scripts/
│   │   └── shapefile_to_kml.py  # Python conversion script
│   ├── package.json         # Backend dependencies
│   ├── requirements.txt     # Python dependencies
│   └── README.md           # Backend documentation
└── README.md               # This file
```

## Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.7 or higher)
- **MongoDB** (local or cloud instance)
- **npm** or **yarn**

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Dashboard
```

### 2. Backend Setup

```bash
cd backend

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Set up MongoDB (optional - uses local MongoDB by default)
# Set MONGODB_URI environment variable if using cloud MongoDB
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install
```

## Running the Application

### Development Mode

1. **Start the Backend Server**:
```bash
cd backend
npm run dev
```
The backend will start on `http://localhost:3001`

2. **Start the Frontend Development Server**:
```bash
cd frontend
npm run dev
```
The frontend will start on `http://localhost:3000`

### Production Mode

1. **Build the Frontend**:
```bash
cd frontend
npm run build
```

2. **Start the Backend**:
```bash
cd backend
npm start
```

## Usage

1. **Upload Shapefiles**: Drag and drop a ZIP file containing shapefiles onto the upload area
2. **Monitor Progress**: Watch the real-time status updates during conversion
3. **Preview Results**: View the generated KML content before downloading
4. **Download KML**: Download the converted KML file for use in Google Earth

## API Endpoints

### Backend API

- `POST /api/upload` - Upload shapefile ZIP
- `GET /api/status/:id` - Get conversion status
- `GET /api/download/:id` - Download KML file
- `GET /api/health` - Health check

### Frontend Proxy

The frontend is configured to proxy API requests to the backend automatically.

## Configuration

### Environment Variables

- `PORT` (Backend): Server port (default: 3001)
- `MONGODB_URI` (Backend): MongoDB connection string

### Python Script Parameters

- `--input_path`: Directory containing shapefiles
- `--output_path`: Directory for KML output
- `--name_field`: Field name for feature names (default: 'id')
- `--description_field`: Field name for feature descriptions (default: 'JOORA')

## Supported File Formats

### Input
- ZIP files containing shapefiles (.shp, .dbf, .shx, etc.)
- Polygon and LineString geometries
- Shapefiles with 'id' and 'JOORA' fields (configurable)

### Output
- KML files compatible with Google Earth
- XML format with proper georeferencing

## Error Handling

The application handles various error scenarios:
- Invalid file types
- Missing required fields in shapefiles
- Python script execution errors
- Network connectivity issues
- File system errors

## Security Features

- File size limits (50MB default)
- File type validation
- Input sanitization
- Temporary file cleanup
- CORS configuration

## Troubleshooting

### Common Issues

1. **Python not found**: Ensure Python is installed and accessible
2. **Missing dependencies**: Run `pip install -r requirements.txt` in backend directory
3. **MongoDB connection failed**: Check MongoDB service and connection string
4. **Port conflicts**: Change ports in configuration files
5. **Shapefile conversion errors**: Verify shapefile format and required fields

### Logs

- Backend logs: Check console output in backend directory
- Frontend logs: Check browser developer console
- Python script logs: Check backend console for Python output

## Development

### Adding New Features

1. **Frontend**: Modify components in `frontend/` directory
2. **Backend**: Add routes in `backend/server.js`
3. **Python Script**: Modify `backend/scripts/shapefile_to_kml.py`

### Testing

- Backend: Test API endpoints with tools like Postman
- Frontend: Use browser developer tools for debugging
- Python Script: Test independently with sample shapefiles

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review the backend README for detailed API documentation
- Ensure all prerequisites are properly installed 