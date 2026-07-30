import axios from "axios";
import {
  openStorylineApiDocumentSchema,
  openStorylineClientConfigSchema,
  openStorylineHealthSchema,
} from "./schemas";
import { mapOpenStorylineError } from "./error-mapper";
import type { OpenStorylineClientConfig, OpenStorylineHealth } from "./types";

type ComponentHealth = OpenStorylineHealth["components"]["web"];

const DEFAULT_BASE_URL = "http://127.0.0.1:7860";
const DEFAULT_MCP_URL = "http://127.0.0.1:8001/mcp";
const DEFAULT_TIMEOUT_MS = 2_000;

export class OpenStorylineClient {
  private readonly config: OpenStorylineClientConfig;

  constructor(config: Partial<OpenStorylineClientConfig> = {}) {
    this.config = openStorylineClientConfigSchema.parse({
      baseUrl: config.baseUrl ?? process.env.OPENSTORYLINE_BASE_URL ?? DEFAULT_BASE_URL,
      mcpUrl: config.mcpUrl ?? process.env.OPENSTORYLINE_MCP_URL ?? DEFAULT_MCP_URL,
      timeoutMs:
        config.timeoutMs ??
        parseTimeout(process.env.OPENSTORYLINE_TIMEOUT_MS) ??
        DEFAULT_TIMEOUT_MS,
    });
  }

  async healthCheck(): Promise<OpenStorylineHealth> {
    const startedAt = Date.now();
    const [web, mcp] = await Promise.all([this.probeWeb(), this.probeMcp()]);
    const reachableComponents = [web.health, mcp].filter(
      (component) => component.status === "online",
    ).length;

    const status =
      reachableComponents === 2 ? "online" : reachableComponents === 1 ? "degraded" : "offline";

    return openStorylineHealthSchema.parse({
      service: "openstoryline",
      status,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      version: web.version,
      components: {
        web: web.health,
        mcp,
      },
    });
  }

  private async probeWeb(): Promise<{ health: ComponentHealth; version?: string }> {
    const startedAt = Date.now();
    try {
      const response = await axios.get(`${this.config.baseUrl}/openapi.json`, {
        timeout: this.config.timeoutMs,
      });
      const document = openStorylineApiDocumentSchema.parse(response.data);
      const hasSessionApi = Object.prototype.hasOwnProperty.call(document.paths, "/api/sessions");

      if (!hasSessionApi) {
        return {
          health: {
            status: "offline",
            latencyMs: Date.now() - startedAt,
            detail: "required session API is missing",
          },
        };
      }

      return {
        health: {
          status: "online",
          latencyMs: Date.now() - startedAt,
        },
        version: document.info.version,
      };
    } catch (error: unknown) {
      return {
        health: {
          status: "offline",
          latencyMs: Date.now() - startedAt,
          detail: mapOpenStorylineError(error),
        },
      };
    }
  }

  private async probeMcp(): Promise<ComponentHealth> {
    const startedAt = Date.now();
    try {
      await axios.get(this.config.mcpUrl, {
        timeout: this.config.timeoutMs,
        headers: {
          Accept: "application/json, text/event-stream",
        },
        validateStatus: (status) => status < 500,
      });

      return {
        status: "online",
        latencyMs: Date.now() - startedAt,
      };
    } catch (error: unknown) {
      return {
        status: "offline",
        latencyMs: Date.now() - startedAt,
        detail: mapOpenStorylineError(error),
      };
    }
  }
}

function parseTimeout(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

