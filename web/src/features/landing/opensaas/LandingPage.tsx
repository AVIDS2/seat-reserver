import type { PlatformUser } from '@/features/booking/api/service';

import { Admin, Auth, Automation, Runs, Strategy } from './components/Examples';
import { Announcement } from './components/Announcement';
import { Clients } from './components/Clients';
import { CampusStories } from './components/CampusStories';
import { ExamplesCarousel } from './components/ExamplesCarousel';
import { FAQ } from './components/FAQ';
import { FeaturesGrid } from './components/FeaturesGrid';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { OpenSaasNavBar } from './components/OpenSaasNavBar';
import { Roadmap } from './components/Roadmap';
import { SchemaMarkup } from './components/SchemaMarkup';
import { Testimonials } from './components/Testimonials';
import { examples, faqs, features, footerNavigation, testimonials } from './contentSections';

export function LandingPage({ user }: { user: PlatformUser | null }) {
  return (
    <div className='bg-background text-foreground'>
      <SchemaMarkup />
      <Announcement />
      <OpenSaasNavBar user={user} />
      <main className='isolate'>
        <Hero user={user} />
        <Clients />
        <CampusStories />
        <ExamplesCarousel examples={examples} />
        <Automation />
        <Auth />
        <Strategy />
        <Admin />
        <Runs />
        <FeaturesGrid features={features} />
        <Roadmap />
        <Testimonials testimonials={testimonials} />
        <FAQ faqs={faqs} />
      </main>
      <Footer footerNavigation={footerNavigation} />
    </div>
  );
}
