import {
  assertCanvasWorkspaceAuthorityMatchesRequest,
  parseCanvasWorkspaceAuthorityRequestV01,
  parseCanvasWorkspaceAuthorityV01,
  type CanvasWorkspaceAuthorityRequestV01,
  type CanvasWorkspaceAuthorityV01,
} from "@/contracts/canvas-v1/workspaceMaterialization";

const PATH = "/api/v1/internal/canvas-workspace-authorities";

export type CanvasWorkspaceAuthorityFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export class CanvasWorkspaceAuthorityClientError extends Error {
  constructor(
    public readonly code:
      | "CANVAS_WORKSPACE_AUTHORITY_CONFIGURATION_INVALID"
      | "CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE"
      | "CANVAS_WORKSPACE_AUTHORITY_INVALID_RESPONSE",
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super("Canvas workspace authority is unavailable.");
    this.name = "CanvasWorkspaceAuthorityClientError";
  }
}

export interface ControlCanvasWorkspaceAuthorityClientOptions {
  controlApiBaseUrl: string;
  internalToken: string;
  fetch?: CanvasWorkspaceAuthorityFetch;
}

function validBaseUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") return null;
    if (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) return null;
    return parsed;
  } catch {
    return null;
  }
}

export class ControlCanvasWorkspaceAuthorityClient {
  private readonly baseUrl: URL;
  private readonly fetchImpl: CanvasWorkspaceAuthorityFetch;

  constructor(private readonly options: ControlCanvasWorkspaceAuthorityClientOptions) {
    const baseUrl = validBaseUrl(options.controlApiBaseUrl);
    if (!baseUrl || Buffer.byteLength(options.internalToken, "utf8") < 32) {
      throw new CanvasWorkspaceAuthorityClientError(
        "CANVAS_WORKSPACE_AUTHORITY_CONFIGURATION_INVALID",
        503,
        false,
      );
    }
    this.baseUrl = baseUrl;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async fetch(rawRequest: CanvasWorkspaceAuthorityRequestV01): Promise<CanvasWorkspaceAuthorityV01> {
    let request: CanvasWorkspaceAuthorityRequestV01;
    try {
      request = parseCanvasWorkspaceAuthorityRequestV01(rawRequest);
    } catch {
      throw new CanvasWorkspaceAuthorityClientError(
        "CANVAS_WORKSPACE_AUTHORITY_INVALID_RESPONSE",
        422,
        false,
      );
    }
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(PATH, this.baseUrl).toString(), {
        method: "POST",
        headers: {
          accept: "application/json",
          "cache-control": "no-store",
          "content-type": "application/json",
          "x-production-plane-internal-token": this.options.internalToken,
          "x-request-id": request.requestId,
        },
        body: JSON.stringify(request),
      });
    } catch {
      throw new CanvasWorkspaceAuthorityClientError(
        "CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE",
        503,
        true,
      );
    }
    if (!response.ok) {
      throw new CanvasWorkspaceAuthorityClientError(
        response.status === 503
          ? "CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE"
          : "CANVAS_WORKSPACE_AUTHORITY_INVALID_RESPONSE",
        response.status,
        response.status === 503,
      );
    }
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new CanvasWorkspaceAuthorityClientError(
        "CANVAS_WORKSPACE_AUTHORITY_INVALID_RESPONSE",
        502,
        false,
      );
    }
    try {
      const parsed = parseCanvasWorkspaceAuthorityV01(await response.json());
      assertCanvasWorkspaceAuthorityMatchesRequest(parsed, request);
      return parsed;
    } catch {
      throw new CanvasWorkspaceAuthorityClientError(
        "CANVAS_WORKSPACE_AUTHORITY_INVALID_RESPONSE",
        502,
        false,
      );
    }
  }
}
