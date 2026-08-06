const { execSync } = require("child_process");

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const file = input.tool_input && input.tool_input.file_path;
    if (file && /\.(ts|tsx)$/.test(file)) {
      execSync(`npx eslint --fix "${file}"`, { stdio: "inherit" });
    }
  } catch {
    // never block the tool call on lint failures
  }
});
