# WSL Environment

Windows Subsystem for Linux (WSL/WSL2) is fully supported. Follow this guide to resolve services, networking, and system parameters specific to WSL.

---

## 🛠 Prerequisites for WSL

1.  **WSL2**: Ensure you are running WSL2. Verify in Windows PowerShell:
    ```powershell
    wsl --list --verbose
    ```
2.  **Linux Distribution**: Ubuntu (20.04 LTS or higher) is recommended.
3.  **Docker Desktop Integration**: Ensure Docker Desktop has "WSL 2 integration" enabled for your specific distribution inside settings.

---

## 🗄 Postgres Service in WSL (For Portable Execution)

Unlike standard Linux environments, WSL does not always start background services on boot.

### 1. Start the service manually
Start PostgreSQL before running your local setup:
```bash
sudo service postgresql start
```

### 2. Enable systemd (Recommended)
Configure WSL to support systemd, which automatically manages services. Add the following to `/etc/wsl.conf` inside your WSL terminal:
```ini
[boot]
systemd=true
```
After saving the file, restart WSL from Windows PowerShell:
```powershell
wsl --shutdown
```
Upon launching WSL again, you can manage postgres using standard systemctl commands:
```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

---

## 🌐 Networking & Browser Connection (Windows to WSL)

### 1. Localhost Port Forwarding
WSL2 forwards active ports to your Windows host by default. You can open your browser on Windows and go directly to `http://localhost:3001` or `http://localhost:3002`.

### 2. Troubleshooting Connection Gaps
If port forwarding fails, locate your WSL IP address:
```bash
ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'
```
Use this IP address directly inside your Windows browser (e.g., `http://<wsl-ip>:3001`).
