import type { Category, CreateSnippet } from '@snippet/contracts';

export const categoryNames: Record<Category, string> = {
  GIT: 'Git',
  DOCKER: 'Docker',
  SQL: 'SQL',
  JAVASCRIPT: 'JavaScript',
  TYPESCRIPT: 'TypeScript',
  OTHER: 'Sonstiges',
};
export const templates: CreateSnippet[] = [
  {
    title: 'Git-Status kompakt anzeigen',
    content: 'git status --short --branch',
    category: 'GIT',
    labels: ['terminal', 'git-repository'],
    favorite: false,
  },
  {
    title: 'Laufende Container auflisten',
    content: 'docker ps',
    category: 'DOCKER',
    labels: ['terminal', 'docker-engine'],
    favorite: false,
  },
  {
    title: 'Aktuelle Datenbank anzeigen',
    content: 'SELECT current_database();',
    category: 'SQL',
    labels: ['postgresql', 'sql-editor'],
    favorite: false,
  },
  {
    title: 'Aktuelle URL anzeigen',
    content: 'console.log(window.location.href);',
    category: 'JAVASCRIPT',
    labels: ['browser-konsole'],
    favorite: false,
  },
];
