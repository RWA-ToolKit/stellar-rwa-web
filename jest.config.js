module.exports = {
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^.+\\.(css|less|scss|sass)$": "identity-obj-proxy"
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/e2e/"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { "tsconfig": "tsconfig.jest.json" }]
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"]
};
