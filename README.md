### Описание

Открытй чат:
- React frontend
- Node.js + Socket.io backend
- Redis для сообщений


Докер образ публикуется в DockerHub  
Выполнил: Еленкин Петр М8О-101-БВ25

### Prod запуск

```
# 1. Клонировать репозиторий
git clone <https://gitlab.mai.ru/idt-lw/m8o-101bv-25/personal/PVElenkin/lab4.git>
cd lab4

# 2. Создать .env файл

cp .env.example .env

# 3. Запустить приложение

docker-compose up -d --build
```
Приложение будет доступно на **http://localhost**

### Dev запуск
```
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache 
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```
Приложение будет доступно на **http://localhost:5173**
## Архитектура

```

┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
└────────────────────────┬────────────────────────────────────┘
│ HTTP/WebSocket
|
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Container                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Nginx                                    │    │
│  │  -  Статические файлы React                         │    │
│  │  -  Proxy для WebSocket                             │    │                  
│  └─────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
│ Internal Docker Network (frontend)
|
┌─────────────────────────────────────────────────────────────┐
│                    Backend Container                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         Node.js + Socket.IO Server                  │    │
│  │  -  WebSocket подключения                           │    │
│  │  -  Обработка событий чата                          │    │            
│  │  -  Health endpoint                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
│ Internal Docker Network (backend)
|
┌─────────────────────────────────────────────────────────────┐
│                     Redis Container                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Redis 7                                │    │
│  │  -  Хранение истории сообщений (последние 50)       │    │
│  │  -  Pub/Sub для Socket.IO масштабирования           │    │
│  │  -  AOF persistence                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

```


## Структура проекта

```

chat-app/
├── docker-compose.yml           \# Базовая конфигурация
├── docker-compose.dev.yml       \# Dev настройки
├── .env                         \# Переменные окружения
├── .env.example                 \# Пример переменных
├── README.md                    \# Документация
│
├── backend/                     \# Backend сервис
│   ├── Dockerfile              \# Multi-stage build
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js               
│   └── .dockerignore
│
└── frontend/                    \# Frontend сервис
├── Dockerfile              \# Multi-stage build
├── nginx.conf              \# Nginx конфигурация
├── vite.config.js          \# Vite настройки
├── package.json
├── package-lock.json
├── index.html
├── .dockerignore
└── src/
├── App.jsx             
├── App.css             
├── socket.js           
└── index.jsx           



