import type { ComponentType } from 'react';
import Home from './screens/Home';
import Welcome from './screens/Welcome';
import Settings from './screens/Settings';
import Exercises from './screens/Exercises';
import NewExercise from './screens/NewExercise';
import ExerciseDetail from './screens/ExerciseDetail';
import Routines from './screens/Routines';
import Pick from './screens/Pick';
import RoutineDetail from './screens/RoutineDetail';

export const ROUTES: [string, ComponentType][] = [
  ['/', Home],
  ['/welcome', Welcome],
  ['/settings', Settings],
  ['/exercises', Exercises],
  ['/exercise/new', NewExercise],
  ['/exercise/:id', ExerciseDetail],
  ['/routines', Routines],
  ['/routines/pick', Pick],
  ['/routines/:id', RoutineDetail],
];
