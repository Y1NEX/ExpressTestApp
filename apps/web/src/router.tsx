import {
  createBrowserRouter,
  redirect,
  type LoaderFunctionArgs,
} from 'react-router-dom';
import { currentUser } from './auth/api';
import {
  LoadingPage,
  NotFoundPage,
  RouteErrorPage,
} from './components/StatusPage';

async function requireUser({ request }: LoaderFunctionArgs) {
  const user = await currentUser(request.signal);
  if (!user) throw redirect('/login');
  return user;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    HydrateFallback: LoadingPage,
    loader: async ({ request }) => {
      if (await currentUser(request.signal)) throw redirect('/');
      return null;
    },
    lazy: async () => ({
      Component: (await import('./pages/LoginPage')).LoginPage,
    }),
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/',
    HydrateFallback: LoadingPage,
    loader: requireUser,
    lazy: async () => ({
      Component: (await import('./pages/HomePage')).HomePage,
    }),
    errorElement: <RouteErrorPage />,
  },
  {
    path: '*',
    HydrateFallback: LoadingPage,
    loader: requireUser,
    element: <NotFoundPage />,
    errorElement: <RouteErrorPage />,
  },
]);
