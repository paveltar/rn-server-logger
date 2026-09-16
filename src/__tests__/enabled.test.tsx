// Runs in its own module registry, so the store starts disabled here: nothing before attach.
import React from 'react';
import axios from 'axios';
import { Modal } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { attach } from '../attach';
import { print } from '../print';
import { ServerLogger } from '../ServerLogger';
import { add, getEntries, isEnabled, isTracking, nextId, subscribe } from '../store';

// The factory runs the first time react-native-shake is required, so it records whether it was loaded
const mockShakeLoads = jest.fn();
jest.mock('react-native-shake', () => {
  mockShakeLoads();
  return jest.requireActual('../../__mocks__/react-native-shake');
});

test('nothing is recorded, the viewer renders nothing and react-native-shake is not loaded until attach', async () => {
  expect(isEnabled()).toBe(false);
  expect(isTracking()).toBe(true);
  expect(print('early')).toBe('early');
  add({ id: nextId(), kind: 'print', startedAt: Date.now(), text: 'direct' });
  expect(getEntries()).toEqual([]);

  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<ServerLogger />); });
  expect(renderer.toJSON()).toBeNull();
  expect(mockShakeLoads).not.toHaveBeenCalled();

  const listener = jest.fn();
  subscribe(listener);
  const api = axios.create();
  await act(async () => { attach(api); });
  expect(isEnabled()).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);
  attach(api); // a second attach does not notify again
  expect(listener).toHaveBeenCalledTimes(1);

  expect(mockShakeLoads).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
  const { shake } = jest.requireMock('react-native-shake') as { shake: () => void };
  await act(async () => shake());
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  print('late');
  expect(getEntries()).toHaveLength(1);
  await act(async () => renderer.unmount());
});
