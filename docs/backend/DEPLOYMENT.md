# Bunik API — Deployment & Production Guide

## Pre-Deployment Checklist

- [ ] All tests pass: `pytest -v`
- [ ] No linting errors: `flake8 apps/ config/`
- [ ] Code formatted: `black apps/ config/`
- [ ] Migrations created: `python manage.py makemigrations --check`
- [ ] Environment variables set correctly
- [ ] Database backup created
- [ ] SSL certificates ready
- [ ] Domain name configured
- [ ] Monitoring setup configured

---

## Environment Configuration

### Production Environment Variables

```bash
# Security
SECRET_KEY=your-very-long-random-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database
POSTGRES_DB=bunik_prod
POSTGRES_USER=bunik_prod_user
POSTGRES_PASSWORD=your-secure-password
POSTGRES_HOST=db.your-hosting-provider.com
POSTGRES_PORT=5432

# Email (optional, for notifications)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# API Configuration
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_BROWSER_XSS_FILTER=True
SECURE_CONTENT_SECURITY_POLICY={...}

# Azure (if using Azure services)
AZURE_ACCOUNT_NAME=your-account-name
AZURE_ACCOUNT_KEY=your-account-key
AZURE_CONTAINER_NAME=bunik-media
```

---

## Docker Deployment

### Build Production Image

```bash
docker build -t bunik-api:latest -f Dockerfile .

docker tag bunik-api:latest registry.example.com/bunik-api:latest

docker push registry.example.com/bunik-api:latest
```

### Production Docker Compose

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    image: registry.example.com/bunik-api:latest
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --worker-class sync"
    env_file: .env.production
    volumes:
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - static_volume:/app/staticfiles:ro
      - media_volume:/app/media:ro
    depends_on:
      - web
    restart: always

volumes:
  postgres_data:
  static_volume:
  media_volume:
```

### Nginx Configuration

```nginx
upstream bunik_app {
    server web:8000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://bunik_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;

        # Websocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /static/ {
        alias /app/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias /app/media/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

---

## Kubernetes Deployment

### Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bunik-api
  labels:
    app: bunik-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: bunik-api
  template:
    metadata:
      labels:
        app: bunik-api
    spec:
      containers:
      - name: bunik-api
        image: registry.example.com/bunik-api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
          name: http
        env:
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: bunik-secrets
              key: secret-key
        - name: POSTGRES_HOST
          valueFrom:
            configMapKeyRef:
              name: bunik-config
              key: db-host
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: bunik-secrets
              key: db-name
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: bunik-secrets
              key: db-user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: bunik-secrets
              key: db-password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: static-volume
          mountPath: /app/staticfiles
        - name: media-volume
          mountPath: /app/media
      volumes:
      - name: static-volume
        emptyDir: {}
      - name: media-volume
        persistentVolumeClaim:
          claimName: bunik-media-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: bunik-api-service
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8000
    protocol: TCP
  selector:
    app: bunik-api
```

---

## AWS Deployment (using Elastic Beanstalk)

### .ebextensions/django.config

```yaml
option_settings:
  aws:elasticbeanstalk:container:python:
    WSGIPath: config.wsgi:application
  aws:elasticbeanstalk:application:environment:
    DJANGO_SETTINGS_MODULE: config.settings.base
    PYTHONPATH: /var/app/current:$PYTHONPATH

container_commands:
  01_migrate:
    command: "python manage.py migrate"
    leader_only: true
  02_collectstatic:
    command: "python manage.py collectstatic --noinput"

option_settings:
  aws:autoscaling:asg:
    MinSize: 2
    MaxSize: 4
  aws:ec2:instances:
    InstanceTypes: t3.medium
  aws:elasticbeanstalk:healthreporting:system:
    SystemType: enhanced
    EnhancedHealthAuthEnabled: true
```

### Deploy to Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB
eb init -p python-3.12 bunik-api --region us-east-1

# Create environment and deploy
eb create bunik-prod

# Deploy updates
eb deploy

# View logs
eb logs

# Monitor
eb open
```

---

## Azure Deployment (using App Service)

### azure-pipelines.yml

```yaml
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

variables:
  djangoSettings: 'config.settings.base'
  pythonVersion: '3.12'

stages:
- stage: Test
  jobs:
  - job: RunTests
    steps:
    - task: UsePythonVersion@0
      inputs:
        versionSpec: '$(pythonVersion)'
    
    - script: |
        python -m pip install --upgrade pip
        pip install -r requirements/dev.txt
      displayName: 'Install dependencies'
    
    - script: |
        pytest -v --cov=apps
      displayName: 'Run tests'

- stage: Deploy
  condition: succeeded()
  jobs:
  - deployment: DeployToAzure
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: AzureWebApp@1
            inputs:
              azureSubscription: 'Azure Service Connection'
              appName: 'bunik-api-prod'
              appType: 'webAppLinux'
              package: '$(Build.ArtifactStagingDirectory)'
              runtimeStack: 'PYTHON|3.12'
              startupCommand: 'gunicorn config.wsgi:application'
```

---

## Monitoring & Logging

### Health Check Endpoint

```python
# Add to urls.py
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({
        'status': 'healthy',
        'timestamp': timezone.now(),
        'version': '4.1.0'
    })
```

### Logging Configuration

```python
# In settings/base.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/django/bunik.log',
            'maxBytes': 1024 * 1024 * 10,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
        'apps': {
            'handlers': ['file', 'console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}
```

### Sentry Integration for Error Tracking

```python
# In settings/base.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

if not DEBUG:
    sentry_sdk.init(
        dsn="https://key@sentry.io/project-id",
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False
    )
```

---

## Performance Optimization

### Database Connection Pooling

```python
# In settings/base.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('POSTGRES_DB'),
        'USER': config('POSTGRES_USER'),
        'PASSWORD': config('POSTGRES_PASSWORD'),
        'HOST': config('POSTGRES_HOST'),
        'PORT': config('POSTGRES_PORT', default='5432'),
        'CONN_MAX_AGE': 600,
        'OPTIONS': {
            'connect_timeout': 10,
        }
    }
}
```

### Caching

```python
# In settings/base.py
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

CACHE_TIMEOUT = 3600  # 1 hour
```

### Query Optimization

```python
# Use select_related and prefetch_related
queryset = University.objects.select_related(
    'province'
).prefetch_related(
    'programs__major_catalog__field'
)
```

---

## Backup & Recovery

### PostgreSQL Backup Script

```bash
#!/bin/bash
# backup_database.sh

BACKUP_DIR="/var/backups/postgresql"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="bunik_prod"

mkdir -p $BACKUP_DIR

pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER $DB_NAME | \
    gzip > $BACKUP_DIR/bunik_$TIMESTAMP.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "bunik_*.sql.gz" -mtime +30 -delete

echo "Backup completed: bunik_$TIMESTAMP.sql.gz"
```

### Restore from Backup

```bash
gunzip -c /var/backups/postgresql/bunik_20240101_120000.sql.gz | \
    psql -h localhost -U postgres bunik_prod
```

---

## Security Best Practices

1. **Use HTTPS/SSL everywhere** — Never expose API over plain HTTP
2. **Rotate SECRET_KEY regularly** — Change in settings and restart
3. **Use strong database passwords** — At least 32 characters
4. **Limit API rate** — Use tools like django-ratelimit
5. **Keep dependencies updated** — Run `pip-audit` monthly
6. **Enable CORS carefully** — Whitelist specific domains
7. **Use environment variables** — Never commit secrets
8. **Monitor access logs** — Alert on suspicious patterns
9. **Enable HTTPS-only cookies** — Set SESSION_COOKIE_SECURE
10. **Use Content Security Policy** — Prevent XSS attacks

---

## Scaling Strategies

### Horizontal Scaling (Multiple Instances)

```yaml
# Load balance across multiple instances
upstream bunik_backend {
    server web1:8000;
    server web2:8000;
    server web3:8000;
}
```

### Vertical Scaling (Single Larger Instance)

- Increase gunicorn workers: `--workers 8`
- Increase memory allocation
- Use faster database hardware
- Enable query caching

### Database Optimization

- Add more indexes on frequently searched fields
- Use read replicas for high-traffic applications
- Archive old data (admission scores > 5 years)
- Partition tables by year for faster queries

---

## Troubleshooting

### Common Issues

**Issue: `OperationalError: could not translate host name`**
```
Solution: Check POSTGRES_HOST in .env and ensure database is accessible
```

**Issue: `ModuleNotFoundError: No module named 'django'`**
```
Solution: Run: pip install -r requirements/base.txt
```

**Issue: `Permission denied: '/var/log/django/bunik.log'`**
```
Solution: Create directory and set permissions:
mkdir -p /var/log/django
chown -R www-data:www-data /var/log/django
```

**Issue: `CSRF token missing or incorrect`**
```
Solution: Ensure CSRF_TRUSTED_ORIGINS includes your domain
```

---

## Monitoring Checklist

- [ ] Setup error tracking (Sentry)
- [ ] Configure log aggregation (ELK, Datadog)
- [ ] Enable performance monitoring (New Relic, Datadog)
- [ ] Setup uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure alerts for:
  - Server down (5xx errors)
  - High response time (> 1s)
  - Database connection issues
  - Memory/CPU usage

---

## Maintenance Schedule

### Weekly
- Review error logs
- Monitor database size
- Check disk space

### Monthly
- Update dependencies: `pip list --outdated`
- Run security audit: `pip-audit`
- Review access logs for suspicious activity
- Backup database verification

### Quarterly
- Full security audit
- Performance review and optimization
- Database maintenance (VACUUM, ANALYZE)

### Annually
- Major dependency updates
- Architecture review
- Disaster recovery drill

---

End of Deployment Guide
