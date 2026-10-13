// Charge le moteur de devis pour assets/js/site.js. site.js est un script classique et n'utilise pas import(),
// pour rester lisible par les navigateurs anciens : sans ce fichier, le reste du site (menu, John…) fonctionne quand même.
import * as devis from './devis-pdf.js';
window.smiltDevis = devis;
document.dispatchEvent(new Event('smilt-devis'));
