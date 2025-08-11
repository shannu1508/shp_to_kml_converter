# -*- coding: utf-8 -*-
"""
Shapefile to KML Converter
Modified version of the original script to work with command line arguments
"""

import os
import sys
import argparse
import geopandas as gpd
import simplekml
import glob

def create_directory(path):
    """Create a directory. Will pass if directory has been added by another thread."""
    if os.path.isdir(path):
        pass
    else:
        try:
            os.makedirs(path)
        except Exception as err:
            pass
            return err

def validate_shapefile_components(shp_file):
    """
    Validate that all required shapefile components exist
    
    Parameters
    ----------
    shp_file : str
        Path to the .shp file
    
    Returns
    -------
    tuple
        (is_valid, missing_files, found_files)
    """
    base_path = os.path.splitext(shp_file)[0]
    required_extensions = ['.shp', '.shx', '.dbf']
    missing_files = []
    found_files = []
    
    for ext in required_extensions:
        required_file = base_path + ext
        if os.path.exists(required_file):
            found_files.append(os.path.basename(required_file))
        else:
            missing_files.append(os.path.basename(required_file))
    
    return len(missing_files) == 0, missing_files, found_files

def scan_directory(path):
    """Scan directory for shapefiles and validate their components"""
    file_lst = []
    validation_errors = []
    
    for (directory, sub_directory, file_name) in os.walk(path):
        for files in file_name:
            if files.lower().endswith('.shp'):
                file_filter = os.path.join(directory, files)
                
                # Validate shapefile components
                is_valid, missing_files, found_files = validate_shapefile_components(file_filter)
                
                if is_valid:
                    file_lst.append(file_filter)
                else:
                    error_msg = f"Shapefile '{os.path.basename(file_filter)}' is incomplete:\n  Found: {', '.join(found_files) if found_files else 'None'}\n  Missing: {', '.join(missing_files)}"
                    validation_errors.append(error_msg)
    
    return file_lst, validation_errors

def read_input_file(file, name_field, description_field, output_path):
    """
    Process a shapefile and convert to KML
    
    Parameters
    ----------
    file : str
        Path to the shapefile
    name_field : str
        Field name for 'name' in input .shp
    description_field : str
        Field name for 'description' in input .shp
    output_path : str
        Output directory for KML files
    
    Returns
    -------
    tuple
        (filename, status message)
    """
    try:
        # Try to read the shapefile
        try:
            input_file = gpd.read_file(file)
        except Exception as read_error:
            # Provide more specific error messages for common issues
            if "No such file or directory" in str(read_error):
                raise Exception(f"Shapefile file not found or corrupted: {os.path.basename(file)}")
            elif "fiona" in str(read_error).lower():
                raise Exception(f"Unable to read shapefile format: {os.path.basename(file)}. Please ensure the file is a valid shapefile.")
            else:
                raise Exception(f"Error reading shapefile {os.path.basename(file)}: {str(read_error)}")
        
        fn = os.path.basename(os.path.splitext(file)[0])
        
        # Check CRS and reproject if needed
        crs = input_file.crs
        if crs is None:
            print(f'{os.path.basename(file)} has no CRS. Output .kml will not be well georeferenced if file is not already in EPSG 4326.')
        elif crs == 'epsg:4326':
            pass
        else:
            print(f'{os.path.basename(file)} has been reprojected to EPSG 4326.')
            input_file = input_file.to_crs(4326)

        # Check input file fields
        print(f'Available columns in {os.path.basename(file)}: {list(input_file.columns)}')
        
        field_in_file = name_field in input_file.columns
        if field_in_file is False:
            # Try to find a suitable alternative field
            if 'id' in input_file.columns:
                name_field = 'id'
                print(f'Using "id" field instead of "{name_field}"')
            elif 'name' in input_file.columns:
                name_field = 'name'
                print(f'Using "name" field instead of "{name_field}"')
            elif 'OBJECTID' in input_file.columns:
                name_field = 'OBJECTID'
                print(f'Using "OBJECTID" field instead of "{name_field}"')
            else:
                raise ValueError(f'"{name_field}" field is not found in {os.path.basename(file)}. Available fields: {list(input_file.columns)}')
        
        field_in_file = description_field in input_file.columns
        if field_in_file is False:
            # Try to find a suitable alternative field
            if 'description' in input_file.columns:
                description_field = 'description'
                print(f'Using "description" field instead of "{description_field}"')
            elif 'desc' in input_file.columns:
                description_field = 'desc'
                print(f'Using "desc" field instead of "{description_field}"')
            elif 'comment' in input_file.columns:
                description_field = 'comment'
                print(f'Using "comment" field instead of "{description_field}"')
            else:
                # Use the first available field as description
                available_fields = [col for col in input_file.columns if col != name_field]
                if available_fields:
                    description_field = available_fields[0]
                    print(f'Using "{description_field}" field as description')
                else:
                    raise ValueError(f'"{description_field}" field is not found in {os.path.basename(file)}. Available fields: {list(input_file.columns)}')

        # Check geometries for Polygon or LineString
        geom_type = ''
        for q in input_file.geometry:
            if q is None:
                continue  # Skip None geometries
            if hasattr(q, 'type'):
                if q.type == 'Polygon':
                    geom_type = 'Polygon'
                elif q.type == 'LineString':
                    geom_type = 'LineString'
                elif q.type == 'Point':
                    geom_type = 'Point'
                elif q.type == 'MultiPolygon':
                    geom_type = 'MultiPolygon'
                elif q.type == 'MultiLineString':
                    geom_type = 'MultiLineString'
                else:
                    message = f'{os.path.basename(file)} contains unsupported geometry type: {q.type}. Supported types: Polygon, LineString, Point, MultiPolygon, MultiLineString'
                    raise ValueError(message)
            else:
                message = f'{os.path.basename(file)} contains invalid geometry objects'
                raise ValueError(message)

        if geom_type == 'Polygon':
            for index, row in input_file.iterrows():
                try:
                    geom = (row.geometry)
                    if geom is None:
                        print(f'Skipping row {index} - no geometry')
                        continue
                    ext = list(geom.exterior.coords)
                    int_ring = []
                    for interior in geom.interiors:
                        int_ring.append(list(interior.coords))
                    kml = simplekml.Kml()
                    pg = kml.newpolygon(name=str(row[name_field]), description=str(row[description_field]))
                    pg.outerboundaryis = ext
                    if int_ring:
                        pg.innerboundaryis = int_ring
                    kml.save(os.path.join(output_path, fn + '_' + str(row[name_field]) + '.kml'))
                except Exception as e:
                    print(f'Error processing Polygon row {index}: {str(e)}')
                    continue

        elif geom_type == 'LineString':
            for index, row in input_file.iterrows():
                geom = (row.geometry)
                if geom is None:
                    continue
                xyz = list(geom.coords)
                kml = simplekml.Kml()
                l = kml.newlinestring(name=(row[name_field]), description=(row[description_field]))
                l.coords = xyz
                kml.save(os.path.join(output_path, fn + '_' + str(row[name_field]) + '.kml'))
        
        elif geom_type == 'Point':
            for index, row in input_file.iterrows():
                geom = (row.geometry)
                if geom is None:
                    continue
                xyz = list(geom.coords)
                kml = simplekml.Kml()
                p = kml.newpoint(name=(row[name_field]), description=(row[description_field]))
                p.coords = xyz
                kml.save(os.path.join(output_path, fn + '_' + str(row[name_field]) + '.kml'))
        
        elif geom_type == 'MultiPolygon':
            for index, row in input_file.iterrows():
                geom = (row.geometry)
                if geom is None:
                    continue
                kml = simplekml.Kml()
                for i, poly in enumerate(geom.geoms):
                    ext = list(poly.exterior.coords)
                    int_ring = []
                    for interior in poly.interiors:
                        int_ring.append(list(interior.coords))
                    pg = kml.newpolygon(name=f"{row[name_field]}_{i+1}", description=(row[description_field]))
                    pg.outerboundaryis = ext
                    if int_ring:
                        pg.innerboundaryis = int_ring
                kml.save(os.path.join(output_path, fn + '_' + str(row[name_field]) + '.kml'))
        
        elif geom_type == 'MultiLineString':
            for index, row in input_file.iterrows():
                geom = (row.geometry)
                if geom is None:
                    continue
                kml = simplekml.Kml()
                for i, line in enumerate(geom.geoms):
                    xyz = list(line.coords)
                    l = kml.newlinestring(name=f"{row[name_field]}_{i+1}", description=(row[description_field]))
                    l.coords = xyz
                kml.save(os.path.join(output_path, fn + '_' + str(row[name_field]) + '.kml'))
        
        else:
            print(f'Unsupported geometry type: {geom_type}')

        return os.path.basename(file), '--> .kml'
        
    except Exception as e:
        raise Exception(f'Error processing {file}: {str(e)}')

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Convert shapefiles to KML format')
    parser.add_argument('--input_path', required=True, help='Input path to shapefile directory')
    parser.add_argument('--output_path', required=True, help='Output path for KML files')
    parser.add_argument('--name_field', default='id', help='Field name for name in input .shp')
    parser.add_argument('--description_field', default='JOORA', help='Field name for description in input .shp')
    
    args = parser.parse_args()
    
    # Set variables
    INPUT_PATH = args.input_path
    OUTPUT_PATH = args.output_path
    NAME = args.name_field
    DESCRIPTION = args.description_field
    
    # Debug output
    print(f'Input path: {INPUT_PATH}')
    print(f'Output path: {OUTPUT_PATH}')
    print(f'Name field: {NAME}')
    print(f'Description field: {DESCRIPTION}')
    print(f'Input path exists: {os.path.exists(INPUT_PATH)}')
    print(f'Input path is directory: {os.path.isdir(INPUT_PATH)}')
    
    # Create output directory
    create_directory(OUTPUT_PATH)
    
    # Scan for shapefiles
    files, validation_errors = scan_directory(INPUT_PATH)
    
    # Check for validation errors first
    if validation_errors:
        print('Shapefile validation errors:', file=sys.stderr)
        for error in validation_errors:
            print(f'  - {error}', file=sys.stderr)
        print(file=sys.stderr)
        sys.exit(1)
    
    if not files:
        print('No valid shapefiles found in the input directory', file=sys.stderr)
        print('Please ensure your ZIP file contains complete shapefiles with .shp, .shx, and .dbf files', file=sys.stderr)
        
        # List what files were actually found
        print('\nFiles found in the directory:', file=sys.stderr)
        all_files = []
        for (directory, sub_directory, file_name) in os.walk(INPUT_PATH):
            for files in file_name:
                all_files.append(files)
                print(f'  - {files}', file=sys.stderr)
        
        # Provide specific guidance based on what was found
        shp_files = [f for f in all_files if f.lower().endswith('.shp')]
        if shp_files:
            print(f'\nFound {len(shp_files)} .shp file(s) but they are missing required components.', file=sys.stderr)
            print('A complete shapefile requires: .shp, .shx, and .dbf files with the same base name.', file=sys.stderr)
        else:
            print('\nNo .shp files found. Please ensure your ZIP contains shapefile (.shp) files.', file=sys.stderr)
        
        sys.exit(1)
    
    print('The following files were found in the input directory:')
    for q in files:
        print(os.path.basename(q))
    print()

    print('Translating file geometries to kml...', '\n')

    # Process each shapefile
    for file in files:
        try:
            message = read_input_file(file, NAME, DESCRIPTION, OUTPUT_PATH)
            print(message[0], message[1])
        except Exception as e:
            print(f'Error processing {os.path.basename(file)}: {str(e)}')
            print('Please check that your shapefile contains valid geometry and required fields.')
            sys.exit(1)

    print('Done')

if __name__ == '__main__':
    main() 