import { useEffect } from 'react';

/** Sets the browser tab title: "<title> · FileAI". */
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · FileAI` : 'FileAI · Organize smarter with AI';
  }, [title]);
}
