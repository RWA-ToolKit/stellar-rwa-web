/** Babel config used exclusively by Jest (not the Next.js build). */
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic" }],
    ["@babel/preset-typescript"],
  ],
};
