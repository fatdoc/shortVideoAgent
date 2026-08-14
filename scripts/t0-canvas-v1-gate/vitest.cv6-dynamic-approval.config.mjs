export default {
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      "tests/e2e/canvas-v1/dynamic-approval.gate.test.tsx",
      "tests/e2e/canvas-v1/ui-contract.gate.test.tsx",
      "src/features/canvas-v1/hooks/useCanvasCommandApprovalFlow.test.tsx",
      "src/features/canvas-v1/pages/CanvasV1Page.test.tsx",
    ],
    setupFiles: ["src/tests/setup.ts"],
  },
};
