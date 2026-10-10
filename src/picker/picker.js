'use strict';

const shareButton = document.getElementById('share');
let selected = null;

function select(card, id) {
  for (const c of document.querySelectorAll('.card.selected')) c.classList.remove('selected');
  card.classList.add('selected');
  selected = id;
  shareButton.disabled = false;
}

function makeCard(source) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.title = source.name;
  const img = document.createElement('img');
  img.src = source.thumbnail;
  img.alt = '';
  const label = document.createElement('span');
  label.textContent = source.name;
  card.append(img, label);
  card.addEventListener('click', () => select(card, source.id));
  card.addEventListener('dblclick', () => window.picker.choose(source.id));
  return card;
}

window.picker.sources().then((sources) => {
  for (const source of sources) {
    document.getElementById(source.kind === 'screen' ? 'screens' : 'windows').append(makeCard(source));
  }
  for (const section of document.querySelectorAll('section')) {
    section.hidden = !section.querySelector('.card');
  }
  const first = document.querySelector('.card');
  if (first) first.focus();
});

shareButton.addEventListener('click', () => {
  if (selected) window.picker.choose(selected);
});
document.getElementById('cancel').addEventListener('click', () => window.picker.choose(null));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.picker.choose(null);
});
