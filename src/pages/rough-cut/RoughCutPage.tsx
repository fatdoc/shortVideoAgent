import {
  GrowthLeadsPage,
  PublishDistributionPage,
  StoreEditingPage,
} from '../store/StoreExperiencePages';

interface RoughCutPageProps {
  view?: 'all' | 'assets' | 'export' | 'inbox' | 'tasks';
}

export function RoughCutPage({ view = 'all' }: RoughCutPageProps) {
  if (view === 'assets') return <GrowthLeadsPage />;
  if (view === 'export') return <PublishDistributionPage />;
  return <StoreEditingPage />;
}
