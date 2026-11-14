(() => {
  const endpoint = 'https://script.google.com/macros/s/AKfycbzdu74B4A7SSOQ7yzxcDJq_3cValrHQbfJOjFZVwShdMS7j6lDlGkJpkrUtRX1ZvYHB3w/exec';
  const lookup = document.getElementById('invitation-form');
  const form = document.getElementById('rsvp-form');
  const thanks = document.getElementById('thank-you-message');
  let party = null;
  let pending = null;
  const toggle = document.querySelector('.nav-toggle');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Close menu' : 'Open menu');
    document.getElementById('primary-nav').classList.toggle('show', expanded);
  });
  function busy(activeForm, value) {
    activeForm.querySelectorAll('button, input, select, textarea').forEach(el => { el.disabled = value; });
    activeForm.querySelector('.submit-btn').classList.toggle('loading', value);
    activeForm.setAttribute('aria-busy', String(value));
  }
  function finish() {
    const request = pending;
    clearTimeout(request.timer);
    busy(request.activeForm, false);
    pending = null;
    return request;
  }
  async function send(action, values, activeForm, error) {
    if (pending) return;
    error.hidden = true;
    const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const controller = new AbortController();
    busy(activeForm, true);
    pending = {requestId, action, activeForm, error, timer: setTimeout(() => controller.abort(), 30000)};
    try {
      // A plain form-encoded POST avoids a cross-origin preflight.
      const response = await fetch(endpoint, {
        method: 'POST', body: new URLSearchParams({action, requestId, format: 'json', ...values}),
        credentials: 'omit', redirect: 'follow', signal: controller.signal
      });
      if (!response.ok) throw new Error('Request failed');
      const result = await response.json();
      if (result?.source !== 'laura-nathan-rsvp' || result.requestId !== requestId) throw new Error('Unexpected reply');
      handleResult(finish(), result);
    } catch {
      if (pending?.requestId === requestId) finish();
      error.textContent = action === 'lookup'
        ? 'We couldn’t reach the invitation list. Please try again or contact Laura or Nathan.'
        : 'We couldn’t confirm your RSVP. You can safely try again, or contact Laura or Nathan.';
      error.hidden = false;
    }
  }
  function reset() {
    party = null;
    form.reset(); lookup.reset();
    document.getElementById('party-members').replaceChildren();
    document.querySelectorAll('.form-error').forEach(el => { el.hidden = true; });
    thanks.hidden = true; form.hidden = true; lookup.hidden = false;
    document.getElementById('guest-name').focus();
  }
  function showParty(result) {
    party = result.party;
    const members = document.getElementById('party-members');
    members.replaceChildren();
    party.members.forEach((member, index) => {
      const card = document.createElement('div'); card.className = 'guest-card';
      const row = document.createElement('div'); row.className = 'form-row';
      const label = document.createElement('label'); label.htmlFor = `member-${index}`; label.textContent = member.name;
      const select = document.createElement('select'); select.id = label.htmlFor; select.name = member.id; select.required = true;
      for (const [value, text] of [['', 'Choose a response'], ['Yes', 'Yes, I’ll be there'], ['No', 'No, I can’t make it']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
      }
      select.value = member.attendance || '';
      row.append(label, select); card.append(row); members.append(card);
    });
    document.getElementById('message').value = party.message || '';
    lookup.hidden = true; form.hidden = false;
    document.getElementById('party-heading').focus();
  }
  lookup.addEventListener('submit', event => {
    event.preventDefault();
    send('lookup', {fullName: document.getElementById('guest-name').value.trim()}, lookup, document.getElementById('lookup-error'));
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!party || pending) return;
    const responses = party.members.map((member, index) => ({id: member.id, attendance: document.getElementById(`member-${index}`).value}));
    send('rsvp', {token: party.token, responses: JSON.stringify(responses), message: document.getElementById('message').value.trim()}, form, document.getElementById('form-error'));
  });
  document.getElementById('change-invitation').addEventListener('click', reset);
  function handleResult(request, result) {
    if (request.action === 'lookup' && result.status === 'found' && result.party?.members?.length) {
      showParty(result);
    } else if (result.status === 'duplicate' || (request.action === 'rsvp' && result.status === 'saved')) {
      lookup.hidden = true; form.hidden = true; thanks.hidden = false; thanks.replaceChildren();
      const title = document.createElement('h2'); title.textContent = result.status === 'duplicate' ? 'We already have your party’s RSVP.' : 'Thank you for your RSVP!';
      const note = document.createElement('p'); note.textContent = 'Your party’s response is on our list. If your plans change, please contact Laura or Nathan.';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-primary another-rsvp'; button.textContent = 'Back to invitation search'; button.addEventListener('click', reset);
      thanks.append(title, note, button); button.focus();
    } else {
      request.error.textContent = result.status === 'not_found'
        ? 'We couldn’t find that invitation. Please check your first and last name, try another person on your invitation, or contact Laura or Nathan.'
        : result.status === 'expired'
          ? 'Your invitation session expired. Please find your invitation again before submitting.'
          : 'We couldn’t complete that request. Please try again or contact Laura or Nathan.';
      if (result.detail) request.error.textContent += ' [' + result.detail + ']';
      request.error.hidden = false;
    }
  }
})();
