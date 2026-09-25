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
import Session from './screens/Session';
import Workout from './screens/Workout';
import Rest from './screens/Rest';
import History from './screens/History';
import HistoryDetail from './screens/HistoryDetail';

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
  ['/session', Session],
  ['/workout', Workout],
  ['/rest', Rest],
  ['/history', History],
  ['/history/:id', HistoryDetail],
];
