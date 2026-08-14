export default {
  test: {
    environment: "jsdom",
    include: ["tests/e2e/canvas-v1/ui-contract.gate.test.tsx"],
    setupFiles: ["src/tests/setup.ts"],
  },
};
