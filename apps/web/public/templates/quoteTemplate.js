console.log('QUOTE TEMPLATE CARGADO');

const GABUTTI_BRAND = {
  name: 'GABUTTI CORSE',
  slogan: 'Equipamiento profesional para automovilismo',
  description: 'Representación oficial de marcas internacionales',
  primaryColor: '#b00000',
  darkColor: '#111111',
  lightColor: '#f4f4f4',
  website: 'www.gabutticorse.cl',
  email: 'contacto@gabutticorse.cl',
  city: 'Viña del Mar · Chile'
};

function escapeQuoteHtml(value){
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;
        )