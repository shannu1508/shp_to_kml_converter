#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Shapefile to KML Converter...\n');

// Check if Node.js is installed
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' });
  console.log(`✅ Node.js version: ${nodeVersion.trim()}`);
} catch (error) {
  console.error('❌ Node.js is not installed. Please install Node.js first.');
  process.exit(1);
}

// Check if Python is installed
try {
  const pythonVersion = execSync('python --version', { encoding: 'utf8' });
  console.log(`✅ Python version: ${pythonVersion.trim()}`);
} catch (error) {
  try {
    const python3Version = execSync('python3 --version', { encoding: 'utf8' });
    console.log(`✅ Python3 version: ${python3Version.trim()}`);
  } catch (error2) {
    console.error('❌ Python is not installed. Please install Python 3.7 or higher.');
    process.exit(1);
  }
}

// Install backend dependencies
console.log('\n📦 Installing backend dependencies...');
try {
  execSync('npm install', { cwd: path.join(__dirname, 'backend'), stdio: 'inherit' });
  console.log('✅ Backend dependencies installed');
} catch (error) {
  console.error('❌ Failed to install backend dependencies');
  process.exit(1);
}

// Install Python dependencies
console.log('\n🐍 Installing Python dependencies...');
try {
  execSync('pip install -r requirements.txt', { cwd: path.join(__dirname, 'backend'), stdio: 'inherit' });
  console.log('✅ Python dependencies installed');
} catch (error) {
  console.error('❌ Failed to install Python dependencies');
  console.log('💡 Try running: pip install -r backend/requirements.txt manually');
}

// Install frontend dependencies
console.log('\n📦 Installing frontend dependencies...');
try {
  execSync('npm install', { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' });
  console.log('✅ Frontend dependencies installed');
} catch (error) {
  console.error('❌ Failed to install frontend dependencies');
  process.exit(1);
}

console.log('\n🎉 Setup complete!');
console.log('\nTo start the application:');
console.log('1. Start MongoDB (if using local instance)');
console.log('2. Start backend: cd backend && npm run dev');
console.log('3. Start frontend: cd frontend && npm run dev');
console.log('\nThe application will be available at:');
console.log('- Frontend: http://localhost:3000');
console.log('- Backend: http://localhost:3001');
console.log('- Health check: http://localhost:3001/api/health'); 