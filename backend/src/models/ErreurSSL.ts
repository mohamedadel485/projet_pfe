export interface IErreurSSL {
  typeErreur: string;
  description: string;
  dateErreur: Date;
}

export class ErreurSSL implements IErreurSSL {
  typeErreur: string;

  description: string;

  dateErreur: Date;

  constructor(data: IErreurSSL) {
    this.typeErreur = data.typeErreur;
    this.description = data.description;
    this.dateErreur = data.dateErreur;
  }
}

export default ErreurSSL;
