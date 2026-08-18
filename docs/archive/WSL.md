# SG Forge WSL Setup Guide

Windows Subsystem for Linux (WSL/WSL2) is fully supported by SG Forge. Follow this guide to resolve networking, service, and path issues specific to running inside a WSL environment.

---

## 🛠 Prerequisites for WSL
1. **WSL2:** Ensure you are running WSL2. Check in Windows PowerShell:
   ```powershell
   wsl --list --verbose
   ```
   If version is `1`, upgrade it to `2` to enable modern virtualization features and performance.
2. **Distribution:** Ubuntu (20.04 or 22.04 LTS) is recommended.

---

## 🗄 PostgreSQL Service in WSL

Unlike standard Linux machines, WSL does not always start system services automatically on boot.

### 1. Starting the Service
Start PostgreSQL manually before launching the setup:
```bash
sudo service postgresql start
```
Check if it is running:
```bash
sudo service postgresql status
```

### 2. Enabling Systemd (Recommended)
You can configure WSL to support standard systemd services, allowing automatic boot configurations. Create or edit `/etc/wsl.conf` in your WSL terminal:
```ini
[boot]
systemd=true
```
After editing, shut down WSL from Windows PowerShell (`wsl --shutdown`) and restart it. You can now use:
```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

---

## 🌐 Networking & Host Access (Windows to WSL)

### 1. Standard localhost forwarding
WSL2 automatically forwards ports bound inside Linux to your Windows host. You can open `http://localhost:3001` in your Windows browser to interact with the Next.js Portal.

### 2. Troubleshooting "Cannot connect" / IP Bindings
If localhost forwarding fails, locate your WSL IP address:
```bash
ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'
```
Use this IP address to connect from your Windows browser (e.g. `http://<wsl_ip>:3001`).

*Note:* Ensure Windows Defender Firewall allows ports `3001`, `3002`, `8085`, `8086`, and `8087` if you plan to access them from other machines on your local intranet.
