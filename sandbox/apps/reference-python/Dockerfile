# syntax=docker/dockerfile:1.7
FROM python:3.11-alpine

RUN apk add --no-cache postgresql-client
WORKDIR /app
RUN adduser -D -u 1000 appuser

COPY --chown=appuser:appuser . .

EXPOSE 8087

USER appuser

CMD ["python", "server.py"]
