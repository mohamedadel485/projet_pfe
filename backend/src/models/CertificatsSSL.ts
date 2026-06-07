export interface ICertificatsSSL {
  domaine: string;
  dateExpiration: Date;
  statut: string;
}

export class CertificatsSSL implements ICertificatsSSL {
  domaine: string;

  dateExpiration: Date;

  statut: string;

  constructor(data: ICertificatsSSL) {
    this.domaine = data.domaine;
    this.dateExpiration = data.dateExpiration;
    this.statut = data.statut;
  }
}

export default CertificatsSSL;
