import { FloatingWhatsApp } from '@/components/FloatingWhatsApp';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-area">
      <div className="aurora" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Navbar />
      <main>{children}</main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}
