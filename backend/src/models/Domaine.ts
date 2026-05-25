export interface IDomaine {
  nom: string;
  dateExpiration: Date;
}

export class Domaine implements IDomaine {
  nom: string;

  dateExpiration: Date;

  constructor(data: IDomaine) {
    this.nom = data.nom;
    this.dateExpiration = data.dateExpiration;
  }
}

export default Domaine;
