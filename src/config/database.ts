import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uptime-monitor';
    
    await mongoose.connect(mongoURI);
    
    console.log('✅ MongoDB connecté avec succès');
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur MongoDB:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB déconnecté');
    });
    
  } catch (error) {
    console.error('❌ Erreur de connexion à MongoDB:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB déconnecté');
  } catch (error) {
    console.error('Erreur lors de la déconnexion de MongoDB:', error);
  }
};
