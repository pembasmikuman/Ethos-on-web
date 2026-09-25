import type { ComponentType } from 'react';
import Home from './screens/Home';
import Welcome from './screens/Welcome';
import Settings from './screens/Settings';

export const ROUTES: [string, ComponentType][] = [
  ['/', Home],
  ['/welcome', Welcome],
  ['/settings', Settings],
];
