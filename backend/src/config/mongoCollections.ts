import mongoose from "mongoose";

// Import the model modules so they register in Mongoose before we check or
// create the underlying collections.
import "../models/DemandeCompte";
import "../models/Incident";
import "../models/Integration";
import "../models/Invitation";
import "../models/Maintenance";
import "../models/Moniteur";
import "../models/MonitorLog";
import "../models/StatusPage";
import "../models/Tokens";
import "../models/Utilisateur";

const getDatabase = (): NonNullable<typeof mongoose.connection.db> => {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB connection indisponible.");
  }
  return database;
};

const collectionExists = async (collectionName: string): Promise<boolean> => {
  const database = getDatabase();
  const existingCollections = await database
    .listCollections({ name: collectionName }, { nameOnly: true })
    .toArray();
  return existingCollections.length > 0;
};

export const ensureMongoCollections = async (): Promise<string[]> => {
  const createdCollections: string[] = [];

  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName);
    const collectionName = model.collection.name;

    if (await collectionExists(collectionName)) {
      continue;
    }

    await getDatabase().createCollection(collectionName);
    createdCollections.push(collectionName);
  }

  if (createdCollections.length > 0) {
    console.log(
      `Collections Mongo creees: ${createdCollections.join(", ")}`,
    );
  } else {
    console.log("Toutes les collections Mongo existent deja.");
  }

  return createdCollections;
};
