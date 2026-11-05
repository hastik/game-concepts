import { createGame } from './game.js';
import { loadFormation } from './formations.js';
import { createFormationEditor } from './formationEditor.js';
import { bindTuners } from './tuners.js';

bindTuners();

const canvas = document.getElementById('game');
const editorCanvas = document.getElementById('formation-editor');
const game = createGame(canvas);

const editor = createFormationEditor(editorCanvas, loadFormation(), (formation) => {
  game.setFormation(formation);
});

document.getElementById('nav-play')?.addEventListener('click', () => {
  game.startMatch();
  game.setScreen('play');
});
document.getElementById('nav-test')?.addEventListener('click', () => {
  game.setScreen('test');
});
document.getElementById('nav-settings')?.addEventListener('click', () => {
  game.setScreen('settings');
  editor.setFormation(loadFormation());
});
document.getElementById('test-solo')?.addEventListener('click', () => {
  game.startSolo();
  game.setScreen('play');
});
document.getElementById('test-double')?.addEventListener('click', () => {
  game.startDouble();
  game.setScreen('play');
});
document.getElementById('test-triple')?.addEventListener('click', () => {
  game.startTriple();
  game.setScreen('play');
});
document.getElementById('test-single')?.addEventListener('click', () => {
  game.startSingle();
  game.setScreen('play');
});

const FIXED_DT = 1 / 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += raw;
  while (acc >= FIXED_DT) {
    game.update(FIXED_DT);
    acc -= FIXED_DT;
  }
  game.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
