import { notFound } from 'next/navigation';

// Any unknown URL lands here so the branded (localized) 404 page is rendered.
export default function CatchAll() {
  notFound();
}
