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
        field_in_file = name_field in input_file.columns
        if field_in_file is False:
            raise ValueError(f'"{name_field}" field is not found in {os.path.basename(file)}. Please verify name_field parameter')
        
        field_in_file = description_field in input_file.columns
        if field_in_file is False:
            raise ValueError(f'"{description_field}" field is not found in {os.path.basename(file)}. Please verify description_field parameter')

        # Check geometries for Polygon or LineString
        geom_type = ''
        for q in input_file.geometry:
            if q.type == 'Polygon':
                geom_type = 'Polygon'
            elif q.type == 'LineString':
                geom_type = 'LineString'
            else:
                message = f'{os.path.basename(file)} contains objects other than Polygons or LineStrings. Please remove file from input directory or modify file objects. Note that MultiPolygon and MultiLineStrings are not supported.'
                raise ValueError(message)

        if geom_type == 'Polygon':
            for index, row in input_file.iterrows():
                geom = (row.geometry)
                ext = list(geom.exterior.coords)
                int_ring = []
                for interior in geom.interiors:
                    int_ring.append(list(interior.coords))
                kml = simplekml.Kml()
                pg = kml.newpolygon(name=(row[name_field]), description=(row[description_field]))
                pg.outerboundaryis = ext
                if int_ring == []:
                    pass
                else:
                    pg.innerboundaryis = int_ring
                kml.save(os.path.join(output_path, fn + '_' + str(row[name_field]) + '.kml'))

        elif geom_type == 'LineString':
            for index, row in input_file.iterrows():
                geom = (row.geometry)
                xyz = list(geom.coords)
                kml = simplekml.Kml()
                l = kml.newlinestring(name=(row[name_field]), description=(row[description_field]))
                l.coords = xyz
                kml.save(os.path.join(output_path, fn + '_' + str(row[name_field]) + '.kml'))
        else:
            print('Only polygons and linestring files are supported for now!')

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