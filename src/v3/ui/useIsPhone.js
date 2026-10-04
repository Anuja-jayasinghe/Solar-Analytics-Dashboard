import { useEffect, useState } from 'react';

/** True at phone width. Matches the CSS breakpoint (max-width: 700px) so layout choices in JS and CSS agree. */
export function useIsPhone() {
  const query = '(max-width: 700px)';
  const [phone, setPhone] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}
