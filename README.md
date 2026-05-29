# Развёртывание в Kubernetes

Инструкция по запуску чат-приложения в Kubernetes на Windows и Linux.

## Windows

### 1. Включить Kubernetes в Docker Desktop

Settings - Kubernetes - **Enable Kubernetes** - Apply & Restart.

Проверить:
```powershell
kubectl config use-context docker-desktop
kubectl get nodes
# NAME             STATUS   ROLES
# docker-desktop   Ready    ...
```

### 2. Запустить локальный registry

Docker Desktop на Windows не пробрасывает локальные образы в Kubernetes напрямую, поэтому используется локальный registry:

```powershell
docker run -d -p 5000:5000 --name registry registry:2
```

### 3. Собрать и запушить образы

Выполнять из корня репозитория (там где `backend/` и `frontend/`):

```powershell
docker build --target production `
  -t localhost:5000/chat-app-backend:latest `
  ./backend
docker push localhost:5000/chat-app-backend:latest

docker build --no-cache --target production `
  --build-arg "VITE_SOCKET_URL=" `
  -t localhost:5000/chat-app-frontend:latest `
  ./frontend
docker push localhost:5000/chat-app-frontend:latest
```

### 4. Применить манифесты

```powershell
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml
kubectl apply -f k8s/03-redis-deployment.yaml
kubectl apply -f k8s/04-redis-service.yaml
kubectl apply -f k8s/05-backend-deployment.yaml
kubectl apply -f k8s/06-backend-service.yaml
kubectl apply -f k8s/07-frontend-deployment.yaml
kubectl apply -f k8s/08-frontend-service.yaml
```

### 5. Проверить статус подов

```powershell
kubectl get pods,svc -n lab5-chat
# Все три пода должны быть 1/1 Running
```

### 6. Открыть приложение

NodePort на Windows/WSL2 может не работать напрямую, поэтому используем port-forward:

```powershell
kubectl port-forward -n lab5-chat svc/frontend 8080:80
```

Открыть в браузере: **http://localhost:8080**

> Окно PowerShell с port-forward должно оставаться открытым.

---

## Linux

### 1. Установить и запустить minikube

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

minikube start --driver=docker
kubectl get nodes
```

### 2. Использовать встроенный registry minikube

На Linux не нужен отдельный registry - можно собирать образы прямо в окружении minikube:

```bash
# Подключить окружение Docker minikube в текущей сессии
eval $(minikube docker-env)
```

### 3. Собрать образы

```bash
docker build --target production \
  -t chat-app-backend:latest \
  ./backend

docker build --no-cache --target production \
  --build-arg "VITE_SOCKET_URL=" \
  -t chat-app-frontend:latest \
  ./frontend
```

### 4. Обновить манифесты для Linux

В манифестах `05-backend-deployment.yaml` и `07-frontend-deployment.yaml` используются образы с `localhost:5000/`. Для Linux заменить:

```bash
# Backend
sed -i 's|localhost:5000/chat-app-backend:latest|chat-app-backend:latest|' k8s/05-backend-deployment.yaml
sed -i 's|imagePullPolicy: IfNotPresent|imagePullPolicy: Never|' k8s/05-backend-deployment.yaml

# Frontend
sed -i 's|localhost:5000/chat-app-frontend:latest|chat-app-frontend:latest|' k8s/07-frontend-deployment.yaml
sed -i 's|imagePullPolicy: IfNotPresent|imagePullPolicy: Never|' k8s/07-frontend-deployment.yaml
```

### 5. Применить манифесты

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml
kubectl apply -f k8s/03-redis-deployment.yaml
kubectl apply -f k8s/04-redis-service.yaml
kubectl apply -f k8s/05-backend-deployment.yaml
kubectl apply -f k8s/06-backend-service.yaml
kubectl apply -f k8s/07-frontend-deployment.yaml
kubectl apply -f k8s/08-frontend-service.yaml
```

### 6. Проверить статус подов

```bash
kubectl get pods,svc -n lab5-chat
# Все три пода должны быть 1/1 Running
```

### 7. Открыть приложение

```bash
# Вариант A: minikube service (откроет браузер автоматически)
minikube service frontend -n lab5-chat

# Вариант B: port-forward
kubectl port-forward -n lab5-chat svc/frontend 8080:80
# Открыть: http://localhost:8080
```

---

## Структура манифестов

```
k8s/
├── 00-namespace.yaml          # Namespace lab5-chat
├── 01-configmap.yaml          # Конфигурация backend (PORT, REDIS_URL, CORS_ORIGIN)
├── 02-secret.yaml             # Секреты (шаблон; в git - без реальных значений)
├── 03-redis-deployment.yaml   # Redis Deployment
├── 04-redis-service.yaml      # Redis ClusterIP Service (порт 6379)
├── 05-backend-deployment.yaml # Backend Deployment (Node.js + Socket.IO)
├── 06-backend-service.yaml    # Backend ClusterIP Service (порт 3001)
├── 07-frontend-deployment.yaml# Frontend Deployment (nginx + React)
└── 08-frontend-service.yaml   # Frontend NodePort Service (порт 30080)
```

## Диагностика

```bash
# Статус всех ресурсов
kubectl get pods,svc -n lab5-chat

# Логи конкретного сервиса
kubectl logs -n lab5-chat deploy/backend
kubectl logs -n lab5-chat deploy/frontend
kubectl logs -n lab5-chat deploy/redis

# Подробная информация о поде (если не стартует)
kubectl describe pod -n lab5-chat -l component=backend
```

## Удаление

```bash
# Удалить все ресурсы лабораторной
kubectl delete namespace lab5-chat

# Остановить локальный registry (только Windows)
docker stop registry && docker rm registry
```
