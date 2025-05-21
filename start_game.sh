#!/bin/bash

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f "env.local" ]; then
    echo "🔄 Loading environment variables from env.local..."
    export $(grep -v '^#' env.local | xargs)
else
    echo "⚠️ env.local not found, using default values"
    # Set default IP to localhost
    export HOST_IP="localhost"
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Redis is running
check_redis() {
    redis-cli ping >/dev/null 2>&1
}

# Function to handle cleanup on exit
cleanup() {
    echo "🛑 Shutting down all services..."
    pkill -f "python.*column_node.py" || true
    pkill -f "uvicorn" || true
    pkill -f "node.*react-scripts" || true
    echo "✅ Cleanup complete"
    exit 0
}

# Register the cleanup function to run on Ctrl+C and other signals
trap cleanup SIGINT SIGTERM

echo "🎮 Starting Connect 4 on Steroids..."
echo "🌐 Using host IP: $HOST_IP"

# Check if Redis is installed
if ! command_exists redis-cli; then
    echo "❌ Redis is not installed. Please install Redis first."
    echo "Ubuntu/Debian: sudo apt-get install redis-server"
    echo "macOS: brew install redis"
    exit 1
fi

# Check if Redis is running
if ! check_redis; then
    echo "🔄 Starting Redis server..."
    redis-server &
    sleep 2
    
    # Check again to make sure Redis started successfully
    if ! check_redis; then
        echo "❌ Failed to start Redis. Please start it manually."
        exit 1
    fi
fi

# Use the 'game' virtual environment
if [ ! -d "game" ]; then
    echo "🔄 Virtual environment 'game' not found. Creating it..."
    python3 -m venv game
    source game/bin/activate
    
    # Check if requirements.txt exists
    if [ -f "requirements.txt" ]; then
        echo "🔄 Installing Python dependencies..."
        pip install -r requirements.txt
    else
        echo "⚠️ requirements.txt not found. Installing minimal requirements..."
        pip install fastapi uvicorn redis websockets python-dotenv
    fi
else
    echo "🔄 Activating virtual environment..."
    source game/bin/activate
    
    # Make sure python-dotenv is installed
    pip install python-dotenv
fi

# Kill any existing game processes
echo "🔄 Cleaning up existing processes..."
pkill -f "python.*column_node.py" || true
pkill -f "uvicorn" || true
pkill -f "node.*react-scripts" || true

# Check if backend directories exist
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Backend or frontend directory not found. Make sure you're in the correct directory."
    exit 1
fi

# Create necessary directories for frontend
if [ ! -d "frontend/public" ]; then
    echo "🔄 Creating frontend/public directory..."
    mkdir -p frontend/public
fi

# Create frontend .env.local file dynamically
echo "🔄 Creating frontend environment file..."
cat > frontend/.env.local << EOF
# API and WebSocket URLs
REACT_APP_API_URL=http://${HOST_IP}:8000
REACT_APP_WS_URL=ws://${HOST_IP}:8000

# Disable polling for faster development
FAST_REFRESH=true
CHOKIDAR_USEPOLLING=false
EOF

# Start column nodes
echo "🔄 Starting column nodes..."
for i in {0..6}
do
    python backend/column_nodes/column_node.py $i &
    if [ $? -ne 0 ]; then
        echo "❌ Failed to start column node $i. Check for errors."
    else
        echo "✅ Started column node $i"
    fi
    sleep 1
done

# Start power-up service
echo "🔄 Starting power-up service..."
cd backend
python -m uvicorn power_up_service.power_up_service:app --host 0.0.0.0 --port 8010 --reload &
if [ $? -ne 0 ]; then
    echo "❌ Failed to start power-up service. Check for errors."
    exit 1
else
    echo "✅ Started power-up service"
fi
cd ..

# Start random event engine
echo "🔄 Starting random event engine..."
cd backend
python -m uvicorn random_event_engine.random_event_engine:app --host 0.0.0.0 --port 8020 --reload &
if [ $? -ne 0 ]; then
    echo "❌ Failed to start random event engine. Check for errors."
    exit 1
else
    echo "✅ Started random event engine"
fi
cd ..

# Start coordinator
echo "🔄 Starting game coordinator..."
cd backend
python -m uvicorn coordinator.coordinator:app --host 0.0.0.0 --port 8000 --reload &
if [ $? -ne 0 ]; then
    echo "❌ Failed to start game coordinator. Check for errors."
    exit 1
else
    echo "✅ Started game coordinator"
fi
cd ..

# Give backend services time to start
echo "⏳ Waiting for backend services to initialize..."
sleep 5

# Start frontend
echo "🔄 Starting frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "🔄 Installing frontend dependencies..."
    if ! command_exists npm; then
        echo "❌ npm not found. Please install Node.js."
        exit 1
    fi
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install frontend dependencies. Check for errors."
        exit 1
    fi
fi

# Start frontend in background so the script doesn't block
npm start &
FRONTEND_PID=$!

# Check if frontend started successfully
sleep 5
if ! ps -p $FRONTEND_PID > /dev/null; then
    echo "❌ Frontend failed to start. Check for errors."
    exit 1
else
    echo "✅ Frontend started successfully"
fi
cd ..

echo "✨ Game is ready!"
echo "🌐 Access the game from any device on your network:"
echo "📱 Frontend: http://${HOST_IP}:3000"
echo "🔌 Backend API: http://${HOST_IP}:8000"
echo "🎲 Power-Up Service: http://${HOST_IP}:8010"
echo "⚡ Random Event Engine: http://${HOST_IP}:8020"
echo ""
echo "Press Ctrl+C to stop all processes"

# Wait for all background processes
wait 