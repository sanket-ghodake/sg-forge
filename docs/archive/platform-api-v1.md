# SG Forge Platform v1 REST API Contracts

This document contains the frozen HTTP REST API specifications for the SG Forge v1 Core Platform. All client and external application runtimes must adhere to these interfaces.

---

## Base URL
The default internal base URL for platform APIs is:
```text
http://localhost:3001
```

---

## Endpoints

### 1. Token Exchange Flow
Exchanges a temporary authorization code (issued during iframe parent container initialization) for an active app session token.

* **Endpoint:** `POST /api/v1/auth/exchange`
* **Content-Type:** `application/json`
* **Request Body:**
  ```json
  {
    "code": "auth_code_sample",
    "client_id": "example_client_id",
    "client_secret": "<CLIENT_SECRET>"
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "access_token": "token_session_uuid_or_hash",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "u_91c...",
      "eid": "EID-1001",
      "name": "Jane Doe",
      "email": "jane.doe@company.com",
      "role": "super_admin"
    },
    "scopes": [
      "user.profile.read",
      "user.manager.read",
      "expense.create",
      "expense.read"
    ]
  }
  ```
* **Error Responses:**
  - `400 Bad Request`: Code, client_id, or client_secret missing.
  - `401 Unauthorized`: Invalid or expired authorization code, or client credentials mismatch.

---

### 2. User Info Directory Query
Retrieves the logged-in user profile, designation, organization vertical, and managerial hierarchy.

* **Endpoint:** `GET /api/v1/user`
* **Headers:**
  - `Authorization: Bearer <access_token>`
* **Success Response (`200 OK`):**
  ```json
  {
    "user": {
      "id": "u_91c...",
      "eid": "EID-1001",
      "name": "Jane Doe",
      "email": "jane.doe@company.com",
      "role": "super_admin",
      "designation": "Principal Engineer",
      "verticalName": "Engineering",
      "hierarchyLevel": 3,
      "manager": {
        "id": "u_manager...",
        "eid": "EID-0099",
        "name": "John Smith",
        "email": "john.smith@company.com",
        "designation": "Director of Engineering"
      }
    }
  }
  ```
* **Error Responses:**
  - `401 Unauthorized`: Missing, expired, or invalid authorization token.
  - `403 Forbidden`: Token does not possess `user.profile.read` scope.

---

### 3. Portal Audit Logs Writeback
Registers a security action, user operation, or permission access denial into the central host audit trail database.

* **Endpoint:** `POST /api/v1/audit/log`
* **Headers:**
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "action": "expense.create.denied",
    "severity": "WARN",
    "payload": {
      "reason": "Missing expense.create permission",
      "amount": 2500.00,
      "category": "Hardware"
    }
  }
  ```
  *Note: `severity` must be one of: `INFO`, `WARN`, `ERROR`, `CRITICAL`.*
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "logId": "audit_log_uuid"
  }
  ```
* **Error Responses:**
  - `401 Unauthorized`: Invalid or expired bearer token.
  - `400 Bad Request`: Missing required action string or invalid severity.
