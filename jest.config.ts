import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Tells next/jest where your Next.js app lives (for loading next.config.mjs
  // and .env files during tests).
  dir: "./",
});

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Support the @/* path alias from tsconfig.json
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Only collect coverage from source files, not tests or generated code
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
};

export default createJestConfig(config);
