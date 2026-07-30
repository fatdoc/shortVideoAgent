import axios from "axios";

export function mapOpenStorylineError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return "request timed out";
    }

    if (error.response) {
      return `upstream returned HTTP ${error.response.status}`;
    }

    return error.code ? `connection failed (${error.code})` : "connection failed";
  }

  return error instanceof Error ? error.message : "unknown upstream error";
}

