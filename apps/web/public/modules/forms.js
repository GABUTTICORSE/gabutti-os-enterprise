console.log('FORMS.JS CARGADO - VERSION NUEVA');

let editingId = null;
let formDefaults = {};

function openForm(collection, id = null, defaults = {}) {
  currentCollection = collection;
  editingId = id;
  formDefaults = { ...defaults };

  const schema = schemas[collection];

  if (!schema) {
    alert('No existe configuración para este formulario.');
    return;
  }

  modalTitle.textContent = editingId
    ? `Editar ${schema.title}`
    : schema.title;

  fields.innerHTML = schema.fields.map(([key, label, type, options]) => {
    if (type === 'select') {
      return `
        <div class="field">
          <label for="field-${key}">${label}</label>

          <select id="field-${key}" name="${key}">
            ${(options || []).map(option => `
              <option value="${option}">
                ${option}
              </option>
            `).join('')}
          </select>
        </div>
      `;
    }

    return `
      <div class="field">
        <label for="field-${key}">${label}</label>

        <input
          id="field-${key}"
          name="${key}"
          type="${type}"
        >
      </div>
    `;
  }).join('');

  recordForm.reset();

  /*
   * Valores recibidos desde otra pantalla.
   * Ejemplo:
   * clientId y clientName desde la ficha del cliente.
   */
  Object.entries(formDefaults).forEach(([key, value]) => {
  const input = recordForm.elements[key];

  if (!input) return;

  input.value = value ?? '';

  // Bloquear los datos que vienen heredados
  if (key === 'clientName') {
    input.readOnly = true;
    input.style.background = '#f3f3f3';
  }
});
  /*
   * Si estamos editando, cargamos los datos existentes.
   * Los datos existentes tienen prioridad sobre los defaults.
   */
  if (editingId) {
    const item = (state[collection] || []).find(
      record => record.id === editingId
    );

    if (!item) {
      alert('No se encontró el registro que intentas editar.');
      editingId = null;
      formDefaults = {};
      return;
    }

    schema.fields.forEach(([key]) => {
      const input = recordForm.elements[key];

      if (input) {
        input.value = item[key] ?? '';
      }
    });
  }

  modal.showModal();
}

function closeForm() {
  editingId = null;
  formDefaults = {};
  recordForm.reset();
  modal.close();
}

recordForm.onsubmit = async event => {
  event.preventDefault();

  const savedCollection = currentCollection;
  const savedEditingId = editingId;

  const formData = Object.fromEntries(
    new FormData(event.target).entries()
  );

  /*
   * Los defaults se guardan aunque no tengan un campo visible.
   * Así podemos guardar clientId junto con clientName.
   */
  const data = {
    ...formDefaults,
    ...formData
  };

  const url = savedEditingId
    ? `/api/${savedCollection}/${savedEditingId}`
    : `/api/${savedCollection}`;

  const method = savedEditingId ? 'PUT' : 'POST';

  const result = await api(url, {
    method,
    body: JSON.stringify(data)
  });

  if (result?.error) {
    alert(result.error);
    return;
  }

  closeForm();
  await loadAll();

  if (
    savedCollection === 'commercial_processes' &&
    !savedEditingId
  ) {
    activateView('commercial_processes');

    if (
      result?.id &&
      typeof showCommercialProcess === 'function'
    ) {
      showCommercialProcess(result.id);
    }

    return;
  }

  if (
    savedCollection === 'clients' &&
    savedEditingId &&
    typeof showClientProfile === 'function'
  ) {
    showClientProfile(savedEditingId);
  }

  if (savedCollection === 'inbox') {
    activateView('commercial_processes');
  }
};