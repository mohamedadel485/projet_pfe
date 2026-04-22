import path from "path";
import dotenv from "dotenv";
import Monitor from "../models/Monitor";
import monitorService from "../services/monitorService";
import { connectDB } from "../config/database";

const envPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath, override: true });

const main = async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "Usage: ts-node src/scripts/runCheckForUrl.ts <monitor-url-or-id>",
    );
    process.exit(1);
  }

  try {
    await connectDB();

    let monitor = null as any;
    // If looks like an ObjectId (24 hex) treat as id
    if (/^[0-9a-fA-F]{24}$/.test(arg)) {
      monitor = await Monitor.findById(arg);
    } else {
      monitor = await Monitor.findOne({ url: arg });
    }

    if (!monitor) {
      console.error("Monitor introuvable pour:", arg);
      process.exit(2);
    }

    console.log("Lancement du check pour monitor:", monitor.name, monitor.url);
    const result = await monitorService.checkMonitor(monitor);
    console.log("Result:", result);
    process.exit(0);
  } catch (error) {
    console.error("Erreur:", error);
    process.exit(3);
  }
};

void main();
