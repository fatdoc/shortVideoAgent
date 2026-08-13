export default {
  test: {
    environment: "node",
    include: [
      "tests/e2e/canvas-v1/control-materialization.gate.test.ts",
      "tests/e2e/canvas-v1/control-materialization-postgres.gate.test.ts",
    ],
    clearMocks: true,
    restoreMocks: true,
    fileParallelism: false,
    maxWorkers: 1,
  },
};
