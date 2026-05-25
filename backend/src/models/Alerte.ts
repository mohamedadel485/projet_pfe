import emailService from "../services/emailService";

export interface IAlerte {
  id?: string;
  type: string;
  message: string;
  date?: Date;
}

export class Alerte implements IAlerte {
  id: string;

  type: string;

  message: string;

  date: Date;

  constructor(data: IAlerte) {
    this.id =
      data.id ??
      `alerte-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.type = data.type;
    this.message = data.message;
    this.date = data.date ?? new Date();
  }

  async envoyer(
    destinataire: string,
    contexte?: {
      monitorName?: string;
      url?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    const monitorName = contexte?.monitorName ?? this.message;
    const url = contexte?.url ?? "";
    const errorMessage = contexte?.errorMessage ?? this.message;
    await emailService.sendMonitorAlert(
      destinataire,
      monitorName,
      url,
      errorMessage,
    );
  }
}

export default Alerte;
