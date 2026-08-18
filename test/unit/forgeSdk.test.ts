import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { ForgeClient } from "@sdk/forge-sdk";

describe("Forge SDK Frontend Client", () => {
  let originalWindow: any;
  let originalDocument: any;
  let messageCallbacks: Array<(event: any) => void> = [];

  beforeAll(() => {
    // Keep reference
    originalWindow = global.window;
    originalDocument = global.document;

    messageCallbacks = [];

    // Mock minimal DOM APIs
    global.window = {
      location: {
        origin: "http://localhost:4000",
        ancestorOrigins: [],
        reload: () => {},
      },
      addEventListener: (type: string, callback: any) => {
        if (type === "message") {
          messageCallbacks.push(callback);
        }
      },
      removeEventListener: () => {},
      parent: {
        postMessage: (message: any, targetOrigin: string) => {
          (global.window as any).lastPostedMessage = { message, targetOrigin };
        },
      },
      lastPostedMessage: null,
    } as any;

    global.document = {
      referrer: "http://localhost:3000",
      documentElement: {
        setAttribute: (name: string, value: string) => {
          (global.document as any).lastThemeAttribute = { name, value };
        },
      },
      lastThemeAttribute: null,
    } as any;
  });

  afterAll(() => {
    global.window = originalWindow;
    global.document = originalDocument;
  });

  test("Initializes correctly and determines parent origin from referrer", () => {
    const client = new ForgeClient();
    expect(client).toBeDefined();
    // parentOrigin should be retrieved from referrer
    expect((client as any).parentOrigin).toBe("http://localhost:3000");
  });

  test("notifyReady sends FORGE_APP_READY message to parent window", () => {
    const client = new ForgeClient();
    client.notifyReady();

    const lastMessage = (global.window as any).lastPostedMessage;
    expect(lastMessage).toBeDefined();
    expect(lastMessage.message).toMatchObject({ type: "FORGE_APP_READY" });
    expect(lastMessage.targetOrigin).toBe("http://localhost:3000");
  });

  test("navigateParent sends FORGE_NAVIGATE message to parent window", () => {
    const client = new ForgeClient();
    client.navigateParent("/new-path");

    const lastMessage = (global.window as any).lastPostedMessage;
    expect(lastMessage).toBeDefined();
    expect(lastMessage.message).toMatchObject({ type: "FORGE_NAVIGATE", url: "/new-path" });
    expect(lastMessage.targetOrigin).toBe("http://localhost:3000");
  });

  test("onThemeChange executes callback and updates DOM theme attribute", () => {
    const client = new ForgeClient();
    let themeChangedPayload: any = null;

    client.onThemeChange((payload) => {
      themeChangedPayload = payload;
    });

    // Simulate parent window theme change message
    const mockEvent = {
      origin: "http://localhost:3000",
      data: {
        type: "THEME_CHANGE",
        theme: "dark",
      },
    };

    messageCallbacks.forEach((cb) => cb(mockEvent));

    expect(themeChangedPayload).toMatchObject({ theme: "dark" });
    const lastTheme = (global.document as any).lastThemeAttribute;
    expect(lastTheme).toMatchObject({ name: "data-theme", value: "dark" });
  });

  test("onAuthToken executes callback with code and token payload", () => {
    const client = new ForgeClient();
    let authPayload: any = null;

    client.onAuthToken((payload) => {
      authPayload = payload;
    });

    const mockEvent = {
      origin: "http://localhost:3000",
      data: {
        type: "FORGE_AUTH_TOKEN",
        code: "auth-code-123",
        token: "access-token-456",
        user: { id: "user-1", name: "Alice" },
      },
    };

    messageCallbacks.forEach((cb) => cb(mockEvent));

    expect(authPayload).toMatchObject({
      code: "auth-code-123",
      token: "access-token-456",
      user: { id: "user-1", name: "Alice" },
    });
  });

  test("onLogout callback executes upon receiving FORGE_LOGOUT_EVENT", () => {
    const client = new ForgeClient();
    let loggedOut = false;

    client.onLogout(() => {
      loggedOut = true;
    });

    const mockEvent = {
      origin: "http://localhost:3000",
      data: {
        type: "FORGE_LOGOUT_EVENT",
      },
    };

    messageCallbacks.forEach((cb) => cb(mockEvent));

    expect(loggedOut).toBe(true);
  });
});
