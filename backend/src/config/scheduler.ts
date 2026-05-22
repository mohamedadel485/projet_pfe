import cron from 'node-cron';
import monitorService from '../services/monitorService';
import Invitation from '../models/Invitation';

/**
 * Lance le scheduler pour vérifier les monitors à intervalle régulier
 */
export const startMonitorScheduler = (): void => {
  // Vérifier tous les monitors toutes les minutes
  cron.schedule('* * * * *', async () => {
    console.log('🔍 Démarrage de la vérification des monitors...');
    await monitorService.checkAllMonitors();
  });

  console.log('✅ Scheduler de monitoring démarré (vérification chaque minute)');
};

/**
 * Nettoie les invitations expirées (pending/expired)
 */
const cleanupExpiredInvitations = async (): Promise<void> => {
  try {
    const result = await Invitation.deleteMany({
      status: { $in: ['pending', 'expired'] },
      expiresAt: { $lte: new Date() },
    });

    if (result.deletedCount > 0) {
      console.log(`🧹 Nettoyage: ${result.deletedCount} invitation(s) expirée(s) supprimée(s)`);
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage des invitations:', error);
  }
};

export const startCleanupScheduler = (): void => {
  // Nettoyage automatique toutes les minutes
  cron.schedule('* * * * *', async () => {
    await cleanupExpiredInvitations();
  });

  // Nettoyage immédiat au démarrage du serveur
  void cleanupExpiredInvitations();

  console.log('✅ Scheduler de nettoyage démarré (chaque minute)');
};
