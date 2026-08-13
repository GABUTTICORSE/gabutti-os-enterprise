const chile = require('./chile');

function getRegion(code) {
  return chile.regions.find(r => r.code === String(code)) || null;
}

function getProvince(code) {
  return chile.provinces.find(p => p.code === String(code)) || null;
}

function getCommune(code) {
  return chile.communes.find(c => c.code === String(code)) || null;
}

module.exports = {
  getRegion,
  getProvince,
  getCommune,
};