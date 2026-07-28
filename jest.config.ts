import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  // run @testing-library/jest-dom matchers in every test file
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // resolve @/* path alias (mirrors tsconfig.json paths)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // stub CSS/image imports so they don't break the transformer
    "\\.(css|scss|sass)$": "<rootDir>/__mocks__/styleMock.js",
    "\\.(png|jpg|jpeg|gif|svg|webp)$": "<rootDir>/__mocks__/fileMock.js",
  },
  transform: {
    "^.+\\.(t|j)sx?$": "babel-jest",
  },
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};

export default config;
