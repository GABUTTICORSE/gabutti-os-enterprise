const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const sourceFile = path.join(
  __dirname,
  '..',
  'sources',
  'chile',
  'CUT_2018_v04.xls'
);

const regionsFile = path.join(__dirname, 'regions.json');
const provincesFile = path.join(__dirname, 'provinces.json');
const communesFile = path.join(__dirname, 'communes.json');

const workbook = XLSX.readFile(sourceFile);
const sheet = workbook.Sheets['Sheet 1'];

if (!sheet) {
  throw new Error('No se encontró la hoja "Sheet 1" en el archivo Excel.');
}

const rows = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  defval: '',
});

const dataRows = rows.slice(1);

const regionsMap = new Map();
const provincesMap = new Map();
const communesMap = new Map();

for (const row of dataRows) {
  const regionCode = String(row[0] || '').trim();
  const regionName = String(row[1] || '').trim();
  const regionAbbr = String(row[2] || '').trim();

  const provinceCode = String(row[3] || '').trim();
  const provinceName = String(row[4] || '').trim();

  const communeCode = String(row[5] || '').trim();
  const communeName = String(row[6] || '').trim();

  if (
    !regionCode ||
    !regionName ||
    !provinceCode ||
    !provinceName ||
    !communeCode ||
    !communeName
  ) {
    continue;
  }

  if (!regionsMap.has(regionCode)) {
    regionsMap.set(regionCode, {
      code: regionCode,
      name: regionName,
      abbreviation: regionAbbr,
    });
  }

  if (!provincesMap.has(provinceCode)) {
    provincesMap.set(provinceCode, {
      code: provinceCode,
      name: provinceName,
      regionCode,
      region: regionName,
    });
  }

  if (!communesMap.has(communeCode)) {
    communesMap.set(communeCode, {
      code: communeCode,
      name: communeName,
      provinceCode,
      province: provinceName,
      regionCode,
      region: regionName,
    });
  }
}

const sortByCode = (a, b) => a.code.localeCompare(b.code);

const regions = Array.from(regionsMap.values()).sort(sortByCode);
const provinces = Array.from(provincesMap.values()).sort(sortByCode);
const communes = Array.from(communesMap.values()).sort(sortByCode);

fs.writeFileSync(regionsFile, JSON.stringify(regions, null, 2) + '\n');
fs.writeFileSync(provincesFile, JSON.stringify(provinces, null, 2) + '\n');
fs.writeFileSync(communesFile, JSON.stringify(communes, null, 2) + '\n');

console.log('Catálogos generados correctamente.');
console.log(`Regiones: ${regions.length}`);
console.log(`Provincias: ${provinces.length}`);
console.log(`Comunas: ${communes.length}`);
