import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ReferenceForm } from '@/components/job-application/ReferenceForm';
import { CompanyProvider } from '@/contexts/CompanyContext';
import { Card } from '@/components/ui/card';

export default function Reference() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get('token');

  useEffect(() => {
    const title = 'Job Reference | Provide Reference';
    const desc = 'Secure reference submission for job applicants.';
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);

    const canonicalHref = `${window.location.origin}/reference`;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalHref);
  }, [location.search]);

  return (
    <CompanyProvider>
      <div className="min-h-screen bg-background">
        {/* Decorative background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-muted/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-muted/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <header className="mb-4 sm:mb-6 text-center animate-fade-in">
            <div className="inline-block bg-gradient-primary p-0.5 rounded-xl mb-2">
              <div className="bg-background px-4 py-2 rounded-lg">
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Provide a Job Reference
                </h1>
              </div>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl mx-auto">
              Your reference helps us make informed decisions.
            </p>
          </header>

          <main className="animate-slide-up">
            {token ? (
              <ReferenceForm token={token} />
            ) : (
              <Card className="card-premium text-center py-12 px-6">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-destructive-soft rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">🔒</span>
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Invalid Reference Link</h2>
                  <p className="text-muted-foreground">
                    Your secure reference link is missing or invalid. Please use the link provided in your email.
                  </p>
                </div>
              </Card>
            )}
          </main>
        </div>
      </div>
    </CompanyProvider>
  );
}
