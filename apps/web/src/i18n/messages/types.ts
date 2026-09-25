import type { AdminMessages } from './admin';
import type { PublicMessages } from './en';

/** Everything a component may read: the public texts (en/pt/es) plus the Portuguese-only admin texts. */
export type Messages = PublicMessages & AdminMessages;
