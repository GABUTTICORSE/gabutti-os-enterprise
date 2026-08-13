const {
  runQuoteAutomations
} = require('./quote_automation');

const {
  runInboxCreatedAutomation
} = require('./inbox_automation');

function runAutomations(db, helpers = {}){
  let changed = false;

  if(runQuoteAutomations(db, helpers)){
    changed = true;
  }

  return changed;
}

function runCreationAutomations(
  db,
  context = {},
  helpers = {}
){
  const {
    event,
    collection,
    item
  } = context;

  if(
    event === 'record.created' &&
    collection === 'inbox'
  ){
    return runInboxCreatedAutomation(
      db,
      item,
      helpers
    );
  }

  return {
    changed: false,
    item
  };
}

module.exports = {
  runAutomations,
  runCreationAutomations
};
