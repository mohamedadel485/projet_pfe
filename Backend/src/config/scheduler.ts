import cron from 'node-cron';
import monitorService from '../services/monitorService';

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
 * Optionnel: Tâche de nettoyage des anciennes invitations expirées
 */
export const startCleanupScheduler = (): void => {
  // Nettoyer les invitations expirées tous les jours à minuit
  cron.schedule('0 0 * * *', async () => {
    try {
      const Invitation = (await import('../models/Invitation')).default;
      
      const result = await Invitation.deleteMany({
        status: 'pending',
        expiresAt: { $lt: new Date() },
      });

      console.log(`🧹 Nettoyage: ${result.deletedCount} invitations expirées supprimées`);
    } catch (error) {
      console.error('Erreur lors du nettoyage des invitations:', error);
    }
  });

  console.log('✅ Scheduler de nettoyage démarré');
};
