# SG Forge Portal - System Guide and User Manual

This document details the features, components, and developer guides for the high-performance SG Forge Organization Portal.

---

## 🌐 1. Interactive Semantic Org Canvas

The Org Canvas replaces static organizational tables with a fluid, infinite-canvas style workspace.

### Viewport Navigation
- **Panning**: Click and drag anywhere on the workspace background grid.
- **Zooming**: Scroll the mouse wheel up (to zoom in) or down (to zoom out). Alternatively, use the `＋` and `－` buttons in the upper-left console.
- **Reset View**: Click the `Reset` button to reset pan to (0, 0) and zoom level to 100%.

### Semantic Zoom States
The viewport automatically transitions its rendering style based on the current zoom level:
1. **Macro View (Zoom < 80%)**: Summarizes the company into Bento-Box layouts representing departments (verticals). It displays vertical names, total member counts, and a scrollable list of employee summaries.
2. **Meso View (80% - 140% Zoom)**: Displays manager clusters. Employees are shown as medium-sized cards displaying names and designations, linked to their managers via dynamic SVG paths.
3. **Micro View (Zoom >= 140%)**: Reveals detailed employee profile cards:
   - Initial-based custom-gradient avatar.
   - Glimmering active status indicator.
   - EID, Designation, Name, and Department fields.

### "Where Am I?" Feature
- Located in the bottom-right corner as a floating target action button.
- Clicking the button resolves the currently logged-in user, pans/zooms the canvas to focus on their profile card, highlights their node, and traces their direct reporting line up to the CEO (Super Admin). Other node linkages fade to a low opacity for clear visual tracking.

---

## 🔒 2. First-Time Login Onboarding Flow

If an administrator creates an account, or if a user has not updated their password (`is_password_changed` is false), the middleware automatically intercepts and forces them to complete the onboarding wizard.

### Step-by-Step Wizard
1. **Welcome Greeting**: Greets the employee by name and displays their unique corporate EID.
2. **Identity Verification**: Prompts the user to enter the temporary shared password (`password123`) provided by HR.
3. **Password Creation Engine**:
   - Validates password entropy and strength rules in real-time.
   - Required parameters: 8+ characters, uppercase, lowercase, number/special character.
   - **Visual Border Indicator**: The input field border transitions from a warning-amber tint to a brand-accent green once strength criteria are met.
   - Shows a multi-color segmented progress bar mapping password complexity.
4. **Celebration Transition**: Displays a glowing success animation, updates the cookie session, and fades out the modal to reveal the dashboard (no secondary login required).

---

## 🛠️ 3. Admin Ingestion & Validation Drawer

Allows administrators to perform batch employee provisioning and maintain business structure metadata.

### Bulk Ingestion CSV Ingestion
1. **Upload Zone**: Drag and drop a CSV file, or click to open a file selector.
2. **CSV Syntax Specification**:
   ```csv
   EID,Name,Email,Role,Designation,Vertical,ManagerEID
   E0011,Jack Ryan,jack@sgforge.com,user,Senior Engineer,Engineering,E0005
   ```
3. **Validation Drawer**:
   - **Raw String editor (Left Panel)**: Shows the raw text data uploaded.
   - **Visual Audit Grid (Right Panel)**: Validates each row in real-time. Displays validation checks (EID regex check, email formatting, designation existence).
   - **Inline Correction**: Admin can double-click or type in any cell (EID, Name, Email, Designation) to fix invalid records directly in the browser. The audit grid recalculates errors on input.
   - **Commit**: The "Commit to Database" button activates once all rows are valid. The backend parses designations/verticals, inserts them into metadata if missing, maps managers by EID, and updates or inserts users.

### Metadata configurator
- Allows creating/removing Verticals and Job Levels (Designations).
- Permits nesting verticals under parent departments.
- Provides reordering controls to adjust sort order rankings (shifting levels up/down).

---

## 💻 4. SQL Workbench IDE Studio

A dark-themed database console for real-time diagnostics and structural maintenance.

### Schema Tree (Left Panel)
- Lists core tables: `users`, `structural_metadata`, and `system_logs`.
- Displays column datatypes and database indexes.
- Includes a live progress bar tracking capacity (e.g. tracking `system_logs` counts against the 100,000 rolling cap).

### Query Console (Right Panel)
- **Editor**: Supports custom PostgreSQL statement entry.
- **SQL Syntax Highlighting**: A real-time overlay highlights key SQL syntax terms (`SELECT`, `FROM`, `WHERE`, `JOIN`, etc.) in blue/green.
- **Role Safeguard Simulation**: Allows testing query safeguards. For example, changing simulation mode to `read_only_admin` prevents mutating statements (`INSERT`, `UPDATE`, `DROP`) from running.
- **Data Grid Results**: Streams output records into a dense grid layout with sticky headers and scrollable pagination.

---

## ⌨️ 5. Keyboard Omni-Search (`Cmd + K` / `Ctrl + K`)

Pressing `Cmd + K` or `Ctrl + K` displays a global command palette:
- **Navigation Shortcuts**: Instantly switches between tabs (Canvas, Admin Panel, SQL Workbench).
- **Settings Shifts**: Switches color themes (Light, Dark, Cyberpunk) and view densities.
- **Employee Search**: Search employees by EID or Name. Selecting an employee closes the palette, navigates to the Org Canvas, and pans/zooms to focus on their card.

---

## 📱 6. Mobile Wi-Fi Testing Guide

You can test the entire enterprise portal end-to-end on a mobile device on the same local Wi-Fi network.

### Step 1: Resolve the Host IP
When Next.js runs, it binds to all interfaces and lists the local network IP:
- **Local Network Address**: `http://192.168.1.11:3001` (Check your terminal startup logs for the exact IP).

### Step 2: Configure Host Firewall
Ensure the host machine allows incoming TCP traffic on port `3001`. On Linux (Ubuntu/Debian):
- Check status: `sudo ufw status`
- Allow port: `sudo ufw allow 3001/tcp`
- (Or temporarily disable ufw: `sudo ufw disable`)

### Step 3: Connect Mobile Device
1. Connect your phone or tablet to the **same Wi-Fi network** as the host.
2. Open a mobile browser (Chrome, Safari, Firefox).
3. Navigate to `http://192.168.1.11:3001` (Replace with your resolved host IP).

### Step 4: Perform Mobile Actions
Because session cookies are stored securely using browser-level domain cookies, the entire portal works identically on mobile:
- Complete the onboarding password reset.
- Pinch-to-zoom and drag-to-pan the Org Canvas.
- Open search via the search toggle and find employee cards.
- View table layouts and run SQL queries.
