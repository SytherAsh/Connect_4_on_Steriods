# 🎮 Connect 4 on Steroids 🚀

## 🌟 Overview

Connect 4 on Steroids is an enhanced version of the classic Connect 4 game with exciting new features, real-time multiplayer capabilities, and a modern tech stack!

## ✨ Features

- 🎲 Classic Connect 4 gameplay with a twist
- 🔄 Real-time multiplayer using WebSockets
- 🐰 RabbitMQ integration for message queuing
- 🖥️ Modern frontend built with React
- 🔧 Robust backend architecture
- 🐳 Containerized with Docker for easy deployment

## 🚀 Getting Started

### 📋 Prerequisites

- 🐍 Python
- 📦 Node.js and npm
- 🐳 Docker and Docker Compose (for containerized setup)

### 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Connect_4_on_Steriods.git
   cd Connect_4_on_Steriods
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start the game**
   ```bash
   ./start_game.sh
   ```

## 🐳 Docker Setup

For Docker-based deployment, see our [Docker README](./DOCKER_README.md) for detailed instructions.

## 🏗️ System Architecture

Our game uses a modern distributed architecture. Check out the [System Architecture](./SYSTEM_ARCHITECTURE.md) document for details.

## 🐰 RabbitMQ Integration

We use RabbitMQ for message queuing. Learn more in our [RabbitMQ Integration](./RABBITMQ-INTEGRATION.md) guide.

## 🎮 How to Play

1. 🔄 Start the game server
2. 👥 Create a game or join an existing one
3. 🎯 Take turns dropping discs into the columns
4. 🏆 Connect 4 of your discs horizontally, vertically, or diagonally to win!

## 🧪 Special Game Modes

- ⏱️ **Timed Mode**: Make your move before the timer runs out!
- 🔮 **Power-ups**: Collect and use special abilities during gameplay
- 🌪️ **Chaos Mode**: Random events shake up the game board

## 👨‍💻 Development

### 🛠️ Tech Stack

- **Frontend**: React, TypeScript
- **Backend**: Python, FastAPI
- **Message Broker**: RabbitMQ
- **Containerization**: Docker

### 🧪 Running Tests

```bash
# Run backend tests
cd backend
pytest

# Run frontend tests
cd frontend
npm test
```

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- Original Connect 4 game concept
- All contributors to this project
- Open source libraries used in development 