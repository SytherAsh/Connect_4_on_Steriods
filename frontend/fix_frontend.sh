#!/bin/bash

echo "🔧 Fixing common frontend issues..."

echo "🔄 Cleaning node_modules and reinstalling..."
rm -rf node_modules
rm -f package-lock.json

echo "🔄 Installing dependencies..."
npm install

echo "🔄 Clearing React cache..."
rm -rf .cache build

echo "✅ Frontend fixes completed!"
echo "Now you can run 'npm start' to start the development server" 