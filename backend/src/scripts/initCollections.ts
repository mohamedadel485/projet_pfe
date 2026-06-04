import path from "path";
import dotenv from "dotenv";
import { connectDB, disconnectDB } from "../config/database";
import { ensureMongoCollections } from "../config/mongoCollections";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath, override: true });

const initCollections = async (): Promise<void> => {
  await connectDB();

  try {
    await ensureMongoCollections();
  } finally {
    await disconnectDB();
  }
};

if (require.main === module) {
  void initCollections().catch((error) => {
    console.error("Erreur lors de l'initialisation des collections Mongo:", error);
    process.exit(1);
  });
}
