# Shapefile to KML Converter - Standalone Integration

This is a standalone version of the Shapefile to KML converter that can be easily integrated into any website without requiring React or other dependencies.

## Files Included

- `shapetokml.js` - The main JavaScript file containing all functionality
- `shapetokml.css` - All required CSS styles (Tailwind-like utilities)
- `example-integration.html` - Example showing how to integrate
- `INTEGRATION_README.md` - This documentation file

## Quick Integration

### 1. Include the Files

Add these files to your HTML:

```html
<!-- Include the CSS file in your <head> -->
<link rel="stylesheet" href="shapetokml.css">

<!-- Include the JavaScript file before closing </body> -->
<script src="shapetokml.js"></script>
```

### 2. Add a Container

Add a container div where you want the converter to appear:

```html
<div id="shape-to-kml-converter"></div>
```

### 3. Initialize the Converter

Initialize with your custom options:

```javascript
document.addEventListener('DOMContentLoaded', function() {
    const converter = initShapeToKmlConverter('shape-to-kml-converter', {
        apiEndpoint: '/api', // Your backend API endpoint
        companyName: 'Your Company Name',
        companyLogo: 'https://your-website.com/logo.png', // Optional
        companyUrl: 'https://your-website.com' // Optional
    });
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiEndpoint` | string | `/api` | Your backend API endpoint |
| `companyName` | string | `'Your Company'` | Your company name |
| `companyLogo` | string | `''` | URL to your company logo |
| `companyUrl` | string | `'#'` | URL to your company website |

## Auto-Initialization

You can also use data attributes for automatic initialization:

```html
<div id="shape-to-kml-converter" 
     data-shape-to-kml 
     data-company-name="Your Company"
     data-company-logo="https://your-website.com/logo.png"
     data-company-url="https://your-website.com"
     data-api-endpoint="/api">
</div>
```

## Backend API Requirements

Your backend needs to provide these endpoints:

### 1. Upload Endpoint
```
POST /api/upload
Content-Type: multipart/form-data

Form data:
- shapefile: ZIP file containing shapefiles
```

Response:
```json
{
  "id": "conversion-id-123"
}
```

### 2. Status Endpoint
```
GET /api/status/{conversionId}
```

Response:
```json
{
  "status": "completed|processing|failed",
  "kmlFileName": "output.kml",
  "processedFiles": ["file1.shp", "file2.shp"],
  "error": "Error message if failed"
}
```

### 3. Download Endpoint
```
GET /api/download/{conversionId}
```

Response: KML file content

### 4. Download All Endpoint
```
GET /api/download-all/{conversionId}
```

Response: ZIP file containing all converted files

## Features

- ✅ Drag & drop file upload
- ✅ ZIP file validation
- ✅ Shapefile component validation (.shp, .shx, .dbf)
- ✅ Real-time processing status
- ✅ Error handling with detailed messages
- ✅ Responsive design
- ✅ Customizable branding
- ✅ No external dependencies (except JSZip from CDN)
- ✅ Modern UI with animations
- ✅ Mobile-friendly

## Customization

### Styling
The converter uses Tailwind-like CSS classes. You can override styles by adding your own CSS:

```css
/* Custom button colors */
#download-btn {
    background: linear-gradient(to right, #your-color-1, #your-color-2);
}

/* Custom company logo size */
.company-logo {
    width: 60px;
    height: 60px;
}
```

### Text Customization
You can modify the text by editing the JavaScript file or by extending the options:

```javascript
const converter = initShapeToKmlConverter('container', {
    // ... other options
    customTexts: {
        title: 'Custom Title',
        subtitle: 'Custom Subtitle',
        uploadText: 'Custom Upload Text'
    }
});
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Dependencies

- **JSZip**: Loaded from CDN for ZIP file handling
- **No other external dependencies**

## Example Integration

See `example-integration.html` for a complete working example.

## Troubleshooting

### Common Issues

1. **Converter not appearing**: Make sure the container ID matches between HTML and JavaScript
2. **API errors**: Check that your backend endpoints are working and accessible
3. **Styling issues**: Ensure `shapetokml.css` is loaded before your custom styles
4. **File upload not working**: Check browser console for JavaScript errors

### Debug Mode

Add this to enable debug logging:

```javascript
const converter = initShapeToKmlConverter('container', {
    debug: true,
    // ... other options
});
```

## License

This converter is provided as-is for integration into your projects.

## Support

For issues or questions about integration, please check:
1. Browser console for JavaScript errors
2. Network tab for API request/response issues
3. That all files are properly loaded
4. That your backend API endpoints are working correctly
