// https://css-tricks.com/lets-create-a-lightweight-native-event-bus-in-javascript/

import {io} from 'socket.io-client';
import {isFSA} from 'flux-standard-action';

import {API_HOST} from './config';

const socket = io(API_HOST);

socket.on('connect', () => {
  console.log('socket connection with server.');
});

console.log(socket.id)

const on = socket.on.bind(socket);
const off = socket.off.bind(socket);

function emitAction(eventName, action) {
  if (!isFSA(action)) {
    throw new Error(
      'Emitted actions must be Flux Standard Actions: https://github.com/redux-utilities/flux-standard-action',
    );
  }

  socket.emit(eventName, action);
}

export default {
  socketId: socket.id,
  on,
  off,
  emitAction,
};
