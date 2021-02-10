import loadMicroLevel from './loadMicroLevel';
import loadMesoLevel from './loadMesoLevel';

export default function loadTargetMap() {
  loadMicroLevel();
  loadMesoLevel();
}
