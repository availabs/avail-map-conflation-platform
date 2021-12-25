import EventEmitter from 'events'

import {Server as SocketIOServer} from 'socket.io';
import {isFSA} from 'flux-standard-action';

const actionEmitter = new EventEmitter()

let socketServer: SocketIOServer | null = null;

// @ts-ignore
export type EventBusActionHandler = (...args: any[]) => void;

function injectSocketServer(socketSrvr: SocketIOServer) {
  socketServer = socketSrvr;
}

function on(eventName: string, listener: EventBusActionHandler) {
  if (socketServer === null) {
    throw new Error('EventBus socket server not yet injected.');
  }

  actionEmitter.on(eventName, listener)
}

function off(eventName: string, listener: EventBusActionHandler) {
  if (socketServer === null) {
    throw new Error('EventBus socket server not yet injected.');
  }

  actionEmitter.off(eventName, listener);
}

function emitAction(eventName: string, action: any) {
  if (socketServer === null) {
    throw new Error('EventBus socket server not yet injected.');
  }

  if (!isFSA(action)) {
    throw new Error(
      'Emitted actions must be Flux Standard Actions: https://github.com/redux-utilities/flux-standard-action',
    );
  }

  actionEmitter.emit(eventName, action)
  socketServer.emit(eventName, action);
}

export default {
  injectSocketServer,
  on,
  off,
  emitAction,
};
