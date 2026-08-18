# Reference Python Application

## 1. Context Profile
* **Domain:** External Application proof of architecture using Python / FastAPI.
* **Role:** A FastAPI application demonstrating iframe integration, OAuth exchange, and secure backchannel communication.

## 2. Network Target Mappings
* **Active Port:** `8087`
* **Routing Mode:** `iframe`
* **Environment Keys Required:**
  * `PORT`: `8087`
  * `DATABASE_URL`: Connection string to the main PostgreSQL database.

## 3. Storage Tier Isolation
* **Schema Namespace:** N/A (Does not request an isolated database schema namespace)

## 4. Independent Execution Command
To run this application independently:
```bash
python3 server.py
```
