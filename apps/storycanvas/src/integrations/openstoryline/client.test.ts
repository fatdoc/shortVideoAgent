import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { OpenStorylineClient } from "./client";

let server: http.Server;
let baseUrl: string;

before(async () => {
  server = http.createServer((request, response) => {
    if (request.url === "/openapi.json") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          info: { title: "OpenStoryline Web", version: "1.0.0" },
          paths: { "/api/sessions": {} },
        }),
      );
      return;
    }

    if (request.url === "/mcp") {
      response.statusCode = 400;
      response.end("missing session");
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("reports online when both Web and MCP endpoints are reachable", async () => {
  const client = new OpenStorylineClient({
    baseUrl,
    mcpUrl: `${baseUrl}/mcp`,
    timeoutMs: 500,
  });

  const health = await client.healthCheck();

  assert.equal(health.status, "online");
  assert.equal(health.version, "1.0.0");
  assert.equal(health.components.web.status, "online");
  assert.equal(health.components.mcp.status, "online");
});

test("reports degraded without throwing when MCP is unavailable", async () => {
  const client = new OpenStorylineClient({
    baseUrl,
    mcpUrl: "http://127.0.0.1:1/mcp",
    timeoutMs: 200,
  });

  const health = await client.healthCheck();

  assert.equal(health.status, "degraded");
  assert.equal(health.components.web.status, "online");
  assert.equal(health.components.mcp.status, "offline");
});

test("reports offline without throwing when OpenStoryline is unavailable", async () => {
  const client = new OpenStorylineClient({
    baseUrl: "http://127.0.0.1:1",
    mcpUrl: "http://127.0.0.1:1/mcp",
    timeoutMs: 200,
  });

  const health = await client.healthCheck();

  assert.equal(health.status, "offline");
  assert.equal(health.components.web.status, "offline");
  assert.equal(health.components.mcp.status, "offline");
});

