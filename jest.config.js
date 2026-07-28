/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.server.json",
      },
    ],
  },
  // Give integration tests (real sockets) generous timeouts.
  testTimeout: 30_000,
  // Run test files serially to avoid port collisions.
  maxWorkers: 1,
};

module.exports = config;
