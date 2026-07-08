# PortariaFlow API

Base: `/`

## Auth
- `POST /auth/login`
- `POST /auth/refresh`

## Dashboard
- `GET /dashboard`

## Tenants, users, residents and units
- `GET|POST /tenants`
- `GET|POST /users`
- `GET|POST /units`
- `GET|POST /residents`

## Deliveries
- `GET|POST /deliveries`
- `GET /deliveries/{id}`
- `POST /deliveries/{id}/photos`
- `POST /deliveries/{id}/notify`
- `POST /deliveries/{id}/pickup`

## Access control
- `POST /access/webhook`
- `GET /access/events`

## Cameras
- `GET|POST /cameras`
- `POST /cameras/{id}/test`
- `GET|POST /camera-mosaics`

## Notifications
- `POST /notifications/whatsapp/connect`
- `GET /notifications/whatsapp/status`
- `POST /notifications/whatsapp/send-test`

## Reports and audit
- `GET /reports/summary`
- `GET /audit-logs`
