// Hand-written OpenAPI 3.0 spec for the STRAXOR core API.
// Served at /api/docs/openapi.json and rendered by Swagger UI at /api/docs.
// `servers[0].url` is "/api", so every path below is relative to /api.

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "STRAXOR API",
    version: "1.0.0",
    description:
      "STRAXOR AI coding workspace — core API surface: auth, chat, agent/team runs, GitHub repos, terminal and live preview.",
  },
  servers: [{ url: "/api" }],
  tags: [
    { name: "Health", description: "Liveness / readiness" },
    { name: "Auth", description: "Registration, login, password recovery" },
    { name: "Chat", description: "AI chat and model orchestration" },
    { name: "Agent", description: "AI agent turns and team runs" },
    { name: "Repos", description: "GitHub repo connection, diff, approve, commit, push" },
    { name: "Terminal", description: "Process execution and streaming" },
    { name: "Preview", description: "Live preview dev servers" },
    { name: "GitHub", description: "GitHub remote adapter (repos + tokens)" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT returned by POST /auth/login.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string" } },
      },
      Health: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          db: { type: "string", example: "connected" },
        },
      },
      AuthResult: {
        type: "object",
        properties: {
          token: { type: "string", description: "JWT access token" },
          user: { type: "object", properties: { id: { type: "string" }, email: { type: "string" } } },
        },
      },
      TeamTask: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: {
            type: "string",
            enum: ["QUEUED", "RUNNING", "VERIFYING", "WAITING_APPROVAL", "VERIFIED", "FAILED", "CANCELLED"],
          },
          prompt: { type: "string" },
          commitHash: { type: "string", nullable: true },
          error: { type: "string", nullable: true },
        },
      },
      TeamApproveResult: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          status: { type: "string" },
          committed: { type: "boolean" },
          hash: { type: "string" },
          pushed: { type: "boolean" },
          pushOutput: { type: "string" },
          error: { type: "string", nullable: true },
        },
      },
      RepoDiff: {
        type: "object",
        properties: {
          stat: { type: "string" },
          diff: { type: "string" },
          hash: { type: "string", description: "SHA-256 fingerprint of the diff" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check (server + database)",
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Health" } } },
          },
          "503": {
            description: "Database disconnected",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResult" } } } },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login and receive a JWT",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResult" } } } },
          "401": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request a password reset token",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } },
          },
        },
        responses: {
          "200": { description: "Accepted (token emailed or logged in dev)" },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with a token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: { token: { type: "string" }, password: { type: "string", minLength: 6 } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password updated" },
          "400": { description: "Invalid or expired token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/chat": {
      post: {
        tags: ["Chat"],
        summary: "Stream a chat completion (SSE)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: { message: { type: "string" }, model: { type: "string" }, attachments: { type: "array", items: { type: "object" } } },
              },
            },
          },
        },
        responses: {
          "200": { description: "SSE stream of assistant deltas" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/chat/route": {
      post: {
        tags: ["Chat"],
        summary: "Route a task to the best available model (difficulty-based)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string" } } } } },
        },
        responses: {
          "200": { description: "Routing decision (providerId, modelId, reason)" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/agent/send": {
      post: {
        tags: ["Agent"],
        summary: "Run an agent turn (SSE)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  message: { type: "string" },
                  machineId: { type: "string", description: "Runtime engine, e.g. local:opencode" },
                  system: { type: "string", description: "Background system prompt (not shown in chat)" },
                  attachments: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "SSE stream (delta/tool_call/tool_result/session.idle)" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/agent/background": {
      post: {
        tags: ["Agent"],
        summary: "Start a background agent job",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: { message: { type: "string" }, machineId: { type: "string" }, system: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "202": { description: "Job accepted (jobId)" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/agent/background/{jobId}": {
      get: {
        tags: ["Agent"],
        summary: "Poll a background agent job",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Job state (status, timeline, error)" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/agent/team": {
      post: {
        tags: ["Agent"],
        summary: "Start a multi-role team run (fan-out)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["prompt"],
                properties: {
                  prompt: { type: "string" },
                  machineId: { type: "string" },
                  roles: { type: "array", items: { type: "string", enum: ["coding", "testing", "security", "research", "documentation"] } },
                },
              },
            },
          },
        },
        responses: {
          "202": { description: "Task accepted (taskId)" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/agent/team/{taskId}": {
      get: {
        tags: ["Agent"],
        summary: "Poll a team task (status, per-role jobs, verification)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "taskId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Task detail", content: { "application/json": { schema: { $ref: "#/components/schemas/TeamTask" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/agent/team/{taskId}/approve": {
      post: {
        tags: ["Agent"],
        summary: "Approve a team task — commit + push (closed loop)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "taskId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  push: { type: "boolean", default: true },
                  commitMessage: { type: "string" },
                  diffHash: { type: "string", description: "Fingerprint of the diff being approved (409 if stale)" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Approved", content: { "application/json": { schema: { $ref: "#/components/schemas/TeamApproveResult" } } } },
          "400": { description: "Not in WAITING_APPROVAL", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Diff changed since shown", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/repos": {
      get: {
        tags: ["Repos"],
        summary: "List repo connections and the active repo",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Repo list" },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/repos/connect": {
      post: {
        tags: ["Repos"],
        summary: "Connect a GitHub repository",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["owner", "repo"],
                properties: { owner: { type: "string" }, repo: { type: "string" }, branch: { type: "string", default: "main" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Connected" },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/repos/diff": {
      get: {
        tags: ["Repos"],
        summary: "Get the sandbox diff + SHA-256 fingerprint",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Diff", content: { "application/json": { schema: { $ref: "#/components/schemas/RepoDiff" } } } },
          "404": { description: "No active repo", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/repos/push": {
      post: {
        tags: ["Repos"],
        summary: "Push the active repo's sandbox changes to GitHub",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Push output" },
          "401": { description: "GitHub token invalid", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/terminal/start": {
      post: {
        tags: ["Terminal"],
        summary: "Start a process",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["command"],
                properties: { command: { type: "string" }, args: { type: "array", items: { type: "string" } }, cwd: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Process started (id)" },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/terminal/{id}/stream": {
      get: {
        tags: ["Terminal"],
        summary: "Stream process stdout/stderr (SSE)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "SSE stream of stdout/stderr + exit" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/terminal/{id}/cancel": {
      post: {
        tags: ["Terminal"],
        summary: "Cancel a running process",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Cancelled" },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/preview/start": {
      post: {
        tags: ["Preview"],
        summary: "Start a live preview dev server",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { command: { type: "string" }, port: { type: "integer" }, framework: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Preview URL" },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/preview/stop": {
      post: {
        tags: ["Preview"],
        summary: "Stop the live preview server",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Stopped" },
          "404": { description: "No preview running", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/git-remote/github/repos": {
      get: {
        tags: ["GitHub"],
        summary: "List the user's GitHub repositories (paginated, incl. orgs)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Repo list" },
          "401": { description: "Invalid token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Insufficient scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
};
