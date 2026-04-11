import type { ReactElement } from 'react';
import { Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import Box from '@mui/material/Box';
import { Agentation } from 'agentation';
import App from './App.tsx';
import HomePage from './pages/HomePage.tsx';
import ScaleDemoPage from './pages/ScaleDemoPage.tsx';

function RootLayout(): ReactElement {
  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <Outlet />
      {import.meta.env.DEV ? <Agentation /> : null}
    </Box>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const exerciseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'exercise',
  component: App,
});

const demoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'demo',
  component: ScaleDemoPage,
});

const routeTree = rootRoute.addChildren([homeRoute, exerciseRoute, demoRoute]);

export const router = createRouter({
  routeTree,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
