# Reference Go Application

## 1. Context Profile
* **Domain:** External Application proof of architecture using Golang.
* **Role:** A simple Go application demonstrating iframe integration, OAuth exchange, and schema-isolated data access in a Go-based microservice.

## 2. Network Target Mappings
* **Active Port:** `8086`
* **Routing Mode:** `iframe`
* **Environment Keys Required:**
  * `PORT`: `8086`
  * `DATABASE_URL`: Connection string to the main PostgreSQL database.

## 3. Storage Tier Isolation
* **Schema Namespace:** `forge_reference_go`
* **Isolated Table Structure:** Creates and reads tables inside the `forge_reference_go` schema namespace.

## 4. Independent Execution Command
To run this application independently, execute the following command:
```bash
go run main.go
```
