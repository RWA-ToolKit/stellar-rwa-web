import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Points to the root of the Next.js app
  dir: "./",
});

const config: Config = {
  testEnvironment: "jest-environment-jsdom",

  // Resolve @/* path aliases used throughout the codebase
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  // TypeScript support via ts-jest
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },

  // Run jest-dom matchers after each test framework initialisation
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

export default createJestConfig(config);
