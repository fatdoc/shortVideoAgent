export default {
  test: {
    environment: "jsdom",
    include: [
      "src/features/canvas-v1/model/workspaceContract.test.ts",
      "tests/e2e/canvas-v1/workspace-hydration.gate.test.tsx",
    ],
    setupFiles: ["src/tests/setup.ts"],
  },
};
