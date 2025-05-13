#!/bin/bash

echo "🔄 Installing dependencies..."
npm install

echo "🔄 Building React application..."
npm run build

echo "✅ Build completed!"
echo "The build folder is ready to be deployed." 