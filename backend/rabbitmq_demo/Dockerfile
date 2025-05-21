FROM node:16-alpine

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Create startup script that allows choosing which demo to run
RUN echo '#!/bin/sh\n\
case "$1" in\n\
  "standard") npm start ;;\n\
  "demo") npm run demo ;;\n\
  "continuous") npm run continuous ;;\n\
  *) echo "Usage: ./start.sh [standard|demo|continuous]" ;;\n\
esac' > /app/start.sh && chmod +x /app/start.sh

# Default command - can be overridden at runtime
CMD ["tail", "-f", "/dev/null"] 