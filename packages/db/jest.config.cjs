/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          moduleResolution: "Node",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  // Source files use NodeNext-style explicit `.js` extensions on relative
  // imports (required because this package is `"type": "module"`), but the
  // test transform above compiles to CommonJS. Strip the extension so
  // Jest's resolver falls back to `moduleFileExtensions` (finding the `.ts`
  // source) instead of looking for a literal `.js` file that doesn't exist.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testEnvironment: "node",
};
