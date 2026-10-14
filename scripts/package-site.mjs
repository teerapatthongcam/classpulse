import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
const files = ["index.html", "teacher.html", "student.html", "styles.css", "config.js", "supabase.js", "app.js", "login.js", "dashboard.js", "teacher.js", "student.js"];
await mkdir(output, { recursive: true });
for (const file of files) await copyFile(path.join(root, file), path.join(output, file));
console.log(`Prepared ${files.length} public application files in dist/. No SQL, tests or private files copied.`);
