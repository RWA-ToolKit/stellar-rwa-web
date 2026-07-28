/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jest-environment-jsdom",
  // Use a dedicated babel config so we don't interfere with Next.js's own transform.
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", { configFile: "./babel.config.jest.js" }],
  },
  moduleNameMapper: {
    // Resolve @/ imports to the project root (mirrors tsconfig paths).
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/*.test.[jt]s?(x)"],
  transformIgnorePatterns: ["/node_modules/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

module.exports = config;
