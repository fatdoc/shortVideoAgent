import { AppProviders } from './Providers';
import { AppRouter } from './Router';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  );
}
