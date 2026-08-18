"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface MetadataItem {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export default function DeveloperPortalPage() {
  // Theme state
  const [theme, setTheme] = useState("default");
  const [_font, setFont] = useState("default");

  // Sidebar & Column Resize States
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [leftColumnWidth, setLeftColumnWidth] = useState(550);
  const [previewHeight, setPreviewHeight] = useState(300);

  // Active view states
  const [activeWorkspace, setActiveWorkspace] = useState<"creator" | "documentation">("creator");
  const [manifestTab, setManifestTab] = useState<"basic" | "routing" | "security" | "hierarchy">(
    "basic",
  );
  const [boilerplateLang, setBoilerplateLang] = useState<
    "react" | "nextjs" | "nodejs" | "fastapi" | "python" | "go" | "rust" | "bun"
  >("react");
  const [docTab, setDocTab] = useState<
    "handshake" | "exchange" | "user" | "permissions" | "audit" | "postmessage"
  >("handshake");

  // Real-time hierarchy/metadata from database
  const [verticals, setVerticals] = useState<MetadataItem[]>([]);
  const [designations, setDesignations] = useState<MetadataItem[]>([]);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [metaError, setMetaError] = useState("");

  // Developer form state for Forge App Manifest
  const [appSlug, setAppSlug] = useState("custom-expenses-app");
  const [appName, setAppName] = useState("Enterprise Expenses Tracker");
  const [appDesc, setAppDesc] = useState(
    "Track department expenses against budget limits and hierarchical approvals.",
  );
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [appIcon, setAppIcon] = useState("Briefcase");

  const [routingMode, setRoutingMode] = useState<"iframe" | "local">("iframe");
  const [entryPoint, setEntryPoint] = useState("http://localhost:4000");
  const [redirectUri, setRedirectUri] = useState("http://localhost:4000/callback");

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const [requiresIsolatedSchema, setRequiresIsolatedSchema] = useState(false);
  const [schemaName, setSchemaName] = useState("");

  const [selectedScopes, setSelectedScopes] = useState<string[]>(["user.profile.read"]);
  const [targetVerticals, setTargetVerticals] = useState<string[]>([]);
  const [targetDesignations, setTargetDesignations] = useState<string[]>([]);
  const [minJobLevel, setMinJobLevel] = useState<number>(1);

  // Custom UI dropdown open states
  const [iconDropdownOpen, setIconDropdownOpen] = useState(false);
  const [routingDropdownOpen, setRoutingDropdownOpen] = useState(false);
  const [_scopesDropdownOpen, _setScopesDropdownOpen] = useState(false);
  const [_verticalsDropdownOpen, _setVerticalsDropdownOpen] = useState(false);
  const [_designationsDropdownOpen, _setDesignationsDropdownOpen] = useState(false);

  // Action states
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Ref pointers for resizing
  const _containerRef = useRef<HTMLDivElement>(null);
  const sidebarResizeRef = useRef<HTMLDivElement>(null);
  const colResizeRef = useRef<HTMLDivElement>(null);
  const splitResizeRef = useRef<HTMLDivElement>(null);

  // Load theme and metadata on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "default";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    const savedFont = localStorage.getItem("font") || "default";
    setFont(savedFont);
    document.documentElement.setAttribute("data-font", savedFont);

    fetchMetadata();
    generateCredentials();

    // Real-time automatic background polling if main app or hierarchy configuration changes
    const pollInterval = setInterval(() => {
      fetchMetadata();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Sync schema name to slug if isolated is enabled
  useEffect(() => {
    if (requiresIsolatedSchema && !schemaName) {
      setSchemaName(`${appSlug.replace(/[^a-zA-Z0-9_]/g, "_")}_schema`);
    }
  }, [requiresIsolatedSchema, appSlug, schemaName]);

  async function fetchMetadata() {
    setIsMetadataLoading(true);
    setMetaError("");
    try {
      const res = await fetch("/api/admin/metadata");
      if (!res.ok) throw new Error("Failed to retrieve organizational schema");
      const data = await res.json();

      const rawMeta: MetadataItem[] = data.metadata || [];
      const verts = rawMeta.filter((m) => m.type === "vertical");
      const desigs = rawMeta.filter(
        (m) => m.type === "job_level" || m.type === "designation" || m.type === "role",
      );

      setVerticals(verts);
      setDesignations(desigs);
    } catch (err: any) {
      console.error(err);
      setMetaError(err.message || "Error fetching metadata");
    } finally {
      setIsMetadataLoading(false);
    }
  }

  function generateCredentials() {
    setClientId(`client_${Math.random().toString(36).substring(2, 15)}`);
    setClientSecret(
      `secret_${Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("")}`,
    );
  }

  // Draggable Column/Sidebar resizing handlers
  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX;
      if (deltaX > 150 && deltaX < 400) {
        setSidebarWidth(deltaX);
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleColumnMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftColumnWidth;
    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;
      if (newWidth > 350 && newWidth < 900) {
        setLeftColumnWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = previewHeight;
    const handleMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = startHeight + deltaY;
      if (newHeight > 150 && newHeight < 600) {
        setPreviewHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Compile app.json in real time
  const manifestJSON = {
    id: appSlug,
    slug: appSlug,
    name: appName,
    description: appDesc,
    version: appVersion,
    icon: appIcon,
    entryPoint: routingMode === "local" ? `src/apps/${appSlug}/index.tsx` : entryPoint,
    entryUrl: routingMode === "local" ? `src/apps/${appSlug}/index.tsx` : entryPoint,
    routingMode: routingMode,
    clientId: clientId || undefined,
    clientSecret: clientSecret || undefined,
    redirectUri: redirectUri || undefined,
    requiredBasePermissions: selectedScopes,
    scopes: selectedScopes,
    database: requiresIsolatedSchema
      ? {
          requiresIsolatedSchema: true,
          schemaName: schemaName,
        }
      : undefined,
    targetRules: {
      verticals: targetVerticals.length > 0 ? targetVerticals : undefined,
      designations: targetDesignations.length > 0 ? targetDesignations : undefined,
      minJobLevel: minJobLevel > 1 ? minJobLevel : undefined,
    },
  };

  const manifestString = JSON.stringify(manifestJSON, null, 2);

  // Scope definitions helper
  const availableScopes = [
    { value: "user.profile.read", label: "user.profile.read — View basic profile structure" },
    { value: "user.profile.write", label: "user.profile.write — Modify account profile values" },
    { value: "audit.log.write", label: "audit.log.write — Stream audit telemetry logs" },
    {
      value: "org.hierarchy.read",
      label: "org.hierarchy.read — Inspect organizational tree structure",
    },
    {
      value: "org.context.read",
      label: "org.context.read — Fetch vertical hierarchy scope context",
    },
  ];

  const handleScopeToggle = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const handleVerticalToggle = (id: string) => {
    if (targetVerticals.includes(id)) {
      setTargetVerticals(targetVerticals.filter((v) => v !== id));
    } else {
      setTargetVerticals([...targetVerticals, id]);
    }
  };

  const handleDesignationToggle = (id: string) => {
    if (targetDesignations.includes(id)) {
      setTargetDesignations(targetDesignations.filter((d) => d !== id));
    } else {
      setTargetDesignations([...targetDesignations, id]);
    }
  };

  // Generate Boilerplate Codes based on selection
  const getBoilerplateCode = () => {
    switch (boilerplateLang) {
      case "react":
        return `/**
 * SG Forge Iframe App Boilerplate (React TypeScript)
 * Place this file inside your frontend SPA structure.
 */
import React, { useEffect, useState } from 'react';
import { ForgeClient } from '@sdk/forge-sdk'; // Or copy client postMessage wrapper

export function ForgeAppContainer() {
  const [theme, setTheme] = useState('default');
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  useEffect(() => {
    // 1. Initialize the postMessage Client Handshake
    const client = new ForgeClient();
    
    // 2. Register layout theme synchronization listener
    const unsubscribe = client.onThemeChange((payload) => {
      setTheme(payload.theme);
      console.log('Synchronized platform layout theme:', payload.theme);
    });

    // 3. Listen to authorization handshake from parent
    const handleHandshake = (event: MessageEvent) => {
      // Validate secure origin matching workspace domain
      if (event.origin !== window.location.origin) return;
      
      const { data } = event;
      if (data && data.type === 'FORGE_AUTH_TOKEN') {
        setAuthToken(data.code || data.token);
        console.log('Received auth handshake code from SG Forge');
        
        // Notify parent that iframe environment is ready
        client.notifyReady();
      }
    };
    
    window.addEventListener('message', handleHandshake);

    return () => {
      unsubscribe();
      window.removeEventListener('message', handleHandshake);
    };
  }, []);

  return (
    <div style={{ padding: '24px', borderRadius: '16px', background: 'var(--surface-card)', color: 'var(--text-primary)' }}>
      <h3>🚀 {appName}</h3>
      <p>{appDesc}</p>
      <div style={{ marginTop: '16px', fontSize: '11px', fontFamily: 'monospace' }}>
        <p>Active Layout Theme: {theme}</p>
        <p>Handshake Token: {authToken ? '✓ Acquired (Ready to Exchange)' : '⚡ Waiting...'}</p>
      </div>
    </div>
  );
}`;
      case "nextjs":
        return `/**
 * SG Forge Iframe App Boilerplate (Next.js 16 App Router)
 * Place this file inside your app directory (e.g. app/forge-callback/page.tsx).
 */
'use client';

import React, { useEffect, useState } from 'react';
import { ForgeClient } from '@sdk/forge-sdk';

export default function ForgeCallback() {
  const [theme, setTheme] = useState('default');
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const client = new ForgeClient();
    
    const unsubscribe = client.onThemeChange((payload) => {
      setTheme(payload.theme);
    });

    const handleHandshake = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const { data } = event;
      if (data && data.type === 'FORGE_AUTH_TOKEN') {
        setAuthToken(data.code || data.token);
        client.notifyReady();
      }
    };
    
    window.addEventListener('message', handleHandshake);
    return () => {
      unsubscribe();
      window.removeEventListener('message', handleHandshake);
    };
  }, []);

  return (
    <div className="p-6 bg-card text-card-foreground rounded-2xl border">
      <h3 className="text-lg font-bold">🚀 ${appName} (Next.js Client)</h3>
      <p className="text-sm opacity-80">${appDesc}</p>
      <div className="mt-4 p-3 bg-muted rounded-xl font-mono text-xs space-y-1">
        <p>Theme: {theme}</p>
        <p>Token Status: {authToken ? '✓ Acquired' : '⚡ Handshake Pending...'}</p>
      </div>
    </div>
  );
}`;
      case "nodejs":
        return `/**
 * SG Forge Backend Handshake Handler (Node.js / Express)
 * This handles the OAuth2-like authentication flow.
 */
const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const PLATFORM_URL = 'http://localhost:3000'; // Target core portal URL
const CLIENT_ID = '${clientId || "your-client-id"}';
const CLIENT_SECRET = '${clientSecret || "your-client-secret"}';

// Endpoint loaded inside iframe (e.g. /callback?code=TEMP_CODE)
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing temporary authorization code.');
  }

  try {
    // 1. Exchange temporary code for secure user access token
    const exchangeRes = await fetch(\`\${PLATFORM_URL}/api/v1/auth/exchange\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    });

    if (!exchangeRes.ok) {
      throw new Error('Failed to exchange authorization token.');
    }

    const sessionPayload = await exchangeRes.json();
    const accessToken = sessionPayload.access_token;
    
    // 2. Use user token to retrieve profile containing designation, vertical & manager upline
    const userProfileRes = await fetch(\`\${PLATFORM_URL}/api/v1/user\`, {
      headers: { 'Authorization': \`Bearer \${accessToken}\` }
    });
    const userProfile = await userProfileRes.json();

    // 3. Establish your application local cookie session
    // req.session.userId = userProfile.user.id;
    // req.session.role = userProfile.user.role;
    
    res.send(\`<h1>Handshake Success</h1><p>Welcome, \${userProfile.user.name} (\${userProfile.user.designation})</p>\`);
  } catch (err) {
    res.status(500).send(\`Authentication failed: \${err.message}\`);
  }
});

app.listen(4000, () => console.log('App listening on port 4000'));`;
      case "fastapi":
        return `'''
SG Forge Handshake Client (Python / FastAPI)
'''
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI(title="${appName} API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PLATFORM_URL = "http://localhost:3000"
CLIENT_ID = "${clientId || "your-client-id"}"
CLIENT_SECRET = "${clientSecret || "your-client-secret"}"

@app.get("/callback")
async def oauth_callback(code: str = Query(...)):
    # 1. Exchange temporary code for secure user access token
    async with httpx.AsyncClient() as client:
        exchange_payload = {
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET
        }
        res = await client.post(f"{PLATFORM_URL}/api/v1/auth/exchange", json=exchange_payload)
        if res.status_code != 200:
            raise HTTPException(status_code=401, detail=f"Token exchange failed: {res.text}")
        
        token_data = res.json()
        access_token = token_data.get("access_token")
        
        # 2. Retrieve user profile
        headers = {"Authorization": f"Bearer {access_token}"}
        user_res = await client.get(f"{PLATFORM_URL}/api/v1/user", headers=headers)
        if user_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user profile")
            
        return {
            "status": "authenticated",
            "session": token_data.get("user"),
            "extended_profile": user_res.json()
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4000)`;
      case "python":
        return `'''
SG Forge Handshake Client (Python / Flask)
'''
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

PLATFORM_URL = 'http://localhost:3000'
CLIENT_ID = '${clientId || "your-client-id"}'
CLIENT_SECRET = '${clientSecret || "your-client-secret"}'

@app.route('/callback', methods=['GET'])
def oauth_callback():
    code = request.args.get('code')
    if not code:
        return "Missing authorization code", 400

    # 1. Exchange token
    payload = {
        'code': code,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }
    r = requests.post(f"{PLATFORM_URL}/api/v1/auth/exchange", json=payload)
    if r.status_code != 200:
        return f"Exchange failed: {r.text}", 401
    
    token_data = r.json()
    access_token = token_data.get('access_token')

    # 2. Get user info (contains structural designation details)
    headers = {'Authorization': f"Bearer {access_token}"}
    u = requests.get(f"{PLATFORM_URL}/api/v1/user", headers=headers)
    
    return jsonify({
        "status": "authenticated",
        "session": token_data.get('user'),
        "extended_profile": u.json()
    })

if __name__ == '__main__':
    app.run(port=4000, debug=True)`;
      case "go":
        return `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

const PlatformURL = "http://localhost:3000"
const ClientID = "${clientId || "your-client-id"}"
const ClientSecret = "${clientSecret || "your-client-secret"}"

type ExchangeRequest struct {
	Code         string \`json:"code"\`
	ClientID     string \`json:"client_id"\`
	ClientSecret string \`json:"client_secret"\`
}

func main() {
	http.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Missing code param", http.StatusBadRequest)
			return
		}

		// 1. Prepare token exchange request payload
		payload := ExchangeRequest{
			Code:         code,
			ClientID:     ClientID,
			ClientSecret: ClientSecret,
		}
		jsonBytes, _ := json.Marshal(payload)

		resp, err := http.Post(PlatformURL+"/api/v1/auth/exchange", "application/json", bytes.NewBuffer(jsonBytes))
		if err != nil || resp.StatusCode != http.StatusOK {
			http.Error(w, "Token exchange connection failure", http.StatusUnauthorized)
			return
		}
		defer resp.Body.Close()

		var exchangeResult map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&exchangeResult)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(exchangeResult)
	})

	fmt.Println("Server running at :4000")
	http.ListenAndServe(":4000", nil)
}`;
      case "rust":
        return `// SG Forge Handshake API (Rust Axum & Reqwest)
// Cargo.toml dependencies: axum, tokio, reqwest, serde, serde_json

use axum::{
    extract::Query,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

const PLATFORM_URL: &str = "http://localhost:3000";
const CLIENT_ID: &str = "${clientId || "your-client-id"}";
const CLIENT_SECRET: &str = "${clientSecret || "your-client-secret"}";

#[derive(Deserialize)]
struct CallbackParams {
    code: String,
}

#[derive(Serialize)]
struct ExchangeRequest {
    code: String,
    client_id: String,
    client_secret: String,
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/callback", get(callback_handler));
    let addr = SocketAddr::from(([0, 0, 0, 0], 4000));
    println!("Rust microservice listening on http://{}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn callback_handler(Query(params): Query<CallbackParams>) -> Result<Json<serde_json::Value>, String> {
    let client = reqwest::Client::new();
    
    // 1. Exchange temporary authorization code
    let exchange_payload = ExchangeRequest {
        code: params.code,
        client_id: CLIENT_ID.to_string(),
        client_secret: CLIENT_SECRET.to_string(),
    };

    let token_res = client
        .post(format!("{}/api/v1/auth/exchange", PLATFORM_URL))
        .json(&exchange_payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !token_res.status().is_success() {
        return Err("Token exchange failed".to_string());
    }

    let token_data: serde_json::Value = token_res.json().await.map_err(|e| e.to_string())?;
    let access_token = token_data["access_token"].as_str().ok_or("No access token found")?;

    // 2. Fetch authenticated user profile
    let profile_res = client
        .get(format!("{}/api/v1/user", PLATFORM_URL))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let profile_data: serde_json::Value = profile_res.json().await.map_err(|e| e.to_string())?;

    Ok(Json(serde_json::json!({
        "status": "authenticated",
        "session": token_data["user"],
        "extended_profile": profile_data
    })))
}`;
      case "bun":
        return `/**
 * SG Forge Backend Handshake (Bun HTTP Server)
 * Run with: bun run index.ts
 */
const PLATFORM_URL = 'http://localhost:3000';
const CLIENT_ID = '${clientId || "your-client-id"}';
const CLIENT_SECRET = '${clientSecret || "your-client-secret"}';

Bun.serve({
  port: 4000,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing code parameter', { status: 400 });
      }

      try {
        // 1. Exchange oauth authorization code
        const exchangeRes = await fetch(\`\${PLATFORM_URL}/api/v1/auth/exchange\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
          })
        });

        if (!exchangeRes.ok) {
          return new Response('Failed to exchange code', { status: 401 });
        }

        const tokenData = await exchangeRes.json();
        const accessToken = tokenData.access_token;

        // 2. Fetch profile context
        const userRes = await fetch(\`\${PLATFORM_URL}/api/v1/user\`, {
          headers: { Authorization: \`Bearer \${accessToken}\` }
        });
        const userProfile = await userRes.json();

        return Response.json({
          status: 'authenticated',
          session: tokenData.user,
          extended_profile: userProfile
        });
      } catch (err: any) {
        return new Response('Error: ' + err.message, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
});

console.log('Bun microservice listening on port 4000...');`;
    }
  };

  // Trigger registration to server disk (/src/apps) and sync to DB
  const handleSaveToLocal = async () => {
    setSaveLoading(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: manifestString,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveStatus({
          message: `Success: App manifest saved under "/src/apps/${appSlug}" and registered!`,
          type: "success",
        });
      } else {
        setSaveStatus({
          message: `Error: ${data.error || "Failed to sync app manifest"}`,
          type: "error",
        });
      }
    } catch (err: any) {
      setSaveStatus({ message: `Network error: ${err.message}`, type: "error" });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([manifestString], { type: "application/json" });
    element.href = URL.createObjectURL(file);
    element.download = "app.json";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  return (
    <div className="flex flex-col h-screen bg-background-portal text-text-primary overflow-hidden font-sans">
      {/* ─── HEADER BAR ─── */}
      <header className="h-16 border-b border-border-accent bg-surface-card/65 backdrop-blur-md flex items-center justify-between px-6 z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2.5 rounded-xl bg-gradient-to-tr from-[#6366f1] to-[#34d399] text-white font-black text-sm tracking-wider shadow-lg shadow-[#6366f1]/25 hover:opacity-90"
          >
            SG
          </Link>
          <span className="text-text-tertiary">/</span>
          <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-text-primary via-text-primary to-[#6366f1] bg-clip-text text-transparent whitespace-nowrap">
            DevCenter Portal
          </span>
          <span className="text-[9px] bg-brand-muted border border-brand-accent/20 px-2 py-0.5 rounded-full text-brand-accent uppercase font-black tracking-wider">
            Workspace SDK v1
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Main workspace selector */}
          <div className="flex rounded-xl bg-background-portal p-1 border border-border-accent">
            <button
              onClick={() => setActiveWorkspace("creator")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeWorkspace === "creator"
                  ? "bg-surface-elevated text-text-primary shadow"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              App Builder
            </button>
            <button
              onClick={() => setActiveWorkspace("documentation")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeWorkspace === "documentation"
                  ? "bg-surface-elevated text-text-primary shadow"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              API Reference
            </button>
          </div>

          {/* Base Layout Themes Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                const themes = ["default", "light", "dark", "solarized-dark", "solarized-light"];
                const nextT = themes[(themes.indexOf(theme) + 1) % themes.length];
                setTheme(nextT);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-surface-card border border-border-accent text-xs font-bold text-text-primary hover:bg-surface-elevated transition-all flex items-center gap-2 cursor-pointer"
              title="Cycle Theme"
            >
              <span>
                {theme === "light"
                  ? "☀️"
                  : theme === "solarized-dark"
                    ? "🕶️"
                    : theme === "solarized-light"
                      ? "📄"
                      : theme === "dark"
                        ? "🌙"
                        : "✨"}
              </span>
              <span className="capitalize text-text-secondary hidden sm:inline">
                {theme.replace("-", " ")}
              </span>
            </button>
          </div>

          <Link
            href="/"
            className="px-4 py-1.5 bg-brand-accent hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-accent/20 transition-all flex items-center gap-1.5"
          >
            Exit DevCenter
          </Link>
        </div>
      </header>

      {/* ─── SPA MAIN AREA (Unified split layout) ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* RESIZABLE SIDEBAR (Optional local directory mapping) */}
        <aside
          style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
          className="relative bg-sidebar-bg border-r border-border-accent flex flex-col h-full overflow-hidden flex-shrink-0 transition-all"
        >
          <div className="w-full h-full flex flex-col p-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-accent">
              <span className="text-[10px] text-text-tertiary uppercase font-black tracking-widest">
                Local Files Matrix
              </span>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="text-text-secondary hover:text-text-primary text-xs"
              >
                ◀
              </button>
            </div>

            <div className="flex-1 py-4 space-y-4 overflow-y-auto">
              <div>
                <p className="text-[11px] font-bold text-text-secondary flex items-center gap-1.5 mb-2">
                  <span>📂</span> src/apps/
                </p>
                <ul className="pl-4 space-y-2 text-xs">
                  <li className="text-brand-accent font-mono flex items-center gap-1.5 cursor-pointer">
                    <span>📁</span> {appSlug}/
                  </li>
                  <li className="text-text-tertiary pl-4 font-mono flex items-center gap-1.5">
                    <span>📄</span> app.json
                  </li>
                  <li className="text-text-tertiary pl-4 font-mono flex items-center gap-1.5">
                    <span>📄</span> index.tsx
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-[11px] font-bold text-text-secondary flex items-center gap-1.5 mb-2">
                  <span>📂</span> src/sdk/
                </p>
                <ul className="pl-4 space-y-1.5 text-xs">
                  <li className="text-text-secondary font-mono flex items-center gap-1.5">
                    <span>📄</span> forge-sdk.ts
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-surface-card/30 rounded-xl border border-border-accent/40 space-y-2">
                <span className="text-[9px] text-[#34d399] font-black uppercase tracking-wider block">
                  Sandbox Status
                </span>
                <p className="text-[10px] text-text-secondary">
                  Apps inside /src/apps/ are loaded inside iframes by core system dynamically.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar Resizer Handle */}
          <div
            ref={sidebarResizeRef}
            onMouseDown={handleSidebarMouseDown}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-accent/40 transition-colors z-20"
          />
        </aside>

        {/* Collapsed sidebar trigger overlay */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-surface-elevated hover:bg-brand-accent border-r border-t border-b border-border-accent p-2 rounded-r-xl z-20 shadow-md text-xs"
          >
            ▶
          </button>
        )}

        {/* MAIN SPLIT CONTAINERS */}
        {activeWorkspace === "creator" ? (
          <div className="flex-1 flex overflow-hidden">
            {/* WORKSPACE COLUMN (resizable form inputs) */}
            <div
              style={{ width: leftColumnWidth }}
              className="relative border-r border-border-accent bg-surface-card/25 flex flex-col h-full flex-shrink-0 overflow-hidden"
            >
              {/* Creator sub-tabs */}
              <div className="flex border-b border-border-accent bg-surface-card/50 flex-shrink-0">
                {[
                  { id: "basic", label: "Basic Info", icon: "📝" },
                  { id: "routing", label: "Routing", icon: "🌐" },
                  { id: "security", label: "Security & Scopes", icon: "🔑" },
                  { id: "hierarchy", label: "Target Hierarchy", icon: "🪢" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setManifestTab(t.id as any)}
                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                      manifestTab === t.id
                        ? "border-brand-accent text-brand-accent bg-brand-muted/20 font-black"
                        : "border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-elevated/20"
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span className="hidden md:inline">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Form viewport */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. BASIC INFORMATION TAB */}
                {manifestTab === "basic" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <h3 className="text-sm font-black text-text-primary">Manifest Metadata</h3>
                      <p className="text-[11px] text-text-secondary">
                        Core application tags stored inside registry matrix.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                          Unique App Slug *
                        </label>
                        <input
                          type="text"
                          value={appSlug}
                          onChange={(e) =>
                            setAppSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                          }
                          className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary font-mono focus:border-brand-accent focus:outline-none"
                          placeholder="e.g. expenses-tracker"
                          required
                        />
                        <p className="text-[9px] text-text-tertiary mt-0.5">
                          Alphanumeric, dashes, or underscores only. Used as folder and endpoint
                          path name.
                        </p>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                          Application Display Name *
                        </label>
                        <input
                          type="text"
                          value={appName}
                          onChange={(e) => setAppName(e.target.value)}
                          className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary font-bold focus:border-brand-accent focus:outline-none"
                          placeholder="e.g. Finance Hub"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                          Description
                        </label>
                        <textarea
                          value={appDesc}
                          onChange={(e) => setAppDesc(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary focus:border-brand-accent focus:outline-none resize-none"
                          placeholder="What does this app do?"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                            App Version
                          </label>
                          <input
                            type="text"
                            value={appVersion}
                            onChange={(e) => setAppVersion(e.target.value)}
                            className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary focus:border-brand-accent focus:outline-none"
                            placeholder="1.0.0"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                            Icon Emoji / Name
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIconDropdownOpen(!iconDropdownOpen)}
                              className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary text-left flex justify-between items-center"
                            >
                              <span className="flex items-center gap-1.5">
                                <span>
                                  {appIcon === "Users"
                                    ? "👥"
                                    : appIcon === "CreditCard"
                                      ? "💳"
                                      : appIcon === "Briefcase"
                                        ? "💼"
                                        : appIcon === "Activity"
                                          ? "📈"
                                          : "📦"}
                                </span>
                                <span>{appIcon}</span>
                              </span>
                              <span>▼</span>
                            </button>
                            {iconDropdownOpen && (
                              <div className="absolute top-10 left-0 right-0 bg-surface-elevated border border-border-accent rounded-xl shadow-2xl p-1 z-30 space-y-1">
                                {[
                                  { name: "Briefcase", icon: "💼" },
                                  { name: "Users", icon: "👥" },
                                  { name: "CreditCard", icon: "💳" },
                                  { name: "Activity", icon: "📈" },
                                  { name: "Box", icon: "📦" },
                                ].map((item) => (
                                  <button
                                    key={item.name}
                                    type="button"
                                    onClick={() => {
                                      setAppIcon(item.name);
                                      setIconDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-bold text-left rounded-lg text-text-primary hover:bg-surface-card flex items-center gap-2"
                                  >
                                    <span>{item.icon}</span>
                                    <span>{item.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ROUTING & LIFECYCLE TAB */}
                {manifestTab === "routing" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <h3 className="text-sm font-black text-text-primary">
                        Iframe Container Routing
                      </h3>
                      <p className="text-[11px] text-text-secondary">
                        Determine how standard iframe loads this microfrontend.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                          Routing Mode
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setRoutingDropdownOpen(!routingDropdownOpen)}
                            className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary text-left flex justify-between items-center font-bold"
                          >
                            <span>
                              {routingMode === "iframe"
                                ? "Iframe Mode (External Port/Subdomain)"
                                : "Local Standalone Component"}
                            </span>
                            <span>▼</span>
                          </button>
                          {routingDropdownOpen && (
                            <div className="absolute top-10 left-0 right-0 bg-surface-elevated border border-border-accent rounded-xl shadow-2xl p-1 z-30">
                              <button
                                type="button"
                                onClick={() => {
                                  setRoutingMode("iframe");
                                  setRoutingDropdownOpen(false);
                                }}
                                className="w-full px-3 py-2 text-xs font-bold text-left rounded-lg text-text-primary hover:bg-surface-card"
                              >
                                Iframe Mode (External Host / Docker)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRoutingMode("local");
                                  setRoutingDropdownOpen(false);
                                }}
                                className="w-full px-3 py-2 text-xs font-bold text-left rounded-lg text-text-primary hover:bg-surface-card"
                              >
                                Local Component (React SPA Integration)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {routingMode === "iframe" ? (
                        <>
                          <div>
                            <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                              Entry Point URL *
                            </label>
                            <input
                              type="url"
                              value={entryPoint}
                              onChange={(e) => setEntryPoint(e.target.value)}
                              className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary font-mono focus:border-brand-accent focus:outline-none"
                              placeholder="http://localhost:4000"
                              required
                            />
                            <p className="text-[9px] text-text-tertiary mt-0.5">
                              Where the client application code is running.
                            </p>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                              OAuth Callback / Redirect URI
                            </label>
                            <input
                              type="text"
                              value={redirectUri}
                              onChange={(e) => setRedirectUri(e.target.value)}
                              className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary font-mono focus:border-brand-accent focus:outline-none"
                              placeholder="http://localhost:4000/callback"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="p-4.5 bg-brand-muted/20 border border-brand-accent/20 rounded-xl space-y-2">
                          <span className="text-xs font-black text-brand-accent block">
                            Local Component Binding
                          </span>
                          <p className="text-[11px] text-text-secondary">
                            The platform will dynamically import:{" "}
                            <code className="font-mono text-text-primary bg-background-portal px-1 py-0.5 rounded">
                              src/apps/{appSlug}/index.tsx
                            </code>
                            .
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. SECURITY CREDENTIALS & SCOPES TAB */}
                {manifestTab === "security" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <h3 className="text-sm font-black text-text-primary">
                        Credentials & Data Sandboxing
                      </h3>
                      <p className="text-[11px] text-text-secondary">
                        Secure keys for backend handshake and client scopes.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Oauth details */}
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                              Client ID
                            </label>
                            <button
                              type="button"
                              onClick={generateCredentials}
                              className="text-[9px] font-bold text-brand-accent hover:underline"
                            >
                              Regenerate Keys
                            </button>
                          </div>
                          <input
                            type="text"
                            value={clientId}
                            readOnly
                            className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-tertiary font-mono focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                            Client Secret
                          </label>
                          <input
                            type="password"
                            value={clientSecret}
                            readOnly
                            className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-tertiary font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Isolated db schema */}
                      <div className="p-4 bg-surface-card border border-border-accent rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-text-primary block">
                              Database Isolation Schema
                            </span>
                            <span className="text-[10px] text-text-secondary">
                              Provision a dedicated schema namespace.
                            </span>
                          </div>
                          {/* Premium toggle button */}
                          <button
                            type="button"
                            onClick={() => setRequiresIsolatedSchema(!requiresIsolatedSchema)}
                            className={`relative w-11 h-6 rounded-full transition-all focus:outline-none ${
                              requiresIsolatedSchema ? "bg-brand-accent" : "bg-input-border"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-all transform ${
                                requiresIsolatedSchema ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {requiresIsolatedSchema && (
                          <div className="space-y-2 mt-2 pt-2 border-t border-border-accent/40 animate-fadeIn">
                            <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                              Schema Namespace Name
                            </label>
                            <input
                              type="text"
                              value={schemaName}
                              onChange={(e) =>
                                setSchemaName(
                                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                                )
                              }
                              className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary font-mono focus:border-brand-accent focus:outline-none"
                              placeholder="e.g. expenses_schema"
                            />
                            <p className="text-[9px] text-text-tertiary">
                              A separate namespace will be initialized in PostgreSQL upon
                              registration.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Scopes checklist */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-secondary block mb-1 uppercase tracking-wider">
                          Base Scopes & Permissions
                        </label>
                        <div className="border border-border-accent rounded-xl overflow-hidden bg-surface-card/40 p-2.5 space-y-2">
                          {availableScopes.map((scope) => (
                            <label
                              key={scope.value}
                              className="flex items-start gap-2.5 text-xs text-text-primary cursor-pointer hover:bg-surface-elevated/30 p-1.5 rounded-lg transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedScopes.includes(scope.value)}
                                onChange={() => handleScopeToggle(scope.value)}
                                className="mt-0.5 accent-brand-accent rounded"
                              />
                              <span className="font-mono text-[11px] leading-tight">
                                {scope.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. TARGET HIERARCHY MATRIX RULES TAB */}
                {manifestTab === "hierarchy" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-black text-text-primary">
                          Organizational Visibility Filters
                        </h3>
                        <p className="text-[11px] text-text-secondary">
                          Configure access boundaries based on enterprise metadata variables.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={fetchMetadata}
                        disabled={isMetadataLoading}
                        className="px-2.5 py-1.5 bg-surface-elevated hover:bg-brand-accent/20 border border-border-accent hover:border-brand-accent/40 rounded-xl text-[9px] font-black text-text-secondary hover:text-text-primary transition-all uppercase tracking-wider"
                      >
                        {isMetadataLoading ? "Reloading..." : "🔄 Sync Context"}
                      </button>
                    </div>

                    {metaError && (
                      <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-[11px]">
                        ⚠️ {metaError}
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Verticals checklist */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-text-secondary block uppercase tracking-wider">
                          Business Verticals (Departments)
                        </label>
                        <div className="border border-border-accent rounded-xl bg-surface-card/40 p-3 max-h-[160px] overflow-y-auto space-y-1.5">
                          {verticals.length > 0 ? (
                            verticals.map((v) => (
                              <label
                                key={v.id}
                                className="flex items-center gap-2 text-xs text-text-primary cursor-pointer hover:bg-surface-elevated/40 p-1.5 rounded-lg"
                              >
                                <input
                                  type="checkbox"
                                  checked={targetVerticals.includes(v.id)}
                                  onChange={() => handleVerticalToggle(v.id)}
                                  className="accent-brand-accent rounded"
                                />
                                <span>{v.name}</span>
                              </label>
                            ))
                          ) : (
                            <p className="text-[10px] text-text-tertiary italic">
                              No vertical metadata registered. Configure in Main Panel first.
                            </p>
                          )}
                        </div>
                        <p className="text-[9px] text-text-tertiary">
                          If none checked, default applies to all verticals.
                        </p>
                      </div>

                      {/* Designations checklist */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-text-secondary block uppercase tracking-wider">
                          Designations / Levels
                        </label>
                        <div className="border border-border-accent rounded-xl bg-surface-card/40 p-3 max-h-[160px] overflow-y-auto space-y-1.5">
                          {designations.length > 0 ? (
                            designations.map((d) => (
                              <label
                                key={d.id}
                                className="flex items-center gap-2 text-xs text-text-primary cursor-pointer hover:bg-surface-elevated/40 p-1.5 rounded-lg"
                              >
                                <input
                                  type="checkbox"
                                  checked={targetDesignations.includes(d.id)}
                                  onChange={() => handleDesignationToggle(d.id)}
                                  className="accent-brand-accent rounded"
                                />
                                <span>
                                  {d.name}{" "}
                                  <span className="text-[9px] text-text-tertiary">({d.type})</span>
                                </span>
                              </label>
                            ))
                          ) : (
                            <p className="text-[10px] text-text-tertiary italic">
                              No designation metadata registered.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Minimum Job level */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold text-text-secondary block uppercase tracking-wider">
                            Minimum Hierarchy Level
                          </label>
                          <span className="text-[11px] font-mono font-bold text-brand-accent">
                            Level {minJobLevel}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={minJobLevel}
                          onChange={(e) => setMinJobLevel(parseInt(e.target.value, 10))}
                          className="w-full accent-brand-accent"
                        />
                        <div className="flex justify-between text-[8px] text-text-tertiary px-1 font-bold">
                          <span>1 (Staff)</span>
                          <span>2 (Senior)</span>
                          <span>3 (Manager)</span>
                          <span>4 (VP / CFO)</span>
                          <span>5 (CEO)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action bar at the bottom */}
              <div className="p-4 border-t border-border-accent bg-surface-card/60 space-y-3 flex-shrink-0 z-10">
                {saveStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold font-mono animate-fadeIn ${
                      saveStatus.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    }`}
                  >
                    {saveStatus.message}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSaveToLocal}
                    disabled={saveLoading}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-brand-accent to-indigo-500 hover:from-brand-hover hover:to-indigo-600 text-white text-xs font-black rounded-xl shadow-lg shadow-brand-accent/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    {saveLoading ? "Registering..." : "💾 Save & Register App"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-4 py-2.5 bg-surface-elevated hover:bg-surface-card border border-border-accent hover:border-brand-accent/40 text-text-primary text-xs font-bold rounded-xl transition-all"
                    title="Download app.json"
                  >
                    📥 Download JSON
                  </button>
                </div>
              </div>
            </div>

            {/* Split Resizer Handle */}
            <div
              ref={colResizeRef}
              onMouseDown={handleColumnMouseDown}
              className="w-1 cursor-col-resize hover:bg-brand-accent/40 transition-colors z-20"
            />

            {/* PREVIEW & DOCUMENTATION COLUMN (Right side) */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-portal">
              {/* Top Block: Real-time manifest viewer */}
              <div
                style={{ height: previewHeight }}
                className="relative border-b border-border-accent flex flex-col overflow-hidden bg-black/10 flex-shrink-0"
              >
                <div className="px-5 py-3 border-b border-border-accent/80 bg-surface-card/30 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand-accent animate-pulse"></span>
                    <span className="text-[10px] text-text-secondary uppercase font-black tracking-widest">
                      Live Compiler Output
                    </span>
                    <span className="text-[9px] font-mono text-text-tertiary">app.json</span>
                  </div>

                  <button
                    onClick={() => copyToClipboard(manifestString)}
                    className="px-2.5 py-1 bg-surface-elevated hover:bg-surface-card border border-border-accent rounded-lg text-[10px] font-bold text-text-primary transition-all"
                  >
                    Copy JSON
                  </button>
                </div>

                <div className="flex-1 p-4 overflow-auto font-mono text-[11px] leading-relaxed text-brand-accent bg-background-portal">
                  <pre className="whitespace-pre-wrap">{manifestString}</pre>
                </div>
              </div>

              {/* Split Height Resizer Handle */}
              <div
                ref={splitResizeRef}
                onMouseDown={handleSplitMouseDown}
                className="h-1 cursor-row-resize hover:bg-brand-accent/40 transition-colors z-20 flex-shrink-0"
              />

              {/* Bottom Block: Boilerplate Codes & Dev Docs */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex border-b border-border-accent bg-surface-card/40 flex-shrink-0 overflow-x-auto scrollbar-thin">
                  {[
                    { id: "react", label: "React SDK" },
                    { id: "nextjs", label: "Next.js 16" },
                    { id: "nodejs", label: "Node.js Express" },
                    { id: "fastapi", label: "FastAPI" },
                    { id: "python", label: "Python Flask" },
                    { id: "go", label: "Go API" },
                    { id: "rust", label: "Rust Axum" },
                    { id: "bun", label: "Bun server" },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => setBoilerplateLang(lang.id as any)}
                      className={`px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                        boilerplateLang === lang.id
                          ? "border-brand-accent text-brand-accent bg-[#818cf8]/5 font-black"
                          : "border-transparent text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                  <div className="flex-1 flex justify-end items-center pr-3">
                    <button
                      onClick={() => copyToClipboard(getBoilerplateCode())}
                      className="px-2.5 py-1 bg-surface-elevated hover:bg-surface-card border border-border-accent rounded-lg text-[10px] font-bold text-text-primary transition-all"
                    >
                      Copy Code
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-auto font-mono text-[11px] leading-relaxed bg-background-portal border-t border-border-accent">
                  <pre className="whitespace-pre-wrap text-text-secondary">
                    {getBoilerplateCode()}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* DOCUMENTATION VIEW */
          <div className="flex-1 flex overflow-hidden">
            {/* DOCS SUB-NAV (Left Pane) */}
            <aside className="w-56 border-r border-border-accent bg-sidebar-bg flex flex-col flex-shrink-0 overflow-y-auto">
              <nav className="p-3 space-y-1">
                <span className="text-[9px] text-text-tertiary font-black uppercase tracking-widest px-3 block mb-2">
                  Auth Flows
                </span>
                {[
                  { id: "handshake", label: "1. App Handshake", icon: "🤝" },
                  { id: "exchange", label: "2. Exchange Token", icon: "🔑" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDocTab(item.id as any)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
                      docTab === item.id
                        ? "bg-sidebar-active text-sidebar-text-active shadow-sm font-black"
                        : "text-sidebar-text hover:bg-sidebar-hover"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}

                <div className="pt-4 pb-2">
                  <span className="text-[9px] text-text-tertiary font-black uppercase tracking-widest px-3 block">
                    REST Client APIs
                  </span>
                </div>
                {[
                  { id: "user", label: "Retrieve Profile", icon: "👤" },
                  { id: "permissions", label: "Read Permissions", icon: "🔐" },
                  { id: "audit", label: "Submit Audit Log", icon: "📜" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDocTab(item.id as any)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
                      docTab === item.id
                        ? "bg-sidebar-active text-sidebar-text-active shadow-sm font-black"
                        : "text-sidebar-text hover:bg-sidebar-hover"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}

                <div className="pt-4 pb-2">
                  <span className="text-[9px] text-text-tertiary font-black uppercase tracking-widest px-3 block">
                    Frontend Client SDK
                  </span>
                </div>
                {[{ id: "postmessage", label: "postMessage Lifecycle", icon: "📬" }].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDocTab(item.id as any)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
                      docTab === item.id
                        ? "bg-sidebar-active text-sidebar-text-active shadow-sm font-black"
                        : "text-sidebar-text hover:bg-sidebar-hover"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            {/* DOCS TEXT VIEW (Right Pane) */}
            <main className="flex-1 overflow-y-auto p-8 space-y-8 bg-surface-card/10">
              {/* tab handshake */}
              {docTab === "handshake" && (
                <div className="max-w-3xl space-y-6 animate-fadeIn">
                  <div>
                    <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
                      <span>🤝</span> Iframe Loading & Handshake Protocol
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">
                      Understanding how the core platform starts your extension.
                    </p>
                  </div>

                  <div className="p-4.5 bg-surface-card border border-border-accent rounded-xl space-y-3 text-xs leading-relaxed">
                    <p>
                      When an authorized employee opens your Forge app in their portal, the platform
                      generates a sandboxed iframe pointing to your app's `entryUrl` and appends a
                      temporary token:
                    </p>
                    <code className="block bg-background-portal p-3 rounded-lg text-brand-accent font-mono">
                      https://your-app-domain.com/callback?code=AUTH_HANDSHAKE_CODE
                    </code>
                    <p>
                      Additionally, the parent window sends a secure postMessage payload containing
                      client parameters directly to the iframe window origin upon loading.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs font-black uppercase tracking-wider text-text-secondary">
                      Expected Handshake Flow
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 bg-surface-card rounded-xl border border-border-accent">
                        <span className="font-bold text-brand-accent block mb-1">
                          1. Mount Iframe
                        </span>
                        <p className="text-text-secondary">
                          Platform loads app URL with short-lived OAuth handshake token appended in
                          the query parameters.
                        </p>
                      </div>
                      <div className="p-4 bg-surface-card rounded-xl border border-border-accent">
                        <span className="font-bold text-brand-accent block mb-1">
                          2. Exchange Code
                        </span>
                        <p className="text-text-secondary">
                          Your backend grabs the code and POSTs it along with Client Secret to
                          exchange it for a session access token.
                        </p>
                      </div>
                      <div className="p-4 bg-surface-card rounded-xl border border-border-accent">
                        <span className="font-bold text-brand-accent block mb-1">
                          3. Establish Session
                        </span>
                        <p className="text-text-secondary">
                          Verify user details and save a local application cookie. Send the
                          FORGE_APP_READY notification.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* tab exchange */}
              {docTab === "exchange" && (
                <div className="max-w-3xl space-y-6 animate-fadeIn">
                  <div>
                    <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
                      <span>🔑</span> Token Exchange Endpoint
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">
                      Exchange your handshake code for an access token.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="border border-border-accent rounded-xl overflow-hidden">
                      <div className="bg-surface-elevated px-4 py-2 border-b border-border-accent flex items-center justify-between text-xs">
                        <span className="font-bold text-success">POST</span>
                        <span className="font-mono text-text-tertiary">/api/v1/auth/exchange</span>
                      </div>
                      <div className="p-4 bg-background-portal font-mono text-[11px] space-y-4">
                        <div>
                          <p className="text-text-tertiary mb-1">{/* Request Body */}</p>
                          <pre className="text-text-secondary">{`{
  "code": "AUTH_HANDSHAKE_CODE",
  "client_id": "${clientId || "your-client-id"}",
  "client_secret": "${clientSecret || "your-client-secret"}"
}`}</pre>
                        </div>
                        <div className="border-t border-border-accent/40 pt-4">
                          <p className="text-[#34d399] mb-1">
                            {/* Successful Response (200 OK) */}
                          </p>
                          <pre className="text-text-secondary">{`{
  "access_token": "forge_access_tok_34ef239dfc829e",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "u0000000-0000-0000-0000-000000000021",
    "eid": "E0412",
    "name": "Sarah Connor",
    "email": "sconnor@cyberdyne.corp",
    "role": "admin"
  },
  "scopes": ["user.profile.read"]
}`}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* tab user */}
              {docTab === "user" && (
                <div className="max-w-3xl space-y-6 animate-fadeIn">
                  <div>
                    <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
                      <span>👤</span> Retrieve User Profile API
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">
                      Get comprehensive metadata boundaries regarding the current user.
                    </p>
                  </div>

                  <div className="border border-border-accent rounded-xl overflow-hidden">
                    <div className="bg-surface-elevated px-4 py-2 border-b border-border-accent flex items-center justify-between text-xs">
                      <span className="font-bold text-info">GET</span>
                      <span className="font-mono text-text-tertiary">/api/v1/user</span>
                    </div>
                    <div className="p-4 bg-background-portal font-mono text-[11px] space-y-4">
                      <div>
                        <p className="text-text-tertiary mb-1">{/* Request Headers */}</p>
                        <pre className="text-text-secondary">{`Authorization: Bearer forge_access_tok_34ef239dfc829e`}</pre>
                      </div>
                      <div className="border-t border-border-accent/40 pt-4">
                        <p className="text-text-tertiary mb-1">{/* Response (200 OK) */}</p>
                        <pre className="text-text-secondary">{`{
  "user": {
    "id": "u0000000-0000-0000-0000-000000000021",
    "eid": "E0412",
    "name": "Sarah Connor",
    "email": "sconnor@cyberdyne.corp",
    "role": "admin",
    "designation": "Security Lead",
    "verticalName": "Risk Management",
    "hierarchyLevel": 3,
    "manager": {
      "id": "u0000000-0000-0000-0000-000000000002",
      "eid": "E0002",
      "name": "John Dyson",
      "email": "jdyson@cyberdyne.corp",
      "designation": "Director of Security Engineering"
    }
  }
}`}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* tab permissions */}
              {docTab === "permissions" && (
                <div className="max-w-3xl space-y-6 animate-fadeIn">
                  <div>
                    <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
                      <span>🔐</span> Retrieve User Permissions API
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">
                      Evaluate specific functional permissions inside the RBAC system.
                    </p>
                  </div>

                  <div className="border border-border-accent rounded-xl overflow-hidden">
                    <div className="bg-surface-elevated px-4 py-2 border-b border-border-accent flex items-center justify-between text-xs">
                      <span className="font-bold text-info">GET</span>
                      <span className="font-mono text-text-tertiary">/api/v1/permissions</span>
                    </div>
                    <div className="p-4 bg-background-portal font-mono text-[11px] space-y-4">
                      <div>
                        <p className="text-text-tertiary mb-1">{/* Response (200 OK) */}</p>
                        <pre className="text-text-secondary">{`{
  "permissions": [
    "user:read",
    "expenses:approve",
    "reports:view"
  ],
  "scopes": [
    "user.profile.read"
  ]
}`}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* tab audit */}
              {docTab === "audit" && (
                <div className="max-w-3xl space-y-6 animate-fadeIn">
                  <div>
                    <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
                      <span>📜</span> Write Audit Telemetry Logs
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">
                      Submit app event logs back to core platform's audit registry.
                    </p>
                  </div>

                  <div className="border border-border-accent rounded-xl overflow-hidden">
                    <div className="bg-surface-elevated px-4 py-2 border-b border-border-accent flex items-center justify-between text-xs">
                      <span className="font-bold text-success">POST</span>
                      <span className="font-mono text-text-tertiary">/api/v1/audit/log</span>
                    </div>
                    <div className="p-4 bg-background-portal font-mono text-[11px] space-y-4">
                      <div>
                        <p className="text-text-tertiary mb-1">{/* Request Body */}</p>
                        <pre className="text-text-secondary">{`{
  "action": "Expense Report Approved",
  "severity": "INFO",
  "payload": {
    "reportId": "rep_78af231a",
    "amount": 1450.00,
    "currency": "USD",
    "department": "Engineering"
  }
}`}</pre>
                      </div>
                      <div className="border-t border-border-accent/40 pt-4">
                        <p className="text-text-tertiary mb-1">{/* Response (200 OK) */}</p>
                        <pre className="text-text-secondary">{`{
  "success": true,
  "logId": "log_a8f9024f-cd2b-4af6-bb4d-efef0129a28b"
}`}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* tab postmessage */}
              {docTab === "postmessage" && (
                <div className="max-w-3xl space-y-6 animate-fadeIn">
                  <div>
                    <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
                      <span>📬</span> postMessage Lifecycle Events
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">
                      Bi-directional message passing between parent portal and child iframe.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-surface-card border border-border-accent rounded-xl space-y-2.5 text-xs">
                      <span className="font-bold text-text-primary block">
                        1. Layout Theme Changes (`THEME_CHANGE`)
                      </span>
                      <p className="text-text-secondary leading-relaxed">
                        The parent portal triggers a postMessage when the visual theme cycles. Your
                        application should subscribe to sync local CSS attributes.
                      </p>
                      <pre className="bg-background-portal p-3 rounded-lg text-text-secondary font-mono leading-normal">{`window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const { data } = event;
  if (data && data.type === 'THEME_CHANGE') {
    document.documentElement.setAttribute('data-theme', data.theme);
  }
});`}</pre>
                    </div>

                    <div className="p-4 bg-surface-card border border-border-accent rounded-xl space-y-2.5 text-xs">
                      <span className="font-bold text-text-primary block">
                        2. Navigation Dispatcher (`FORGE_NAVIGATE`)
                      </span>
                      <p className="text-text-secondary leading-relaxed">
                        Ask the parent portal to redirect the active window browser address to a
                        separate route.
                      </p>
                      <pre className="bg-background-portal p-3 rounded-lg text-text-secondary font-mono leading-normal">{`window.parent.postMessage({
  type: 'FORGE_NAVIGATE',
  url: '/settings'
}, window.location.origin);`}</pre>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
