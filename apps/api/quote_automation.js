function daysSince(dateValue){
  const date = new Date(dateValue);

  if(Number.isNaN(date.getTime())){
    return 0;
  }

  const now = new Date();
  const difference = now.getTime() - date.getTime();

  return Math.floor(
    difference / (1000 * 60 * 60 * 24)
  );
}

function taskAlreadyExists(db, quoteId, automationCode){
  return (db.tasks || []).some(task =>
    task.quoteId === quoteId &&
    task.automationCode === automationCode
  );
}

function historyAlreadyExists(db, quoteId, automationCode){
  return (db.history || []).some(history =>
    history.quoteId === quoteId &&
    history.automationCode === automationCode
  );
}

function runQuoteAutomations(db, helpers = {}){
  let changed = false;
  const uid = helpers.uid;

  if(typeof uid !== 'function'){
    throw new Error(
      'runQuoteAutomations necesita la función uid.'
    );
  }

  db.quotes = db.quotes || [];
  db.tasks = db.tasks || [];
  db.history = db.history || [];

  for(const quote of db.quotes){
    const inactiveStatuses = [
      'Borrador',
      'Aceptada',
      'Rechazada',
      'Sin respuesta'
    ];

    if(inactiveStatuses.includes(quote.status)){
      continue;
    }

    const trackingDate = quote.sentAt || quote.createdAt;
    const ageInDays = daysSince(trackingDate);

    if(ageInDays < 3 && quote.status !== 'Enviada'){
      quote.status = 'Enviada';
      changed = true;
    }

    if(ageInDays >= 3 && ageInDays < 10){
      if(quote.status !== 'Esperando respuesta'){
        quote.status = 'Esperando respuesta';
        changed = true;
      }

      if(
        !taskAlreadyExists(
          db,
          quote.id,
          'QUOTE_FOLLOWUP_DAY_3'
        )
      ){
        db.tasks.unshift({
          id: uid('tsk'),
          createdAt: new Date().toISOString(),
          title:
            `Primer seguimiento cotización ${quote.number || quote.id}`,
          type: 'Seguimiento Cotización',
          owner: quote.owner || 'Ventas',
          dueDate: new Date().toISOString().slice(0, 10),
          status: 'Pendiente',
          quoteId: quote.id,
          clientId: quote.clientId || '',
          clientName: quote.clientName || '',
          automationCode: 'QUOTE_FOLLOWUP_DAY_3'
        });

        changed = true;
      }
    }

    if(
      ageInDays >= 5 &&
      ageInDays < 10 &&
      !taskAlreadyExists(
        db,
        quote.id,
        'QUOTE_FOLLOWUP_DAY_5'
      )
    ){
      db.tasks.unshift({
        id: uid('tsk'),
        createdAt: new Date().toISOString(),
        title:
          `Segundo seguimiento cotización ${quote.number || quote.id}`,
        type: 'Seguimiento Cotización',
        owner: quote.owner || 'Ventas',
        dueDate: new Date().toISOString().slice(0, 10),
        status: 'Pendiente',
        quoteId: quote.id,
        clientId: quote.clientId || '',
        clientName: quote.clientName || '',
        automationCode: 'QUOTE_FOLLOWUP_DAY_5'
      });

      changed = true;
    }

    if(ageInDays >= 10){
      if(quote.status !== 'Sin respuesta'){
        quote.status = 'Sin respuesta';
        changed = true;
      }

      if(!quote.noResponseAt){
        quote.noResponseAt = new Date().toISOString();
        changed = true;
      }

      for(const task of db.tasks){
        const isQuoteFollowUp =
          task.quoteId === quote.id &&
          task.type === 'Seguimiento Cotización' &&
          task.status !== 'Hecha';

        if(isQuoteFollowUp){
          task.status = 'Hecha';
          task.completedAt = new Date().toISOString();
          changed = true;
        }
      }

      if(
        !historyAlreadyExists(
          db,
          quote.id,
          'QUOTE_NO_RESPONSE_DAY_10'
        )
      ){
        db.history.unshift({
          id: uid('his'),
          createdAt: new Date().toISOString(),
          type: 'Cotización',
          title: 'Cotización sin respuesta',
          description:
            `${quote.number || quote.id} quedó sin respuesta después de 10 días.`,
          quoteId: quote.id,
          processId: quote.processId || '',
          clientId: quote.clientId || '',
          clientName: quote.clientName || '',
          sourceId: quote.id,
          automationCode: 'QUOTE_NO_RESPONSE_DAY_10'
        });

        changed = true;
      }
    }
  }

  return changed;
}

module.exports = {
  runQuoteAutomations
};
