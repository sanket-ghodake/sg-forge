# SG Forge Installation Guide

Follow these steps to set up and launch SG Forge on your local machine (Ubuntu, Debian, or WSL).

---

## 📋 Prerequisites

### 1. Runtimes & Tooling
* **Git:** Required to clone the repository.
* **Bun:** SG Forge uses Bun v1.2.0. If not installed, the setup script automatically fetches it.
* **Go:** Required to run the reference Go app (port 8086).
* **Python 3:** Required to run the reference Python app (port 8087).

### 2. Database (PostgreSQL)
Ensure you have a PostgreSQL instance running locally. By default, SG Forge expects:
* **Host:** `localhost:5432`
* **User:** `lifeos`
* **Password:** `change_me_db_password`
* **Database name:** `org_db`

To configure a new PostgreSQL database and user on your system, run:
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start postgres service
sudo service postgresql start

# Access prompt and configure user/database
sudo -u postgres psql -c "CREATE USER lifeos WITH PASSWORD 'change_me_db_password' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE org_db OWNER lifeos;"
```

---

## 🚀 Step-by-Step Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/sanket-ghodake/org_manager.git sgforge
cd sgforge
```

### Step 2: Configure Environment Variables
Create a `.env` file in the root directory:
```bash
echo "DATABASE_URL=postgres://lifeos:change_me_db_password@localhost:5432/org_db" > .env
```

### Step 3: Run the Setup Script
The setup script configures dependencies and runs database initializers:
```bash
bun run setup
```
*(Alternatively, run `bash scripts/setup.sh` directly)*.

### Step 4: Run Tests (Verification)
Verify that your database connection is active and the schemas seed correctly:
```bash
bun test test/
```

### Step 5: Launch the Dev Server
Launch the main portal alongside all reference micro-apps:
```bash
bun run run-dev
```
*(Alternatively, run `bash scripts/run.sh`)*.

The portal will be active at:
* **Portal UI:** `http://localhost:3001`
* **Dev Dashboard / DB Workbench:** `http://localhost:3002`

---

## 🛠 Troubleshooting Installation Issues

* **Error: `role "lifeos" does not exist`**: Ensure you ran the SQL query to create the database user.
* **Error: `port 3001 already in use`**: Another process is binding to one of the portal ports. Kill it or edit the port mappings inside `scripts/run.sh`.
