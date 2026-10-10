import PDFDocument from 'pdfkit';

export interface DonneesFacture {
  facture: { numero: string; total: number; avance: number; reste: number; date: string };
  atelier: { nom: string; telephone?: string | null; adresse?: string | null };
  client: { nom: string; prenom: string; telephone_e164?: string | null };
  commande: { code: string; date_rdv?: string | null };
  habits: { code: string; type: string; modele?: string | null }[];
  paiements: { date: string; montant: number; mode: string }[];
}

// Format FCFA avec espaces simples (les espaces fines de Intl ne sont pas dans la police PDF standard).
export const fcfa = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

const MODES: Record<string, string> = {
  especes: 'Espèces', mobile_money: 'Mobile money', virement: 'Virement', autre: 'Autre',
};

const dateFr = (iso: string, avecHeure = false) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Bamako', day: '2-digit', month: '2-digit', year: 'numeric',
    ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso));

export function genererPdfFacture(d: DonneesFacture, logo?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Facture ${d.facture.numero}` } });
    const morceaux: Buffer[] = [];
    doc.on('data', (c: Buffer) => morceaux.push(c));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);

    const gauche = 48;
    const droite = doc.page.width - 48;
    let y = 48;

    if (logo) {
      try { doc.image(logo, gauche, y, { fit: [70, 70] }); } catch { /* logo illisible : on continue sans */ }
    }
    const xTexte = logo ? gauche + 84 : gauche;
    doc.fillColor('#1d2a4a').font('Helvetica-Bold').fontSize(18).text(d.atelier.nom, xTexte, y, { width: 280 });
    doc.font('Helvetica').fontSize(9).fillColor('#444');
    if (d.atelier.telephone) doc.text(`Tél. : ${d.atelier.telephone}`, xTexte, doc.y + 2, { width: 280 });
    if (d.atelier.adresse) doc.text(d.atelier.adresse, xTexte, doc.y + 1, { width: 280 });

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#1d2a4a').text('FACTURE', 330, y, { width: droite - 330, align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor('#222')
      .text(`N° ${d.facture.numero}`, 330, y + 26, { width: droite - 330, align: 'right' })
      .text(`Date : ${dateFr(d.facture.date, true)}`, 330, y + 40, { width: droite - 330, align: 'right' })
      .text(`Commande : ${d.commande.code}`, 330, y + 54, { width: droite - 330, align: 'right' });

    y = 140;
    doc.moveTo(gauche, y).lineTo(droite, y).strokeColor('#1d2a4a').lineWidth(1.2).stroke();
    y += 14;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1d2a4a').text('Client', gauche, y);
    doc.font('Helvetica').fontSize(11).fillColor('#222')
      .text(`${d.client.prenom} ${d.client.nom}`, gauche, y + 14);
    if (d.client.telephone_e164) doc.fontSize(10).text(d.client.telephone_e164, gauche, doc.y + 1);
    if (d.commande.date_rdv) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1d2a4a').text('Rendez-vous', 330, y, { width: droite - 330, align: 'right' });
      doc.font('Helvetica').fontSize(11).fillColor('#222').text(dateFr(d.commande.date_rdv + 'T12:00:00Z'), 330, y + 14, { width: droite - 330, align: 'right' });
    }

    y = Math.max(doc.y, y + 50) + 18;
    const enteteTableau = (titres: [string, number][]) => {
      doc.rect(gauche, y, droite - gauche, 20).fill('#e8ecf5');
      doc.fillColor('#1d2a4a').font('Helvetica-Bold').fontSize(9);
      for (const [t, x] of titres) doc.text(t, x, y + 6, { lineBreak: false });
      y += 24;
      doc.font('Helvetica').fillColor('#222').fontSize(10);
    };

    enteteTableau([['ID habit', gauche + 6], ['Vêtement', gauche + 110], ['Modèle', gauche + 300]]);
    for (const h of d.habits) {
      if (y > 720) { doc.addPage(); y = 48; }
      doc.text(h.code, gauche + 6, y, { lineBreak: false });
      doc.text(h.type, gauche + 110, y, { width: 180, lineBreak: false });
      doc.text(h.modele ?? '—', gauche + 300, y, { width: 190, lineBreak: false });
      y += 18;
    }

    y += 14;
    if (d.paiements.length > 0) {
      if (y > 650) { doc.addPage(); y = 48; }
      enteteTableau([['Paiement', gauche + 6], ['Mode', gauche + 200], ['Montant', gauche + 380]]);
      for (const p of d.paiements) {
        if (y > 720) { doc.addPage(); y = 48; }
        doc.text(dateFr(p.date, true), gauche + 6, y, { lineBreak: false });
        doc.text(MODES[p.mode] ?? p.mode, gauche + 200, y, { lineBreak: false });
        doc.text(fcfa(p.montant), gauche + 380, y, { lineBreak: false });
        y += 18;
      }
    }

    y += 16;
    if (y > 680) { doc.addPage(); y = 48; }
    const ligne = (label: string, valeur: string, gras = false) => {
      doc.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(gras ? 13 : 11).fillColor(gras ? '#1d2a4a' : '#222');
      doc.text(label, 300, y, { width: 130, lineBreak: false });
      doc.text(valeur, 420, y, { width: droite - 420, align: 'right', lineBreak: false });
      y += gras ? 24 : 18;
    };
    ligne('Montant total', fcfa(d.facture.total));
    ligne('Avance (déjà payé)', fcfa(d.facture.avance));
    ligne('Reste à payer', fcfa(d.facture.reste));
    doc.moveTo(300, y).lineTo(droite, y).strokeColor('#1d2a4a').lineWidth(0.8).stroke();
    y += 8;
    ligne('Net à payer', fcfa(d.facture.reste), true);

    doc.font('Helvetica').fontSize(8).fillColor('#777')
      .text('Document généré par COUTURE GESTION. Les montants sont en francs CFA (FCFA).', gauche, 790, { width: droite - gauche, align: 'center' });
    doc.end();
  });
}
